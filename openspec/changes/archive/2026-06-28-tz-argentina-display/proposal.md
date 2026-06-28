# Proposal: Argentina Timezone Display — Serializer Fix

## Intent

**This change completes what the previously-archived `timezone-fix` change left undone.**

Production (PostgreSQL/Supabase) returns tz-aware UTC datetimes. The `CitaRead` / `ClienteRead` Pydantic schemas emit those as `2026-06-29T09:00:00Z`, and the `get_busy_slots` endpoint emits `2026-06-29T09:00:00+00:00`. The Argentina browser (UTC-3) shifts both to 06:00, producing two visible bugs:

1. Admin appointment list shows 06:00 for appointments booked at 09:00.
2. Public calendar does not mark busy slots as "Ocupado".

The `timezone-fix` design (`openspec/changes/timezone-fix/design.md` line 11) explicitly called for a `field_serializer` that strips tzinfo. The merged PR (#46) added the `naive()` helper for *comparison* normalization but **never added the serializer to the schemas**, and the verify phase accepted "Pydantic v2 default behavior" as compliant — a false positive. The regression test (`test_appointment_datetime_no_z_suffix`) only exercises the naive path, so it passes on SQLite regardless of the missing serializer.

This change adds the missing serializer (3 fields), patches the only endpoint that bypasses Pydantic, and adds a regression test that exercises the tz-aware path.

## Scope

### In Scope
- `@field_serializer` on `CitaRead.fecha_hora_cita`, `CitaRead.fecha_registro_cita`, and `ClienteRead.fecha_creacion` that strips tzinfo before serialization.
- `naive(cita.fecha_hora_cita)` and `naive(cita_end)` in `get_busy_slots` (the one endpoint that returns raw dicts).
- Defensive `field_validator` on `CitaCreate.fecha_hora_cita` and `CitaUpdate.fecha_hora_cita` that normalizes incoming `Z`/offset strings to naive — prevents round-trip drift on PATCH.
- Regression test that inserts a `tzinfo=timezone.utc` datetime directly into the DB, then GETs `/appointments` and `/busy_slots` and asserts the response is naive (`"2026-06-29T09:00:00"`, no `Z`, no offset).
- README/AGENTS.md docstring confirmation on `frontend/src/lib/datetime.ts` (the docstring already states "naive" — verify and update if drifted).

### Out of Scope
- **Production data migration** (deliberate user decision — production DB is "mega alpha", only test data, no affected users).
- Multi-timezone support.
- Frontend test infrastructure (no test runner exists yet).
- Frontend code changes (`Calendar.tsx`, `CalendarView.tsx`, `Admin.tsx`, `Reservar.tsx`, `AppointmentModal.tsx` all already work correctly *if the API returns naive strings*).

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `datetime-coordination`: Add **REQ-DCO-004 — Defensive Serializer on Aware Datetimes** which explicitly requires the serializer to strip tzinfo even when the DB returns aware datetimes (preventing the 3h offset in UTC-3 browsers). New delta spec at `openspec/changes/tz-argentina-display/specs/datetime-coordination/spec.md`.

## Approach

**Approach 1 (from exploration): Pydantic v2 `field_serializer` per schema + targeted `naive()` in `get_busy_slots`.**

1. In `backend/app/schemas.py`, add a `_strip_tz(v: datetime) -> str` helper that returns `v.replace(tzinfo=None).isoformat()`.
2. Decorate the 3 response fields with `@field_serializer(...)` calling `_strip_tz`.
3. In `backend/app/main.py` `get_busy_slots`, wrap the two `isoformat()` calls with the existing `naive()` helper.
4. In `backend/app/schemas.py` `CitaCreate` and `CitaUpdate`, add `@field_validator("fecha_hora_cita")` that strips tzinfo on input.
5. Add the regression test in `backend/tests/test_api.py` that injects a tz-aware datetime and asserts naive output.

Alternatives 2–4 (global base class, dict-build normalization, response-rewriting middleware) were considered and rejected — see `openspec/changes/tz-argentina-display/exploration.md` for full rationale. Approach 1 is the only one that matches the original `timezone-fix` design intent and guarantees naive output regardless of Pydantic version drift.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/app/schemas.py` (lines 69-80, 135-174, 249-264) | Modified | Add `_strip_tz` helper, 3 `@field_serializer` decorators, 2 `@field_validator` decorators. |
| `backend/app/main.py` (lines 903-931, `get_busy_slots`) | Modified | Wrap 2 `isoformat()` calls with `naive()`. |
| `backend/tests/test_api.py` | Modified | Add tz-aware regression test next to `test_appointment_datetime_no_z_suffix` (line ~1619). |
| `frontend/src/lib/datetime.ts` | Verify only | Confirm docstring matches naive contract; no code change expected. |
| `openspec/changes/tz-argentina-display/specs/datetime-coordination/spec.md` | New | Delta spec adding REQ-DCO-004. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Round-trip asymmetry on PATCH (client sends `Z` → DB shifts to UTC → serializer strips) | Med | Defensive `field_validator` on `CitaCreate` / `CitaUpdate` normalizes input to naive before storage. |
| `get_busy_slots` endpoint bypasses `response_model` and could regress if endpoint is later refactored to declare a `response_model` that lacks the serializer | Low | Add a code comment in `get_busy_slots` pointing to the schema-level serializer; future endpoints must use `CitaRead` or explicitly strip tzinfo. |
| Test pollution from SQLite (naive path) masking the regression | Med | New regression test explicitly constructs `datetime(..., tzinfo=timezone.utc)` to simulate the production aware-datetime path. |
| `naive()` helper name becomes ambiguous (compare vs. serialize) | Low | Same behavior (strip tzinfo) so safe; rename in a future refactor if readability suffers. |
| Existing test data in production DB may have wrong wall-clock times | Out of scope | User decision: production DB is "mega alpha" with no real users; ignore. **Explicitly not a risk this change is expected to address.** |
| The previous `verify-report.md` was a false positive (PR #46 archived as PASS but the serializer was missing) | Real but historical | This change's design phase will require the regression test plus a manual production check as acceptance criteria. |

## Rollback Plan

1. Revert the 3 `@field_serializer` decorators in `backend/app/schemas.py`.
2. Revert the 2 `@field_validator` decorators in `backend/app/schemas.py` (the input-side defensive strip).
3. Revert the 2 `naive()` calls in `get_busy_slots` in `backend/app/main.py`.
4. Revert the new regression test in `backend/tests/test_api.py`.
5. Restart the backend service. No DB changes, no frontend changes, no data loss. Behavior returns to the pre-change state (bug returns, but system is otherwise intact).

## Dependencies

- `naive()` helper in `backend/app/main.py:26-34` (already exists, used by `get_busy_slots`).
- `get_busy_slots` endpoint (`backend/app/main.py:903-931`).
- `CitaRead` / `ClienteRead` / `CitaCreate` / `CitaUpdate` schemas in `backend/app/schemas.py`.
- Existing `datetime-coordination` spec (created by `timezone-fix`, lives in `openspec/changes/timezone-fix/specs/datetime-coordination/spec.md`, not yet merged to main specs).
- `test_appointment_datetime_no_z_suffix` test pattern in `backend/tests/test_api.py:1619-1655` (to be the structural template for the new regression test).

## Success Criteria

- [ ] New regression test passes: `tzinfo=timezone.utc` datetime inserted into DB → GET `/appointments` returns `"2026-06-29T09:00:00"` (no `Z`, no offset).
- [ ] New regression test passes: same datetime → GET `/busy_slots` returns naive ISO string in the slot entries.
- [ ] All existing 132 backend tests still pass (4 pre-existing rate-limiting failures are unrelated).
- [ ] `tsc --noEmit` passes on the frontend.
- [ ] **Manual production check**: book a 09:00 appointment via the public flow, then verify (a) admin list shows 09:00 (not 06:00), (b) public calendar shows 09:00 as "Ocupado".
