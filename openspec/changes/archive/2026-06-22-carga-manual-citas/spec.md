# Delta Spec: Carga Manual de Citas + Buscador Predictivo

**Change**: `carga-manual-citas`
**Spec Type**: Combinado — nuevo dominio + deltas sobre dominios existentes
**Propuesta**: `openspec/changes/carga-manual-citas/proposal.md`

---

## ADDED Domain: Carga Manual de Citas (`carga-manual-citas`)

### Purpose

Permitir a la manicurista crear turnos manualmente desde el panel admin con búsqueda predictiva de clientas y bloqueo instantáneo de franja horaria.

---

## Requirements

### CMC-001 — Endpoint `GET /clients/search?q=`

El backend DEBE exponer `GET /clients/search?q={query}` para búsqueda predictiva de clientas.

| Propiedad | Especificación |
|-----------|---------------|
| Parámetro | `q` (query string, requerido) |
| Mínimo | 2 caracteres. Si `q` < 2, DEBE devolver lista vacía (200) |
| Matching | `nombre` LIKE `%q%` OR `apellido` LIKE `%q%` OR `telefono` LIKE `%q%` |
| Sensibilidad | Case-insensitive (SQLite `LIKE` es case-insensitive por default para ASCII) |
| Límite | Máximo 10 resultados |
| Response | `List[ClienteRead]` — mismo schema que `GET /clients` |
| Latencia | < 300ms para el conjunto de datos esperado (< 5000 clientas) |

#### Scenario: Búsqueda por nombre parcial
- DADO una clienta "María García" registrada con teléfono "3415550101"
- CUANDO el admin escribe "mar" en el buscador
- THEN `GET /clients/search?q=mar` devuelve [{id: N, nombre: "María", apellido: "García", telefono: "3415550101"}]
- Y el máximo de resultados es 10

#### Scenario: Búsqueda por teléfono
- DADO una clienta registrada con teléfono "3415550101"
- CUANDO el admin busca "3415"
- THEN el resultado incluye a esa clienta

#### Scenario: Búsqueda sin resultados
- DADO que no existen clientas con "xyz"
- CUANDO el admin busca "xyz"
- THEN el endpoint devuelve lista vacía `[]`

#### Scenario: Búsqueda con 1 carácter
- DADO que el admin escribe un solo carácter "a"
- CUANDO se dispara la petición
- THEN el endpoint devuelve lista vacía `[]`

### CMC-002 — `POST /appointments` extendido (add `estado_cita`)

El schema `CitaCreate` DEBE aceptar `estado_cita` opcional. Cuando se provee, el endpoint DEBE usarlo en lugar del default `Pendiente`.

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `estado_cita` | `Optional[EstadoCita]` | `None` | Si se omite, conserva `Pendiente` (default del modelo) |
| `metodo_pago_sena` | `Optional[str]` | `"Transferencia"` | Ya existe; se expone en UI manual como toggle |

El método `find_conflicting_appointment` NO se modifica. El bloqueo aplica para estados `Pendiente` y `Confirmado`.

#### Scenario: Crear turno manual como Confirmado
- DADO una clienta existente y un servicio activo
- CUANDO el admin crea un turno con `estado_cita: "Confirmado"` y horario libre
- THEN el endpoint crea la cita con `estado_cita = Confirmado`
- Y la franja aparece ocupada en `GET /busy_slots`

#### Scenario: Crear turno manual como Pendiente (default)
- DADO una clienta existente
- CUANDO el admin crea un turno sin enviar `estado_cita`
- THEN el endpoint crea la cita con `estado_cita = Pendiente`

#### Scenario: Conflicto de horario en creación manual
- DADO un turno Confirmado existente de 10:00 a 11:00
- CUANDO el admin crea un turno manual de 10:30 a 11:30
- THEN el endpoint responde 409 con "El horario elegido ya está ocupado"

### CMC-003 — Componente ClientSearch (búsqueda predictiva)

El frontend DEBE implementar un input de búsqueda con debounce y dropdown.

| Propiedad | Especificación |
|-----------|---------------|
| Debounce | 300ms — NO disparar request en cada keystroke |
| Mínimo chars | 2 caracteres — por debajo no se muestra dropdown |
| Resultados | Máximo 10 items en dropdown |
| Display | `"{nombre} {apellido} — {teléfono}"` |
| Sin resultados | Texto: "No se encontraron clientas. Crear nueva ficha" |
| Loading | Indicador de carga durante la petición |
| Error | Texto genérico "Error al buscar" + log en consola |

#### Scenario: Debounce evita requests excesivos
- DADO el componente ClientSearch montado
- CUANDO el admin escribe "ma" (2 chars) y luego "mar" (3 chars) rápidamente (< 300ms entre cada letra)
- THEN solo se dispara UNA petición con `q=mar` (la última tras 300ms de inactividad)

#### Scenario: Dropdown se cierra al seleccionar
- DADO el dropdown abierto con resultados
- CUANDO el admin hace click en un resultado
- THEN el dropdown se cierra
- Y el input muestra el nombre de la clienta seleccionada
- Y el `id_cliente` queda almacenado para el POST

### CMC-004 — Registro Express (creación inline de clienta)

Si la búsqueda no encuentra resultados, el admin DEBE poder crear una clienta nueva sin salir del modal.

El formulario inline DEBE exigir: `nombre` (requerido), `apellido` (requerido), `teléfono` (requerido).

#### Scenario: Crear clienta nueva desde el modal
- DADO el modal de carga manual abierto
- CUANDO el admin busca "xyz" y no obtiene resultados
- Y hace click en "Crear nueva ficha"
- THEN se muestra formulario con campos nombre, apellido, teléfono
- CUANDO completa los campos y confirma
- THEN se crea la clienta vía `POST /clients`
- Y el `id_cliente` se asigna automáticamente al turno que se está creando

### CMC-005 — ManualAppointmentModal

El modal DEBE contener: buscador de clientas (CMC-003), selector de servicios (multi-select o single con duración), date picker + time picker, toggles de estado y pago, botón submit.

| Elemento | Comportamiento |
|----------|---------------|
| Selector servicios | Lista de servicios activos vía `useServices()` |
| Fecha/Hora | Input type="date" + type="time" o picker combinado |
| Toggle estado | "Pendiente" (default) / "Confirmado" |
| Toggle pago | "Transferencia" (default) / "Efectivo" |
| Botón "Guardar Turno" | Disabled si no hay clienta seleccionada, servicio, fecha y hora |
| Error display | Muestra error del backend (conflicto, validación) |

#### Scenario: Carga manual completa con estado Confirmado y pago Efectivo
- DADO el modal abierto con clienta seleccionada
- CUANDO el admin selecciona servicio, fecha 2026-07-15 10:00, toggle "Confirmado", pago "Efectivo"
- Y hace click en "Guardar Turno"
- THEN se envía `POST /appointments` con `{estado_cita: "Confirmado", metodo_pago_sena: "Efectivo", ...}`
- Y al success se cierra el modal
- Y el calendario se refresca mostrando el nuevo turno

#### Scenario: Conflicto de horario desde el modal
- DADO el modal con datos completos
- CUANDO el backend responde 409 (conflicto)
- THEN el modal muestra mensaje: "El horario elegido ya está ocupado"
- Y el modal NO se cierra
- Y el admin puede corregir la franja

---

## MODIFIED Domain: Admin Agenda Visual (`admin-agenda-visual`)

### CAL-001 — Calendario Visual con Toggle (MODIFIED)

Se AGREGA botón "Cargar Turno Manual" que DEBE aparecer sobre el calendario, junto a los controles de navegación.

(Previously: Solo controles de navegación y toggle de vista)

#### Scenario: Botón abre modal de carga manual
- DADO el admin en el panel con calendario visible
- CUANDO hace click en "Cargar Turno Manual"
- THEN se abre ManualAppointmentModal
- Y el calendario permanece visible detrás del modal

---

## MODIFIED Domain: Frontend Data Fetching (`frontend-data-fetching`)

### ADDED: Hook `useClientSearch`

```typescript
function useClientSearch(query: string): {
  data: ClienteRead[] | undefined;
  isLoading: boolean;
  isError: boolean;
}
```

- Usa `useQuery` de TanStack Query con key `['clients', 'search', query]`
- Solo se activa cuando `query.length >= 2`
- Debounce de 300ms manejado por el componente (no el hook)
- Query NO enabled cuando query < 2

#### Scenario: Hook solo se ejecuta con >= 2 caracteres
- DADO `useClientSearch` con `query = "a"`
- THEN `enabled = false` — no se dispara fetch
- CUANDO `query` cambia a `"ma"`
- THEN `enabled = true` — se dispara `GET /clients/search?q=ma`

### ADDED: Hook `useCreateManualAppointment`

```typescript
function useCreateManualAppointment(): {
  mutate: (payload: CitaCreateConEstado) => void;
  isPending: boolean;
  error: Error | null;
  data: CitaRead | undefined;
}
```

- Usa `useMutation` sobre `POST /appointments`
- Tipo `CitaCreateConEstado` extiende `CitaCreate` con `estado_cita` opcional
- On success: invalida `['appointments']` para refrescar calendario

### ADDED: API function `searchClients`

```typescript
export async function searchClients(q: string): Promise<ClienteRead[]> {
  const r = await api.get('/clients/search', { params: { q } })
  return r.data
}
```

---

## Acceptance Criteria — Técnicos

| Criterio | Límite |
|----------|--------|
| Latencia búsqueda (p99) | < 300ms |
| Debounce | 300ms ± 50ms |
| Mínimo caracteres para búsqueda | 2 |
| Máximo resultados en dropdown | 10 |
| Conflict detection | Reutilizar `find_conflicting_appointment` — sin cambios |

---

## Dependencias y Restricciones

- **Modelos**: `Cliente`, `Cita`, `CitaServicio`, `Servicio` existen y no se modifican.
- **Conflict detection**: `find_conflicting_appointment` se reusa. No se toca.
- **Sin autenticación**: Este cambio no implementa auth admin (requisito 3.B separado).
- **Sin notificaciones**: No se envían WhatsApp para turnos manuales.
- **Base de datos**: SQLite (migración automática con SQLModel).

---

## Fuera de Alcance (reforzar)

- Notificaciones WhatsApp para turnos manuales
- Autenticación / login admin
- Dashboard de métricas
- Modificaciones al flujo de booking online público
- Reprogramación o cancelación desde el modal (se hace desde AppointmentModal existente)
- Múltiples servicios por turno en la UI manual (el schema lo soporta, pero la UI inicial usará un solo servicio)
