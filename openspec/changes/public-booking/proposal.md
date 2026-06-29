# Proposal: Public Booking Endpoints

## Intent

`/reservar` is broken. The frontend (`frontend/src/pages/Reservar.tsx:140-183`) calls `POST /clients` and `POST /appointments` as an unauthenticated visitor, but both endpoints require `Depends(get_current_user)` (`backend/app/main.py:425, 795`). The result is a silent 401 — the form's catch block falls through to `"Ocurrió un error. Intentá de nuevo."` (`Reservar.tsx:170-181`) and the booking is lost. This is a foundational architecture gap: the system was designed admin-only without a public path.

This change adds two **new** public endpoints (`POST /public/clients`, `POST /public/appointments`) with no auth dependency and aggressive throttling. Admin paths stay as-is, preserving auth and all existing admin features. Throttling = **T2** (honeypot + per-DNI 3/day + per-IP 10/min). The 5 alternatives (T1-T5) were scored in the explore: T2 is the right balance of friction, supply-chain, and threat model for a low-volume single-tenant salon.

## Scope

### In Scope
- 2 new endpoints in `backend/app/main.py`: `POST /public/clients` (lookup-or-create by DNI), `POST /public/appointments` (create pending cita, resolve client via DNI).
- 4 new Pydantic schemas in `backend/app/schemas.py`: `PublicClientLookupRequest`, `PublicClientLookupResponse`, `PublicAppointmentCreate`, `PublicAppointmentResponse`. Reuse the `sena_excede_precio` PydanticCustomError pattern (PR #50) and the `_strip_tz` / `normalize_phone` helpers.
- slowapi: per-IP `@limiter.limit("10/minute")` on both; per-DNI `@limiter.shared_limit("3/day", scope="public_booking_per_dni", key_func=...)` on appointments.
- Honeypot field (`honeypot`) in the request schema; **server returns silent 200** (no DB write, audit log records `outcome="honeypot"`) if non-empty. No `PydanticCustomError` is raised. *(Decision per O1 in design.md — revised from the original 422 plan to maximize bot-fingerprinting resistance.)*
- New `frontend/src/components/HoneypotField.tsx` — hidden input (`tabindex=-1`, `aria-hidden="true"`, absolute off-screen, innocuous `name="website_url"`).
- New `frontend/src/components/HoneypotField.test.tsx` — V1 Vitest test (renders hidden, accepts empty, etc.).
- `frontend/src/pages/Reservar.tsx` — switch `useCreateClient` → `lookupOrCreatePublicClient`, switch `useCreateAppointment` → `createPublicAppointment`; embed `<HoneypotField/>`. **No new error types to handle** (honeypot is silent 200, indistinguishable from a real success in the response).
- `frontend/src/api.ts` — +2 functions: `lookupOrCreatePublicClient`, `createPublicAppointment`.
- **`frontend/src/lib/apiErrors.ts` — NO change** (the server never raises a `honeypot_triggered` error type).
- 9-11 new pytest tests in `backend/tests/test_api.py`; re-introduce the `_reset_rate_limiter` autouse fixture (reverted in B-8 but proven to fix 3 of the 4 pre-existing rate-limit failures).
- 2-3 new Vitest cases in `frontend/src/components/HoneypotField.test.tsx` (only).
- Audit log: every public booking emits `logger.info(...)` with IP, DNI, timestamp, action.
- **`Cliente.activo=False` policy**: deactivated clients are treated as "not found" in public endpoints. No silent reactivation. Admin must reactivate in person. The public client is expected to call `/public/clients` again (which creates a new record; the admin deduplicates).

### Out of Scope
- T4 OTP verification (overkill for a low-volume single-tenant salon; requires Twilio/WhatsApp Business API).
- CAPTCHA / hCaptcha (third-party friction + privacy cost under Argentine personal-data law).
- Per-IP-only throttling (IP rotation trivial; per-DNI is the durable cap).
- Changes to admin paths (`/clients`, `/appointments`) — they stay as-is.
- Data migration (no production users yet; explicit user decision carried over from B-8).
- `Reservar.tsx` refactor beyond the endpoint swap.
- Redis-backed slowapi (in-memory is acceptable; documented as known limitation — `limiter.reset()` resets on Render restart).
- Cross-tenant rate limiting.

## Approach

**Approach A** (locked): new `/public/...` endpoints with their own schemas, throttling, and audit log. Admin paths untouched.

**Why not B** (remove auth from existing endpoints): would (1) mix concerns, (2) expose any future admin-only features on those endpoints to the public, (3) make per-admin-only fields a leaky abstraction, (4) make the lookup-or-create-by-DNI side-effect (used by both admin and public flows) impossible to gate per-context. New endpoints are cleaner, easier to test, future-proof, and the review surface is small (~150 lines backend + ~60 lines frontend).

**2-step pattern retained** (matches the current `Reservar.tsx` flow): lookup-or-create client → create appointment. Race in lookup-or-create handled via `try/except IntegrityError` → re-query → return winner's id with `was_existing: true`. The 1-step pattern was considered and rejected (cancellation is harder, more failure modes, frontend refactor larger).

**Hardcoded constraints in public endpoints** (these are the security boundary, NOT implementation details):
- `id_cliente` NOT accepted in the public appointment payload — backend resolves the client via `dni`. A public caller cannot book for arbitrary clients.
- `estado_cita` hardcoded to `EstadoCita.pendiente` — not in the request schema at all. A public caller cannot mark a cita as `Asistido` or `Cancelado`.
- Lookup-match response is minimal: `{id, was_existing}` only — no name, no phone, no DNI echoed, no counters. Prevents PII enumeration via DNI.

**Throttling T2 — honeypot + per-DNI 3/day + per-IP 10/min**:
- Honeypot catches naive spam-bots (~95% of low-effort abuse).
- Per-DNI 3/day is the durable cap; IP rotation doesn't help an attacker because they need unique, valid, real Argentine DNIs to do meaningful damage.
- Per-IP 10/min is defense in depth and protects against volumetric floods.
- IP-based reset on Render restart is an acceptable limitation for a single-tenant low-volume system. Documented.

## Capabilities

### New Capabilities
- `public-booking`: new unauthenticated public endpoints for client lookup-or-create and appointment creation, with throttling (per-DNI + per-IP), honeypot, deactivated-client handling, race resolution, and audit log. Delta spec at `openspec/changes/public-booking/specs/public-booking/spec.md`; archive phase creates main `openspec/specs/public-booking/spec.md`. Carries REQ-PUB-001..010.

### Modified Capabilities
- None. The existing `online-booking` spec (`openspec/specs/online-booking/spec.md`, REQ-BKG-001..005) describes the user-facing 4-step flow, which is unchanged. The frontend's endpoint swap is an implementation detail. REQ-BKG-002's "estado Pendiente" scenario is satisfied by the new endpoints (hardcoded). REQ-BKG-004's reference to `POST /clients` is the admin path, untouched. No MODIFIED block needed; the sdd-spec phase will confirm this.

## Affected Areas

| File | Action | Description |
|------|--------|-------------|
| `backend/app/main.py` | Modify | +2 endpoints with slowapi decorators; `try/except IntegrityError` re-query; audit `logger.info` call. |
| `backend/app/schemas.py` | Modify | +4 Pydantic models; reuse `_strip_tz`, `normalize_phone`, `sena_excede_precio` pattern. |
| `backend/tests/test_api.py` | Modify | +8-10 tests; re-introduce `_reset_rate_limiter` autouse fixture. |
| `frontend/src/api.ts` | Modify | +2 functions: `lookupOrCreatePublicClient`, `createPublicAppointment`. |
| `frontend/src/components/HoneypotField.tsx` | New | Hidden input with `tabindex=-1`, `aria-hidden`, off-screen position (~25 lines). |
| `frontend/src/components/HoneypotField.test.tsx` | New | V1 Vitest test (~30 lines). |
| `frontend/src/pages/Reservar.tsx` | Modify | Switch to new endpoints; embed `<HoneypotField/>`. |
| `frontend/src/lib/apiErrors.ts` | **No change** | The server never raises a `honeypot_triggered` type — silent 200 means the frontend treats it as a normal success. |
| `openspec/changes/public-booking/specs/public-booking/spec.md` | New | Delta spec with REQ-PUB-001..010. |
| `DOCUMENTATION.md` | Modify | Changelog entry on phase completion. |

## Risks

| # | Risk | Like | Mitigation |
|---|------|------|------------|
| 1 | Honeypot bypassed by browser autofill (some password managers fill hidden fields) | Low | Innocuous name (`website_url`, not `honeypot`); `aria-hidden="true"` + `tabindex=-1` + absolute off-screen position; documented trade-off in a code comment. |
| 2 | `slowapi.shared_limit` per-DNI `key_func` needs request body access | Med | Pre-validation `Depends` reads `request._body`, sets `request.state.dni`; the `key_func` reads from `request.state.dni`. Documented pattern in design. |
| 3 | In-memory rate limit resets on Render restart | Low | Acceptable for a low-volume single-tenant salon; documented as known limitation. Future hardening: Upstash Redis (already known in `python-backend` skill). |
| 4 | `Cliente.activo=False` interaction with public lookup | Med | Public endpoint treats deactivated clients as "not found" — `was_existing: false` on lookup (forces re-create), 404 on appointment creation. Admin reactivates in person. No silent reactivation via public request. |
| 5 | PydanticCustomError typos in new error types | Low | Anti-typo guard test (same pattern as `deposit-front-alert` PR #50): asserts the literal `type` string appears in the 422 body. |
| 6 | Frontend refactor risk in `Reservar.tsx` (honeypot embed, 2-step result handling) | Med | Keep form layout similar; only swap the submit handler. Step-4 data (name, appointment summary) already comes from `form.values` and the new minimal response — no regression. The silent-200 honeypot means the frontend has zero new error paths to handle. |
| 7 | slowapi per-IP limit shared across all `testclient` calls (50+ existing tests) | Med | `_reset_rate_limiter` autouse fixture from the reverted B-8 attempt — proven to fix 3 of the 4 pre-existing failures. The 4th is a `.env` `LOGIN_RATE_LIMIT=5/minute` override, not this change. |

## Rollback Plan

`git revert` of the merge commit (or `git reset --hard` to pre-PR SHA) restores everything. **No DB changes, no schema drift, no migration, no data risk.** The admin path is untouched. The reverted B-8 commit (`f2a86b6`) demonstrates this is a clean revert surface. The 2 new endpoints, 4 new schemas, HoneypotField component, `Reservar.tsx` change, and `apiErrors.ts` extension all revert independently. Audit log INFO lines are additive; the logger filter (existing in `main.py`) can drop them without code change.

## Dependencies

- `slowapi 0.1.9` (already in `backend/requirements.txt`).
- `Cliente.dni = Field(unique=True)` constraint (already in `backend/app/models.py:19`).
- `sena_excede_precio` PydanticCustomError pattern (PR #50, `backend/app/schemas.py:172-180`).
- `getApiError` helper and `API_ERROR_MESSAGES` lookup (PR #50, `frontend/src/lib/apiErrors.ts:1-89`).
- `_reset_rate_limiter` autouse fixture pattern (B-8 attempt `f2a86b6`, reverted but proven).
- No new third-party dependencies, no new env vars, no `render.yaml` change.

## Success Criteria

- [ ] 9-11 new backend tests pass: lookup-or-create new (201, `was_existing: false`), lookup-or-create existing (200, `was_existing: true`), race resolved (concurrent same-DNI requests don't 500), **honeypot filled (silent 200, no DB write, audit `outcome="honeypot"`)**, per-IP limit at 11th call (429), per-DNI limit at 4th call (429), `id_cliente` in body rejected (422), `estado_cita` in body ignored (always `Pendiente`), deactivated client returns 404 on appointment, validation errors (DNI format, phone format, sena > precio).
- [ ] 2-3 new Vitest cases pass: HoneypotField renders hidden, HoneypotField passes accessibility attributes (tabindex=-1, aria-hidden=true, autocomplete=off), HoneypotField is positioned off-screen.
- [ ] All 157 existing backend tests still pass (the 4 pre-existing rate-limit failures in `test_endpoints.py::TestAuthEndpoints` remain, unrelated to this change).
- [ ] All 17 existing frontend vitest tests still pass.
- [ ] `npx tsc --noEmit` exits clean.
- [ ] **Manual smoke test in production**: visit `/reservar` as a logged-out visitor, fill step 2 (data), step 3 (slot), submit → no 401; client is created or looked up; appointment is created in `Pendiente` state. Verify the admin sees the new appointment at `/admin`. Verify the honeypot is filled manually and submit returns 200 (silent, no DB write).
- [ ] `openspec/changes/public-booking/specs/public-booking/spec.md` exists with REQ-PUB-001..010.
- [ ] `DOCUMENTATION.md` updated with the change entry.

## Requirements (REQ-PUB-001..010)

| ID | Statement |
|----|-----------|
| REQ-PUB-001 | `POST /public/clients` accepts DNI + minimal client fields, returns minimal-info response (`{id, was_existing}` only — no name, no phone, no DNI echoed, no counters). MUST. |
| REQ-PUB-002 | `POST /public/appointments` accepts DNI + service + slot, hardcodes `estado_cita = Pendiente`, returns appointment summary (`{id, fecha_hora_cita, estado_cita}`). MUST. |
| REQ-PUB-003 | Public endpoints reject `id_cliente` from the body (the public cannot book for arbitrary clients). MUST. |
| REQ-PUB-004 | Public endpoints hardcode `estado_cita` to `Pendiente` (not in the request schema; cannot be set by the public). MUST. |
| REQ-PUB-005 | Honeypot field in the form is required; **server returns silent 200** (no DB write, audit log records `outcome="honeypot"`) if filled. The bot receives a response shape identical to a real success and learns nothing from the rejection. MUST. |
| REQ-PUB-006 | Per-DNI rate limit of 3 reservations per 24h on `/public/appointments` (slowapi `shared_limit`). MUST. |
| REQ-PUB-007 | Per-IP rate limit of 10 requests per minute on both public endpoints (slowapi default; defense in depth). MUST. |
| REQ-PUB-008 | Deactivated clients (`Cliente.activo=False`) are treated as "not found" in public endpoints (no silent reactivation). MUST. |
| REQ-PUB-009 | All public bookings are logged with IP, DNI, timestamp, action (audit trail). MUST. |
| REQ-PUB-010 | Race condition in lookup-or-create is handled via `try/except IntegrityError` → re-query → return winner's id with `was_existing: true`. MUST. |
