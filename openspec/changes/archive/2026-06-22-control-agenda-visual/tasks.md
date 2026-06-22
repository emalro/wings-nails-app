# Tareas: Control de Agenda Visual

## Review Workload Forecast

| Campo | Valor |
|-------|-------|
| Líneas estimadas | ~455 (suma aproximada de add + del) |
| Riesgo presupuesto 400 ln | Medio |
| Chained PRs recomendado | Sí |
| Split sugerido | PR 1 (Backend) → PR 2 (Frontend infra + CalendarView) → PR 3 (Modales + integración) |
| Estrategia delivery | auto-forecast |
| strict_tdd | true (backend) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Work Units Sugeridos

| Unidad | Contenido | PR | Base |
|--------|-----------|----|------|
| 1 | Backend: schema + handler + tests (~100 ln) | PR 1 | main |
| 2 | Frontend: deps + API/hook + CalendarView (~140 ln) | PR 2 | main |
| 3 | Frontend: AppointmentModal + MarkAttendedModal + Admin.tsx + tsc (~215 ln) | PR 3 | main |

## Fase 1: Backend — Schema y Handler

- [x] 1.1 **Extender CitaUpdate** — `backend/app/schemas.py`: agregar `monto_recibido_en_caja: Optional[float] = Field(default=None, ge=0)`. AC: schema rechaza montos < 0 con 422 vía Pydantic. ~5 ln. Dep: —
- [x] 1.2 **Extender PATCH handler** — `backend/app/main.py` en `update_appointment_status`: validar monto ≥ 0 (422 si negativo), si `estado_cita == Asistido` y monto presente → asignar `cita.monto_recibido_en_caja`; obtener `cliente = session.get(Cliente, cita.id_cliente)` e incrementar `cliente.cantidad_turnos_abonados += 1`. Compatibilidad backward: PATCH sin monto funciona igual que antes. ~25 ln. Dep: 1.1

## Fase 2: Backend — Tests de Integración

- [x] 2.1 **5 tests de integración** — Usar `TestClient`. Escenarios: (a) monto negativo → 422, (b) PATCH sin monto → 200 (backward compat), (c) PATCH a Asistido con monto → `cantidad_turnos_abonados` incrementado en 1, (d) PATCH Asistido sin cliente (id_cliente inválido) → no crashea, (e) PATCH a Cancelado_Cliente sin monto → funciona como antes. AC: todos pasan con `python -m pytest`. ~70 ln. Dep: 1.2

## Fase 3: Frontend — Infraestructura

- [x] 3.1 **Instalar dependencias** — `frontend/`: `npm install react-big-calendar date-fns`. AC: sin errores en install. ~2 ln (package.json). Dep: —
- [x] 3.2 **Extender capa API** — `frontend/src/api.ts`: renombrar `updateAppointmentStatus` a `updateAppointment`, payload `{ estado_cita, monto_recibido_en_caja?: number }`. `frontend/src/hooks/useAppointments.ts`: extender `useUpdateAppointmentStatus` para aceptar `montoRecibidoEnCaja?: number`, enviarlo al PATCH, invalidar `['clients']` además de `['appointments']`. ~15 ln. Dep: —

## Fase 4: Frontend — Componentes

- [x] 4.1 **CalendarView** — `frontend/src/components/CalendarView.tsx`: wrapper de react-big-calendar con toggle día/semana/mes, mapeo de `CitaRead[]` a `CalendarEvent[]{ title, start, end, resource, status }`, colores vía `eventPropGetter` (Pendiente=#F59E0B, Confirmado=#10B981, Asistido=#6B7280, Cancelado=#EF4444), prop `onEventClick(cita)`, estado vacío "Sin turnos registrados". ~120 ln. Dep: 3.1, 3.2
- [x] 4.2 **AppointmentModal** — `frontend/src/components/AppointmentModal.tsx`: modal overlay con datos completos de la cita (cliente, servicio, fecha, estado, monto, seña), botón "Marcar como Asistido" solo si `estado_cita === 'Confirmado'`, prop `onMarkAttended(cita)`. ~80 ln. Dep: —
- [x] 4.3 **MarkAttendedModal** — `frontend/src/components/MarkAttendedModal.tsx`: modal overlay con desgluce editable Precio - Seña = Saldo, campo `monto_recibido_en_caja` (number input, editable), botones "Confirmar" (envía PATCH) y "Cancelar". Props: `cita, onClose, onConfirm(id, monto)`. En caso de error PATCH: muestra mensaje + botones "Reintentar" y "Cancelar". ~100 ln. Dep: 3.2

## Fase 5: Frontend — Integración y Verificación

- [x] 5.1 **Integrar en Admin.tsx** — `frontend/src/pages/Admin.tsx`: reemplazar sección de lista de turnos por `<CalendarView>`, conectar modales `AppointmentModal` y `MarkAttendedModal`. Estado local: `selectedCita`, `showDetail`, `showMarkAttended`. On confirm: llama `useUpdateAppointmentStatus`, cierra modales, invalida queries. ~40 ln. Dep: 4.1, 4.2, 4.3
- [x] 5.2 **Verificar tipos** — `cd frontend && npx tsc --noEmit`. AC: 0 errores de tipo. ~0 ln. Dep: 5.1
