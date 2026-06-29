# Exploration: `public-booking`

**Change**: `public-booking`
**Status**: Explore
**Branch target**: `feat/public-booking` from `origin/main` (post PR #51 merge)
**User decision (locked)**: Approach A — new public endpoints (`POST /public/clients`, `POST /public/appointments`); admin paths stay as-is. Aggressive throttling required.

---

## 1. Current State of the Public Booking Flow

### Frontend path (broken)

`frontend/src/pages/Reservar.tsx:140-183` `handleConfirm()`:

```ts
const client = await createClientMutation.mutateAsync({
  nombre, apellido, telefono: normalizePhone(form.values.telefono), dni,
})
const appointmentPayload = {
  id_cliente: client.id,                    // ← trusts the server's id
  fecha_hora_cita: form.values.fechaHora,
  precio_historico_cobrado: totalAmount,
  sena_historica_pagada: depositAmount,
  servicios: selectedServiceList.map(...),
}
const appt = await createAppointmentMutation.mutateAsync(appointmentPayload)
```

- `useCreateClient` → `createClient(payload)` → `api.post('/clients', payload)` (`api.ts:152-155`)
- `useCreateAppointment` → `createAppointment(payload)` → `api.post('/appointments', payload)` (`api.ts:157-160`)
- No `Authorization` header is attached on the public flow because the request interceptor at `api.ts:43-49` only attaches the token if one is stored in `localStorage`, and no token exists for a public visitor.
- The frontend has NO retry / no `/auth/me` probe — it just sends POST → expects 201 → moves to step 4.

### Backend path (auth-gated, returns 401)

`backend/app/main.py:424-461` `create_client`:
```python
@app.post("/clients", response_model=ClienteRead)
def create_client(client: ClienteCreate, current_user: Usuario = Depends(get_current_user), session: Session = Depends(get_session)):
    ...
```

`backend/app/main.py:794-839` `create_appointment`:
```python
@app.post("/appointments", response_model=CitaRead)
def create_appointment(appointment: CitaCreate, current_user: Usuario = Depends(get_current_user), session: Session = Depends(get_session)):
    client = session.get(Cliente, appointment.id_cliente)
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    ...
```

### The gap

A real visitor on `/reservar` (no JWT) hits both endpoints → 401. The frontend's catch block at `Reservar.tsx:170-181` falls through to `"Ocurrió un error. Intentá de nuevo."` because it has no 401 branch. The booking is silently lost.

The lookup-or-create logic at `main.py:428-457` (DNI first, then phone, then INSERT) is correct; it just lives behind an auth wall.

### Other affected admin endpoints (NOT touched by this change)

`GET/PATCH/DELETE /clients/{id}`, `GET /clients/search`, `GET /clients`, `GET /clients/{id}/appointments`, `GET/PATCH/DELETE /appointments/{id}` all stay auth-gated. The new public endpoints are strictly additive.

---

## 2. Current `slowapi` / Throttling Infrastructure

`backend/app/main.py:197-200`:
```python
# Rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

- `key_func=get_remote_address` → buckets keyed by client IP
- slowapi default `key_style="url"` → /clients and /appointments have independent buckets
- `LOGIN_RATE_LIMIT` env var defaults to `"5/minute"` (`main.py:21`)
- Current usage: only `POST /auth/login` at `main.py:211-213`:
  ```python
  @app.post("/auth/login", response_model=TokenResponse)
  @limiter.limit(LOGIN_RATE_LIMIT)
  def login(request: Request, login_data: LoginRequest, session: Session = Depends(get_session)):
  ```
- **Critical slowapi pattern**: the endpoint MUST accept `request: Request` as a parameter or the decorator raises `ValueError` at startup. (See `main.py:213` line.)

### Test-isolation pattern (reverted but proven)

The B-8 reverted commit (`f2a86b6`) introduced a working autouse fixture in `backend/tests/test_api.py`:
```python
@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    yield
    from app.main import limiter
    limiter.reset()
```
This calls `limiter.reset()` after every test, giving each test a clean rate-limit window. It is necessary because (a) all `TestClient` calls share the same IP `"testclient"`, and (b) the existing 50+ tests in `test_api.py` already exceed `10/minute` if the limit is added globally.

The fix improved the full suite from 153 passed + 4 failed → 157 passed + 1 failed (the 1 remaining is pre-existing `.env` `LOGIN_RATE_LIMIT=5/minute` overriding test settings).

---

## 3. The 6 Problems to Address

| # | Problem | Symptom | Code Location | Fix in New Endpoint |
|---|---------|---------|---------------|--------------------|
| 1 | **Endpoint auth** | 401 on real visitor submit | `main.py:425, 795` | New `/public/clients` and `/public/appointments` with NO `Depends(get_current_user)`; admin paths untouched |
| 2 | **`id_cliente` abusable** | Public caller can book for any client_id | `main.py:796, 810` | Public `/public/appointments` accepts `dni: str` (not `id_cliente`); backend resolves the client internally |
| 3 | **`estado_cita` abusable** | Public caller can set `estado_cita = "Asistido"` | `main.py:816-817` (admin path) | Public endpoint hardcodes `EstadoCita.pendiente`; `estado_cita` is not in the request schema |
| 4 | **PII leak on lookup-match** | Returning full `ClienteRead` on match is a DNI enumeration vector | `main.py:432-433` (admin path returns the full record) | Public endpoint returns minimal `{ id, was_existing: bool }` only — no name, no phone, no DNI echoed, no counters |
| 5 | **Race in lookup-or-create** | Two concurrent requests with same DNI both INSERT → second one gets `IntegrityError` (uncaught → 500) | `main.py:446-449` (admin path) | Public endpoint wraps the INSERT in `try/except IntegrityError` and re-queries on conflict (returns `{ id, was_existing: true }` with the winner's id) |
| 6 | **Abuse / throttling** | Unauthenticated POST = scriptable abuse surface | n/a (no current limit on these paths) | See Section 4 — recommended: **T2 (honeypot + per-DNI limit)** |

---

## 4. Throttling Strategy — Comparison & Recommendation

The user asked for "aggressive throttling (CAPTCHA / honeypot / OTP)". Five options compared:

### T1: Honeypot field only
- **What**: Hidden form field (CSS off-screen, `aria-hidden`, `tabindex=-1`, label "Leave this field empty"). Real users never fill it; bots autofill all fields. Server rejects with 422 if filled.
- **Pros**: Zero human friction. No third-party dependency. One new form field + one server check (~5 lines). Battle-tested pattern (used by every major CMS).
- **Cons**: Doesn't catch sophisticated bots that parse CSS to detect hidden fields. Scripted attackers can omit the field.
- **Effort**: Low (~10 lines backend, ~20 lines frontend).

### T2: Honeypot + per-DNI rate limit
- **What**: T1 + `@limiter.limit("3/day", key_func=lambda req: req.state.dni)` on `/public/appointments`. Limit fires on the DNI from the request body, not the IP. IPs can rotate freely; the same DNI is capped regardless.
- **Pros**: Catches both naive bots (honeypot) and IP-rotating scripts (per-DNI). No third-party dependency. Real users never hit the per-DNI cap (3 reservations per day is generous for a single client).
- **Cons**: A real client who shares their DNI (e.g., a child or partner) could theoretically hit the cap. **Mitigation**: 3/day is way above the normal booking rate for a nail salon (1/month typical).
- **Effort**: Low-Medium (~20 lines backend, ~10 lines frontend).

### T3: Honeypot + per-DNI + CAPTCHA fallback
- **What**: T2 + after N (e.g., 2) rate-limit hits per IP in 1 hour, the next response includes a `captcha_required: true` flag. The frontend renders an hCaptcha/reCAPTCHA widget. Backend verifies the token via the captcha service.
- **Pros**: Defense in depth.
- **Cons**: Third-party dependency (privacy concerns: hCaptcha/reCAPTCHA track users). UX friction when triggered. Privacy policy implications for the salon (Argentina has personal-data laws). `render.yaml` would need the captcha secret key.
- **Effort**: High (~80 lines backend, ~50 lines frontend, env var plumbing, privacy policy update).

### T4: OTP at phone (one-time code via WhatsApp/SMS)
- **What**: After form submit, server sends a 6-digit code via WhatsApp/SMS. Client enters code on a 2nd step. Server validates, then processes the booking.
- **Pros**: Strongest verification. Prevents fake bookings with someone else's phone.
- **Cons**: 30-60s extra friction per booking. Requires Twilio / WhatsApp Business API integration (new dep, monthly cost, env var, async webhook). **Out of scope for a single-tenant low-volume salon**.
- **Effort**: Very High (~150+ lines backend, 2 new endpoints, third-party integration, full async messaging flow).

### T5: Honeypot + per-DNI + soft phone verification
- **What**: T2 + a stricter phone format check (e.g., must be a valid Argentine mobile prefix 11/15 + 8 digits) + a simple "type the day of the week" question.
- **Pros**: Less friction than T4.
- **Cons**: Barely adds value over T2 (the honeypot already catches the same bot class). The phone prefix check is bypassable. The "day of week" question is solvable by all modern bots (LLM-based).
- **Effort**: Medium (~30 lines).

### Recommendation: **T2 (honeypot + per-DNI)**

Reasoning, in order of weight:

1. **No third-party dependency** — T3 and T4 require external services, env vars in `render.yaml`, and ongoing cost/privacy review. The project has zero third-party deps for booking flow today. Adding one expands the supply chain.
2. **Bots vs real users are very different on this flow** — A nail salon's public booking is low-incentive for abuse (no money moves until the client shows up and pays). The threat model is spam-bots, not targeted attacks. T2's honeypot handles spam-bots effectively.
3. **IP rotation doesn't help an attacker** — A scripted attacker that rotates IPs to flood `/public/appointments` is still capped at 3 reservations per unique DNI. They'd need a DNI generator that produces real, unique, valid Argentine DNIs to do meaningful damage. The cost/benefit is unattractive.
4. **3 reservations per day per DNI is generous** — A real client can book, cancel, and rebook within a day. A family member using the same DNI is still within bounds. The salon is a low-volume single-tenant system.
5. **T4 (OTP) is overkill** — The user said "aggressive throttling", not "user verification". T4 is user verification. Different problem.
6. **T2 is reversible** — If abuse is observed in production, escalating to T3 is a small change.

---

## 5. Schema Design Preview

Following Approach A (new public endpoints) and the T2 throttling strategy:

### `POST /public/clients` — lookup-or-create by DNI

```
Request:
  {
    "dni": "12345678",          // 7-8 digits, primary identifier
    "nombre": "María",          // required (must be present at lookup or create)
    "apellido": "González",     // required
    "telefono": "3411234567",   // required, digits-only (10-11)
    "email": "maria@...",       // OPTIONAL (collect but not validated against duplicates)
    "honeypot_field": ""        // must be empty; non-empty → 422
  }

Response 200 (DNI matched existing client):
  { "id": 42, "was_existing": true }
  // No name, no phone, no DNI echoed, no counters
  // Confirms the booking can proceed with id=42

Response 201 (DNI did not exist, client created):
  { "id": 42, "was_existing": false }

Response 400: validation error (DNI format, phone format, honeypot filled)
Response 409: IntegrityError resolved → returns the winner's id as 200
Response 422: honeypot filled, or unknown validation error
Response 429: per-IP rate limit (e.g., 10/minute, slowapi default)
```

### `POST /public/appointments` — create pending cita, resolve client via DNI

```
Request:
  {
    "dni": "12345678",                  // required, must match an existing client
    "servicios": [
      { "servicio_id": 1, "duracion_minutos": 60,
        "precio_unitario": 5000, "subtotal": 5000 }
    ],
    "fecha_hora_cita": "2026-07-15T14:00:00",  // naive ISO
    "precio_historico_cobrado": 5000,
    "sena_historica_pagada": 2000,
    "honeypot_field": ""
  }

Response 201 (created):
  {
    "id": 99,
    "fecha_hora_cita": "2026-07-15T14:00:00",  // naive ISO
    "estado_cita": "Pendiente"                  // ALWAYS Pendiente, hardcoded
  }
  // Minimal — no id_cliente, no cliente_nombre (less PII echo)

Response 400: validation error (DNI format, missing field, etc.)
Response 404: DNI not found (client doesn't exist; user should call /public/clients first)
Response 409: time slot conflict (existing find_conflicting_appointment logic)
Response 422: honeypot filled, business hours violation, sena > precio
Response 429: per-IP rate limit AND/OR per-DNI rate limit (3/day)
```

### Decision: 2-step pattern (NOT atomic 1-step)

**Recommendation**: 2-step matches the current `Reservar.tsx` flow (1) and surfaces clearer errors to the frontend. The race in lookup-or-create is solved with `try/except IntegrityError` re-query, not by going atomic. The 1-step pattern would require:
- A new combined schema
- Frontend refactor of the 2-step success path
- Larger endpoint with more failure modes (DNI missing, DNI exists but with different name → conflict?, etc.)
- Cancellation becomes harder (transaction rollback on cita-side error leaves a stranded client)

**Trade-off**: The 2-step pattern has a small window where a client can be created without a corresponding cita (e.g., user closes the tab between steps 1 and 2). Mitigation: the public `POST /clients` only creates clients that explicitly intend to book — DNIs from cancellations can be `activo=False`'d by the admin in a future cleanup job. This is acceptable for a low-volume salon.

### Pydantic schemas (new in `backend/app/schemas.py`)

```python
class PublicClienteCreate(BaseModel):
    dni: str = Field(pattern=r"^\d{7,8}$")
    nombre: str = Field(min_length=1, max_length=100)
    apellido: str = Field(min_length=1, max_length=100)
    telefono: str = Field(min_length=7, max_length=20)
    email: Optional[str] = Field(default=None, max_length=200)
    honeypot_field: str = Field(default="", max_length=500)  # must be empty

    @field_validator("dni", "telefono")  # normalize phone, strip DNI
    @classmethod
    def _normalize(cls, v: str) -> str: ...

    @field_validator("honeypot_field")
    @classmethod
    def _honeypot_must_be_empty(cls, v: str) -> str:
        if v.strip():
            # Return a friendly error to the public caller
            raise PydanticCustomError(
                "honeypot_triggered",
                "La solicitud no pudo procesarse",
                {},
            )
        return v


class PublicClienteResponse(BaseModel):
    id: int
    was_existing: bool


class PublicCitaServicioCreate(BaseModel):
    servicio_id: int
    duracion_minutos: int
    precio_unitario: float = Field(ge=0)
    subtotal: float = Field(ge=0)


class PublicCitaCreate(BaseModel):
    dni: str = Field(pattern=r"^\d{7,8}$")
    servicios: List[PublicCitaServicioCreate] = Field(min_length=1)
    fecha_hora_cita: datetime
    precio_historico_cobrado: float = Field(ge=0)
    sena_historica_pagada: float = Field(ge=0)
    honeypot_field: str = Field(default="", max_length=500)

    @model_validator(mode="after")
    def check_sena_no_supera_precio(self):
        # Reuse the same PydanticCustomError contract as CitaCreate
        if self.sena_historica_pagada > self.precio_historico_cobrado:
            raise PydanticCustomError(
                "sena_excede_precio",
                "La seña ({sena}) no puede superar el precio de la cita ({precio})",
                {"sena": self.sena_historica_pagada, "precio": self.precio_historico_cobrado},
            )
        return self

    @field_validator("fecha_hora_cita", mode="after")
    @classmethod
    def _accept_naive_or_aware(cls, v):
        return v.replace(tzinfo=None) if v.tzinfo else v

    @field_validator("honeypot_field")
    @classmethod
    def _honeypot_must_be_empty(cls, v: str) -> str:
        # Same PydanticCustomError pattern as PublicClienteCreate
        if v.strip():
            raise PydanticCustomError(
                "honeypot_triggered",
                "La solicitud no pudo procesarse",
                {},
            )
        return v


class PublicCitaResponse(BaseModel):
    id: int
    fecha_hora_cita: datetime
    estado_cita: EstadoCita  # always "Pendiente"
```

**Reuse of the `sena_excede_precio` PydanticCustomError**: the existing `CitaCreate` model at `schemas.py:172-180` raises this with the type `sena_excede_precio` (no ñ). The frontend's `apiErrors.ts:38-41` lookup table already maps this type to a Spanish message. **The new `PublicCitaCreate` MUST use the same type string so the existing `getApiError` helper handles it without a code change.**

---

## 6. Affected Areas

| File | Why affected |
|------|--------------|
| `backend/app/main.py` | Add `POST /public/clients` (~50 lines) and `POST /public/appointments` (~70 lines). Apply `@limiter.limit("10/minute")` to both, with the appointment endpoint also getting a per-DNI dynamic key via `limiter.shared_limit("3/day", scope="public_booking_per_dni", key_func=...)`. Add new `try/except IntegrityError` around the `session.add(db_client)` / `session.commit()`. Import `IntegrityError` from `sqlalchemy.exc`. |
| `backend/app/schemas.py` | Add `PublicClienteCreate`, `PublicClienteResponse`, `PublicCitaCreate`, `PublicCitaResponse`. Reuse the `_strip_tz` and `normalize_phone` helpers. Reuse the `sena_excede_precio` PydanticCustomError. |
| `backend/app/models.py` | NO changes — the `Cliente.dni` unique constraint (line 19) is already in place. The `Cita.id_cliente` foreign key (line 69) is also in place. The lookup-or-create race protection in #5 only needs `IntegrityError` handling, not a model change. |
| `backend/tests/test_api.py` | Add ~6-8 new tests: (1) public create new client returns 201, (2) public create same DNI returns 200 with `was_existing: true`, (3) public appointment creates pending cita, (4) public appointment with `estado_cita: "Asistido"` in body is ignored, (5) public appointment with non-existent DNI returns 404, (6) honeypot field filled returns 422, (7) per-IP rate limit kicks in at 11th call, (8) per-DNI rate limit at 4th call with same DNI. Add the `_reset_rate_limiter` autouse fixture from the B-8 attempt. |
| `frontend/src/api.ts` | Add `lookupOrCreatePublicClient(payload)` and `createPublicAppointment(payload)`. Reuse the existing axios instance. |
| `frontend/src/pages/Reservar.tsx` | Switch `createClientMutation.mutateAsync` → `lookupOrCreatePublicClient`; switch `createAppointmentMutation.mutateAsync` → `createPublicAppointment`. The payload changes: remove `id_cliente` from the appointment payload (backend resolves via DNI). Update the 422 branch to handle the new `honeypot_triggered` and any new error types. |
| `frontend/src/components/HoneypotField.tsx` (NEW) | Hidden `<input>` with `tabindex=-1`, `autocomplete="off"`, `aria-hidden="true"`, visually hidden via `position: absolute; left: -9999px;` (not `display: none` — that breaks bot detection). Includes the standard `name="website_url"` or similar fake-looking label. |
| `frontend/src/lib/apiErrors.ts` | Extend the lookup table with the new `honeypot_triggered` type → `{ title: '', message: 'La solicitud no pudo procesarse. Intentá de nuevo.' }` (a generic message that doesn't reveal it was a honeypot — security through obscurity on the bot side). Add a Vitest case for the new type. |

---

## 7. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Honeypot bypassed by browser autofill** — Some password managers or browsers autofill hidden fields if they match heuristics | Low | Use a name like `website_url` (not `honeypot`); position absolute + `aria-hidden`; document in a code comment that this is a known trade-off |
| **`limiter.shared_limit` with custom key_func** — slowapi requires a `Request` object, but the per-DNI key needs the request body. Standard pattern is to read `request.state` after a small Pydantic pre-validation hook | Medium | Use slowapi's `shared_limit` with a `key_func` that reads `request._body` or sets `request.state.dni` in a Depends that runs first. Document the pattern in the design phase. |
| **In-memory rate limit resets on Render restart** — slowapi's default backend is in-memory; a deploy wipes all buckets | Low | Document the limitation; for a single-tenant low-volume salon, an attacker has to time their attack within a deploy window. Future hardening: Upstash Redis backend (already a known pattern in `python-backend` skill). |
| **Atomic 1-step vs 2-step pattern** — current Reservar.tsx flow is 2-step; changing to 1-step is a bigger refactor | Low | 2-step is the recommended approach. The frontend change is small. |
| **Existing data risk** — public lookup-or-create might match an old `Cliente` with `activo=False` (deactivated). Should the public endpoint reactivate? | Medium | **Decision needed**: probably NO. Public endpoint only matches `activo=True` clients; deactivated clients should be reactivated by the admin in person, not silently by a public request. Surfaced as an open question in the design phase. |
| **Confirmation step** — Reservar.tsx step 4 (payment) uses `appointment.cliente_nombre`. With the new public endpoint, the response is minimal (`{id, fecha_hora_cita, estado_cita}`). Frontend needs to keep the name from step 2 (form values) and not depend on the server response for it. | Low | The frontend already stores `form.values.nombre` and `form.values.apellido` locally; step 4 just needs to use those instead of the server echo. |
| **CSP / honeypot false positives** — Real users with screen readers or accessibility tools might trigger the honeypot | Low | `aria-hidden="true"` and `tabindex=-1` are the standard. Document in a Vitest test that a focused honeypot still passes (a11y users are not bots). |

---

## 8. Open Questions for the Orchestrator / User

These are NOT blockers for `sdd-propose` but should be answered before `sdd-design`:

1. **What happens to deactivated clients (activo=False) when a public lookup hits their DNI?**
   - Option A: Return `{id, was_existing: true}` (treat as match; admin can investigate)
   - Option B: Return 404 (force admin reactivation)
   - **Recommendation**: B (404). Public reactivation is a security hole.

2. **What is the per-DNI rate limit value?**
   - Default proposal: 3 reservations per DNI per 24 hours
   - 3 is generous; could be 5 to allow a client + family member booking
   - **Recommendation**: 3 (per-T2 baseline). Escalate to 5 if a real client complains.

3. **Should the new `honeypot_triggered` error return 422 or 400?**
   - 422 is the existing pattern for PydanticCustomError (seña_excede_precio)
   - **Recommendation**: 422 for consistency.

4. **What to do about the existing 4 pre-existing rate-limit test failures in `test_endpoints.py::TestAuthEndpoints`?**
   - Carry-over from main, NOT caused by this change
   - **Recommendation**: Leave them. The `_reset_rate_limiter` autouse fixture from the B-8 attempt already mitigated 3 of the 4; the 4th is a `.env` `LOGIN_RATE_LIMIT=5/minute` override.

---

## 9. Ready for Proposal

**Yes.** The exploration covers:
- The current state of the broken flow (frontend 2-step, backend auth-gated)
- The 6 problems inherited from the rolled-back B-8 attempt
- A recommended throttling strategy (T2) with 5 options compared
- A schema design preview for both new public endpoints
- All affected files and their roles
- Risks and open questions

The orchestrator should now launch `sdd-propose` to formalize the intent, scope, and approach in `openspec/changes/public-booking/proposal.md`. The user has already made the high-level Approach A decision; the proposal should focus on:
- Locking in the T2 throttling strategy
- Locking in the 2-step pattern (not 1-step)
- Locking in the 4 open questions in Section 8
- Defining the success criteria (e.g., "a real visitor can book without 401, and the per-DNI rate limit kicks in at 4 reservations in 24h")

---

## Relevant Files (read or referenced)

- `backend/app/main.py:1-200, 380-461, 580-839, 940-979` — limiter setup, `POST /clients`, `POST /appointments`, `get_busy_slots`
- `backend/app/schemas.py:10-54, 100-180, 287-306` — `ClienteCreate`, `ClienteRead`, `CitaCreate`, `CitaRead`, `normalize_phone`, `sena_excede_precio` PydanticCustomError pattern
- `backend/app/models.py:1-70` — `Cliente.dni = Field(unique=True)`, `Cita.id_cliente` FK, `EstadoCita` enum
- `backend/app/main.py:142-164` — `_validate_jwt_secret_key` (B-5, still in place; lifespan runs before new endpoints)
- `backend/tests/test_api.py:1-44` — TestClient setup, `_reset_rate_limiter` fixture pattern (reverted but proven)
- `backend/requirements.txt` — slowapi 0.1.9 already installed; no new deps needed for T2
- `frontend/src/pages/Reservar.tsx:1-200, 560-574` — 4-step flow, `handleConfirm`, step-4 payment render
- `frontend/src/hooks/useClients.ts:5-9` — `useCreateClient` (to be replaced)
- `frontend/src/hooks/useAppointments.ts:11-20` — `useCreateAppointment` (to be replaced)
- `frontend/src/api.ts:34-49, 152-160, 374-419` — axios instance, auth interceptor, `createClient`/`createAppointment`, client/cita type definitions
- `frontend/src/lib/apiErrors.ts:1-89` — `getApiError` helper, `API_ERROR_MESSAGES` lookup table (needs `honeypot_triggered` added)
- `render.yaml:1-20` — Render config; no new env vars needed for T2
- `vercel.json:1-14` — Vercel config; no changes needed
- `openspec/config.yaml:1-85` — hybrid mode, strict TDD, 400-line review budget
- `openspec/specs/online-booking/spec.md` — existing public-booking main spec (REQ-BKG-001..003). The new public endpoints will EXTEND this spec, not create a new domain.
- `openspec/changes/public-booking/` — NEW change folder, this file is the first artifact

---

## Engram Cross-References

- `public-booking-401/todo` (#241) — initial diagnosis
- `public-booking-design/todo` (#244) — design notes from rollback decision
- `sdd/jd-quick-wins/apply-progress` — B-8 attempt + revert log
- `sdd/deposit-front-alert/spec` — PydanticCustomError 2-type pattern reference
- `sdd/tz-argentina-display/verify-report` — TZ serialization context (REQ-DCO-004/005)
- `bugfix: CRITICAL: Public booking flow non-functional` (#241)
- `decision: B-8 deferred to feat/public-booking` (#244)
- `session_summary: jd-quick-wins 2026-06-28` (#245)
