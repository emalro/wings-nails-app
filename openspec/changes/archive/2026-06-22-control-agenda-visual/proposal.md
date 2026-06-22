# Propuesta: Control de Agenda Visual

## Intención
Reemplazar la lista textual de turnos por un calendario visual tipo Google Calendar con códigos de color por estado de cita, más el flujo "Marcar como Asistido" con desglose contable.

## Alcance

### Incluye
- Calendario admin con toggle día / semana / mes
- Colores: Amarillo (Pendiente), Verde (Confirmado), Gris+check (Asistido), Rojo (Cancelado)
- Modal de detalle al clickear turno (cliente, servicios, montos)
- "Marcar Asistido": ventana con desglose (Precio - Seña = Saldo) y campo editable de monto recibido
- Actualización de contadores de clienta al confirmar
- `GET /busy_slots` sin cambios

### Excluye
- Auth/login, Dashboard/KPIs (REQ 3.E), reprogramación, notificaciones, paginación, integración con Google Calendar real

## Capacidades

### Nuevas
- `admin-calendar`: Calendario visual con toggle día/semana/mes, colores por estado, modal de detalle
- `mark-attended`: Cierre de turno con desglose contable editable + actualización de contadores

### Modificadas
- `frontend-data-fetching`: Se extiende `useUpdateAppointmentStatus` para aceptar `monto_recibido_en_caja`

## Enfoque
Backend: extender `PATCH /appointments/{id}` para aceptar `monto_recibido_en_caja` y actualizar contadores al marcar Asistido. Frontend: nuevo CalendarView reemplaza la lista en Admin.tsx; modales de detalle y confirmación contable.

## Áreas Afectadas

| Área | Impacto | Descripción |
|------|---------|-------------|
| `backend/app/main.py` | Mod | PATCH acepta monto_recibido_en_caja + actualiza contadores |
| `backend/app/schemas.py` | Mod | CitaUpdate: +monto_recibido_en_caja opcional |
| `frontend/src/pages/Admin.tsx` | Mod | Lista de turnos → CalendarView |
| `frontend/src/components/CalendarView.tsx` | Nuevo | Calendario con navegación y toggle |
| `frontend/src/components/AppointmentModal.tsx` | Nuevo | Modal de detalle + acciones |
| `frontend/src/components/MarkAttendedModal.tsx` | Nuevo | Desglose contable editable |
| `frontend/src/api.ts` | Mod | updateAppointmentStatus → updateAppointment |
| `frontend/src/hooks/useAppointments.ts` | Mod | Hook extendido + invalidación busy-slots |

## Riesgos

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| Complejidad calendario multi-vista | Media | Evaluar librería existente (react-big-calendar) |
| Pocos datos de prueba para edge cases | Baja | Seed de citas en múltiples estados |

## Rollback
Revertir Admin.tsx a la lista original. Revertir schema CitaUpdate. Componentes nuevos se quedan sin integrar.

## Dependencias
Ninguna externa obligatoria. Evaluar librería de calendario en diseño.

## Criterios de Éxito
- [ ] Turnos renderizan con color correcto según estado
- [ ] Toggle día/semana/mes funciona
- [ ] Click en turno abre modal con datos completos
- [ ] "Marcar Asistido" muestra Precio - Seña = Saldo, con campo editable
- [ ] Al confirmar: estado → Asistido, +1 a turnos_tomados y turnos_abonados
- [ ] `/busy_slots` sin cambios
- [ ] Tests existentes de pytest pasan
