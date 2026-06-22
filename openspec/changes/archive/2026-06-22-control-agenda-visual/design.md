# Design: Control de Agenda Visual

## Enfoque Técnico

Reemplazar la lista textual de turnos en `Admin.tsx` por un calendario visual tipo Google Calendar usando `react-big-calendar` + `date-fns`. Se agregan dos modales (detalle y marcación de asistido) y se extiende el endpoint `PATCH /appointments/{id}` para aceptar `monto_recibido_en_caja` y actualizar contadores del cliente. Las vistas públicas (`Calendar.tsx`, `Reservar.tsx`) quedan intactas.

## Decisiones de Arquitectura

### D1: Librería de calendario

| Opción | Tradeoff | Decisión |
|--------|----------|----------|
| `react-big-calendar` + `date-fns` | 30KB gzip, views día/semana/mes, `eventPropGetter` para colores, navegación nativa, responsive | ✅ Elegido |
| Custom build | Control total pero costo alto de desarrollo y mantenimiento | ❌ Rechazado |
| `@syncfusion/ej2-react-calendars` | Licencia enterprise, bundle pesado | ❌ Rechazado |

Instalación: `npm install react-big-calendar date-fns` (types incluidos en el paquete).

### D2: Mapeo de colores por estado

`eventPropGetter` de RBC recibe cada evento y retorna estilo CSS según `estado_cita`. Paleta:

| Estado | Color | Hex |
|--------|-------|-----|
| Pendiente | Ámbar | `#F59E0B` |
| Confirmado | Verde | `#10B981` |
| Asistido | Gris | `#6B7280` |
| Cancelado_Cliente / Cancelado_Sistema_Vencimiento | Rojo | `#EF4444` |

### D3: Solo incrementa `cantidad_turnos_abonados`

La spec resolvió: `cantidad_turnos_tomados` ya se incrementa al crear la cita (`POST /appointments`). Al marcar Asistido solo se incrementa `cantidad_turnos_abonados` del cliente.

## Flujo de Datos

```
CalendarView ──(onSelectEvent)──→ AppointmentModal ──(onMarkAttended)──→ MarkAttendedModal
     │                                    │                                     │
     │                                    │ (close)                             │ (confirm → PATCH)
     │                                    └→ cierra modal                      │
     │                                                                          │
     └── ← TanStack Query invalida ['appointments', 'clients'] ←───────────────┘
                                                                         │
                                                                   Backend: PATCH /appointments/{id}
                                                                     ├── estado_cita = "Asistido"
                                                                     ├── monto_recibido_en_caja = valor
                                                                     └── cliente.cantidad_turnos_abonados += 1
```

## Cambios por Archivo

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `backend/app/schemas.py` | MODIFICAR | `CitaUpdate`: +`monto_recibido_en_caja: Optional[float] = None` |
| `backend/app/main.py` | MODIFICAR | `PATCH /appointments/{id}`: validar ≥0, actualizar monto y contadores si Asistido |
| `frontend/src/components/CalendarView.tsx` | CREAR | Wrapper de react-big-calendar con toggle día/semana/mes, mapeo de eventos, colores por estado |
| `frontend/src/components/AppointmentModal.tsx` | CREAR | Modal de detalle con datos de cita + botón "Marcar como Asistido" |
| `frontend/src/components/MarkAttendedModal.tsx` | CREAR | Desglose Precio - Seña = Saldo + campo editable `monto_recibido_en_caja` |
| `frontend/src/pages/Admin.tsx` | MODIFICAR | Reemplazar sección de lista de citas por `<CalendarView>` + modales |
| `frontend/src/hooks/useAppointments.ts` | MODIFICAR | `useUpdateAppointmentStatus`: acepta `monto_recibido_en_caja?`, invalida `clients` |
| `frontend/src/api.ts` | MODIFICAR | `updateAppointmentStatus` renombrado a `updateAppointment` con payload extendido |
| `frontend/package.json` | MODIFICAR | +`react-big-calendar` + `date-fns` |

## Interfaces / Contratos

### Backend — Nuevo CitaUpdate

```python
class CitaUpdate(BaseModel):
    estado_cita: EstadoCita
    monto_recibido_en_caja: Optional[float] = None
```

### Backend — Lógica PATCH extendida

```python
@app.patch("/appointments/{appointment_id}", response_model=CitaRead)
def update_appointment_status(appointment_id: int, appointment: CitaUpdate, session: Session = Depends(get_session)):
    cita = session.get(Cita, appointment_id)
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    if appointment.monto_recibido_en_caja is not None and appointment.monto_recibido_en_caja < 0:
        raise HTTPException(status_code=422, detail="monto_recibido_en_caja no puede ser negativo")
    cita.estado_cita = appointment.estado_cita
    if appointment.estado_cita == EstadoCita.asistido:
        if appointment.monto_recibido_en_caja is not None:
            cita.monto_recibido_en_caja = appointment.monto_recibido_en_caja
        cliente = session.get(Cliente, cita.id_cliente)
        if cliente:
            cliente.cantidad_turnos_abonados += 1
    session.add(cita)
    session.commit()
    session.refresh(cita)
    return build_cita_response(cita, session)
```

### Frontend — AppointmentModal props

```typescript
interface AppointmentModalProps {
  cita: CitaRead
  onClose: () => void
  onMarkAttended: (cita: CitaRead) => void  // solo si estado === 'Confirmado'
}
```

### Frontend — MarkAttendedModal props

```typescript
interface MarkAttendedModalProps {
  cita: CitaRead
  onClose: () => void
  onConfirm: (appointmentId: number, montoRecibido: number) => void
}
```

### Frontend — CalendarView props

```typescript
interface CalendarViewProps {
  appointments: CitaRead[]
  loading: boolean
  onEventClick: (cita: CitaRead) => void
}
```

### Frontend — Event shape para RBC

```typescript
interface CalendarEvent {
  title: string          // cliente_nombre
  start: Date
  end: Date
  resource: CitaRead     // cita completa para el modal
  status: string         // estado_cita para color via eventPropGetter
}
```

## Estados Vista / Carga / Vacío / Error

| Estado | UX |
|--------|-----|
| Loading | Spinner sobre el calendario |
| Sin citas en rango | Mensaje "Sin turnos registrados" en el área del calendario |
| Error en modal (PATCH falla) | Mensaje de error + botones "Reintentar" y "Cancelar" — modal permanece abierto |
| Error de fetch inicial | TanStack Query maneja error con retry automático (3 intentos) |

## Comportamiento Responsive

- `react-big-calendar` soporta responsive nativo (`accessibility` prop, scroll horizontal en modo semana/día)
- En móviles (< 768px): vista día por defecto, modales ocupan 100% width con padding 16px
- Modales usan `position: fixed` con overlay semi-transparente, centrados, `max-width: 500px` en desktop, `width: 100%` en mobile
- El panel admin conserva su grid actual de servicios + configuración; solo la sección de turnos se reemplaza

## Estrategia de Testing

| Capa | Qué probar | Cómo |
|------|-----------|------|
| Integration (backend) | `CitaUpdate` con `monto_recibido_en_caja` negativo → 422 | pytest + TestClient |
| Integration (backend) | `CitaUpdate` sin monto (compatibilidad hacia atrás) → 200 | pytest + TestClient |
| Integration (backend) | PATCH a Asistido incrementa `cantidad_turnos_abonados` en 1 | pytest + session real |
| Integration (backend) | PATCH a Asistido sin cliente existente → no crashea | pytest |
| Integration (backend) | PATCH a Cancelado_Cliente sin monto → funciona como antes | pytest |
| TypeScript (frontend) | Tipado de props en CalendarView y modales | `tsc --noEmit` |
| Manual (frontend) | Toggle vistas, colores correctos, apertura modal, flujo completo QA | QA visual |

## Migración

No requiere migración de datos. `monto_recibido_en_caja` ya existe en el modelo `Cita` (SQLModel) con default `0.0`. Los cambios son estrictamente aditivos: nuevas rutas de componentes, extensión de schema existente.

## Preguntas Abiertas

Ninguna. Todas las decisiones están cubiertas por la spec y la propuesta.
