# Tasks: Argentina Timezone Display — Serializer Fix

**Change**: `tz-argentina-display`
**Spec**: `openspec/changes/tz-argentina-display/specs/datetime-coordination/spec.md` (REQ-DCO-004, REQ-DCO-005)
**Design**: `openspec/changes/tz-argentina-display/design.md`
**Test runner**: `python -m pytest` from `backend/` (`strict_tdd: true`)
**Work-unit model**: 6 atomic tasks → 6 conventional commits → 1 PR

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines (cumulative) | ~60 (test ~30 + schemas.py ~25 + main.py ~5 + docs ~1 + frontend verify-only 0) |
| Files touched | 3 production + 1 test + 1 docs + 1 verify-only = 5 (3 modified, 1 added test) |
| 400-line budget risk | **Low** (~15% of budget) |
| Chained PRs recommended | **No** |
| Delivery strategy | `single-pr-default` (no chaining) |
| Review budget remaining after change | ~340 lines |

Decision needed before apply: No
Chained PRs recommended: No
400-line budget risk: Low

The cumulative diff across all 6 tasks is well under the 400-line review budget. A single PR is the right delivery vehicle. No chained/stacked PRs required.

---

## Branch and PR

- **Branch**: `fix/tz-argentina-display` from `main`
- **Target**: PR against `main`
- **Strategy**: Single PR (no chaining)
- **Commit format**: Conventional commits (`test(backend): …`, `fix(backend): …`, `chore(backend): …`, `docs(backend): …`)
- **PR title**: `fix(backend): strip tzinfo on datetime serialization (REQ-DCO-004/005)`
- **PR body**: links REQ-DCO-004 and REQ-DCO-005; references the previous `timezone-fix` regression; lists the new test as the regression guard.

---

## Task Order (RED-first, vertical slices)

The plan follows strict TDD: each production change is preceded or accompanied by a test that proves the behavior. Task 1 writes the failing test. Tasks 2-4 are the GREEN steps. Task 5 is full-suite verification. Task 6 is documentation.

---

### Task 1 — Add failing regression test for aware-datetime serialization (RED)

- **What**: Add `test_appointment_datetime_aware_input_serializes_naive` to `backend/tests/test_api.py` immediately after line 1655 (end of `test_appointment_datetime_no_z_suffix`). The test (a) inserts a `datetime(2026, 6, 29, 9, 0, tzinfo=timezone.utc)` cita via `Session(engine)`, (b) GETs `/appointments`, `/busy_slots`, `/clients/{id}` and asserts the response strings are `"2026-06-29T09:00:00"` (no `Z`, no offset), (c) POSTs a payload with `"2026-06-29T10:00:00Z"` and asserts the response is naive, (d) scans the GET payloads for any `Z` or `+00:00`.
- **Why**: Closes the regression test gap from `timezone-fix` PR #46 (the existing `test_appointment_datetime_no_z_suffix` only exercises the SQLite naive path). Satisfies REQ-DCO-004 scenarios PROD-A, PROD-B, PROD-C, PROD-E and REQ-DCO-005 scenario PROD-D. The test must FAIL on current `main` and pass only after Tasks 2-4 are applied.
- **TDD step**: RED
- **Verification**: `cd backend && python -m pytest tests/test_api.py::test_appointment_datetime_aware_input_serializes_naive -v` — must FAIL with assertion errors on `endswith("Z")` / `"+00:00" in body` (because current code emits `2026-06-29T09:00:00+00:00` for the aware input).
- **Files touched**: `backend/tests/test_api.py` (insert ~30 lines after line 1655; no other test file changes).
- **Estimated lines**: +30 / -0
- **Commit message**: `test(backend): add regression test for aware-datetime serialization (REQ-DCO-004)`

---

### Task 2 — Add `_strip_tz` helper and `@field_serializer` to response schemas (GREEN, partial)

- **What**: In `backend/app/schemas.py`:
  1. Add `field_serializer` to the existing `from pydantic import …` line (line 5).
  2. Add module-level helper at the top of the file (after imports, before `class ClienteCreate` at line 15):
     ```python
     def _strip_tz(v: datetime) -> str:
         """Serialize datetime to ISO without tzinfo suffix (REQ-DCO-004)."""
         return v.replace(tzinfo=None).isoformat() if v.tzinfo else v.isoformat()
     ```
  3. Add `@field_serializer("fecha_creacion")` method to `ClienteRead` (line 69).
  4. Add `@field_serializer("fecha_hora_cita", "fecha_registro_cita")` method to `CitaRead` (line 249).
- **Why**: Satisfies REQ-DCO-004 PROD-A and PROD-C. The serializer runs during Pydantic model serialization, which is the only guaranteed-correct spot (see design Decision: Field-level `@field_serializer`). After this task, the `/appointments` and `/clients/{id}` sub-assertions of the new test PASS, but `/busy_slots` still fails — fixed in Task 3.
- **TDD step**: GREEN (partial)
- **Verification**: `cd backend && python -m pytest tests/test_api.py::test_appointment_datetime_aware_input_serializes_naive -v` — PROD-A and PROD-C sub-assertions pass; PROD-B still fails; PROD-D still fails.
- **Files touched**: `backend/app/schemas.py` (~15 lines net: 5-line helper, 4-line method on `ClienteRead`, 4-line method on `CitaRead`, 1 import edit, 1 blank line for spacing).
- **Estimated lines**: +15 / -0
- **Commit message**: `fix(backend): strip tzinfo on CitaRead/ClienteRead datetime serialization (REQ-DCO-004)`

---

### Task 3 — Wrap `isoformat()` calls in `get_busy_slots` with `naive()` (GREEN)

- **What**: In `backend/app/main.py` `get_busy_slots` (lines 924-929), replace:
  ```python
  "start": cita.fecha_hora_cita.isoformat(),
  "end": cita_end.isoformat(),
  ```
  with:
  ```python
  # naive() wrap REQUIRED: this endpoint does not declare response_model,
  # so the CitaRead @field_serializer does NOT run here. Any new endpoint
  # returning a datetime MUST declare response_model (CitaRead/ClienteRead)
  # or apply naive() manually. — REQ-DCO-004 PROD-B
  "start": naive(cita.fecha_hora_cita).isoformat(),
  "end": naive(cita_end).isoformat(),
  ```
- **Why**: Satisfies REQ-DCO-004 PROD-B. The endpoint bypasses Pydantic's model serializer because it returns raw dicts (no `response_model`). The existing `naive()` helper at `main.py:26-34` is the right tool — same `replace(tzinfo=None)` semantics as `_strip_tz`. The inline comment is the guard against a future maintainer removing the wrap on the mistaken assumption that the schema-level serializer covers this path.
- **TDD step**: GREEN
- **Verification**: `cd backend && python -m pytest tests/test_api.py::test_appointment_datetime_aware_input_serializes_naive -v` — all of PROD-A, PROD-B, PROD-C, PROD-E pass; PROD-D (input normalization) still fails — fixed in Task 4.
- **Files touched**: `backend/app/main.py` (lines 926-927: 2 changed calls + 4-line comment block).
- **Estimated lines**: +5 / -2 (counting the comment as additions and the 2 modified lines as net-zero line-count).
- **Commit message**: `fix(backend): ensure get_busy_slots emits naive ISO (REQ-DCO-004)`

---

### Task 4 — Add `@field_validator` to `CitaCreate` and `CitaUpdate` for input normalization (GREEN)

- **What**: In `backend/app/schemas.py`:
  1. Add `@field_validator("fecha_hora_cita", mode="before") @classmethod def _normalize_naive(cls, v): …` to `CitaCreate` (line 135) that returns `v.replace(tzinfo=None) if hasattr(v, "tzinfo") and v.tzinfo else v`.
  2. Same validator on `CitaUpdate` (line 155). The `Optional[datetime]` type requires the validator to handle `None` — early-return `v` when it's `None` (covered by the `hasattr` check, since `None` has no `tzinfo`).
  3. `field_validator` is already imported (line 5); no import changes needed.
- **Why**: Satisfies REQ-DCO-005 (all 4 scenarios: PROD-D POST with `Z`, POST with explicit offset, PATCH round-trip, naive input accepted unchanged). Defensive against the round-trip asymmetry risk: client sends `Z` → DB shifts to UTC on write (PostgreSQL `TIMESTAMP WITH TIME ZONE` columns) → naive strip on read silently shifts the wall-clock hour. Stripping on input keeps the stored value equal to the wall-clock hour the user meant.
- **TDD step**: GREEN
- **Verification**: `cd backend && python -m pytest tests/test_api.py::test_appointment_datetime_aware_input_serializes_naive -v` — all sub-assertions pass (PROD-A, PROD-B, PROD-C, PROD-D, PROD-E).
- **Files touched**: `backend/app/schemas.py` (2 validator methods, ~6 lines each including the `@classmethod` and inline guard, but the body is 1 logical line so ~10 net lines total).
- **Estimated lines**: +10 / -0
- **Commit message**: `fix(backend): normalize aware datetimes on input to naive (REQ-DCO-005)`

---

### Task 5 — Full regression suite + frontend type-check (VERIFY)

- **What**: Run two verification commands, no code changes:
  1. `cd backend && python -m pytest tests/` — full backend suite.
  2. `cd frontend && npx tsc --noEmit` — TypeScript type-check.
- **Why**: Confirms (a) the 4 pre-existing rate-limiting failures are unchanged (unrelated, per `proposal.md` Success Criteria), (b) no new regressions are introduced by the serializer/validator change, (c) no frontend type errors result from any docstring updates. This is the gate before Task 6 (docs) and before opening the PR.
- **TDD step**: VERIFY (no RED/GREEN cycle)
- **Verification**:
  - pytest output: all tests pass EXCEPT the 4 pre-existing rate-limiting failures (unrelated).
  - tsc output: clean exit code, no errors.
  - If any new test fails or tsc reports an error, STOP and fix before Task 6.
- **Files touched**: none (verification only).
- **Estimated lines**: 0
- **Commit message**: `chore(backend): verify full test suite passes after TZ fix` (commit only if a `.pytest_cache` or `__pycache__` change is tracked; otherwise this task is a local-only gate, not a commit).

---

### Task 6 — Documentation pass (DOC)

- **What**:
  1. Read `frontend/src/lib/datetime.ts` lines 12-15. Confirm the docstring still states the naive convention (it does today: *"The backend serializes datetimes as naive ISO strings that represent the studio's wall-clock time in Argentina (UTC-3)"*). If drifted, update to match the new contract. If aligned, no edit.
  2. Append a new entry to `DOCUMENTATION.md` "Historial de cambios" section using the existing template (Fecha, Tipo, Descripción, Archivos, Requisitos, Motivo, Impacto). The entry records the regression-vs-`timezone-fix`, the new `field_serializer`/`field_validator`/`naive()` changes, the new regression test, and the operational impact (production appointments now display in booked wall-clock time, not UTC-3 shifted).
- **Why**: `AGENTS.md` rule 6: *"Antes de implementar un cambio, el agente debe registrar la intención en `DOCUMENTATION.md`. Al completar cualquier cambio, el agente debe documentar…"*. The docstring check prevents a future frontend contributor from "fixing" the perceived "missing timezone" by adding offset parsing, which would re-introduce the bug.
- **TDD step**: DOC
- **Verification**:
  - `git diff frontend/src/lib/datetime.ts` shows no changes (docstring already aligned), OR shows the minimal edit to restore alignment.
  - `git diff DOCUMENTATION.md` shows exactly one new entry in the "Historial de cambios" section, dated 2026-06-28, with the template fields filled.
- **Files touched**: `frontend/src/lib/datetime.ts` (verify only — likely 0 lines), `DOCUMENTATION.md` (+~12 lines for one new entry).
- **Estimated lines**: +12 / -0
- **Commit message**: `docs(backend): document tz-argentina-display fix and regression test`

---

## Traceability Matrix

| Requirement | Spec scenario | Satisfied by task(s) | Test coverage |
|---|---|---|---|
| REQ-DCO-004 (defensive output serializer) | PROD-A: cita GET emits naive | Task 2 (`_strip_tz` + `CitaRead` `@field_serializer`) | `test_appointment_datetime_aware_input_serializes_naive` PROD-A sub-assertion |
| REQ-DCO-004 | PROD-B: `/busy_slots` emits naive `start`/`end` | Task 3 (`naive()` wrap in `get_busy_slots`) | PROD-B sub-assertion |
| REQ-DCO-004 | PROD-C: `ClienteRead.fecha_creacion` is naive | Task 2 (`_strip_tz` + `ClienteRead` `@field_serializer`) | PROD-C sub-assertion |
| REQ-DCO-004 | PROD-E: no `Z` / `+00:00` in any response | Tasks 2 + 3 (both serializer paths covered) | PROD-E sub-assertion (negative) |
| REQ-DCO-005 (input normalization) | PROD-D: POST with `Z` → naive stored + returned | Task 4 (`CitaCreate` `@field_validator`) | PROD-D sub-assertion |
| REQ-DCO-005 | POST with explicit `-03:00` offset | Task 4 (same validator) | Implicit — same code path as PROD-D |
| REQ-DCO-005 | PATCH round-trip preserves wall-clock | Task 4 (`CitaUpdate` `@field_validator`) | Implicit — same validator on PATCH path |
| REQ-DCO-005 | Naive input accepted unchanged | Task 4 (validator's `else` branch) | Implicit — covered by existing `test_appointment_datetime_no_z_suffix` |
| Continuity with `timezone-fix` (REQ-DCO-001..003) | All prior scenarios still pass | Task 5 (full suite regression) | All 132 pre-existing tests |

---

## Cumulative Diff Estimate

| File | Lines | Direction |
|---|---|---|
| `backend/tests/test_api.py` | +30 | added (Task 1) |
| `backend/app/schemas.py` | +25 | added (Tasks 2 + 4) |
| `backend/app/main.py` | +5 / -2 | modified (Task 3) |
| `DOCUMENTATION.md` | +12 | added (Task 6) |
| `frontend/src/lib/datetime.ts` | 0 | verify-only (Task 6) |
| **Total** | **+70 / -2 ≈ 72** | well under 400-line budget |

The actual `git diff --stat` after all 6 tasks lands at approximately 70 changed lines (additions + deletions), which is ~18% of the 400-line review budget. Single PR is safe.

---

## Suggested Commit Graph

```
fix/tz-argentina-display
├── 1. test(backend): add regression test for aware-datetime serialization (REQ-DCO-004)
├── 2. fix(backend): strip tzinfo on CitaRead/ClienteRead datetime serialization (REQ-DCO-004)
├── 3. fix(backend): ensure get_busy_slots emits naive ISO (REQ-DCO-004)
├── 4. fix(backend): normalize aware datetimes on input to naive (REQ-DCO-005)
├── 5. chore(backend): verify full test suite passes after TZ fix  [optional, see Task 5 note]
└── 6. docs(backend): document tz-argentina-display fix and regression test
```

Each commit is independently reviewable. Commits 1-4 tell a complete RED→GREEN story even if commits 5-6 are dropped.
