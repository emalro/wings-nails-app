# Public Booking

**Domain**: `public-booking`
**Status**: Active (new)
**Source change**: `public-booking` (archived 2026-06-29)

---

## Context

This domain establishes the public booking entry point for unauthenticated visitors. The previous flow was non-functional: `Reservar.tsx` calls `POST /clients` and `POST /appointments` as a logged-out visitor, but both require `Depends(get_current_user)` — every submit returned 401 and the booking was silently lost. Judgment-day review (engram #241, #244) deferred the quick-win attempt to a dedicated SDD change.

This change adds **two new endpoints** — `POST /public/clients` and `POST /public/appointments` — with throttling posture T2 (honeypot + per-DNI 3/day + per-IP 10/min). Admin paths are untouched. The new endpoints give the existing 4-step flow a working backend, satisfying `online-booking` REQ-BKG-002 and REQ-BKG-004 (UX spec; no public-path contract existed before).

The new endpoints honor prior specs as-is (no MODIFIED blocks needed): `online-booking` REQ-BKG-002/004, `gestion-horarios` (reuse `validate_appointment_hours` + `find_conflicting_appointment`), `datetime-coordination` REQ-DCO-004/005 (naive datetime round-trip), and `deposit-validation` REQ-DVA-001 (literal `PydanticCustomError` type `"sena_excede_precio"`).

---

## Requirements

### REQ-PUB-001 — `POST /public/clients` lookup-or-create by DNI (MUST)

The endpoint MUST accept a JSON body with `dni` (7-8 digits), `nombre`, `apellido`, `telefono` (≥7 chars, digits-only), `email` (optional), and `honeypot` (MUST be empty). It MUST look up an active `Cliente` by `dni`. On a hit (`activo=True`) it returns 200 with `{ "id", "was_existing": true }`; on a miss it creates a new `Cliente` and returns 201 with `{ "id", "was_existing": false }`. The response MUST NOT echo the full client record.

#### Scenario: New DNI creates a new client

- GIVEN no existing `Cliente` with `dni="12345678"`
- WHEN the visitor POSTs `/public/clients` with valid `dni`, `nombre`, `apellido`, `telefono`
- THEN the response is 201
- AND the body is exactly `{ "id": <int>, "was_existing": false }`

#### Scenario: Existing active DNI returns minimal info

- GIVEN an existing `Cliente` with `dni="12345678"` and `activo=True`
- WHEN the visitor POSTs `/public/clients` with the same DNI
- THEN the response is 200
- AND the body is exactly `{ "id": <existing_id>, "was_existing": true }` (no `nombre`, `apellido`, `telefono`, `email`, `dni`, or counters)

### REQ-PUB-002 — `POST /public/appointments` create with DNI resolution (MUST)

The endpoint MUST accept a JSON body with `dni` (7-8 digits), `servicios` (list of `{ servicio_id, duracion_minutos, precio_unitario, subtotal }`, ≥1 element), `fecha_hora_cita` (ISO datetime, naive after REQ-DCO-005), `precio_historico_cobrado` (≥0), `sena_historica_pagada` (≤ precio per REQ-DVA-001), and `honeypot` (empty). On a successful DNI lookup, the endpoint MUST validate business hours and slot conflict (reusing `validate_appointment_hours` and `find_conflicting_appointment`), hardcode `estado_cita = EstadoCita.pendiente`, persist the `Cita` with `CitaServicio` rows, atomically increment `Cliente.cantidad_turnos_tomados`, and return 201 with `{ "id", "fecha_hora_cita", "estado_cita" }`.

#### Scenario: DNI match creates a `Pendiente` cita

- GIVEN an active `Cliente` with `dni="12345678"` and no conflicting cita at 14:00 on 2026-07-15
- WHEN the visitor POSTs `/public/appointments` with `dni="12345678"`, `fecha_hora_cita="2026-07-15T14:00:00"`, and a valid service
- THEN the response is 201
- AND `estado_cita == "Pendiente"`
- AND `Cliente.cantidad_turnos_tomados` for DNI 12345678 has incremented by 1

#### Scenario: Conflicting slot returns 409

- GIVEN an existing cita at 14:00 on 2026-07-15 (any client, any estado)
- WHEN the visitor POSTs `/public/appointments` for the same slot
- THEN the response is 409
- AND no new cita is created

### REQ-PUB-003 — Public endpoints reject `id_cliente` from body (MUST)

The `PublicClientLookupRequest` and `PublicAppointmentCreate` Pydantic schemas MUST NOT include `id_cliente` as a field, and MUST set `model_config = ConfigDict(extra="forbid")`. Any request body that contains `id_cliente` MUST be rejected with 422 and a validation error that names the offending field.

#### Scenario: `id_cliente` in body is rejected

- GIVEN a valid `/public/appointments` body for an active DNI
- WHEN the body also includes `"id_cliente": 999`
- THEN the response is 422
- AND `detail[0].loc` includes `"id_cliente"`
- AND no `Cliente` is read by `id_cliente`

### REQ-PUB-004 — Public endpoints hardcode `estado_cita` to `Pendiente` (MUST)

The `PublicAppointmentCreate` schema MUST NOT include `estado_cita` as a field (with `extra="forbid"` per REQ-PUB-003). The endpoint code MUST set `estado_cita = EstadoCita.pendiente` literally on the new `Cita`. Any request body that includes `estado_cita` MUST be rejected with 422.

#### Scenario: `estado_cita` in body is rejected

- GIVEN a valid `/public/appointments` body for an active DNI
- WHEN the body also includes `"estado_cita": "Asistido"`
- THEN the response is 422

#### Scenario: Missing `estado_cita` is hardcoded

- GIVEN a valid `/public/appointments` body without `estado_cita`
- WHEN the visitor submits
- THEN the response is 201
- AND the persisted `estado_cita` is exactly `EstadoCita.pendiente`

### REQ-PUB-005 — Honeypot field required, silent 200 on trigger (MUST)

Both public endpoints MUST accept a `honeypot` (string) field in the JSON body. The expected value is the empty string (the frontend renders a hidden field humans do not see or fill). The server MUST check the honeypot BEFORE any database write. If non-empty (after `.strip()`), the endpoint MUST:

1. **Return 200 with a successful response body of the same shape as a real create** (e.g., `PublicClientLookupResponse(id=0, was_existing=False)` or `PublicAppointmentResponse(...)` with placeholder values).
2. **NOT perform any database write** (no `Cliente` is created, no `Cita` is created, no `cantidad_turnos_tomados` increment).
3. **Emit an audit log line with `outcome="honeypot"`** per REQ-PUB-009.

Rationale: a 4xx response (400 or 422) gives the bot a signal that the honeypot was the cause, allowing an attacker to refine. A silent 200 with the same response shape as success gives the bot no signal — the per-DNI rate limit (REQ-PUB-006) is the durable defense; the honeypot is the cheap first-line filter.

#### Scenario: Honeypot filled returns silent 200 with no DB write

- GIVEN no existing `Cliente` with `dni="12345678"`
- WHEN the visitor POSTs `/public/clients` with `"honeypot": "http://spam.example"` and valid other fields
- THEN the response is 200
- AND the response body matches `PublicClientLookupResponse` shape (e.g., `{"id": 0, "was_existing": false}`)
- AND no `Cliente` row is created in the database
- AND the audit log emits an INFO line with `action="lookup_create_client"`, `outcome="honeypot"`, `dni="12345678"`

#### Scenario: Honeypot filled on `/public/appointments` returns silent 200 with no DB write

- GIVEN an active `Cliente` with `dni="12345678"`
- WHEN the visitor POSTs `/public/appointments` with `"honeypot": "spam"` and valid other fields
- THEN the response is 200
- AND the response body matches `PublicAppointmentResponse` shape
- AND no `Cita` row is created
- AND `Cliente.cantidad_turnos_tomados` is NOT incremented
- AND the audit log emits an INFO line with `action="create_appointment"`, `outcome="honeypot"`, `dni="12345678"`

#### Scenario: Frontend `<HoneypotField/>` renders hidden and empty

- GIVEN the booking form renders the `<HoneypotField/>` component
- WHEN the component mounts in the DOM
- THEN the input is visually hidden (off-screen absolute positioning, not `display: none`)
- AND `tabindex === -1`, `aria-hidden === "true"`, `autocomplete === "off"`

### REQ-PUB-006 — Per-DNI rate limit of 3 reservations per 24h (MUST)

For `POST /public/appointments`, slowapi MUST apply a `shared_limit` of `"3/day"` with a custom `key_func` that returns the `dni` from the request body (resolved via a pre-validation `Depends` that sets `request.state.dni` from the parsed body). The limit is per-DNI, NOT per-IP. When exceeded, the response MUST be 429 with a generic error message. This limit is in ADDITION to the per-IP limit (REQ-PUB-007).

#### Scenario: Same DNI is capped at 3 reservations per 24h

- GIVEN a `/public/appointments` request with `dni="12345678"` succeeds (201) 3 times in 24h from the same IP
- WHEN the visitor POSTs a 4th time with the same DNI from the same IP
- THEN the response is 429
- AND no new cita is created
- AND a different DNI from the same IP is unaffected

### REQ-PUB-007 — Per-IP rate limit of 10 requests per minute (MUST)

Both public endpoints MUST have a per-IP rate limit of 10 requests per minute, applied via `@limiter.limit("10/minute")` with the default `get_remote_address` key function. The limit is independent from the per-DNI limit (REQ-PUB-006). When exceeded, the response MUST be 429.

#### Scenario: 11th request from same IP in 1 minute returns 429

- GIVEN the visitor IP `203.0.113.7` POSTs `/public/clients` 10 times in 60 seconds
- WHEN an 11th request arrives from the same IP within the same window
- THEN the response is 429

### REQ-PUB-008 — Deactivated clients treated as "not found" in public endpoints (MUST)

`Cliente.activo=False` clients MUST NOT be exposed via the public endpoints. `POST /public/clients` MUST treat them as "not found" (returning 404 — see REQ-PUB-001). `POST /public/appointments` MUST return 404 when the DNI resolves to a deactivated client. The admin path can still reactivate via the existing `/clients/{id}/reactivate` endpoint (out of scope).

#### Scenario: Deactivated client appointment returns 404

- GIVEN an existing `Cliente` with `dni="12345678"` and `activo=False`
- WHEN the visitor POSTs `/public/appointments` with that DNI
- THEN the response is 404 (not 201)
- AND no silent reactivation occurs

### REQ-PUB-009 — All public bookings audited (MUST)

Both public endpoints MUST emit a structured log line at INFO level for each request, using the standard `logging` module. The line MUST include: `timestamp` (ISO 8601), `client_ip` (from `Request.client.host`), `dni` (the value submitted by the visitor), `action` (one of `lookup_create_client`, `create_appointment`), and `outcome` (one of `success`, `validation_error`, `rate_limit`, `honeypot`, `conflict`, `not_found`, `deactivated`). The endpoint MUST NOT log the full request body or any PII beyond the DNI.

#### Scenario: Successful public booking logs the outcome

- GIVEN a `/public/appointments` request with `dni="12345678"` from IP `203.0.113.7` returns 201
- WHEN the log is captured
- THEN an INFO line is emitted with `action="create_appointment"`, `outcome="success"`, `dni="12345678"`, `client_ip="203.0.113.7"`, and an ISO timestamp
- AND the log line does NOT include `nombre`, `apellido`, `telefono`, or `email`

### REQ-PUB-010 — Race condition in lookup-or-create handled (MUST)

For `POST /public/clients`, two concurrent requests with the same `dni` MUST both receive a successful response (200 or 201 — NOT 500). The implementation MUST wrap the INSERT in `try/except IntegrityError` on the `Cliente.dni` unique constraint, re-fetch the existing client on conflict, and return 200 with `{ "id": <winner_id>, "was_existing": true }`.

#### Scenario: Two concurrent requests with same DNI both succeed

- GIVEN no existing `Cliente` with `dni="12345678"`
- WHEN two `POST /public/clients` requests with the same DNI arrive concurrently (e.g., a threading test)
- THEN both responses are successful (200 or 201)
- AND neither response is 500
- AND exactly one `Cliente` row exists in the database

#### Scenario: Manual race simulation in pytest

- GIVEN a pytest test for the race condition
- WHEN the test calls `POST /public/clients` with a new DNI, then manually inserts a competing row with the same DNI via a second `Session`, then calls `POST /public/clients` again
- THEN the second response is 200 with `was_existing: true` and the id of the manually-inserted row

---

## Cross-References

- **Prior domains** (compatible as-is, no MODIFIED blocks):
  - `online-booking` REQ-BKG-002 (cita in `Pendiente`), REQ-BKG-004 (DNI in payload).
  - `gestion-horarios` — effective hours; new endpoints reuse `validate_appointment_hours` and `find_conflicting_appointment`.
  - `datetime-coordination` REQ-DCO-004 (naive serializer) and REQ-DCO-005 (input normalization of `Z` / `-03:00`).
  - `deposit-validation` REQ-DVA-001 (literal `PydanticCustomError` type `"sena_excede_precio"` on `sena > precio`).
- **Affected files** (apply phase; full list in `design.md`):
  - Backend: `main.py` (+2 endpoints), `schemas.py` (+4 models), `tests/test_api.py` (+~10 tests)
  - Frontend: `api.ts` (+2 functions), `components/HoneypotField.tsx` (NEW), `components/HoneypotField.test.tsx` (NEW), `pages/Reservar.tsx` (endpoint swap)
  - Changelog: `DOCUMENTATION.md`
- **Honeypot error handling**: the server never raises a `honeypot_triggered` error type (silent 200 path) — `frontend/src/lib/apiErrors.ts` does NOT need a new entry. The honeypot field is invisible to the frontend's error handling because the response is always 200.
