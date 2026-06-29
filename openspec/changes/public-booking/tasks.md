# Tasks: Public Booking Endpoints

**Change**: `public-booking` | **Phase**: tasks | **Strict TDD**: ACTIVE
**Run**: `python -m pytest` (backend) | `npx vitest run` (frontend)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~720 (backend ~520, frontend ~180, docs ~20) |
| 400-line budget risk | **High** (180%) |
| Chained PRs recommended | No (D3 in design R7) |
| Delivery strategy | `single-pr` |
| Chain strategy | `size-exception` |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

### Work Units (commits, 150 LOC max each)

| # | Commit subject | Scope | LOC | Deps |
|---|----------------|-------|-----|------|
| 1 | `chore(sdd): add public booking Pydantic schemas` | backend | ~80 | — |
| 2 | `chore(sdd): add public booking parse deps + audit helper` | backend | ~40 | 1 |
| 3 | `feat(backend): POST /public/clients lookup-or-create` | backend | ~120 | 1, 2 |
| 4 | `feat(backend): POST /public/appointments with rate limit` | backend | ~140 | 1, 2 |
| 5 | `test(backend): race, rate limits, audit log, fixture` | backend | ~120 | 3, 4 |
| 6 | `feat(frontend): HoneypotField component + vitest` | frontend | ~75 | — |
| 7 | `feat(frontend): wire Reservar.tsx to public endpoints + docs` | fe+docs | ~120 | 3, 4, 6 |

**Critical path**: 1→2→3→4→5→7. **Parallelism**: unit 6 independent of 2-5.

## Phase 1 — Schemas (unit 1, commit 1)

- [ ] 1.1 **RED**: `test_public_schemas_extra_forbid` (422 on `id_cliente`), `_dni_pattern`, `_phone_short`, `_appointment_sena_excede_precio` (type=`sena_excede_precio`), `_appointment_estado_cita_forbidden`.
- [ ] 1.2 **GREEN**: add `PublicClientLookupRequest/Response`, `PublicCitaServicioCreate`, `PublicAppointmentCreate/Response` to `backend/app/schemas.py`. All requests use `ConfigDict(extra="forbid")`. Reuse `normalize_phone`, `_strip_tz`, `sena_excede_precio`. `honeypot: str = Field(default="", max_length=500)` — **no validator** (D2: silent 200 is a route concern).

## Phase 2 — Parse deps + audit helper (unit 2, commit 2)

- [ ] 2.1 **GREEN-only** (exercised by 3+4): in `backend/app/main.py` add `parse_public_client_payload` + `parse_public_appointment_payload` async deps (read `request.json()` → `model_validate` → set `request.state.dni`), `get_dni_key` key_func (fallback `request.client.host`), `log_public_booking()` stdlib helper. Import `IntegrityError` from `sqlalchemy.exc`.

## Phase 3 — /public/clients (unit 3, commit 3)

- [ ] 3.1 **RED**: `_new_dni_returns_201` (`was_existing:false`), `_existing_active_returns_200` (`was_existing:true`, no PII echoed), `_deactivated_silently_treated_as_new` (D5).
- [ ] 3.2 **GREEN**: add `POST /public/clients` with `@limiter.limit(PUBLIC_BOOKING_IP_LIMIT)`. Order: silent-200 honeypot → `Cliente.dni+activo` lookup (200 hit, 201 miss) → on `IntegrityError` rollback + re-query → return winner's id. `PUBLIC_BOOKING_IP_LIMIT = "10/minute"`. **200 on hit branch needs `response: Response` injection (see Risks).**

## Phase 4 — /public/appointments (unit 4, commit 4)

- [ ] 4.1 **RED**: `_creates_pendiente` (201, counter++), `_slot_conflict_409`, `_sena_excede_precio_422`, `_id_cliente_forbidden_422`, `_estado_cita_forbidden_422` (persisted exactly `Pendiente`), `_dni_not_found_404`, `_deactivated_dni_404`.
- [ ] 4.2 **GREEN**: add `POST /public/appointments` with `@limiter.limit(PUBLIC_BOOKING_IP_LIMIT)` + `@limiter.shared_limit(PUBLIC_BOOKING_PER_DNI_LIMIT, scope="public_booking_per_dni", key_func=get_dni_key)`. Order: silent-200 honeypot → `Cliente.dni+activo` lookup (404) → `validate_appointment_hours` (422) → `find_conflicting_appointment` (409) → INSERT `Cita(estado_cita=EstadoCita.pendiente, metodo_pago_sena="Transferencia")` + `CitaServicio[]` + `cliente.cantidad_turnos_tomados += 1`. `PUBLIC_BOOKING_PER_DNI_LIMIT = "3/day"`.

## Phase 5 — Edge tests (unit 5, commit 5)

- [ ] 5.1 **GREEN-only first**: re-introduce `@pytest.fixture(autouse=True) def _reset_rate_limiter()` at top of `backend/tests/test_api.py` (B-8 reverted pattern, `f2a86b6`).
- [ ] 5.2 **RED**: `_race_simulated_via_second_session` — POST, second `Session(engine)` inserts competing `Cliente` with same DNI, POST again → 200 with `was_existing:true` and the manually-inserted id.
- [ ] 5.3 **RED**: `_per_ip_429_after_10` (10 OK, 11th → 429; unique DNIs).
- [ ] 5.4 **RED**: `_per_dni_429_after_3` (3 OK at unique future slots, 4th → 429; different DNI from same IP succeeds).
- [ ] 5.5 **RED**: `_audit_log_emitted` — `caplog` on `logger="public_booking"`; assert `action`, `outcome="success"`, `dni`, `client_ip`, no PII. Add `outcome="honeypot"` assertion.

## Phase 6 — HoneypotField (unit 6, commit 6)

- [ ] 6.1 **RED**: `frontend/src/components/HoneypotField.test.tsx` — (a) `name="website"`, `tabIndex=-1`, `aria-hidden="true"`, `autocomplete="off"`, empty; (b) positioned absolute off-screen, not `display:none`.
- [ ] 6.2 **GREEN**: `frontend/src/components/HoneypotField.tsx` (D7: DOM `name="website"` ≠ JSON key `honeypot`).

## Phase 7 — Frontend wiring (unit 7, commit 7)

- [ ] 7.1 add types + `lookupOrCreatePublicClient` + `createPublicAppointment` to `frontend/src/api.ts`.
- [ ] 7.2 refactor `Reservar.tsx` `handleConfirm`: swap to new calls; drop `id_cliente`; add `honeypot: ""` to both payloads.
- [ ] 7.3 embed `<HoneypotField/>` in form JSX.
- [ ] 7.4 update `buildWhatsAppUrl` to derive `cliente_nombre` from `form.values` (REQ-PUB-002: minimal response).
- [ ] 7.5 append `DOCUMENTATION.md` changelog entry (2026-06-29).

## Test Inventory

**Backend pytest — 18 new tests** for REQ-PUB-001..010: 4 schema-validation, 2 clients-baseline, 7 appointments-baseline, 2 silent-200-honeypot, 1 race, 2 rate-limit, 1 audit-log (with 2 outcomes).
**Frontend vitest — 2 new cases** for `HoneypotField`.
**Manual smoke**: logged-out `/reservar` submit on staging (proposal success criteria).

## Risks / Drift Notes (apply must address)

- **Design gap, not spec drift**: design example `public_lookup_or_create_client` (design.md:281-329) sets `status_code=201` as route default, but REQ-PUB-001 requires **200** on the existing-active-DNI branch. Apply must inject `response: Response` (or use `JSONResponse`) in the early-return path. `/public/appointments` only returns 201 on success → issue contained to `/public/clients`. Not a blocker.
- **No `apiErrors.ts` change** (D2: server never raises `honeypot_triggered`).
- **Vitest smoke for `Reservar.tsx` not required** — refactor is mechanical; manual smoke is the gate.
- **`metodo_pago_sena="Transferencia"`** — design choice, consistent with `Cita.metodo_pago_sena` default (`models.py:64`). No spec delta.
- **No spec/design drift on REQ-PUB-001..010 semantics** — O1–O5 are resolved in the design and the spec is updated.
