import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import date, datetime, time, timedelta
from fastapi import Depends, FastAPI, HTTPException, Path, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlmodel import Session, select, or_
from sqlalchemy import text
from .auth import create_access_token, create_refresh_token, verify_token, verify_password, get_password_hash
from .database import create_db_and_tables, get_session, engine
from .deps import get_current_user
from .models import Cliente, ClienteTelefono, Servicio, Cita, CitaServicio, Configuracion, EstadoCita, HorarioSemanal, ExcepcionHorario, Usuario
from .schemas import ClienteCreate, ClienteRead, ClienteUpdate, ClienteTelefonoCreate, ClienteTelefonoRead, ClienteTelefonoUpdate, normalize_phone, ServicioCreate, ServicioRead, ServicioUpdate, CitaCreate, CitaRead, CitaUpdate, CitaServicioRead, ConfiguracionRead, ConfiguracionUpdate, HorarioSemanalRead, HorarioSemanalUpdate, ExcepcionHorarioCreate, ExcepcionHorarioRead, EffectiveHoursResponse, LoginRequest, TokenResponse, UserRead

LOGIN_RATE_LIMIT = os.getenv("LOGIN_RATE_LIMIT", "5/minute")

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


def run_migration(session: Session) -> None:
    """Startup migration: add activo column, copy telefono to ClienteTelefono, set activo=1."""
    # Add activo column if it doesn't exist (existing DBs)
    try:
        session.exec(text("ALTER TABLE cliente ADD COLUMN activo BOOLEAN NOT NULL DEFAULT 1"))
        session.commit()
    except Exception:
        session.rollback()  # Column already exists — ignore

    # Set activo=1 for all rows (in case they were created before the column existed)
    session.exec(text("UPDATE cliente SET activo = 1 WHERE activo IS NULL"))
    session.commit()

    # Copy existing telefono data to ClienteTelefono only if CT table is empty
    # AND the old telefono column still exists (pre-refactor DBs)
    existing_ct = session.exec(select(ClienteTelefono)).all()
    if len(existing_ct) == 0:
        # Check if the old telefono column exists before querying it
        pragma = session.exec(text("PRAGMA table_info(cliente)")).all()
        has_telefono_col = any(row[1] == "telefono" for row in pragma)
        if has_telefono_col:
            rows = session.exec(text("SELECT id, telefono FROM cliente WHERE telefono IS NOT NULL AND telefono != ''")).all()
            for row in rows:
                ct = ClienteTelefono(id_cliente=row[0], telefono=row[1], es_principal=True)
                session.add(ct)
            if rows:
                session.commit()


def seed_admin_user(session: Session) -> None:
    """Seed admin user from environment variables if not already present."""
    admin_email = os.getenv("ADMIN_EMAIL")
    admin_password_hash = os.getenv("ADMIN_PASSWORD_HASH")
    if not admin_email or not admin_password_hash:
        return
    existing = session.exec(select(Usuario).where(Usuario.email == admin_email)).first()
    if existing:
        return
    user = Usuario(
        email=admin_email,
        hashed_password=admin_password_hash,
        role="admin",
        is_active=True,
    )
    session.add(user)
    session.commit()

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    create_db_and_tables()
    with Session(engine) as session:
        run_migration(session)
        seed_default_config(session)
        seed_default_schedule(session)
        seed_admin_user(session)
    yield


app = FastAPI(
    title="Nails Studio Booking API",
    description="API inicial para gestionar servicios, clientas y citas de estudio de uñas.",
    version="0.1.0",
    lifespan=lifespan,
)

origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.get("/health")
def health_check():
    return {"status": "ok"}


# ── Auth Endpoints ──────────────────────────────────────────────────────


@app.post("/auth/login", response_model=TokenResponse)
@limiter.limit(LOGIN_RATE_LIMIT)
def login(request: Request, login_data: LoginRequest, session: Session = Depends(get_session)):
    user = session.exec(select(Usuario).where(Usuario.email == login_data.email)).first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    
    response = JSONResponse(content=TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserRead(email=user.email, role=user.role),
    ).model_dump())
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="strict",
        max_age=1800,  # 30 minutes
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="strict",
        max_age=604800,  # 7 days
        path="/",
    )
    
    return response


@app.post("/auth/logout")
def logout():
    response = JSONResponse(content={"message": "Logged out"})
    response.delete_cookie(key="access_token")
    response.delete_cookie(key="refresh_token")
    return response


@app.post("/auth/refresh", response_model=dict)
def refresh(request: Request, session: Session = Depends(get_session)):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    
    try:
        payload = verify_token(refresh_token, expected_type="refresh")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    
    user_id = int(payload["sub"])
    user = session.get(Usuario, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    
    new_access_token = create_access_token(user.id)
    
    response = JSONResponse(content={"access_token": new_access_token})
    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        samesite="strict",
        max_age=1800,
        path="/",
    )
    
    return response


@app.get("/auth/me", response_model=UserRead)
def get_me(user: Usuario = Depends(get_current_user)):
    return UserRead(email=user.email, role=user.role)


@app.get("/config", response_model=ConfiguracionRead)
def get_config(current_user: Usuario = Depends(get_current_user), session: Session = Depends(get_session)):
    config = session.get(Configuracion, 1)
    if not config:
        config = Configuracion(id=1)
        session.add(config)
        session.commit()
        session.refresh(config)
    return config


@app.put("/config", response_model=ConfiguracionRead)
def update_config(update: ConfiguracionUpdate, current_user: Usuario = Depends(get_current_user), session: Session = Depends(get_session)):
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


# ── Helpers ──────────────────────────────────────────────────────────────────


def _attach_telefonos(client: Cliente, session: Session) -> dict:
    """Build ClienteRead-compatible dict with telefonos attached (values JSON-safe)."""
    data = client.model_dump(mode="json")
    phones = session.exec(
        select(ClienteTelefono)
        .where(ClienteTelefono.id_cliente == client.id)
        .order_by(ClienteTelefono.es_principal.desc(), ClienteTelefono.id)
    ).all()
    data["telefonos"] = [ClienteTelefonoRead.model_validate(p).model_dump(mode="json") for p in phones]
    return data


def _build_cliente_read_response(client: Cliente, session: Session) -> dict:
    return _attach_telefonos(client, session)


# ── Client Endpoints ─────────────────────────────────────────────────────────


@app.post("/clients", response_model=ClienteRead)
def create_client(client: ClienteCreate, current_user: Usuario = Depends(get_current_user), session: Session = Depends(get_session)):
    normalized_phone = normalize_phone(client.telefono)

    # 1. Search by DNI (primary identifier)
    existing = session.exec(
        select(Cliente).where(Cliente.dni == client.dni)
    ).first()
    if existing:
        return _build_cliente_read_response(existing, session)

    # 2. Search by normalized phone via ClienteTelefono
    existing_phone = session.exec(
        select(ClienteTelefono).where(ClienteTelefono.telefono == normalized_phone)
    ).first()
    if existing_phone:
        client_match = session.get(Cliente, existing_phone.id_cliente)
        if client_match:
            return _build_cliente_read_response(client_match, session)

    # 3. Create new client + primary phone
    data = client.model_dump(exclude={"telefono"})
    db_client = Cliente(**data)
    session.add(db_client)
    session.commit()
    session.refresh(db_client)

    ct = ClienteTelefono(
        id_cliente=db_client.id,
        telefono=normalized_phone,
        es_principal=True,
    )
    session.add(ct)
    session.commit()
    session.refresh(db_client)

    response_data = _build_cliente_read_response(db_client, session)
    return JSONResponse(status_code=201, content=response_data)


@app.get("/clients", response_model=list[ClienteRead])
def list_clients(
    incluir_inactivos: bool = False,
    current_user: Usuario = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    statement = select(Cliente)
    if not incluir_inactivos:
        statement = statement.where(Cliente.activo == True)
    results = session.exec(statement).all()
    return [_build_cliente_read_response(c, session) for c in results]


@app.get("/clients/search", response_model=list[ClienteRead])
def search_clients(
    q: str = Query(min_length=0),
    incluir_inactivos: bool = False,
    current_user: Usuario = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if len(q) < 2:
        return []
    # Search across Cliente fields AND ClienteTelefono.telefono
    matching_ids: set[int] = set()
    cliente_matches = session.exec(
        select(Cliente).where(
            Cliente.nombre.ilike(f"%{q}%") |
            Cliente.apellido.ilike(f"%{q}%") |
            Cliente.dni.ilike(f"%{q}%")
        )
    ).all()
    for c in cliente_matches:
        matching_ids.add(c.id)

    phone_matches = session.exec(
        select(ClienteTelefono).where(ClienteTelefono.telefono.ilike(f"%{q}%"))
    ).all()
    for p in phone_matches:
        matching_ids.add(p.id_cliente)

    if not matching_ids:
        return []

    statement = select(Cliente).where(Cliente.id.in_(matching_ids))
    if not incluir_inactivos:
        statement = statement.where(Cliente.activo == True)
    statement = statement.limit(10)
    results = session.exec(statement).all()
    return [_build_cliente_read_response(c, session) for c in results]


@app.get("/clients/{client_id}", response_model=ClienteRead)
def get_client(client_id: int, current_user: Usuario = Depends(get_current_user), session: Session = Depends(get_session)):
    client = session.get(Cliente, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return _build_cliente_read_response(client, session)


@app.patch("/clients/{client_id}", response_model=ClienteRead)
def update_client(
    client_id: int,
    payload: ClienteUpdate,
    current_user: Usuario = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    client = session.get(Cliente, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(client, key, value)
    session.add(client)
    session.commit()
    session.refresh(client)
    return _build_cliente_read_response(client, session)


@app.delete("/clients/{client_id}", status_code=204)
def delete_client(client_id: int, current_user: Usuario = Depends(get_current_user), session: Session = Depends(get_session)):
    client = session.get(Cliente, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    client.activo = False
    session.add(client)
    session.commit()


@app.post("/clients/{client_id}/reactivate", response_model=ClienteRead)
def reactivate_client(client_id: int, current_user: Usuario = Depends(get_current_user), session: Session = Depends(get_session)):
    client = session.get(Cliente, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    client.activo = True
    session.add(client)
    session.commit()
    session.refresh(client)
    return _build_cliente_read_response(client, session)


# ── Phone Sub-resources ──────────────────────────────────────────────────────


@app.get("/clients/{client_id}/phones", response_model=list[ClienteTelefonoRead])
def list_client_phones(client_id: int, current_user: Usuario = Depends(get_current_user), session: Session = Depends(get_session)):
    client = session.get(Cliente, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    phones = session.exec(
        select(ClienteTelefono)
        .where(ClienteTelefono.id_cliente == client_id)
        .order_by(ClienteTelefono.es_principal.desc(), ClienteTelefono.id)
    ).all()
    return phones


@app.post("/clients/{client_id}/phones", response_model=ClienteTelefonoRead, status_code=201)
def add_client_phone(
    client_id: int,
    payload: ClienteTelefonoCreate,
    current_user: Usuario = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    client = session.get(Cliente, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    normalized = normalize_phone(payload.telefono)
    existing_phones = session.exec(
        select(ClienteTelefono).where(ClienteTelefono.id_cliente == client_id)
    ).all()
    is_first = len(existing_phones) == 0

    ct = ClienteTelefono(
        id_cliente=client_id,
        telefono=normalized,
        etiqueta=payload.etiqueta,
        es_principal=is_first,
    )
    session.add(ct)
    session.commit()
    session.refresh(ct)
    return ct


@app.patch("/clients/{client_id}/phones/{phone_id}", response_model=ClienteTelefonoRead)
def update_client_phone(
    client_id: int,
    phone_id: int,
    payload: ClienteTelefonoUpdate,
    current_user: Usuario = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    client = session.get(Cliente, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    phone = session.get(ClienteTelefono, phone_id)
    if not phone or phone.id_cliente != client_id:
        raise HTTPException(status_code=404, detail="Teléfono no encontrado")

    update_data = payload.model_dump(exclude_unset=True)
    new_principal = update_data.get("es_principal")

    if new_principal is True:
        # Unset principal on all other phones for this client
        others = session.exec(
            select(ClienteTelefono).where(
                ClienteTelefono.id_cliente == client_id,
                ClienteTelefono.id != phone_id,
            )
        ).all()
        for other in others:
            other.es_principal = False
            session.add(other)

    for key, value in update_data.items():
        setattr(phone, key, value)

    session.add(phone)
    session.commit()
    session.refresh(phone)
    return phone


@app.delete("/clients/{client_id}/phones/{phone_id}", status_code=204)
def delete_client_phone(
    client_id: int,
    phone_id: int,
    current_user: Usuario = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    client = session.get(Cliente, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    phone = session.get(ClienteTelefono, phone_id)
    if not phone or phone.id_cliente != client_id:
        raise HTTPException(status_code=404, detail="Teléfono no encontrado")

    # Refuse to delete the only phone
    count = session.exec(
        select(ClienteTelefono).where(ClienteTelefono.id_cliente == client_id)
    ).all()
    if len(count) <= 1:
        raise HTTPException(
            status_code=422,
            detail="No se puede eliminar el único teléfono del cliente",
        )

    session.delete(phone)
    session.commit()


# ── Appointment History ──────────────────────────────────────────────────────


@app.get("/clients/{client_id}/appointments", response_model=list[CitaRead])
def get_client_appointments(client_id: int, current_user: Usuario = Depends(get_current_user), session: Session = Depends(get_session)):
    client = session.get(Cliente, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    citas = session.exec(
        select(Cita)
        .where(Cita.id_cliente == client_id)
        .order_by(Cita.fecha_hora_cita.desc())
    ).all()
    return [build_cita_response(c, session) for c in citas]


@app.post("/services", response_model=ServicioRead)
def create_service(service: ServicioCreate, current_user: Usuario = Depends(get_current_user), session: Session = Depends(get_session)):
    db_service = Servicio.model_validate(service)
    session.add(db_service)
    session.commit()
    session.refresh(db_service)
    return db_service


@app.patch("/services/{service_id}", response_model=ServicioRead)
def update_service(service_id: int, service_update: ServicioUpdate, current_user: Usuario = Depends(get_current_user), session: Session = Depends(get_session)):
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
def delete_service(service_id: int, current_user: Usuario = Depends(get_current_user), session: Session = Depends(get_session)):
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
def list_services(all: bool = False, current_user: Usuario = Depends(get_current_user), session: Session = Depends(get_session)):
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
def create_appointment(appointment: CitaCreate, current_user: Usuario = Depends(get_current_user), session: Session = Depends(get_session)):
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
def list_appointments(current_user: Usuario = Depends(get_current_user), session: Session = Depends(get_session)):
    statement = select(Cita)
    citas = session.exec(statement).all()
    return [build_cita_response(cita, session) for cita in citas]


@app.patch("/appointments/{appointment_id}", response_model=CitaRead)
def update_appointment(appointment_id: int, appointment: CitaUpdate, current_user: Usuario = Depends(get_current_user), session: Session = Depends(get_session)):
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
def delete_appointment(appointment_id: int, current_user: Usuario = Depends(get_current_user), session: Session = Depends(get_session)):
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
def get_busy_slots(date_str: str, current_user: Usuario = Depends(get_current_user), session: Session = Depends(get_session)):
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
def get_weekly_schedule(current_user: Usuario = Depends(get_current_user), session: Session = Depends(get_session)):
    statement = select(HorarioSemanal).order_by(HorarioSemanal.dia_semana)
    return session.exec(statement).all()


@app.put("/schedule/weekly", response_model=list[HorarioSemanalRead])
def update_weekly_schedule(
    schedule: list[HorarioSemanalUpdate],
    current_user: Usuario = Depends(get_current_user),
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
def get_exceptions(current_user: Usuario = Depends(get_current_user), session: Session = Depends(get_session)):
    statement = select(ExcepcionHorario).order_by(ExcepcionHorario.fecha.desc())
    return session.exec(statement).all()


@app.post("/schedule/exceptions", response_model=ExcepcionHorarioRead)
def create_exception(
    payload: ExcepcionHorarioCreate,
    current_user: Usuario = Depends(get_current_user),
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
def delete_exception(exception_id: int, current_user: Usuario = Depends(get_current_user), session: Session = Depends(get_session)):
    exc = session.get(ExcepcionHorario, exception_id)
    if not exc:
        raise HTTPException(status_code=404, detail="Excepción no encontrada")
    session.delete(exc)
    session.commit()
    return {"ok": True}


@app.get("/schedule/effective", response_model=EffectiveHoursResponse)
def get_effective_hours(date: str = Query(alias="date"), current_user: Usuario = Depends(get_current_user), session: Session = Depends(get_session)):
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


# Serve built frontend assets (JS/CSS bundles with hashed names)
app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")

# SPA fallback: serve index.html for all non-API, non-asset routes
# This must come AFTER all API routes so explicit routes take priority
@app.get("/")
async def serve_root():
    return FileResponse("static/index.html")

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    return FileResponse("static/index.html")