# Exploration: tz-argentina-display

## Current State

**Symptom in production (PostgreSQL/Supabase, not local SQLite):**

1. Public calendar in `Calendar.tsx` does not show "Ocupado" tags for slots that have an assigned appointment.
2. Admin appointment list shows appointments at 06:00 when the user booked them at 09:00 (3-hour offset = Argentina UTC-3).

**Root cause (verified by reading the code):**

- `backend/app/schemas.py:249-264` — `CitaRead` declares `fecha_hora_cita: datetime` and `fecha_registro_cita: datetime` with **no `field_serializer`, no `model_serializer`, no `json_encoders`**. Pydantic v2 default serialization emits `2026-06-29T09:00:00Z` for any aware datetime (PostgreSQL `TIMESTAMP WITH TIME ZONE` round-trip) and `2026-06-29T09:00:00` for naive (SQLite default).
- `backend/app/schemas.py:69-80` — `ClienteRead` also exposes `fecha_creacion: datetime` with the same missing serializer. Affected by the same bug for all `/clients*` endpoints.
- `backend/app/main.py:903-931` — `get_busy_slots` returns **raw dicts** (no `response_model`). Lines 926-927 do `cita.fecha_hora_cita.isoformat()`. If the datetime is tz-aware (production), Python's `datetime.isoformat()` emits `"2026-06-29T09:00:00+00:00"`, which is then JSON-serialized as `"2026-06-29T09:00:00+00:00"`. The frontend `new Date(...)` then interprets the `+00:00` as UTC and the Argentina browser (UTC-3) shifts the hour to 06:00.
- `backend/app/main.py:26-34` — `naive()` helper strips tzinfo, but **only used for comparison normalization** (in `validate_appointment_hours`, `appointment_overlaps`, `find_conflicting_appointment`, and `get_busy_slots`'s date-range filter). It is **never applied to the response payload**, so it does not affect what the API emits.
- `backend/app/main.py:727-746` — `build_cita_response` does `cita.model_dump()` (a SQLModel instance, not Pydantic), populates a dict, and returns the dict. FastAPI then re-validates the dict against the declared `response_model=CitaRead`. The re-validation runs Pydantic's default datetime serializer → aware datetimes become `Z`, naive stay naive. The serializer fix on `CitaRead` is therefore the right surgical spot.
- `frontend/src/lib/datetime.ts:62-66` — `formatTime` does `d.getHours()` / `d.getMinutes()`. If the input string is `2026-06-29T09:00:00Z` and the browser is UTC-3 (Argentina), `getHours()` returns `6`. This is the source of the admin-list 06:00 display.
- `frontend/src/components/Calendar.tsx:60-69` — `slotStart = new Date(date); slotStart.setHours(hour, minute, 0, 0)` builds a **browser-local** Date. In Argentina (UTC-3), `toISOString()` would shift `09:00 local` to `12:00:00.000Z`. The busy slot from the API is `09:00:00Z` (or `09:00:00+00:00`). Overlap check `slotStart < busyEnd && slotEnd > busyStart` → `12:00Z < 09:00Z+duration` AND `12:00Z+duration > 09:00Z` → depending on service duration, may or may not overlap. For the canonical 60-minute service, slot is `12:00Z` to `13:00Z`, busy is `09:00Z` to `10:00Z` → no overlap → slot is "available" → no "Ocupado" tag. **This is the source of the public-calendar missing-Ocupado bug.**
- `frontend/src/components/CalendarView.tsx:87-99` — the public admin calendar also does `new Date(\`${dateStr}T${effectiveHours.hora_apertura}\`)` to build the visible day range. When `dateStr` is e.g. `2026-06-29`, `new Date('2026-06-29T09:00')` (naive) is interpreted as **local browser time**. Same assumption as `Calendar.tsx` — works on Argentina browsers, breaks in UTC-only environments (server-rendered or non-AR users).

**Why the regression slipped through the previous `timezone-fix` change (PR #46):**

- `openspec/changes/timezone-fix/design.md` line 11 explicitly says: *"Configure `CitaRead` and `CitaUpdate` with a custom serializer that strips timezone info from datetime fields."* This was the design intent.
- `openspec/changes/timezone-fix/tasks.md` line 27 marks task 1.1 ("Add `strip_z_suffix` field serializer to `schemas.py`") as `[x]` complete. But the actual `git show 687c065` reveals the merged commit only added the `naive()` helper to `main.py` for comparison normalization — it **never added the serializer to `schemas.py`**.
- `verify-report.md` line 119 says *"Pydantic v2 default behavior used"* under "Backend serialization without Z suffix" → this is a **false positive**. The verify phase accepted the "naive comparison" fix as if it were the "naive serialization" fix. They are different.
- `test_appointment_datetime_no_z_suffix` (`backend/tests/test_api.py:1619-1655`) only tests the **naive round-trip** path: it sends a naive ISO string, the local SQLite stores it naive, Pydantic serializes the naive datetime as `"2026-12-...T10:30:00"` (no `Z`). The test passes. It never exercises the **aware** path: insert a tz-aware datetime into the DB, GET, assert the response. The test gap is exactly the production failure mode.

**Production data state:** unknown. The orchestrator's ground truth says "Production (PostgreSQL/Supabase) returns aware UTC datetimes". This implies the production schema may have been created with `TIMESTAMP WITH TIME ZONE` columns (via Supabase's default) rather than `TIMESTAMP WITHOUT TIME ZONE` (which SQLAlchemy's `DateTime` type generates by default). This needs to be confirmed by checking the production DB schema or by reproducing with `psycopg2` against a Supabase DB. The fix MUST handle BOTH aware and naive datetimes defensively (a `field_serializer` that strips tzinfo does this).

## Affected Areas

- `backend/app/schemas.py:249-264` (`CitaRead`) — `fecha_hora_cita` and `fecha_registro_cita` need a `field_serializer` that strips tzinfo. **Primary bug surface.**
- `backend/app/schemas.py:69-80` (`ClienteRead`) — `fecha_creacion` needs the same serializer. Affects all `/clients*` endpoints (list, get, search, create, patch, reactivate, appointment history).
- `backend/app/schemas.py:135-152` (`CitaCreate`) and `155-174` (`CitaUpdate`) — defensive: ensure input datetimes that arrive with `Z` or `+00:00` are normalized to naive on the way in. This is not strictly required to fix the visible bug, but it prevents a future round-trip asymmetry where input is `09:00:00Z` and output is `09:00:00` (or vice versa).
- `backend/app/main.py:903-931` (`get_busy_slots`) — endpoint returns raw dicts (no `response_model`). Line 926-927 must call `naive(cita.fecha_hora_cita).isoformat()` and `naive(cita_end).isoformat()` to strip tzinfo before emitting. **Cannot be fixed by the schema-level serializer alone** because the endpoint bypasses Pydantic.
- `backend/app/main.py:26-34` (`naive()` helper) — keep as-is. It is still required for the `get_busy_slots` date-range filter (lines 920-922) and the appointment-conflict comparison paths.
- `backend/tests/test_api.py:1619-1655` (`test_appointment_datetime_no_z_suffix`) — the test as written is insufficient. Add a companion test that inserts a tz-aware datetime directly into the DB (bypassing the API), GETs `/appointments` and `/busy_slots`, and asserts the response is naive. This is the regression test that would have caught the bug.
- `frontend/src/lib/datetime.ts:31-35` (`toDate`) — current code does `new Date(input)`. If the input is naive (the new contract), this returns a Date in **browser-local** time, which is correct for Argentina browsers and matches the design assumption. No change needed.
- `frontend/src/components/Calendar.tsx:60-69` — slot generation uses `slotStart.setHours(hour, minute, 0, 0)`. This is **browser-local** in the user's TZ. The fix is purely on the API side: if `/busy_slots` returns naive ISO strings representing Argentina wall-clock time, then `new Date('2026-06-29T09:00:00')` in the browser produces a Date that `toISOString()` converts back to `2026-06-29T12:00:00.000Z` (since the browser is UTC-3). The busy slot's parsed Date will ALSO be `2026-06-29T12:00:00.000Z` (since both are naive `09:00 local`). They will overlap correctly. **No frontend change needed if the API fix is correct.** This validates the design.
- `frontend/src/components/CalendarView.tsx:87-99` — same reasoning. If the API is fixed, no frontend change.
- `frontend/src/components/AppointmentModal.tsx:193,197` — uses `formatDate`/`formatTime` from `lib/datetime.ts`. If the API returns naive ISO strings, these display correctly. No change needed.
- `frontend/src/pages/Admin.tsx:423,426,434` — uses `formatTime(row.fecha_hora_cita)`. Same reasoning. No change needed.
- `frontend/src/pages/Reservar.tsx:97-101,200-201,442` — uses `formatTime(appointment.fecha_hora_cita)`. Same reasoning. No change needed.
- `openspec/changes/tz-argentina-display/` — new change folder (currently empty). All SDD artifacts for this change go here.
- `openspec/specs/datetime-coordination/` — existing spec from `timezone-fix` change. The new change's spec.md may add a new requirement or modify the existing REQ-DCO-001 to be more explicit (e.g., "MUST strip tzinfo even if the DB returns aware datetimes").

## Approaches

1. **`field_serializer` per schema (Pydantic v2)** — Add a shared `serialize_naive_datetime` helper in `schemas.py` and apply it via `@field_serializer("fecha_hora_cita", "fecha_registro_cita")` on `CitaRead` and `@field_serializer("fecha_creacion")` on `ClienteRead`. Combined with explicit `naive()` calls inside `get_busy_slots` (the only endpoint that returns raw dicts with datetimes), this is the surgical fix.
   - Pros: Matches the original `timezone-fix` design intent. Surgical — only touches the specific fields with the bug. Preserves the OpenAPI schema (the JSON schema still says `string` with `format: date-time`; the actual emitted value is just ISO without offset). Works for BOTH aware and naive source datetimes (a `field_serializer` is invoked regardless). Easy to test (one new regression test covers both).
   - Cons: Requires the `get_busy_slots` endpoint to be patched in `main.py` separately because it bypasses the schema. The `CitaCreate` / `CitaUpdate` input path needs a similar `field_validator` to handle incoming `Z`/offset strings (otherwise the round-trip is asymmetric: POST with `Z` → naive-stripped in DB, but PATCH round-trip could drift). Slightly more code than option 3 (one helper + decorator + one manual endpoint patch + one validator).
   - Effort: **Low-Medium** (~25-35 lines across 2 files, plus 2 new tests).

2. **Global Pydantic config / shared base class with `field_serializer` for all `datetime` fields** — Define a `BaseReadModel(BaseModel)` with `model_config = ConfigDict(...)` and a class-level `@field_serializer` (or use a `BeforeValidator` + `PlainSerializer` on a `Annotated[datetime, ...]` type alias). Have all `*Read` schemas inherit from it.
   - Pros: One place to add/change the rule. Future datetime fields automatically get the right treatment. Less per-schema code.
   - Cons: Broader blast radius. There are currently no other datetime fields in the response (auth tokens use `exp`/`iat` claims but those are JWT-encoded, not in the response body; `User` has no datetime; `HorarioSemanal` has `hora_apertura`/`hora_cierre` as strings, not datetimes). But ANY future `datetime` field would inherit the behavior — which may or may not be desired (e.g., audit-log timestamps might want explicit UTC). Still requires a separate fix for `get_busy_slots`. Introduces an abstraction for a 3-field problem.
   - Effort: **Low** for the refactor (~15 lines for the base class + 2 schema-inheritance changes + 1 endpoint patch + 1 regression test). But **architectural cost** is medium because it commits every future `datetime` to the naive convention.

3. **Normalize at dict-build time (Approach C — `naive()` in `build_cita_response`, `_attach_telefonos`, `get_busy_slots`)** — Strip tzinfo inside the endpoint helpers before putting the value into the response dict. Let Pydantic and FastAPI's `jsonable_encoder` serialize the now-naive datetime as the default `"...T09:00:00"`.
   - Pros: Very explicit. No Pydantic magic. Each endpoint's contract is visible in the endpoint code. Easy to grep for "where do we strip tz?".
   - Cons: Spreads the fix across 3-4 files (`build_cita_response`, `_attach_telefonos`, `get_busy_slots`, plus any new endpoint that returns a datetime). Easy to forget when adding a new endpoint. Does NOT match the original `timezone-fix` design intent (which was schema-level). Tests must cover every endpoint individually. Pydantic v2 still re-validates the response dict through `CitaRead`/`ClienteRead`, and **the response_model serialization may re-introduce `Z` if Pydantic converts the datetime back to aware** — needs verification. The risk is that re-validation converts naive→aware→emits `Z` (Pydantic's behavior with naive datetimes depends on the default_tz setting, which is not configured here).
   - Effort: **Medium** (~30-40 lines across 4 files, plus N tests where N = number of endpoints).

4. **Middleware that rewrites ISO strings in responses** — A FastAPI middleware (or a custom JSON encoder) that scans every response body for ISO 8601 strings ending in `Z` or `+HH:MM` and strips the suffix.
   - Pros: Catches all endpoints including future ones. Centralized.
   - Cons: **Breaks OpenAPI schema** (the spec still says UTC). Fragile — could strip offsets from genuinely UTC datetimes that the API is supposed to emit (e.g., a future `last_login` field for a multi-tenant product). Hard to test exhaustively (must scan every JSON response). Rejected by the original `timezone-fix` design for the same reason (line 14 of `design.md`: "rejected because it bypasses Pydantic's model serialization and breaks OpenAPI schema").
   - Effort: **Low** for the middleware itself (~10 lines) but **High** for the testing + risk surface. Not recommended.

## Recommendation

**Approach 1 (field_serializer per schema) + targeted `naive()` in `get_busy_slots`.**

Concretely:

1. In `backend/app/schemas.py`, add a module-level helper:
   ```python
   from pydantic import field_serializer
   def _strip_tz(v: datetime) -> datetime:
       return v.replace(tzinfo=None) if v.tzinfo is not None else v
   ```
2. Decorate `CitaRead.fecha_hora_cita` and `CitaRead.fecha_registro_cita` with `@field_serializer("fecha_hora_cita", "fecha_registro_cita")` returning `_strip_tz(v).isoformat()`. Same for `ClienteRead.fecha_creacion`.
3. In `backend/app/main.py:903-931` (`get_busy_slots`), replace `cita.fecha_hora_cita.isoformat()` with `naive(cita.fecha_hora_cita).isoformat()` and the same for `cita_end`.
4. (Defensive, optional) Add a `field_validator("fecha_hora_cita")` to `CitaCreate` and `CitaUpdate` that strips tzinfo on input — keeps the round-trip symmetric.
5. Add the regression test that the previous fix missed: directly insert a tz-aware datetime via raw SQL or `Session.add()` with `tzinfo=timezone.utc`, GET `/appointments` and `/busy_slots`, assert the response is `"2026-06-29T09:00:00"` (no `Z`, no offset).

Why not Approach 2: the global config is over-engineered for 3 fields. The base-class abstraction hides the contract and complicates any future move to UTC (e.g., for a multi-region tenant). Approach 1 keeps the convention local and visible.

Why not Approach 3: the dict-build-time approach is fragile and depends on Pydantic re-validation not re-introducing the `Z`. Approach 1 is the only one that guarantees the output is naive regardless of Pydantic version drift.

Why not Approach 4: the original `timezone-fix` design explicitly rejected it. The OpenAPI-schema break is a real cost.

## Risks

- **Production data may have wrong times.** If the production DB stored datetimes as UTC-3 (because the frontend was sending naive `09:00` strings which the DB interpreted as UTC), then existing appointments are now 3 hours behind "real" Argentina time. The `naive()` strip in the serializer will not fix this — it will just faithfully emit the wrong times. The fix must be coordinated with a DB audit. Mitigation: in the design phase, query the production DB for a sample of `cita.fecha_hora_cita` values and check whether they cluster around 09:00 Argentina or 09:00 UTC. If the latter, a one-time migration is needed.
- **Round-trip asymmetry on PATCH.** `CitaUpdate.fecha_hora_cita` accepts a datetime; if the client sends `"2026-06-29T09:00:00Z"`, Pydantic parses it as aware UTC. The DB stores it as-is. The next GET strips the `Z` → `"2026-06-29T09:00:00"`. This is fine if the DB column is naive (`TIMESTAMP WITHOUT TIME ZONE`); the timezone gets dropped on write. But if the column is aware (`TIMESTAMP WITH TIME ZONE`), the stored value is converted to UTC at write time, then re-emitted without offset at read time — which silently shifts the wall-clock time. **Requires a defensive `field_validator` on `CitaUpdate` to normalize input to naive.**
- **`get_busy_slots` not covered by the schema fix.** Easy to forget when adding a new endpoint that returns a datetime. Mitigation: a comment in the schema fix naming the only non-schema path; future endpoints must either declare a `response_model` with the serializer or strip tzinfo manually.
- **The `naive()` helper semantics.** Today it strips tzinfo and is used for comparison. After the fix, it is also used in `get_busy_slots` for serialization. The behavior is the same (strip tzinfo) so this is safe. But the name `naive()` is now ambiguous (is it "compare naive" or "serialize naive"?). Consider renaming or splitting if readability becomes a concern.
- **Test pollution from SQLite.** All existing tests run against SQLite (`os.environ["DATABASE_URL"] = "sqlite:///./test.db"`). SQLite returns naive datetimes regardless of input, so they will continue to pass — including the existing `test_appointment_datetime_no_z_suffix`. The new regression test must explicitly use `timezone.utc` to simulate the production aware-datetime path, OR use a Postgres test container (out of scope for this change). The single SQLite test with explicit `tzinfo=timezone.utc` is sufficient because the failure mode is at the **serialization boundary** (Python `datetime` → Pydantic → JSON), not at the DB-driver boundary.
- **No front-end change required, but verify in production.** The frontend's `formatTime` and `Calendar.tsx` slot generation both rely on the browser being in Argentina time (UTC-3). If any user accesses the app from a non-AR timezone, the calendar will display wrong times — but this is a pre-existing UX constraint, not a regression introduced by this fix. Document it.
- **The previous verify-report was wrong.** The `timezone-fix` change was archived as "PASS" with 7/8 tasks complete and "manual verification pending". The pending manual step was the very thing that would have caught this bug. The sdd-verify phase's "code inspection confirms correct implementation" was a false positive. **The design phase for this new change should explicitly call out the production data audit and the regression-test gap as acceptance criteria.**

## Ready for Proposal

**Yes.** All required ground truth is verified by code reading:
- The `field_serializer` is provably missing from `schemas.py:249-264` (confirmed by grep across the entire `backend/app/` tree — no occurrences of `field_serializer`, `model_serializer`, or `json_encoders`).
- The `naive()` helper exists and works (line 26-34) but does not affect serialization.
- The test gap is provable (`test_appointment_datetime_no_z_suffix` only exercises the naive path).
- The blast radius is fully mapped: 3 response_model-decorated fields + 1 raw-dict endpoint.
- The recommendation is the surgical approach that matches the original `timezone-fix` design intent.

**What the orchestrator should tell the user before sdd-propose:**

> "Found the regression. The `field_serializer` was never added to `CitaRead`/`ClienteRead` in PR #46 — only the `naive()` comparison helper was. The existing test passes because it only tests the naive round-trip on SQLite. The fix is to add a `field_serializer` to 3 fields and a `naive()` call in `get_busy_slots`, plus a regression test that explicitly uses a tz-aware datetime. Estimated ~30-40 lines across 2 backend files, 1 new test, no frontend change. The design phase should also recommend a production data audit to confirm existing appointment times are not 3 hours off."
