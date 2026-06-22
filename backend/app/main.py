from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import date, datetime, time, timedelta
from fastapi import Depends, FastAPI, HTTPException, Path, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select, or_
from .database import create_db_and_tables, get_session, engine
from .models import Cliente, Servicio, Cita, CitaServicio, Configuracion, EstadoCita, HorarioSemanal, ExcepcionHorario
from .schemas import ClienteCreate, ClienteRead, ServicioCreate, ServicioRead, ServicioUpdate, CitaCreate, CitaRead, CitaUpdate, CitaServicioRead, ConfiguracionRead, ConfiguracionUpdate, HorarioSemanalRead, HorarioSemanalUpdate, ExcepcionHorarioCreate, ExcepcionHorarioRead, EffectiveHoursResponse


def seed_default_config(session: Session) -> None:
    existing = session.get(Configuracion, 1)
    if not existing:
        session.add(Configuracion(id=1))
        session.commit()


def seed_default_schedule(session: Session) -> None:
    existing = session.exec(select(HorarioSemanal)).first()
    if existing:
        return
    defaults = [
        # (dia_semana, activo, apertura, cierre)
        (0, False, "09:00", "18:00"),  # Domingo
        (1, True, "09:00", "18:00"),   # Lunes
        (2, True, "09:00", "18:00"),   # Martes
        (3, True, "09:00", "18:00"),   # Miércoles
        (4, True, "09:00", "18:00"),   # Jueves
        (5, True, "09:00", "18:00"),   # Viernes
        (6, True, "09:00", "13:00"),   # Sábado
    ]
    for dia_semana, activo, apertura, cierre in defaults:
        session.add(HorarioSemanal(
            dia_semana=dia_semana,
            activo=activo,
            hora_apertura=apertura,
            hora_cierre=cierre,
        ))
    session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    create_db_and_tables()
    with Session(engine) as session:
        seed_default_config(session)
        seed_default_schedule(session)
    yield


app = FastAPI(
    title="Nails Studio Booking API",
    description="API inicial para gestionar servicios, clientas y citas de estudio de uñas.",
    version="0.1.0",
    lifespan=lifespan,
)

origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/config", response_model=ConfiguracionRead)
def get_config(session: Session = Depends(get_session)):
    config = session.get(Configuracion, 1)
    if not config:
        config = Configuracion(id=1)
        session.add(config)
        session.commit()
        session.refresh(config)
    return config


@app.put("/config", response_model=ConfiguracionRead)
def update_config(update: ConfiguracionUpdate, session: Session = Depends(get_session)):
    config = session.get(Configuracion, 1)
    if not config:
        config = Configuracion(id=1)
        session.add(config)
        session.commit()
        session.refresh(config)

    update_data = update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(config, key, value)

    session.add(config)
    session.commit()
    session.refresh(config)
    return config


@app.post("/clients", response_model=ClienteRead)
def create_client(client: ClienteCreate, session: Session = Depends(get_session)):
    db_client = Cliente.model_validate(client)
    session.add(db_client)
    session.commit()
    session.refresh(db_client)
    return db_client


@app.get("/clients", response_model=list[ClienteRead])
def list_clients(session: Session = Depends(get_session)):
    statement = select(Cliente)
    results = session.exec(statement).all()
    return results


@app.get("/clients/search", response_model=list[ClienteRead])
def search_clients(q: str = Query(min_length=0), session: Session = Depends(get_session)):
    if len(q) < 2:
        return []
    statement = select(Cliente).where(
        Cliente.nombre.ilike(f"%{q}%") |
        Cliente.apellido.ilike(f"%{q}%") |
        Cliente.telefono.ilike(f"%{q}%")
    ).limit(10)
    return session.exec(statement).all()


@app.post("/services", response_model=ServicioRead)
def create_service(service: ServicioCreate, session: Session = Depends(get_session)):
    db_service = Servicio.model_validate(service)
    session.add(db_service)
    session.commit()
    session.refresh(db_service)
    return db_service


@app.patch("/services/{service_id}", response_model=ServicioRead)
def update_service(service_id: int, service_update: ServicioUpdate, session: Session = Depends(get_session)):
    service = session.get(Servicio, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    update_data = service_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(service, key, value)

    session.add(service)
    session.commit()
    session.refresh(service)
    return service


@app.delete("/services/{service_id}")
def delete_service(service_id: int, session: Session = Depends(get_session)):
    service = session.get(Servicio, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    items = session.exec(select(CitaServicio).where(CitaServicio.servicio_id == service_id)).all()
    for item in items:
        session.delete(item)

    session.delete(service)
    session.commit()
    return {"ok": True}


@app.get("/services", response_model=list[ServicioRead])
def list_services(all: bool = False, session: Session = Depends(get_session)):
    statement = select(Servicio)
    if not all:
        statement = statement.where(Servicio.activo == True)
    results = session.exec(statement).all()
    return results


def calculate_duration_for_cita(cita: Cita, session: Session) -> int:
    items = session.exec(select(CitaServicio).where(CitaServicio.cita_id == cita.id)).all()
    return sum(item.duracion_minutos for item in items)


def appointment_overlaps(start_a: datetime, end_a: datetime, start_b: datetime, end_b: datetime) -> bool:
    return start_a < end_b and start_b < end_a


def find_conflicting_appointment(start: datetime, duration_minutes: int, session: Session, exclude_id: int | None = None) -> Cita | None:
    end = start + timedelta(minutes=duration_minutes)
    active_states = ["Pendiente", "Confirmado"]
    citas = session.exec(select(Cita).where(Cita.estado_cita.in_(active_states))).all()
    for cita in citas:
        if exclude_id is not None and cita.id == exclude_id:
            continue
        cita_end = cita.fecha_hora_cita + timedelta(minutes=calculate_duration_for_cita(cita, session))
        if appointment_overlaps(start, end, cita.fecha_hora_cita, cita_end):
            return cita
    return None


def build_cita_response(cita: Cita, session: Session) -> dict:
    items = session.exec(select(CitaServicio).where(CitaServicio.cita_id == cita.id)).all()
    servicios = []
    for item in items:
        servicio = session.get(Servicio, item.servicio_id)
        servicios.append({
            "servicio_id": item.servicio_id,
            "nombre_servicio": servicio.nombre_servicio if servicio else "Servicio no disponible",
            "duracion_minutos": item.duracion_minutos,
            "precio_unitario": item.precio_unitario,
            "subtotal": item.subtotal,
        })

    client = session.get(Cliente, cita.id_cliente)
    duration = sum(item.duracion_minutos for item in items)
    cita_data = cita.model_dump()
    cita_data["cliente_nombre"] = f"{client.nombre} {client.apellido}" if client else None
    cita_data["duracion_total_minutos"] = duration
    cita_data["servicios"] = servicios
    return cita_data


@app.post("/appointments", response_model=CitaRead)
def create_appointment(appointment: CitaCreate, session: Session = Depends(get_session)):
    client = session.get(Cliente, appointment.id_cliente)
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    appointment_duration = sum(item.duracion_minutos for item in appointment.servicios)
    conflict = find_conflicting_appointment(appointment.fecha_hora_cita, appointment_duration, session)
    if conflict:
        raise HTTPException(status_code=409, detail="El horario elegido ya está ocupado. Por favor elegí otra franja.")

    cita_kwargs = {
        "id_cliente": appointment.id_cliente,
        "fecha_hora_cita": appointment.fecha_hora_cita,
        "precio_historico_cobrado": appointment.precio_historico_cobrado,
        "sena_historica_pagada": appointment.sena_historica_pagada,
        "metodo_pago_sena": appointment.metodo_pago_sena,
    }
    if appointment.estado_cita is not None:
        cita_kwargs["estado_cita"] = appointment.estado_cita
    cita = Cita(**cita_kwargs)
    session.add(cita)
    session.commit()
    session.refresh(cita)

    for item in appointment.servicios:
        servicio = session.get(Servicio, item.servicio_id)
        if not servicio:
            raise HTTPException(status_code=404, detail=f"Servicio {item.servicio_id} no encontrado")
        service_item = CitaServicio(
            cita_id=cita.id,
            servicio_id=item.servicio_id,
            duracion_minutos=item.duracion_minutos,
            precio_unitario=item.precio_unitario,
            subtotal=item.subtotal,
        )
        session.add(service_item)

    client.cantidad_turnos_tomados += 1
    session.commit()
    session.refresh(cita)
    return build_cita_response(cita, session)


@app.get("/appointments", response_model=list[CitaRead])
def list_appointments(session: Session = Depends(get_session)):
    statement = select(Cita)
    citas = session.exec(statement).all()
    return [build_cita_response(cita, session) for cita in citas]


@app.patch("/appointments/{appointment_id}", response_model=CitaRead)
def update_appointment(appointment_id: int, appointment: CitaUpdate, session: Session = Depends(get_session)):
    cita = session.get(Cita, appointment_id)
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    update_data = appointment.model_dump(exclude_unset=True)

    if "monto_recibido_en_caja" in update_data and update_data["monto_recibido_en_caja"] is not None and update_data["monto_recibido_en_caja"] < 0:
        raise HTTPException(status_code=422, detail="monto_recibido_en_caja no puede ser negativo")

    # Handle servicios separately (use the original Pydantic model, not the dumped dict)
    if appointment.servicios is not None:
        servicios = appointment.servicios

        # Calculate new duration for conflict check
        new_duration = sum(s.duracion_minutos for s in servicios)

        # Check conflicts if date changed or services changed
        check_date = update_data.get("fecha_hora_cita", cita.fecha_hora_cita)
        conflict = find_conflicting_appointment(check_date, new_duration, session, exclude_id=appointment_id)
        if conflict:
            raise HTTPException(status_code=409, detail="El horario elegido ya está ocupado. Por favor elegí otra franja.")

        # Remove old services
        old_items = session.exec(select(CitaServicio).where(CitaServicio.cita_id == cita.id)).all()
        for item in old_items:
            session.delete(item)

        # Add new services
        for item in servicios:
            service_item = CitaServicio(
                cita_id=cita.id,
                servicio_id=item.servicio_id,
                duracion_minutos=item.duracion_minutos,
                precio_unitario=item.precio_unitario,
                subtotal=item.subtotal,
            )
            session.add(service_item)

        # Remove servicios from update_data so we don't try to setattr it later
        update_data.pop("servicios", None)
    else:
        # Conflict check if only changing date
        if "fecha_hora_cita" in update_data:
            current_duration = calculate_duration_for_cita(cita, session)
            conflict = find_conflicting_appointment(update_data["fecha_hora_cita"], current_duration, session, exclude_id=appointment_id)
            if conflict:
                raise HTTPException(status_code=409, detail="El horario elegido ya está ocupado. Por favor elegí otra franja.")

    # Estado change to asistido → increment client counter
    if "estado_cita" in update_data:
        cita.estado_cita = update_data["estado_cita"]
        del update_data["estado_cita"]
        if cita.estado_cita == EstadoCita.asistido:
            if "monto_recibido_en_caja" in update_data:
                cita.monto_recibido_en_caja = update_data["monto_recibido_en_caja"]
                del update_data["monto_recibido_en_caja"]
            cliente = session.get(Cliente, cita.id_cliente)
            if cliente:
                cliente.cantidad_turnos_abonados += 1

    # Apply remaining scalar fields
    for key, value in update_data.items():
        setattr(cita, key, value)

    session.add(cita)
    session.commit()
    session.refresh(cita)
    return build_cita_response(cita, session)


@app.delete("/appointments/{appointment_id}")
def delete_appointment(appointment_id: int, session: Session = Depends(get_session)):
    cita = session.get(Cita, appointment_id)
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    items = session.exec(select(CitaServicio).where(CitaServicio.cita_id == appointment_id)).all()
    for item in items:
        session.delete(item)

    session.delete(cita)
    session.commit()
    return {"ok": True}


@app.get("/busy_slots")
def get_busy_slots(date_str: str, session: Session = Depends(get_session)):
    try:
        target_date = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Usa YYYY-MM-DD.")

    start_of_day = datetime.combine(target_date, time.min)
    end_of_day = datetime.combine(target_date, time.max)

    active_states = ["Pendiente", "Confirmado"]
    citas = session.exec(select(Cita).where(Cita.estado_cita.in_(active_states))).all()
    busy_slots = []

    for cita in citas:
        duration = calculate_duration_for_cita(cita, session)
        cita_end = cita.fecha_hora_cita + timedelta(minutes=duration)
        if cita_end < start_of_day or cita.fecha_hora_cita > end_of_day:
            continue
        busy_slots.append({
            "cita_id": cita.id,
            "start": cita.fecha_hora_cita.isoformat(),
            "end": cita_end.isoformat(),
            "estado": cita.estado_cita,
        })

    return busy_slots


# ── Schedule Endpoints ─────────────────────────────────────────────────────


def _validate_hours(apertura: str, cierre: str) -> None:
    if apertura >= cierre:
        raise HTTPException(
            status_code=422,
            detail="hora_apertura debe ser menor que hora_cierre",
        )


def _python_weekday_to_schema(python_weekday: int) -> int:
    """Convert Python weekday (0=Mon..6=Sun) to schema dia_semana (0=Dom..6=Sab)."""
    return (python_weekday + 1) % 7


@app.get("/schedule/weekly", response_model=list[HorarioSemanalRead])
def get_weekly_schedule(session: Session = Depends(get_session)):
    statement = select(HorarioSemanal).order_by(HorarioSemanal.dia_semana)
    return session.exec(statement).all()


@app.put("/schedule/weekly", response_model=list[HorarioSemanalRead])
def update_weekly_schedule(
    schedule: list[HorarioSemanalUpdate],
    session: Session = Depends(get_session),
):
    for day in schedule:
        _validate_hours(day.hora_apertura, day.hora_cierre)
        existing = session.exec(
            select(HorarioSemanal).where(HorarioSemanal.dia_semana == day.dia_semana)
        ).first()
        if existing:
            existing.activo = day.activo
            existing.hora_apertura = day.hora_apertura
            existing.hora_cierre = day.hora_cierre
            session.add(existing)
        else:
            session.add(HorarioSemanal(
                dia_semana=day.dia_semana,
                activo=day.activo,
                hora_apertura=day.hora_apertura,
                hora_cierre=day.hora_cierre,
            ))
    session.commit()
    statement = select(HorarioSemanal).order_by(HorarioSemanal.dia_semana)
    return session.exec(statement).all()


@app.get("/schedule/exceptions", response_model=list[ExcepcionHorarioRead])
def get_exceptions(session: Session = Depends(get_session)):
    statement = select(ExcepcionHorario).order_by(ExcepcionHorario.fecha.desc())
    return session.exec(statement).all()


@app.post("/schedule/exceptions", response_model=ExcepcionHorarioRead)
def create_exception(
    payload: ExcepcionHorarioCreate,
    session: Session = Depends(get_session),
):
    # Validate hours when not cerrado
    if not payload.cerrado:
        if not payload.hora_apertura or not payload.hora_cierre:
            raise HTTPException(
                status_code=422,
                detail="hora_apertura y hora_cierre son requeridos cuando cerrado=false",
            )
        _validate_hours(payload.hora_apertura, payload.hora_cierre)

    # Check for duplicate fecha
    existing = session.exec(
        select(ExcepcionHorario).where(ExcepcionHorario.fecha == payload.fecha)
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Ya existe una excepción para la fecha {payload.fecha}",
        )

    db_exc = ExcepcionHorario(
        fecha=payload.fecha,
        cerrado=payload.cerrado,
        hora_apertura=payload.hora_apertura if not payload.cerrado else None,
        hora_cierre=payload.hora_cierre if not payload.cerrado else None,
    )
    session.add(db_exc)
    session.commit()
    session.refresh(db_exc)
    return db_exc


@app.delete("/schedule/exceptions/{exception_id}")
def delete_exception(exception_id: int, session: Session = Depends(get_session)):
    exc = session.get(ExcepcionHorario, exception_id)
    if not exc:
        raise HTTPException(status_code=404, detail="Excepción no encontrada")
    session.delete(exc)
    session.commit()
    return {"ok": True}


@app.get("/schedule/effective", response_model=EffectiveHoursResponse)
def get_effective_hours(date: str = Query(alias="date"), session: Session = Depends(get_session)):
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=400,
            detail="Formato de fecha inválido. Usa YYYY-MM-DD.",
        )

    # 1. Check exception
    exc = session.exec(
        select(ExcepcionHorario).where(ExcepcionHorario.fecha == target_date)
    ).first()
    if exc:
        if exc.cerrado:
            return EffectiveHoursResponse(abierto=False)
        return EffectiveHoursResponse(
            abierto=True,
            hora_apertura=exc.hora_apertura,
            hora_cierre=exc.hora_cierre,
        )

    # 2. Check weekly schedule
    python_weekday = target_date.weekday()  # 0=Mon..6=Sun
    schema_day = _python_weekday_to_schema(python_weekday)
    weekly = session.exec(
        select(HorarioSemanal).where(HorarioSemanal.dia_semana == schema_day)
    ).first()
    if weekly and weekly.activo:
        return EffectiveHoursResponse(
            abierto=True,
            hora_apertura=weekly.hora_apertura,
            hora_cierre=weekly.hora_cierre,
        )

    # 3. Closed
    return EffectiveHoursResponse(abierto=False)


# Mount static files AFTER all API routes so explicit routes take priority
app.mount("/", StaticFiles(directory="static", html=True), name="static")

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    index = Path("static/index.html")
    return FileResponse(index)