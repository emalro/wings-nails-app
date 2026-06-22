# Delta Spec: Control de Agenda Visual

**Change**: `control-agenda-visual`
**Domain**: `admin-agenda-visual`
**Spec Type**: New (extiende sistema de turnos existente)
**Proposal Ref**: `openspec/changes/control-agenda-visual/proposal.md`

---

## ADDED Requirements

### CAL-001 — Calendario Visual con Toggle

El panel admin DEBE reemplazar la lista de tarjetas por un calendario visual.

- El calendario DEBE soportar 3 modos: día, semana y mes.
- El usuario DEBE poder alternar entre modos mediante botones de toggle.
- El calendario DEBE incluir navegación (anterior/siguiente, "Hoy").
- Las citas DEBEN renderizarse con color según `estado_cita`:
  - `Pendiente` → Amarillo/ámbar
  - `Confirmado` → Verde
  - `Asistido` → Gris con indicador de check
  - `Cancelado_Cliente` / `Cancelado_Sistema_Vencimiento` → Rojo
- Periodos sin citas DEBEN mostrar indicador de "Sin turnos".

#### Escenario: Navegación y visualización
- DADO el admin en el panel
- CUANDO selecciona vista "semana" y navega a la semana siguiente
- THEN el calendario muestra las citas de esa semana con colores correctos

#### Escenario: Período vacío
- DADO que no hay citas en el mes actual
- CUANDO el admin selecciona vista "mes"
- THEN se muestra un indicador "Sin turnos registrados"

### CAL-002 — Modal de Detalle de Cita

Al clickear una cita en el calendario, DEBE abrirse un modal con los datos completos.

El modal DEBE mostrar: `cliente_nombre`, `fecha_hora_cita`, `duracion_total_minutos`, lista de `servicios` (nombre, precio, subtotal), `precio_historico_cobrado`, `sena_historica_pagada`, `monto_recibido_en_caja`, `estado_cita`.

El modal DEBE incluir un botón "Cerrar". Cuando `estado_cita` sea `Confirmado`, DEBE incluir además un botón "Marcar como Asistido".

#### Escenario: Apertura de detalle
- DADO un turno en estado Confirmado visible en el calendario
- CUANDO el admin hace click en el turno
- THEN se abre un modal con datos del cliente, servicios, montos y botón "Marcar como Asistido"

### CAL-003 — Flujo "Marcar como Asistido"

Al hacer click en "Marcar como Asistido", DEBE abrirse un modal de confirmación con desglose contable.

El modal DEBE mostrar:
| Campo | Origen |
|-------|--------|
| Precio total | `precio_historico_cobrado` |
| Seña pagada | `sena_historica_pagada` |
| Saldo restante | cálculo: precio - seña |
| Monto recibido en caja | campo editable, pre-cargado con precio total |

Al confirmar, el sistema DEBE enviar `PATCH /appointments/{id}` con `estado_cita: "Asistido"` y `monto_recibido_en_caja` con el valor editado.

En el backend, al recibir `estado_cita = Asistido` con `monto_recibido_en_caja`:
- DEBE establecer `cita.estado_cita = Asistido`
- DEBE establecer `cita.monto_recibido_en_caja` al valor enviado
- DEBE incrementar `cliente.cantidad_turnos_abonados += 1`

El modal DEBE tener un botón "Cancelar" que lo cierra sin cambios.

#### Escenario: Marcar como asistido exitosamente
- DADO un turno Confirmado con precio $5000 y seña $2000
- CUANDO el admin abre "Marcar como Asistido", edita monto a $4500 y confirma
- THEN se envía `PATCH` con `estado_cita: "Asistido", monto_recibido_en_caja: 4500`
- Y el modal se cierra
- Y el calendario muestra la cita en gris con check
- Y el contador `cantidad_turnos_abonados` de la clienta se incrementa en 1

#### Escenario: Cancelación del flujo
- DADO el modal de "Marcar como Asistido" abierto
- CUANDO el admin hace click en "Cancelar"
- THEN el modal se cierra sin enviar ningún cambio

#### Escenario: Error al confirmar
- DADO el modal de confirmación abierto
- CUANDO el backend responde con error (500, 404)
- THEN el modal muestra mensaje de error y permanece abierto
- Y el usuario puede reintentar o cancelar

## MODIFIED Requirements

### FE-001 — Hook useUpdateAppointmentStatus

(Pasa de aceptar solo `{appointmentId, estado_cita}` a aceptar `{appointmentId, estado_cita, monto_recibido_en_caja?}`)

#### Escenario: Actualización con monto
- DADO el hook `useUpdateAppointmentStatus`
- CUANDO se llama con `{appointmentId: 5, estado_cita: "Asistido", monto_recibido_en_caja: 4500}`
- THEN envía `PATCH /appointments/5` con `{estado_cita: "Asistido", monto_recibido_en_caja: 4500}`
- Y al success invalida `['appointments']` y `['clients']`

#### Escenario: Actualización sin monto (compatibilidad)
- DADO el hook `useUpdateAppointmentStatus`
- CUANDO se llama con `{appointmentId: 3, estado_cita: "Cancelado_Cliente"}` (sin monto)
- THEN envía `PATCH /appointments/3` con `{estado_cita: "Cancelado_Cliente"}`
- Y funciona como antes (compatibilidad hacia atrás)

### API-001 — Esquema CitaUpdate extendido

`CitaUpdate` DEBE aceptar `monto_recibido_en_caja: Optional[float] = None` además de `estado_cita: EstadoCita`.

| Campo | Tipo | Requerido | Default |
|-------|------|-----------|---------|
| `estado_cita` | `EstadoCita` | Sí | — |
| `monto_recibido_en_caja` | `Optional[float]` | No | `None` |

## UNCHANGED Behavior

- `GET /busy_slots` conserva su lógica actual (solo estados Pendiente/Confirmado)
- `POST /appointments` y `DELETE /appointments/{id}` sin cambios
- Vistas públicas (`Calendar.tsx`, `Reservar.tsx`) sin cambios
- `cantidad_turnos_tomados` ya se incrementa en creación — NO se modifica

## Edge Cases

| Caso | Comportamiento |
|------|---------------|
| Cita sin servicios | Modal muestra servicios vacío, precio 0, saldo 0 |
| `monto_recibido_en_caja` = 0 | Válido — se registra como 0 |
| `monto_recibido_en_caja` negativo | Backend DEBE rechazar con 422 |
| Cita ya Asistida | Botón "Marcar como Asistido" NO aparece |
| Cita Cancelada | Se ve en rojo, sin acciones de estado |
| Cliente eliminado | Modal muestra "Cliente no disponible" |
| Vista mes con 50+ citas | Calendario renderiza todas sin romper layout |
| Toggle rápido entre modos | Cancelación de fetch anterior manejada por TanStack Query |
