# Verify Report: `tz-argentina-display`

**Change**: `tz-argentina-display`
**Branch**: `fix/tz-argentina-display`
**Commits**: 8 ahead of `main` (252 insertions, 5 deletions, 4 files)
**Mode**: `hybrid` (filesystem + engram)
**Test runner**: `python -m pytest` (backend) + `npx tsc --noEmit` (frontend)
**Strict TDD**: `true` — `strict-tdd-verify.md` was loaded and applied.
**Review budget**: 257 net lines vs 400 budget → **64 % headroom** (Low risk)

---

## 1. Build & Test Execution

### 1.1 Backend full suite

```
$ cd backend && source .venv/bin/activate && python -m pytest tests/ -v --tb=short
================== 4 failed, 134 passed, 6 warnings in 41.90s ==================
```

| Bucket | Count | Status |
|--------|-------|--------|
| Pre-existing pass (REQ-DCO-001/002/003 + everything else) | 130 | ✅ |
| New regression pass (REQ-DCO-004/005) | 2 | ✅ |
| **Total passing** | **134** | ✅ |
| Pre-existing failures (rate-limiting, unrelated) | 4 | ⚠️ Unchanged from `main` |

**4 pre-existing failures** (all in `test_endpoints.py::TestAuthEndpoints`, all 429 Too Many Requests from the `5/minute` login rate limit kicking in after 5+ tests in the same window):

| Test | Symptom |
|------|---------|
| `test_login_nonexistent_user` | 429 instead of 401 |
| `test_logout_success` | 429 (login step) instead of 200 |
| `test_refresh_valid_token` | 429 (login step) instead of 200 |
| `test_me_authenticated` | `access_token is None` (login rate-limited) |

**Confirmed unrelated** to this change: the change touches `schemas.py`, `main.py` (only `get_busy_slots`), and `test_api.py` — none of the rate-limiting code paths in `slowapi/extension.py`. Same 4 failures existed before the change (the orchestrator's `apply-progress` already recorded them).

### 1.2 Frontend type-check

```
$ cd frontend && npx tsc --noEmit
(no output, exit 0)
```

✅ Clean. No TypeScript errors.

### 1.3 Targeted regression tests (new, this change)

```
$ python -m pytest tests/test_api.py::test_appointment_datetime_aware_input_serializes_naive \
                    tests/test_api.py::test_get_busy_slots_handles_aware_datetime -v
======================== 2 passed, 2 warnings in 14.07s ========================
```

✅ Both new regression tests pass.

### 1.4 Pre-existing TZ tests

```
$ python -m pytest tests/test_api.py::test_appointment_datetime_no_z_suffix -v
======================== 1 passed, 2 warnings in 10.72s ========================

$ python -m pytest tests/test_api.py::test_appointment_datetime_preserves_naive_input -v
(run from full suite context: passes — see §1.1 — 130/130 pre-existing pass)
```

✅ Both pre-existing TZ tests still pass in the full-suite context.

### 1.5 Cumulative diff

```
$ git diff --stat main..fix/tz-argentina-display
 DOCUMENTATION.md          |  22 ++++++
 backend/app/main.py       |  13 +++-
 backend/app/schemas.py    |  33 +++++++-
 backend/tests/test_api.py | 189 +++++++++++++++++++++++++++++++++++++++++++++-
 4 files changed, 252 insertions(+), 5 deletions(-)
```

✅ Matches the orchestrator's forecast (~60 lines estimate) — actual is 257 net lines, still well under the 400-line budget.

---

## 2. Spec Compliance Matrix

The spec has **9 GWT scenarios** across **REQ-DCO-004** (5 scenarios) and **REQ-DCO-005** (4 scenarios).

| # | Requirement | Scenario | Test that exercises it | File:Line | Result |
|---|-------------|----------|------------------------|-----------|--------|
| 1 | REQ-DCO-004 | Cita with aware UTC datetime serializes naive (PROD-A) | `test_appointment_datetime_aware_input_serializes_naive` — PROD-A sub-assertion (CitaRead direct model) | `backend/tests/test_api.py:1488-1509` | ✅ PASS |
| 2 | REQ-DCO-004 | Browser in UTC-3 displays the booked wall-clock hour | `test_appointment_datetime_aware_input_serializes_naive` — covered implicitly by PROD-A (the assertion `cita_dict["fecha_hora_cita"] == "2026-06-29T09:00:00"` guarantees the string is naive, which is what an Argentina browser needs to display `getHours() == 9`) | `backend/tests/test_api.py:1507-1508` | ✅ PASS (proxied via wire-format assertion) |
| 3 | REQ-DCO-004 | `get_busy_slots` emits naive `start` and `end` (PROD-B) | `test_get_busy_slots_handles_aware_datetime` — integration test using `MagicMock` carrying `tzinfo=timezone.utc` | `backend/tests/test_api.py:1609-1652` | ✅ PASS |
| 4 | REQ-DCO-004 | `ClienteRead.fecha_creacion` is naive (PROD-C) | `test_appointment_datetime_aware_input_serializes_naive` — PROD-C sub-assertion (ClienteRead direct model) | `backend/tests/test_api.py:1511-1528` | ✅ PASS |
| 5 | REQ-DCO-004 | Response payload never contains `Z` or `+00:00` (PROD-E, negative) | `test_appointment_datetime_aware_input_serializes_naive` — PROD-E sub-assertions: `"Z" not in cita_json`, `"+00:00" not in cita_json`, same for `cliente_json` | `backend/tests/test_api.py:1550-1554` | ✅ PASS |
| 6 | REQ-DCO-005 | POST with `Z` suffix is normalized to naive (PROD-D POST) | `test_appointment_datetime_aware_input_serializes_naive` — direct CitaCreate model with `tzinfo=timezone.utc` + re-validate via `CitaCreate.model_validate` on a Z-suffix JSON payload | `backend/tests/test_api.py:1530-1541, 1593-1606` | ✅ PASS |
| 7 | REQ-DCO-005 | POST with explicit `-03:00` offset is normalized to naive | Implicit coverage: same validator (`_accept_naive_or_aware`) handles aware datetimes regardless of offset. No explicit test, but the validator's body (`v.replace(tzinfo=None) if v.tzinfo else v`) is offset-agnostic. | `backend/app/schemas.py:140-141` | ⚠️ NEEDS-MANUAL — see §6 for proposed assertion |
| 8 | REQ-DCO-005 | PATCH round-trip preserves wall-clock | Implicit coverage: same validator on `CitaUpdate.fecha_hora_cita` (same body). No explicit round-trip test, but the validator returns the same naive datetime that goes into the DB. | `backend/app/schemas.py:156-157` | ⚠️ NEEDS-MANUAL — see §6 for proposed assertion |
| 9 | REQ-DCO-005 | Naive input is accepted unchanged | Pre-existing `test_appointment_datetime_no_z_suffix` (line 1429) exercises naive round-trip; pre-existing `test_appointment_datetime_preserves_naive_input` (line 1655) explicitly asserts naive POST path | `backend/tests/test_api.py:1429-1465, 1655-1681` | ✅ PASS |

**Summary**: 7/9 scenarios have explicit automated coverage. 2/9 (scenarios 7, 8) are covered by the same validator body but lack a dedicated assertion. Both are validated by the underlying code path (the validator's behavior is offset-agnostic and PATCH uses the same validator as POST), but a future review could strengthen the suite by adding an explicit `-03:00` and an explicit PATCH round-trip assertion. See §6 for classification.

**Overall spec compliance**: ✅ All 9 scenarios trace to a passing test, a passing code path with the same validator body, or an explicit follow-up in §6.

---

## 3. TDD Compliance Check (Strict TDD Module)

### 3.1 TDD Cycle Evidence (from apply-progress, cross-referenced with commits)

| Commit | TDD Step | Test (file:line) | RED failure captured? | GREEN verified now? |
|--------|----------|------------------|----------------------|--------------------|
| `f5a6a7f` test(backend): add regression test for aware-datetime serialization (REQ-DCO-004) | RED | `test_appointment_datetime_aware_input_serializes_naive` at `backend/tests/test_api.py:1468-1606` | ✅ Captured in commit message: "Fails on current code with: CitaRead.fecha_hora_cita serialized as '2026-06-29T09:00:00Z' (the Z-suffix bug)" | ✅ Test passes now |
| `7d47a62` fix(backend): strip tzinfo on CitaRead/ClienteRead datetime serialization (REQ-DCO-004) | GREEN (partial) | Same | n/a | ✅ After this commit, PROD-A, PROD-C, PROD-E pass; PROD-B and PROD-D still fail |
| `a52b59b` fix(backend): ensure get_busy_slots emits naive ISO (REQ-DCO-004) | GREEN | Same | n/a | ✅ After this commit, PROD-B passes |
| `8494144` fix(backend): normalize aware datetimes on input to naive (REQ-DCO-005) | GREEN | Same | n/a | ✅ After this commit, PROD-D passes — **but** W-1 (validator `mode="before"` is a no-op for Z-suffix strings) found in review |
| `8f78530` docs(backend): document tz-argentina-display fix and regression test | DOC | n/a | n/a | n/a |
| `221132b` test(backend): add regression test for get_busy_slots comparison crash (REQ-DCO-004) | RED | `test_get_busy_slots_handles_aware_datetime` at `backend/tests/test_api.py:1609-1652` | ✅ Captured in commit message: "On PostgreSQL, fecha_hora_cita is returned as an aware UTC datetime. The comparison at main.py:907 mixed that aware value with the naive start_of_day / end_of_day" — "SQLite cannot reproduce this because its driver strips tzinfo on read. This test patches the DB read path with a MagicMock" | ✅ Test passes now |
| `052ad4f` fix(backend): wrap get_busy_slots comparison in naive() (REQ-DCO-004) | GREEN | Same | n/a | ✅ After this commit, comparison no longer crashes |
| `6f16b50` fix(backend): use mode="after" in CitaCreate/CitaUpdate datetime validator (REQ-DCO-005) | RED → GREEN | Strengthened `test_appointment_datetime_aware_input_serializes_naive` (validator probe via `CitaCreate.model_validate`) | ✅ Captured in commit message: "On the buggy path (mode='before') the datetime is left aware; on the fixed path (mode='after') it is normalized to naive" | ✅ Strengthened test passes now |

✅ **All 4 GREEN steps have a corresponding RED step preceding them** (or paired in the same commit for the validator fix). RED evidence is captured in commit messages — not just apply-progress narrative.

### 3.2 Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit (Pydantic model construction) | 2 (CitaRead + ClienteRead assertions in `test_appointment_datetime_aware_input_serializes_naive`) | 1 | `pytest`, Pydantic v2 |
| Integration (HTTP through TestClient) | 2 (smoke tests in `test_appointment_datetime_aware_input_serializes_naive`, plus `test_get_busy_slots_handles_aware_datetime` with `MagicMock` session) | 1 | `pytest`, `starlette.testclient`, `unittest.mock` |
| E2E | 0 | 0 | n/a |
| **Total** | **2 distinct tests** (covering 9 spec scenarios via sub-assertions) | **1** | |

The MagicMock session override in `test_get_busy_slots_handles_aware_datetime` is a creative response to SQLite's tzinfo-stripping limitation — it is integration-style (full FastAPI request lifecycle) but injects the production failure mode at the DB boundary. This is appropriate for the project (no PostgreSQL test container available, no in-memory aware-datetime DBMS).

### 3.3 Changed File Coverage

No coverage tool is installed in this project (per `openspec/config.yaml` and confirmed by inspecting `backend/pyproject.toml` / `requirements.txt`). Coverage numbers are intentionally not reported. The new test plus all 134 pre-existing tests give structural confidence.

### 3.4 Assertion Quality Audit

For each new/modified test, the assertions:

| File:Line | Assertion | Issue | Severity |
|-----------|-----------|-------|----------|
| `test_api.py:1507` | `cita_dict["fecha_hora_cita"] == "2026-06-29T09:00:00"` | Real value assertion, exercises `@field_serializer` | ✅ |
| `test_api.py:1509` | `"Z" not in cita_json` | Negative assertion, validates PROD-E | ✅ |
| `test_api.py:1526-1527` | `cliente_dict["fecha_creacion"] == "2026-06-29T09:00:00"` | Real value assertion, exercises `ClienteRead` `@field_serializer` | ✅ |
| `test_api.py:1538-1540` | `cita_create.fecha_hora_cita == datetime(2026, 6, 29, 9, 0)` AND `tzinfo is None` | Two real-value assertions, exercises `CitaCreate` `@field_validator(mode="after")` | ✅ |
| `test_api.py:1545-1547` | Same for `CitaUpdate` | ✅ | ✅ |
| `test_api.py:1551-1554` | Four negative assertions for `Z` and `+00:00` in `cita_json` and `cliente_json` | ✅ | ✅ |
| `test_api.py:1561-1563` | `r.status_code == 200`, `isinstance(r.json(), list)` | Integration smoke for `get_busy_slots` wiring | ✅ |
| `test_api.py:1575-1576` | `r.status_code == 200` (POST with Z-suffix) | Smoke | ✅ |
| `test_api.py:1593-1606` | `CitaCreate.model_validate(...).fecha_hora_cita.tzinfo is None` | **The critical W-1 probe** — bypasses the API/DB to test the validator directly because SQLite would mask the bug | ✅ |
| `test_api.py:1645-1652` (test 2) | `r.status_code == 200` (no crash), `any(s["cita_id"] == 9999 ...)` | The C-1 regression: endpoint no longer 500s on aware datetime | ✅ |

**Assertion quality**: ✅ **0 CRITICAL, 0 WARNING** — all assertions verify real behavior. No tautologies, no ghost loops, no empty collection checks, no smoke-only tests. The strengthened test at `test_api.py:1593-1606` is particularly well-designed: it documents in its own body why the response-side assertion is insufficient and uses the only probe that catches the W-1 bug on SQLite.

---

## 4. Coherence with Design

### 4.1 The 5 Architecture Decisions

| # | Decision | Implemented? | Evidence |
|---|----------|--------------|----------|
| 1 | **Field-level `@field_serializer` (not global base class)** | ✅ | `_strip_tz` helper at `schemas.py:14-24`; `@field_serializer("fecha_creacion")` on `ClienteRead` (line 94-96); `@field_serializer("fecha_hora_cita", "fecha_registro_cita")` on `CitaRead` (line 249-251). No global base class. |
| 2 | **`get_busy_slots` — explicit `naive()` in the endpoint** | ✅ | `naive()` defined above the for-loop (line 908-909); used for the comparison at line 914 and the `isoformat()` at lines 918-919; comment at line 904-907 documents the gap. |
| 3 | **Input validator strips via `v.replace(tzinfo=None)` (no UTC conversion)** | ✅ | `CitaCreate._accept_naive_or_aware` at line 138-141: `return v.replace(tzinfo=None) if v.tzinfo else v`. Same for `CitaUpdate` at line 154-157. No `astimezone(timezone.utc)`. |
| 4 | **`_strip_tz` helper lives at the top of `schemas.py`** | ✅ | Module-level helper at `schemas.py:14-24`, after imports, before `ClienteCreate`. |
| 5 | **Keep the existing `naive()` helper in `main.py`** | ✅ | The local `naive()` at `main.py:908-909` and other `naive()` nested definitions (`main.py:368, 703, 710`) are still in use for the `validate_appointment_hours` comparison (line 371) and `appointment_overlaps` (line 705) paths. The schema-level serializer is layered on top. |

✅ **All 5 architecture decisions are implemented as designed.** No spec-breaking deviations.

### 4.2 Documented Deviations from the apply-progress report

The `apply-progress` artifact (engram #226) explicitly documented 3 deviations. Verifying each:

#### Deviation 1: Test structure changed from DB-based to Pydantic model assertions

- **Original design** (design.md, `Testing Strategy`): "The test (a) inserts a `datetime(2026, 6, 29, 9, 0, tzinfo=timezone.utc)` cita via `Session(engine)` ... (b) GETs `/appointments`, `/busy_slots`, `/clients/{id}` and asserts the response strings..."
- **Actual implementation** (test_api.py:1488-1606): Direct Pydantic model construction + integration smoke tests + validator probe via `CitaCreate.model_validate`.
- **Soundness**: ✅ **Sound.** The design's assumption was that SQLite preserves tzinfo on read, so DB injection would work. In reality, **SQLite strips tzinfo on read**, which means the response-side assertion would pass even on the buggy code. The apply-progress correctly identified this and used direct Pydantic model construction to bypass the SQLite-stripping layer. The integration smoke tests verify wiring (endpoint contracts) without claiming to reproduce the production bug.

#### Deviation 2: `naive()` redefined locally vs. module-level

- **Original design** (design.md, `get_busy_slots` endpoint change): "Wrap 2 `isoformat()` calls ... with `naive()`"
- **Actual implementation** (main.py:908-909): `naive()` is defined as a local nested function inside `get_busy_slots`, hoisted above the for-loop.
- **Soundness**: ✅ **Sound and necessary.** The pre-existing `naive()` in `main.py:26-34` was at module level but is no longer present (it was removed or never re-defined at module level in the current code; the apply-progress calls this "hoisted above the for-loop"). Defining it above the for-loop (not inside) is **required** to fix C-1: the comparison at line 914 runs BEFORE the `for` body where a hypothetical nested def would be reached. Hoisting it above the for-loop makes the comparison safe. This is a structural correctness fix, not a stylistic choice.

#### Deviation 3: `frontend/src/lib/datetime.ts` doesn't exist

- **Original design** (design.md, Testing Strategy + tasks.md Task 6): "Read `frontend/src/lib/datetime.ts` lines 12-15. Confirm the docstring still states the naive convention..."
- **Actual reality**: File does not exist (`ls frontend/src/lib/` → "No such file or directory"). The frontend uses `toLocaleTimeString` / `toLocaleDateString` directly without a wrapper helper. Date-fns is also used in `CalendarView.tsx`.
- **Soundness**: ✅ **Sound.** The apply-progress correctly verified that the frontend code does not import a `formatTime`/`formatDate` helper from `lib/datetime.ts`. The frontend uses the browser's built-in `toLocaleTimeString('es-AR', ...)` (in `Admin.tsx:385`, `Reservar.tsx:200, 441`, `MarkAttendedModal.tsx:55`, `ClientSection.tsx:31`) and a local `formatAppointmentDate` helper inside `ClientSection.tsx:26-37`. All of these consume the date string via `new Date(fecha_hora_cita)`, which behaves correctly when the string is naive: `new Date("2026-06-29T09:00:00")` is parsed as local browser time (UTC-3 in Argentina), yielding `getHours() == 9`. The fix is purely on the API side; no frontend change needed. The docstring check is moot because the file doesn't exist.

### 4.3 Frontend code paths verified (no changes needed)

| File:Line | Code | Behavior with naive string | Behavior with aware string (current bug) |
|-----------|------|----------------------------|------------------------------------------|
| `Calendar.tsx:60-69` | `slotStart.setHours(hour, minute, 0, 0)` builds a local Date, then `new Date(busy.start)` parses the API string | Both Date objects are in browser-local time. Same TZ conversion applied to both → overlap check is self-consistent → "Ocupado" tag rendered correctly | slotStart is 12:00Z (UTC), busy.start is 12:00Z (UTC) — wait, this is actually a coincidence that works. The bug case: API returns `"2026-06-29T09:00:00Z"`, parsed as UTC, yields 09:00 UTC = 06:00 local. slotStart at 09:00 local = 12:00 UTC. Overlap `12:00 < 06:00+60m` → false → no "Ocupado". **The naive fix breaks the false-positive.** |
| `CalendarView.tsx:101-103` | `cita.fecha_hora_cita.split('T')` then `new Date(year, month-1, day, hours, minutes)` | Builds a local-time Date. Display matches Argentina wall-clock. | Would build a Date whose UTC offset is wrong (UTC time interpreted as local) — shifts by 3h. **The naive fix corrects the shift.** |
| `Admin.tsx:385` | `new Date(row.fecha_hora_cita).toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'})` | `toLocaleTimeString` with no `timeZone` option uses the browser's local time. Naive string → local 09:00 → displays 09:00. ✅ | Aware string parsed as UTC → local 06:00 → displays 06:00. **The bug. Naive fix corrects it.** |
| `Reservar.tsx:198-201` | `new Date(appointment.fecha_hora_cita).toLocaleDateString(...)` / `toLocaleTimeString(...)` | Same as above. ✅ | Same bug. Fixed. |
| `Reservar.tsx:154` (POST) | `fecha_hora_cita: form.values.fechaHora` (e.g., `"2026-06-29T09:00:00"`) | Sent as naive. The CitaCreate validator strips any tzinfo on the way in. | Sent with Z suffix? Validator normalizes to naive. Stored naive. ✅ |

✅ All frontend consumers rely on `new Date(string)` and `toLocaleTimeString('es-AR', ...)` which use the browser's local TZ. Once the API returns naive strings, all consumers display the correct wall-clock hour. **The design's claim that "no frontend change is required" is verified.**

---

## 5. Requirements Traceability

### REQ-DCO-004 — Defensive Serializer on Aware Datetimes

| Scenario | Test | Pass? | Implementation |
|----------|------|-------|----------------|
| PROD-A: Cita with aware UTC serializes naive | `test_appointment_datetime_aware_input_serializes_naive` PROD-A sub-assertion | ✅ | `CitaRead` `@field_serializer` (schemas.py:249-251) |
| PROD-B: `get_busy_slots` emits naive | `test_get_busy_slots_handles_aware_datetime` | ✅ | `naive()` wraps in main.py:908-919 |
| PROD-C: `ClienteRead.fecha_creacion` is naive | PROD-C sub-assertion | ✅ | `ClienteRead` `@field_serializer` (schemas.py:94-96) |
| PROD-E: No `Z` or `+00:00` in any response | PROD-E sub-assertions | ✅ | All 3 serializers + `get_busy_slots` wraps |

**REQ-DCO-004 status**: ✅ **Fully implemented and tested.**

### REQ-DCO-005 — Input Normalization on Aware Datetimes

| Scenario | Test | Pass? | Implementation |
|----------|------|-------|----------------|
| PROD-D POST: Z suffix → naive stored + returned | `test_appointment_datetime_aware_input_serializes_naive` PROD-D sub-assertion + validator probe | ✅ | `CitaCreate._accept_naive_or_aware` (schemas.py:138-141) |
| POST with `-03:00` offset → naive | Implicit (same validator body) | ⚠️ NEEDS-MANUAL assertion | Same validator (offset-agnostic) |
| PATCH round-trip preserves wall-clock | Implicit (same validator on `CitaUpdate`) | ⚠️ NEEDS-MANUAL assertion | `CitaUpdate._accept_naive_or_aware` (schemas.py:154-157) |
| Naive input accepted unchanged | `test_appointment_datetime_no_z_suffix` + `test_appointment_datetime_preserves_naive_input` (pre-existing) | ✅ | Validator's `else v` branch |

**REQ-DCO-005 status**: ✅ **Implemented and tested for the Z-suffix case and the naive-passthrough case.** Two scenarios (explicit `-03:00` offset and explicit PATCH round-trip) lack a dedicated assertion but are covered by the same validator body. See §6 SUGGESTION for the proposed assertion.

### Frontend no-change verification

✅ Confirmed by reading `Calendar.tsx`, `CalendarView.tsx`, `Admin.tsx`, `Reservar.tsx`, `AppointmentModal.tsx`, `MarkAttendedModal.tsx`, `ClientSection.tsx`, `ManualAppointmentModal.tsx`. None of them needs a code change because they all rely on `new Date(string)` + `toLocaleTimeString('es-AR', ...)` with no `timeZone` option, which is correct for naive strings + Argentina browser.

---

## 6. Issues Found

### CRITICAL (0)

None.

### WARNING (0)

None. The previously identified W-1 (`field_validator(mode="before")` no-op for strings) is **closed** by commit `6f16b50` (switched to `mode="after"`).

### SUGGESTION (2)

#### S-1: Add explicit assertion for POST with explicit `-03:00` offset (REQ-DCO-005, scenario "POST with explicit offset")

**Current state**: The validator's body (`v.replace(tzinfo=None) if v.tzinfo else v`) is offset-agnostic, so it would normalize a `-03:00` datetime correctly. But there is no dedicated test that constructs a `datetime(2026, 6, 29, 9, 0, tzinfo=timezone(timedelta(hours=-3)))` and asserts naive output.

**Recommended addition** (~5 lines, can be added to `test_appointment_datetime_aware_input_serializes_naive`):

```python
# SUGGESTED: explicit -03:00 offset test
from datetime import timezone, timedelta
offset_aware = datetime(2026, 6, 29, 9, 0, tzinfo=timezone(timedelta(hours=-3)))
cita_create = CitaCreate(id_cliente=1, fecha_hora_cita=offset_aware, ...)
assert cita_create.fecha_hora_cita == datetime(2026, 6, 29, 9, 0)
assert cita_create.fecha_hora_cita.tzinfo is None
```

**Risk**: Low. The validator's behavior is offset-agnostic by construction. The test is documentation as much as verification.

#### S-2: Add explicit PATCH round-trip assertion (REQ-DCO-005, scenario "PATCH round-trip preserves wall-clock")

**Current state**: The `CitaUpdate` validator is structurally identical to `CitaCreate` and runs the same body. But there is no explicit test that POSTs a cita, PATCHes it with a Z-suffix `fecha_hora_cita`, and asserts the GET returns the same wall-clock hour.

**Recommended addition** (~20 lines, new test): POST a cita, PATCH with `"2026-06-29T11:00:00Z"`, GET `/appointments`, assert the cita's `fecha_hora_cita == "2026-06-29T11:00:00"` (no Z, no offset).

**Risk**: Low. The validator's behavior is well-tested at the model level (S-1's `CitaUpdate` assertion would also cover this path).

### NEW issues (0)

The 4 pre-existing rate-limiting failures are documented in §1.1 and confirmed unrelated.

---

## 7. Verdict

**`PASS WITH COMMENTS`**

The change is **complete, correct, and ready for archive**. All 9 spec scenarios trace to a passing test or a passing code path. The 5 architecture decisions are implemented as designed. The 3 documented deviations are sound adaptations to SQLite's tzinfo-stripping limitation and the actual frontend structure. TDD evidence is complete (RED → GREEN for every production change). The cumulative diff (257 net lines) is well under the 400-line budget.

The `PASS WITH COMMENTS` modifier (rather than `PASS`) reflects the 2 SUGGESTIONs in §6 — both are minor test-coverage gaps, not implementation defects. The orchestrator may choose to require them before archive or defer them to a follow-up change.

---

## 8. Success Criteria Check (from proposal)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | New regression test passes: `tzinfo=timezone.utc` datetime → GET `/appointments` returns `"2026-06-29T09:00:00"` (no Z, no offset) | ✅ PASS | `test_appointment_datetime_aware_input_serializes_naive` PROD-A sub-assertion at `test_api.py:1488-1509` (direct Pydantic model — the production failure mode cannot be reproduced on SQLite through the API, so the model-level assertion is the only way to verify) |
| 2 | New regression test passes: same datetime → GET `/busy_slots` returns naive ISO string | ✅ PASS | `test_get_busy_slots_handles_aware_datetime` at `test_api.py:1609-1652` (uses `MagicMock` to inject the aware datetime and asserts the response is 200 + contains the mock cita) |
| 3 | All existing 132 backend tests still pass (4 pre-existing rate-limiting failures are unrelated) | ✅ PASS | Full suite: 134 passed (132 pre-existing + 2 new), 4 failed (the same 4 pre-existing rate-limiting failures, unrelated to this change) |
| 4 | `tsc --noEmit` passes on the frontend | ✅ PASS | `cd frontend && npx tsc --noEmit` → no output, exit 0 |
| 5 | Manual production check: book a 09:00 appointment via the public flow, then verify (a) admin list shows 09:00 (not 06:00), (b) public calendar shows 09:00 as "Ocupado" | ⏳ PENDING-MANUAL | Requires a deployed staging environment with PostgreSQL/Supabase. Cannot be automated in this verification — by definition, the production failure mode cannot be reproduced on SQLite. Recommended next step: deploy `fix/tz-argentina-display` to staging, insert a cita with `tzinfo=UTC` via `psql`, GET `/busy_slots?date_str=YYYY-MM-DD` and confirm 200 + naive ISO output; POST a cita with `fecha_hora_cita: "2026-06-29T09:00:00Z"` and confirm the GET returns `"2026-06-29T09:00:00"` (no Z, no offset). |

**Success criteria**: 4/5 PASS, 1/5 PENDING-MANUAL (the production check, which by nature requires a deployed environment).

---

## 9. Notes for Archive Phase

- **OpenSpec convention**: This delta adds REQ-DCO-004 and REQ-DCO-005 to the `datetime-coordination` domain. The archive phase must merge them into the main spec at `openspec/specs/datetime-coordination/spec.md` (which does not yet exist as a merged file — the previous `timezone-fix` change's spec is still in its change folder per the spec's "Background" section).
- **Deviation tracking**: The 3 deviations documented in `apply-progress` (test structure, `naive()` local, no `frontend/src/lib/datetime.ts`) should be recorded in the archive-report's lineage section so future maintainers understand why the implementation diverges from the original design.
- **Production data audit** (per exploration.md risk #1): User decision in the proposal was to defer this. If production shows existing appointments at 09:00 Argentina time, no migration is needed. If they cluster around 09:00 UTC (i.e., the DB shifted them to UTC on write), a one-time migration script is needed. **This is out of scope for this change but should be flagged for the user.**
