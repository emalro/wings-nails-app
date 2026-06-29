# Design: Public Booking Endpoints

**Change**: `public-booking`
**Phase**: design
**Source artifacts**: `exploration.md` (Approach A, T2 throttling locked), `proposal.md` (2-step pattern locked), `specs/public-booking/spec.md` (REQ-PUB-001..010).
**Status**: Design complete. Open questions O1–O5 resolved (see Open Questions section). Ready for `sdd-tasks`.

---

## Technical Approach

Two new unauthenticated endpoints (`POST /public/clients`, `POST /public/appointments`) added to `backend/app/main.py`, served by four new Pydantic schemas in `backend/app/schemas.py`. The 2-step pattern (lookup-or-create client → create cita) matches the existing `Reservar.tsx` flow. Throttling combines a per-IP `@limiter.limit("10/minute")` (default `get_remote_address`) and a per-DNI `@limiter.shared_limit("3/day", scope="public_booking_per_dni", key_func=...)`. A honeypot field is a `Field` in both request schemas and is checked before any DB write. Admin paths stay untouched. Race in lookup-or-create handled via `try/except IntegrityError` → re-query → return winner's id. Audit log emits one INFO line per request via stdlib `logging` with structured `extra={...}` fields.

---

## Architecture Decisions

### D1. Honeypot field placement

**Choice**: Single hidden HTML field rendered by a new `<HoneypotField/>` React component, embedded in the booking form. Submitted as a string in the JSON body. Server checks `.strip() == ""` before any DB work.
**Alternatives considered**: (a) JS-generated nonce on page load sent on submit; (b) captcha token (hCaptcha/reCAPTCHA).
**Rationale**: One HTML element + one field validator. Zero new deps, no third-party privacy cost, works for ~95% of naive spam-bots. (a) adds a roundtrip and React state, no real security gain against a curl-armed attacker; (b) is the "escalate to T3" path if production shows the simple honeypot is bypassed.

### D2. Honeypot response shape — silent 200 (no signal to the bot)

**Choice**: Return a **silent `200`** with the same response body shape as a successful create, but **without performing any database write**. Audit log records `outcome="honeypot"`.
**Alternatives considered**: (a) `400` with a generic Spanish message; (b) `422` with a `PydanticCustomError(honeypot_triggered)` (originally in REQ-PUB-005 of the spec).
**Rationale**: A 4xx response (400 or 422) gives the bot a signal that the honeypot was the cause — it can iterate: "I filled the field → got 4xx, so this field is special, let me try omitting it next time." A silent 200 with the same response shape as a real success gives the bot no signal. The per-DNI rate limit (REQ-PUB-006, 3/day) is the durable defense; the honeypot is the cheap first-line filter. The 429 (rate limit) is a separate, expected signal on any endpoint — bots learn nothing new from it. **Tradeoff**: a legitimate user with an autofill bug, password manager, or screen reader that fills the honeypot gets a "ghost appointment" (200 with a fake id, no real cita). This is mitigated by the CSS-hidden + `aria-hidden="true"` + `tabindex=-1` implementation — the field is invisible to humans and to assistive tech, so the only way to fill it is deliberate. The audit log gives the operator visibility into any false positive. **This is a deliberate deviation from the spec's original REQ-PUB-005 (which specified 422).** The spec has been updated to require silent 200 (O1 resolved).

### D3. Per-DNI rate-limit key extraction

**Choice**: A Pydantic dependency (`parse_public_appointment_payload`) reads `await request.json()`, validates via `PublicAppointmentCreate.model_validate(...)`, sets `request.state.dni = payload.dni`, and returns the model. The `key_func` reads `request.state.dni` (falling back to `request.client.host` on parse failure).
**Alternatives considered**: (a) custom `key_func` that reads `request._body` and re-parses JSON inline; (b) per-IP only (no per-DNI).
**Rationale**: FastAPI resolves `Depends` before calling the wrapped route, and slowapi's limit check runs inside the wrapper — so `request.state.dni` is set before the `key_func` reads it. The Pydantic dependency is the same one the route function consumes (`payload: PublicAppointmentCreate = Depends(...)`), so the body is parsed exactly once. (a) is fragile (`request._body` is a private starlette cache; the body may be a multipart upload; format assumption couples key_func to the schema). (b) loses the durable cap.

### D4. Atomic 1-step vs 2-step pattern

**Choice**: 2-step pattern (lookup-or-create client → create cita). Locked by the proposal.
**Rationale**: Matches the current `Reservar.tsx` mutation flow. Allows independent rate limits (per-IP on `/public/clients` only; per-IP + per-DNI on `/public/appointments`). Lets the user see "client created" vs "client matched" feedback. Race on concurrent same-DNI inserts is solved locally with `try/except IntegrityError` (REQ-PUB-010). 1-step would mix concerns, enlarge the failure surface, and complicate cancellation.

### D5. `Cliente.activo=False` handling

**Choice**: Public endpoints treat deactivated clients as "not found". `POST /public/clients` creates a new client (treating deactivated as a different person); `POST /public/appointments` returns `404`.
**Alternatives considered**: Silent reactivation; `403 Forbidden`.
**Rationale**: Silent reactivation is a privilege-escalation hole (a public caller cannot decide who is active in the salon's records). 403 leaks the deactivated state to a DNI enumerator. 404 with a generic "Cliente no encontrado" is indistinguishable from "this DNI has never booked", which is the privacy posture the operator wants. Admin can re-activate via the existing `POST /clients/{id}/reactivate` endpoint, out of scope here.

### D6. Audit log format

**Choice**: stdlib `logging` with `extra={...}` structured fields. One INFO line per public booking attempt.
**Alternatives considered**: `loguru`; dedicated `audit.py` module; JSON formatter.
**Rationale**: No new dependency. Render captures stdout (existing pattern in `database.py:14` and `main.py:164`). `extra={...}` is greppable with `jq`/plain regex. A `logging` filter is **not** added — the operator's access to Render logs is the audit boundary. Field schema: `timestamp` (ISO 8601 from logger default), `client_ip`, `dni`, `action` (`lookup_create_client` | `create_appointment`), `outcome` (`success` | `validation_error` | `rate_limit` | `honeypot` | `conflict` | `not_found` | `deactivated`).

### D7. Honeypot field name (security-by-obscurity)

**Choice**: `name="website"` on the DOM input, serialized as `"honeypot": ""` in the JSON body. Plausible-looking label to naive bots.
**Alternatives considered**: `name="honeypot"` (self-defeating).
**Rationale**: Documented in a code comment as a known weakness — sophisticated bots that strip hidden fields will defeat it. Acceptable trade-off because the per-DNI rate limit (REQ-PUB-006) is the durable defense; the honeypot is the cheap first-line filter. The DOM name and JSON key intentionally differ so a bot that learns one (e.g., from inspecting the network panel) does not automatically learn the other.

### D8. Race condition handling

**Choice**: `try/except IntegrityError` on `session.commit()`, re-query by DNI, return winner's id with `was_existing=True`.
**Alternatives considered**: `INSERT ... ON CONFLICT DO NOTHING RETURNING` (PostgreSQL-only).
**Rationale**: Portable across SQLite (tests) and PostgreSQL (prod). Explicit error path; the test for the race is straightforward (see Testing Strategy). `ON CONFLICT` is SQLAlchemy 2.0 dialect-specific and complicates the portable test base.

---

## Data Flow

```
                                   ┌─────────────────────────┐
                                   │ HoneypotField (hidden)  │
                                   │ <input name="website"   │
                                   │  value="" />            │
                                   └──────────┬──────────────┘
                                              │
Step 1: Visitor at /reservar                  │
Step 2: form.values (nombre, apellido,        │
        telefono, dni, fechaHora)             │
Step 3: handleConfirm() builds payload with   │
        honeypot = ""                         │
                                              ▼
                              POST /public/clients { dni, nombre,
                                    apellido, telefono, email,
                                    honeypot: "" }
                                              │
                                              ▼
                           ┌──────────────────────────────────────┐
                           │ backend/app/main.py                 │
                           │   parse_public_client_payload (Dep)  │
                           │     ├─ if honeypot.strip():         │
                           │     │    silent 200 (D2)             │
                           │     │    log outcome="honeypot"      │
                           │     │    return {id:0, was_existing:false}
                           │     ├─ lookup Cliente by dni+activo  │
                           │     │    hit  → 200 {id, was_existing:true}
                           │     │    miss → INSERT + commit      │
                           │     │      on IntegrityError:        │
                           │     │         rollback + re-query    │
                           │     │         → 200 {id, was_existing:true}
                           │     │      OK → 201 {id, was_existing:false}
                           │     └─ audit log INFO                │
                           └─────────────┬────────────────────────┘
                                         │
                                         ▼
                               POST /public/appointments { dni,
                                     servicios, fecha_hora_cita,
                                     precio, sena, honeypot: "" }
                                         │
                                         ▼
                           ┌──────────────────────────────────────┐
                           │ parse_public_appointment_payload     │
                           │   ├─ set request.state.dni for slowapi
                           │   ├─ if honeypot.strip():            │
                           │   │    silent 200 (D2)                │
                           │   │    log outcome="honeypot"         │
                           │   │    return fake response          │
                           │   ├─ lookup Cliente by dni+activo    │
                          │   │    miss → 404                    │
                          │   ├─ @limiter.shared_limit(3/day,    │
                          │   │    scope=public_booking_per_dni, │
                          │   │    key_func=get_dni_key)         │
                          │   ├─ validate_appointment_hours      │
                          │   ├─ find_conflicting_appointment    │
                          │   │    conflict → 409                │
                          │   ├─ Cita(estado=pendiente) +        │
                          │   │   CitaServicio[] + counter++     │
                          │   └─ audit log INFO                  │
                          └─────────────┬────────────────────────┘
                                        │
                                        ▼
                              201 { id, fecha_hora_cita,
                                    estado_cita: "Pendiente" }
                                        │
                                        ▼
                              Reservar.tsx step 4 (payment)
```

**Error paths**:
- Honeypot filled → **`200` silent** (no DB write, audit log records `outcome="honeypot"`)
- Per-DNI limit exceeded → `429`
- Per-IP limit exceeded → `429`
- DNI not found on `/public/appointments` → `404`
- `Cliente.activo=False` → `404` (indistinguishable from not found)
- Slot conflict → `409`
- Business hours violation → `422` (existing `validate_appointment_hours`)
- `sena > precio` → `422` (existing `sena_excede_precio`)
- `id_cliente` in body → `422` (extra="forbid")

---

## File Changes

| File | Action | Lines | Description |
|------|--------|-------|-------------|
| `backend/app/schemas.py` | Modify | +~80 | Add `PublicClientLookupRequest`, `PublicClientLookupResponse`, `PublicAppointmentCreate`, `PublicAppointmentResponse`. All `extra="forbid"`. Reuse `normalize_phone`, `_strip_tz`, `sena_excede_precio` pattern. (No `_honeypot_must_be_empty` validator — silent 200 is a route concern per D2.) |
| `backend/app/main.py` | Modify | +~160 | Add 2 endpoints, `parse_public_client_payload` + `parse_public_appointment_payload` deps, `get_dni_key` key_func, `log_public_booking()` helper, `IntegrityError` import. |
| `backend/tests/test_api.py` | Modify | +~280 | Add 8-10 tests including silent-200 honeypot tests (no DB write, audit log emitted) + re-introduce `_reset_rate_limiter` autouse fixture (B-8 pattern). |
| `frontend/src/components/HoneypotField.tsx` | New | ~30 | Hidden input (`aria-hidden`, `tabindex=-1`, absolute off-screen). |
| `frontend/src/components/HoneypotField.test.tsx` | New | ~45 | Vitest: render, assert `tabindex === -1`, `aria-hidden === "true"`, value empty. |
| `frontend/src/api.ts` | Modify | +~30 | `PublicClientLookupRequest/Response`, `PublicAppointmentCreate/Response` types + `lookupOrCreatePublicClient` + `createPublicAppointment`. |
| `frontend/src/pages/Reservar.tsx` | Modify | +60-80 diff | Switch mutations to new endpoints, embed `<HoneypotField/>`, derive step-4 summary from `form.values` (not from server response). No new error types to handle (honeypot is silent 200). |
| `openspec/changes/public-booking/specs/public-booking/spec.md` | Modify (delta) | -8/+30 lines | REQ-PUB-005 rewritten for silent 200 (already applied; design was finalized after). |
| `DOCUMENTATION.md` | Modify | +~20 | Changelog entry. |

**Total estimated**: **~720 changed lines** (180% of the 400-line review budget).

**Delivery strategy** — recommended **D3 (single PR, many small commits)** — see Risks section.

---

## Interfaces / Contracts

### Schemas (`backend/app/schemas.py`)

```python
class PublicClientLookupRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    dni: str = Field(min_length=7, max_length=8, pattern=r"^\d+$")
    nombre: str = Field(min_length=1, max_length=100)
    apellido: str = Field(min_length=1, max_length=100)
    telefono: str  # validated via normalize_phone (>=7 digits)
    email: Optional[str] = Field(default=None, max_length=200)
    honeypot: str = Field(default="", max_length=500)  # expected empty; silent 200 if filled (D2)

    # NO field_validator on honeypot -- the route does the silent 200 check
    # before any DB work. Pydantic should not raise; the response must look
    # identical to a real success.

    @field_validator("telefono")
    @classmethod
    def _normalize_telefono(cls, v: str) -> str:
        return normalize_phone(v)  # raises ValueError if <7 digits


class PublicClientLookupResponse(BaseModel):
    id: int
    was_existing: bool


class PublicCitaServicioCreate(BaseModel):
    servicio_id: int
    duracion_minutos: int = Field(gt=0)
    precio_unitario: float = Field(ge=0)
    subtotal: float = Field(ge=0)


class PublicAppointmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    dni: str = Field(min_length=7, max_length=8, pattern=r"^\d+$")
    servicios: List[PublicCitaServicioCreate] = Field(min_length=1)
    fecha_hora_cita: datetime
    precio_historico_cobrado: float = Field(ge=0)
    sena_historica_pagada: float = Field(ge=0)
    honeypot: str = Field(default="", max_length=500)  # expected empty; silent 200 if filled (D2)

    # NO field_validator on honeypot -- see note above

    @field_validator("fecha_hora_cita", mode="after")
    @classmethod
    def _accept_naive_or_aware(cls, v):  # matches CitaCreate
        return v.replace(tzinfo=None) if v.tzinfo else v

    @model_validator(mode="after")
    def check_sena_no_supera_precio(self):
        if self.sena_historica_pagada > self.precio_historico_cobrado:
            raise PydanticCustomError("sena_excede_precio", ...)  # reused
        return self


class PublicAppointmentResponse(BaseModel):
    id: int
    fecha_hora_cita: datetime
    estado_cita: EstadoCita  # always "Pendiente"
```

### Routes (`backend/app/main.py`)

```python
PUBLIC_BOOKING_PER_DNI_LIMIT = "3/day"
PUBLIC_BOOKING_IP_LIMIT = "10/minute"


async def parse_public_client_payload(
    request: Request,
) -> PublicClientLookupRequest:
    body = await request.json()
    payload = PublicClientLookupRequest.model_validate(body)
    request.state.dni = payload.dni
    return payload


async def parse_public_appointment_payload(
    request: Request,
) -> PublicAppointmentCreate:
    body = await request.json()
    payload = PublicAppointmentCreate.model_validate(body)
    request.state.dni = payload.dni
    return payload


def get_dni_key(request: Request) -> str:
    dni = getattr(request.state, "dni", None)
    if dni:
        return f"dni:{dni}"
    return f"ip:{request.client.host}"  # fallback before Depends resolves


def log_public_booking(request: Request, dni: str, action: str, outcome: str) -> None:
    import logging
    logging.getLogger("public_booking").info(
        "public_booking event",
        extra={
            "client_ip": request.client.host if request.client else None,
            "dni": dni,
            "action": action,
            "outcome": outcome,
        },
    )


@app.post("/public/clients", response_model=PublicClientLookupResponse, status_code=201)
@limiter.limit(PUBLIC_BOOKING_IP_LIMIT)
def public_lookup_or_create_client(
    request: Request,
    payload: PublicClientLookupRequest = Depends(parse_public_client_payload),
    session: Session = Depends(get_session),
):
    # Silent 200 honeypot check (D2): if filled, log it and return a fake
    # success response WITHOUT any DB write. The bot gets no signal that
    # the honeypot was the cause; the response shape matches a real create.
    if payload.honeypot.strip():
        log_public_booking(request, payload.dni, "lookup_create_client", "honeypot")
        return PublicClientLookupResponse(id=0, was_existing=False)

    existing = session.exec(
        select(Cliente).where(Cliente.dni == payload.dni, Cliente.activo == True)
    ).first()
    if existing:
        log_public_booking(request, payload.dni, "lookup_create_client", "success")
        return PublicClientLookupResponse(id=existing.id, was_existing=True)

    try:
        db_client = Cliente(
            dni=payload.dni,
            nombre=payload.nombre,
            apellido=payload.apellido,
        )
        session.add(db_client)
        session.commit()
        session.refresh(db_client)
        if payload.telefono:
            session.add(ClienteTelefono(
                id_cliente=db_client.id,
                telefono=payload.telefono,
                es_principal=True,
            ))
            session.commit()
        log_public_booking(request, payload.dni, "lookup_create_client", "success")
        return PublicClientLookupResponse(id=db_client.id, was_existing=False)
    except IntegrityError:
        session.rollback()
        existing = session.exec(
            select(Cliente).where(Cliente.dni == payload.dni, Cliente.activo == True)
        ).first()
        if existing:
            log_public_booking(request, payload.dni, "lookup_create_client", "success")
            return PublicClientLookupResponse(id=existing.id, was_existing=True)
        raise  # truly unexpected


@app.post("/public/appointments", response_model=PublicAppointmentResponse, status_code=201)
@limiter.limit(PUBLIC_BOOKING_IP_LIMIT)
@limiter.shared_limit(
    PUBLIC_BOOKING_PER_DNI_LIMIT,
    scope="public_booking_per_dni",
    key_func=get_dni_key,
)
def public_create_appointment(
    request: Request,
    payload: PublicAppointmentCreate = Depends(parse_public_appointment_payload),
    session: Session = Depends(get_session),
):
    # Silent 200 honeypot check (D2): same as /public/clients.
    if payload.honeypot.strip():
        log_public_booking(request, payload.dni, "create_appointment", "honeypot")
        # Return a fake appointment response; no Cita row created,
        # no cantidad_turnos_tomados increment.
        return PublicAppointmentResponse(
            id=0,
            fecha_hora_cita=payload.fecha_hora_cita,
            estado_cita=EstadoCita.pendiente,
        )

    client = session.exec(
        select(Cliente).where(Cliente.dni == payload.dni, Cliente.activo == True)
    ).first()
    if not client:
        log_public_booking(request, payload.dni, "create_appointment", "not_found")
        raise HTTPException(404, "Cliente no encontrado")

    duration = sum(s.duracion_minutos for s in payload.servicios)
    validate_appointment_hours(payload.fecha_hora_cita, duration, session)
    conflict = find_conflicting_appointment(payload.fecha_hora_cita, duration, session)
    if conflict:
        log_public_booking(request, payload.dni, "create_appointment", "conflict")
        raise HTTPException(409, "El horario elegido ya esta ocupado.")

    cita = Cita(
        id_cliente=client.id,
        fecha_hora_cita=payload.fecha_hora_cita,
        precio_historico_cobrado=payload.precio_historico_cobrado,
        sena_historica_pagada=payload.sena_historica_pagada,
        metodo_pago_sena="Transferencia",
        estado_cita=EstadoCita.pendiente,  # hardcoded -- REQ-PUB-004
    )
    session.add(cita)
    session.commit()
    session.refresh(cita)
    for s in payload.servicios:
        session.add(CitaServicio(
            cita_id=cita.id,
            servicio_id=s.servicio_id,
            duracion_minutos=s.duracion_minutos,
            precio_unitario=s.precio_unitario,
            subtotal=s.subtotal,
        ))
    client.cantidad_turnos_tomados += 1
    session.commit()
    session.refresh(cita)
    log_public_booking(request, payload.dni, "create_appointment", "success")
    return PublicAppointmentResponse(
        id=cita.id, fecha_hora_cita=cita.fecha_hora_cita, estado_cita=cita.estado_cita
    )
```

### HoneypotField component (`frontend/src/components/HoneypotField.tsx`)

```typescript
import React from 'react'

export function HoneypotField() {
  return (
    <input
      type="text"
      name="website"   // plausible-looking (D7)
      value=""
      onChange={() => {}}  // suppress React controlled-input warning
      aria-hidden="true"
      tabIndex={-1}
      autoComplete="off"
      style={{
        position: 'absolute',
        left: '-9999px',
        top: 'auto',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
      }}
    />
  )
}
```

### Vitest (`frontend/src/components/HoneypotField.test.tsx`)

```typescript
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { HoneypotField } from './HoneypotField'

describe('HoneypotField', () => {
  it('renders a hidden text input', () => {
    const { container } = render(<HoneypotField />)
    const input = container.querySelector('input') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.name).toBe('website')
    expect(input.value).toBe('')
    expect(input.getAttribute('aria-hidden')).toBe('true')
    expect(input.tabIndex).toBe(-1)
    expect(input.getAttribute('autocomplete')).toBe('off')
  })

  it('is positioned off-screen (not display:none — that defeats bot detection)', () => {
    const { container } = render(<HoneypotField />)
    const input = container.querySelector('input') as HTMLInputElement
    expect(input.style.position).toBe('absolute')
    expect(input.style.left).toBe('-9999px')
  })
})
```

### API wrapper (`frontend/src/api.ts`)

```typescript
export interface PublicClientLookupRequest {
  dni: string
  nombre: string
  apellido: string
  telefono: string
  email?: string | null
  honeypot: string
}

export interface PublicClientLookupResponse {
  id: number
  was_existing: boolean
}

export interface PublicCitaServicioCreate {
  servicio_id: number
  duracion_minutos: number
  precio_unitario: number
  subtotal: number
}

export interface PublicAppointmentCreate {
  dni: string
  servicios: PublicCitaServicioCreate[]
  fecha_hora_cita: string
  precio_historico_cobrado: number
  sena_historica_pagada: number
  honeypot: string
}

export interface PublicAppointmentResponse {
  id: number
  fecha_hora_cita: string
  estado_cita: string
}

export async function lookupOrCreatePublicClient(
  payload: PublicClientLookupRequest,
): Promise<PublicClientLookupResponse> {
  const r = await api.post('/public/clients', payload)
  return r.data
}

export async function createPublicAppointment(
  payload: PublicAppointmentCreate,
): Promise<PublicAppointmentResponse> {
  const r = await api.post('/public/appointments', payload)
  return r.data
}
```

### Error table — NO change required (`frontend/src/lib/apiErrors.ts`)

Per D2, the server returns silent `200` on a honeypot trigger — it never raises a `honeypot_triggered` error type. The `ApiErrorType` union and `API_ERROR_MESSAGES` lookup table in `frontend/src/lib/apiErrors.ts` are **unchanged**. The frontend cannot and should not distinguish a honeypot-triggered response from a real success; the audit log is the only place this outcome is recorded.

---

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Backend unit | Pydantic schemas (DNI pattern, sena>precio, extra="forbid") | Inline: each test posts an invalid body and asserts 422 with the right `type` string. **No honeypot-triggered 422 test** — honeypot is silent 200, never an error. |
| Backend integration | Endpoint behavior | TestClient + FastAPI app + autouse `_reset_rate_limiter` fixture (re-introduced from B-8, `test_api.py:88-97`). |
| Backend integration | Silent-200 honeypot | POST with `honeypot="spam"`. Assert: (a) response is 200, (b) body matches the success shape (e.g., `{"id": 0, "was_existing": False}` for `/public/clients`), (c) no row was created in the DB (count Cliente/Cita before and after), (d) `cantidad_turnos_tomados` is unchanged for `/public/appointments`, (e) audit log emitted with `outcome="honeypot"`. |
| Backend race | Concurrent same-DNI posts | **Sequential session strategy** (simpler than `threading.Thread`+`Barrier`): the test first calls `POST /public/clients` once, then opens a second `Session(engine)`, inserts a competing `Cliente` with the same DNI via raw `session.add(Cliente(...))`, commits, and then calls `POST /public/clients` AGAIN — expecting `was_existing: true` with the second session's id. (Spec scenario "Manual race simulation in pytest" at line 163-167 of the spec.) This avoids DB-locking flakiness in the test runner. |
| Backend audit log | INFO line emitted | `caplog.set_level(logging.INFO, logger="public_booking")`, post once, assert record has the right `action`/`outcome`/`dni` fields. Tests cover `outcome="success"`, `"honeypot"`, `"not_found"`, `"conflict"`, `"rate_limit"` (via the limit decorator). |
| Frontend unit | HoneypotField render | `render`, assert attributes; `screen.getByRole('textbox', { hidden: true })` or DOM query. |
| Frontend unit | apiErrors lookup | **No new test needed** — the `honeypot_triggered` type is never raised by the server (D2), so the lookup table is unchanged. |
| Manual smoke | End-to-end at `/reservar` | Documented in `proposal.md:108-110`. Not automated (no E2E infra). |

### Test count target: 9-11 new pytest, 2-3 new Vitest

---

## Migration / Rollout

**No migration required.** No DB schema change. No data backfill. The new endpoints are additive; the existing admin paths stay auth-gated. Deploy is a normal Render deploy: backend picks up the new routes, frontend picks up the new components.

**Rollback**: `git revert` of the merge commit. The admin path is untouched; reverting disables the new public endpoints and the frontend falls back to the (broken) admin path with 401 — same state as before the change. No data loss, no migration to roll back.

---

## Open Questions

- **O1. ✅ RESOLVED — Honeypot response shape: silent 200.** User chose a **silent 200** over 400/422 to maximize bot-fingerprinting resistance. Spec REQ-PUB-005 has been updated. The server returns 200 with the same response shape as a real success, performs no DB write, and emits `outcome="honeypot"` in the audit log. Pydantic schema does NOT raise on a filled honeypot — the route handles the silent 200 check. See D2.
- **O2. Race test strategy.** Recommend **sequential session simulation** (Testing Strategy table). Avoids DB-locking flakiness. The threading approach is documented as a follow-up if the sequential one proves insufficient. **Resolved by recommendation** — proceed unless the apply phase finds issues.
- **O3. `email` field — required or optional?** Proposal says optional. **Confirm: optional, default `None`, max_length=200.** No uniqueness check. **Resolved by recommendation** — apply uses optional.
- **O4. Audit log: hash the DNI?** Recommend **plain DNI in the log**. Render's log access is already a privilege boundary; hashing adds complexity without a concrete threat model. The DNI is needed in plaintext to correlate with the Cliente record if a fraud investigation happens. **Resolved by recommendation** — apply logs plain DNI.
- **O5. Per-DNI rate limit reset behavior.** The spec says "24h". slowapi's `3/day` is a 24-hour sliding window. No ambiguity, but document for the operator. **Resolved by spec** — no further work needed.

---

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|------------|--------|------------|
| R1 | Honeypot bypassed by sophisticated bots | Medium | Low | Per-DNI rate limit (3/day) is the durable defense. Silent 200 prevents the iterative "honeypot learning" attack (the bot gets no signal). `name="website"` frustrates naive scanners. Escalate to T3 (hCaptcha) if production logs show the honeypot alone isn't enough. |
| R2 | slowapi in-memory backend resets on Render restart | High | Low | Document. Acceptable for low-volume single-tenant. Future hardening: Upstash Redis (already in `python-backend` skill). |
| R3 | Race test fragile in CI | Medium | Medium | Sequential session strategy is deterministic. Threading test kept as a stretch goal, not a gate. |
| R4 | Reservar.tsx refactor leaks `id_cliente` | Medium | High | Switch is mechanical: replace `useCreateClient`/`useCreateAppointment` calls with new function calls; drop `id_cliente` from the appointment payload. TDD: each commit includes the new function call + a Vitest update on `Reservar.tsx` smoke. |
| R5 | `extra="forbid"` is too strict | Low | Medium | All public callers are our own frontend. Document in a code comment. Any future change to the schema (e.g., adding `observaciones`) goes through a new field, never a wildcard. |
| R6 | ~~400 honeypot response conflicts with spec REQ-PUB-005~~ | — | — | **Resolved** — REQ-PUB-005 updated to silent 200. Spec is in sync. |
| R7 | **~720 lines exceeds 400-line PR review budget by 80%** | High | Medium | **Adopt D3: single PR, ~6-7 small work-unit commits** (one per concern: schemas, deps/parse helpers + audit helper, `/public/clients` endpoint + silent-200 test + happy-path test, `/public/appointments` endpoint + silent-200 test + happy-path test, race + rate-limit + audit tests, HoneypotField + Vitest, Reservar.tsx refactor + smoke). Each commit is independently testable; the diff is reviewable because each commit is ~80-100 lines. (A 2-PR split was considered and rejected: the frontend refactor is small, the dependency on the new endpoints is hard, and PR overhead isn't worth the ~400 lines of savings.) |

---

## Traceability Matrix

| Requirement | Files that satisfy it |
|-------------|----------------------|
| REQ-PUB-001 | `backend/app/schemas.py` (PublicClientLookupRequest/Response); `backend/app/main.py` (parse_public_client_payload, public_lookup_or_create_client). |
| REQ-PUB-002 | `backend/app/schemas.py` (PublicAppointmentCreate/Response); `backend/app/main.py` (public_create_appointment). |
| REQ-PUB-003 | `backend/app/schemas.py` (extra="forbid" on both schemas). |
| REQ-PUB-004 | `backend/app/main.py` (literal `estado_cita=EstadoCita.pendiente`); `schemas.py` (no `estado_cita` field on PublicAppointmentCreate). |
| REQ-PUB-005 | `backend/app/schemas.py` (`honeypot` field declared, no validator — silent 200 is a route concern); `backend/app/main.py` (silent 200 check at top of both endpoints, log + return fake success); `frontend/src/components/HoneypotField.tsx` + `.test.tsx`. **No `apiErrors.ts` change** (server never raises a `honeypot_triggered` type — see D2). |
| REQ-PUB-006 | `backend/app/main.py` (`@limiter.shared_limit("3/day", scope="public_booking_per_dni", key_func=get_dni_key)`). |
| REQ-PUB-007 | `backend/app/main.py` (`@limiter.limit("10/minute")` on both). |
| REQ-PUB-008 | `backend/app/main.py` (`Cliente.activo == True` filter in both endpoints). |
| REQ-PUB-009 | `backend/app/main.py` (`log_public_booking()` helper + calls in both endpoints). |
| REQ-PUB-010 | `backend/app/main.py` (`try/except IntegrityError` in public_lookup_or_create_client). |
| REQ-PUB-005/Frontend | `frontend/src/components/HoneypotField.tsx`, `frontend/src/pages/Reservar.tsx` (embeds the field in the form). |
| All (e2e) | `frontend/src/api.ts` (2 new functions); `frontend/src/pages/Reservar.tsx` (switches mutations). |

---

## Relevant Files (read or to be modified)

**Read for this design**:
- `backend/app/main.py:1-200, 197-200, 211-247, 350-461, 740-839, 948-980` (limiter setup, login, clients, appointments, busy_slots, find_conflicting_appointment)
- `backend/app/schemas.py:10-54, 156-186, 287-307` (normalize_phone, _strip_tz, CitaCreate, CitaRead)
- `backend/app/models.py:1-50, 67-78` (Cliente.dni unique, Cita, CitaServicio, EstadoCita)
- `backend/.venv/lib/python3.14/site-packages/slowapi/extension.py:555-790` (limiter check order: Depends first, wrapper calls _check_request_limit, then key_func)
- `backend/tests/test_api.py:1-50, 230-292` (TestClient setup, _unique_dni/_unique_phone, _create_test_client_and_appointment)
- `frontend/src/api.ts:34-49, 152-160, 336-360` (axios instance, createClient/createAppointment, type definitions)
- `frontend/src/lib/apiErrors.ts:1-89` (getApiError, API_ERROR_MESSAGES, ApiErrorType)
- `frontend/src/lib/apiErrors.test.ts:1-83` (Vitest pattern)
- `frontend/src/pages/Reservar.tsx:140-183, 484-557` (handleConfirm, renderPaymentStep)

**To be modified**: see File Changes table above.
