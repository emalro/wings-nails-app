# Design: Online Booking Flow

## Technical Approach

Refactor `Reservar.tsx` from a single-step form to a 4-step local state machine (no router). Each step is a conditional render section within the same component to minimize abstraction overhead. Backend changes are additive — new optional fields on `Configuracion` model. No new endpoints required: the existing `POST /clients` already expects `dni` (current frontend omits it — bug being fixed). Calendar gets an "Ocupado" label switch and a privacy note.

## Architecture Decisions

### Decision: Step machine over router

| Option | Tradeoff | Decision |
|--------|----------|----------|
| React Router (separate routes) | Each step is a URL; supports back/forward browser nav | ❌ — adds route nesting, URL state sync complexity, and the flow is linear-forward only |
| Local step enum | Simple `useState<Step>` with `switch/case` render | ✅ — 4 steps, forward-only flow, no back/forward needed |

### Decision: State in single component vs extracted store

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Zustand / Context | Overkill for 4-step wizard with no cross-page state | ❌ — form state is local to this page only |
| Component-local `useState` | 6-7 state vars, all driven by user input in sequence | ✅ — TanStack Query already caches API data (services, config); no shared state needed |

### Decision: Single `Reservar.tsx` vs step components

| Option | Tradeoff | Decision |
|--------|----------|----------|
| 4 separate step components + parent | Cleaner isolation but premature abstraction for a linear flow with shared state | ❌ |
| All in one file sections | 200→~350 lines, step sections easily read top-to-bottom | ✅ — collocation keeps state transitions readable; extract only if lines exceed 500 |

### Decision: WhatsApp deep link format

```
https://wa.me/{number}?text={encodeURIComponent(template)}
```

Template: `Hola! Te envio el comprobante de la seña de mi turno.\n\nNombre: {nombre}\nFecha: {fecha}\nHora: {hora}\nServicio: {servicio}\nTotal: ${total}\nSeña: ${sena}`

## Data Flow

```
Step 1 (SERVICE)
  Service grid → selectedService (id)
  [Error: none, purely selection]

Step 2 (FORM)
  nombre, apellido, telefono, dni → form state
  Calendar → fechaHora (ISO datetime)
  [Loading: busy slots by selected date]
  [Error: DNI missing, phone invalid → inline field validation]

Step 3 (CONFIRM)
  All state → rendered summary
  Button: "Confirmar turno" → loading spinner, buttons disabled
  
  ┌─ Sequential API calls ──────────────────────────────────┐
  │                                                          │
  │  POST /clients {nombre, apellido, telefono, dni}         │
  │    │                                                      │
  │    ├── 422 (validation) → inline error on step 3         │
  │    │      User stays on step 3, retry available           │
  │    │                                                      │
  │    └── 201/200 → client.id                                │
  │                                                           │
  │  POST /appointments {id_cliente, fecha_hora_cita,         │
  │                       servicios, ...}                      │
  │    │                                                      │
  │    ├── 409 (conflict) → error banner on step 3            │
  │    │      "El horario elegido ya fue reservado por         │
  │    │       otra persona. Elegí otro horario."              │
  │    │      User stays on step 3, form data preserved        │
  │    │      (no lost fields), can pick new time              │
  │    │                                                       │
  │    ├── 422 (validation) → inline error on step 3           │
  │    │                                                       │
  │    ├── 5xx (server error) → error banner on step 3         │
  │    │      "Ocurrió un error. Intentá de nuevo."            │
  │    │                                                       │
  │    └── 201 → set createdAppointment, advance to            │
  │               STEP_PAYMENT                                 │
  └──────────────────────────────────────────────────────────┘
  
  [Error states summary]
  | Scenario | UX | User action |
  |----------|-----|-------------|
  | POST /clients fails (422) | Red inline error in step 3 | Correct field, retry |
  | POST /appointments (409) | Red banner: "Horario ocupado" | Pick new time, retry |
  | POST /appointments (5xx) | Red banner: "Error del servidor" | Retry |
  | POST /clients OK + POST /appointments fails | Client created orphan — no visible impact, user retries with new time | Acceptable; orphan client row is harmless |

Step 4 (PAYMENT)
  GET /config → {cbu_alias, cbu_number, whatsapp_number}
  Show CBU/Alias + deposit amount
  WhatsApp deep link with template
  [Fallback: if cbu_alias or cbu_number is empty → show "Consultá por WhatsApp para recibir los datos bancarios"]
  [Fallback: if whatsapp_number is empty → hide WhatsApp button, show "Contactanos para coordinar el pago"]
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/app/models.py` | Modify | Add `cbu_alias: str = ""` and `cbu_number: str = ""` to `Configuracion` |
| `backend/app/schemas.py` | Modify | Add both fields to `ConfiguracionUpdate` (Optional[str]) and `ConfiguracionRead` (str) |
| `backend/app/main.py` | Modify | No change needed to seed (SQLModel defaults handle empty) |
| `frontend/src/api.ts` | Modify | No change needed (config types inferred, but add `ConfigType` type with new fields for clarity) |
| `frontend/src/pages/Reservar.tsx` | Modify | Full refactor: step enum, 4 sections, DNI field, summary card, payment screen, WhatsApp button |
| `frontend/src/components/Calendar.tsx` | Modify | "Ocupado" label for unavailable slots, add privacy message below the time-slot grid: "Los horarios ocupados no muestran datos de otras clientas por protección de datos personales." |
| `frontend/src/pages/Admin.tsx` | Modify | Add `cbu_alias` and `cbu_number` inputs to config form section |

## Interfaces / Contracts

```typescript
// Step machine (Reservar.tsx)
type Step = 'service' | 'form' | 'confirm' | 'payment'

// Booking form state (Reservar.tsx)
type BookingForm = {
  nombre: string
  apellido: string
  telefono: string
  dni: string
  fechaHora: string
}

// Appointment created after API call (step 3 → 4 transition)
type CreatedAppointment = {
  id: number
  cliente_nombre: string
  fecha_hora_cita: string
  servicios: { nombre_servicio: string; precio_unitario: number }[]
  precio_historico_cobrado: number
  sena_historica_pagada: number
}

// Config type (api.ts, extends existing)
type ConfigType = {
  business_name: string
  whatsapp_number: string
  cbu_alias: string
  cbu_number: string
  // ... existing fields
}
```

```python
# models.py — Configuracion additions
class Configuracion(SQLModel, table=True):
    # ... existing fields
    cbu_alias: str = Field(default="")
    cbu_number: str = Field(default="")

# schemas.py — ConfiguracionUpdate additions
class ConfiguracionUpdate(BaseModel):
    # ... existing fields
    cbu_alias: Optional[str] = None
    cbu_number: Optional[str] = None

# schemas.py — ConfiguracionRead additions (inherits from model via from_attributes)
# No change needed: ConfiguracionRead uses from_attributes=True
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Backend unit | Configuracion model has new fields | Pytest — create config, assert cbu_alias/cbu_number are persistable |
| Backend unit | Config GET/PUT returns new fields | Pytest — GET /config, assert new fields in response |
| Frontend manual | Multi-step flow | Step through all 4 steps with browser; verify transitions, DNI required validation, WhatsApp link, "Ocupado" labels, privacy message |
| Frontend manual | Payment screen fallback | Clear CBU/Alias in config → verify "Consultá por WhatsApp" fallback |
| Frontend manual | WhatsApp missing | Clear whatsapp_number → verify button hidden, fallback text shown |
| Frontend manual | 409 conflict | While on step 3, manually book the slot via API → click confirm → verify red banner and staying on step 3 |
| Frontend manual | Network error | Disconnect network, confirm → verify error banner, retry available |

## Migration / Rollout

No migration required. New `Configuracion` fields have empty string defaults — SQLModel auto-adds columns. Admin can fill CBU/Alias at any time before the booking flow goes live.

## Open Questions

None.
