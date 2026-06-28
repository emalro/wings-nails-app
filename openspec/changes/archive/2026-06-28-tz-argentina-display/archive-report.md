# Archive Report: tz-argentina-display

**Change**: `tz-argentina-display`
**Archived at**: 2026-06-28
**Branch**: `fix/tz-argentina-display`
**Verdict**: PASS WITH COMMENTS
**Total commits**: 8 (5 original RED→GREEN + 3 from re-apply batch addressing C-1 and W-1)
**Diff vs main**: 252 insertions, 5 deletions across 4 files (64% of 400-line review budget)
**Archive folder**: `openspec/changes/archive/2026-06-28-tz-argentina-display/`

---

## What was done

Identified the 3h timezone display bug in production: PostgreSQL/Supabase returns tz-aware UTC datetimes; Pydantic v2's default `field_serializer` emits them as `2026-06-29T09:00:00Z`; the Argentina browser (UTC-3) shifts them to 06:00, producing two visible failures — admin appointment list shows 06:00 for appointments booked at 09:00, and the public calendar does not mark busy slots as "Ocupado".

The change adds:

- A Pydantic v2 `@field_serializer` (3 fields) that strips tzinfo before serialization, via a module-level `_strip_tz` helper.
- A defensive `@field_validator(mode="after")` on `CitaCreate.fecha_hora_cita` and `CitaUpdate.fecha_hora_cita` (2 fields) that normalizes incoming `Z`/offset strings to naive on input.
- A `naive()` wrap on both the comparison and the `isoformat()` serialization inside `get_busy_slots` (the only endpoint that bypasses Pydantic's `response_model`).
- Two new regression tests that catch the production failure mode that SQLite cannot reproduce (Pydantic model direct assertion + MagicMock session for `get_busy_slots`).

The change completes the prior `timezone-fix` change (PR #46, archived 2026-06-26), whose verify report was a false positive — the original serializer was never wired in.

---

## Files changed

- `backend/app/schemas.py` (+33 / -0 net) — `_strip_tz` helper, 3 `@field_serializer` decorators (CitaRead.fecha_hora_cita, CitaRead.fecha_registro_cita, ClienteRead.fecha_creacion), 2 `@field_validator(mode="after")` decorators (CitaCreate.fecha_hora_cita, CitaUpdate.fecha_hora_cita).
- `backend/app/main.py` (+13 / -5 net) — `naive()` hoisted above the for-loop in `get_busy_slots`; wraps BOTH the date-range comparison (C-1 fix) and the two `isoformat()` calls; updated inline comment to document the response_model gap honestly.
- `backend/tests/test_api.py` (+189 / -0 net) — `test_appointment_datetime_aware_input_serializes_naive` (Pydantic model-level + integration smoke + validator probe) and `test_get_busy_slots_handles_aware_datetime` (MagicMock session injecting tzinfo=timezone.utc).
- `DOCUMENTATION.md` (+22 / -0 net) — "Historial de cambios" entry recording the regression-vs-`timezone-fix`, the new serializer/validator changes, the regression test, and operational impact.

Cumulative diff: 4 files, 252 insertions, 5 deletions, 64% of the 400-line review budget.

---

## Requirements added

- **REQ-DCO-004 — Defensive Serializer on Aware Datetimes (MUST)** — the API serializer MUST strip tzinfo from aware datetimes before emitting JSON. Applies to `CitaRead.fecha_hora_cita`, `CitaRead.fecha_registro_cita`, `ClienteRead.fecha_creacion`, and the `get_busy_slots` response.
- **REQ-DCO-005 — Input Normalization on Aware Datetimes (MUST)** — the validator MUST normalize incoming `Z`/offset strings to naive on input. Applies to `CitaCreate.fecha_hora_cita` and `CitaUpdate.fecha_hora_cita`.

Both requirements are now part of the source-of-truth main spec at `openspec/specs/datetime-coordination/spec.md`.

---

## Spec lineage

This change completes the prior `timezone-fix` change (PR #46, archived at `openspec/changes/archive/2026-06-26-timezone-fix/`). Both deltas have been merged into the main spec:

- **From `timezone-fix`**: REQ-DCO-001 (Backend Datetime Serialization), REQ-DCO-002 (Frontend Datetime Sending), REQ-DCO-003 (Consistency Across Components).
- **From `tz-argentina-display`**: REQ-DCO-004 (Defensive Serializer on Aware Datetimes), REQ-DCO-005 (Input Normalization on Aware Datetimes).

The prior `timezone-fix` change was archived today (2026-06-28) as part of the same batch operation, with explicit reconciliation of its stale implementation checkboxes (see "Stale task reconciliation" below).

---

## Deviations from design

1. **Test structure: Pydantic model assertions instead of DB integration** (planned: `Session.add(Cita(... tzinfo=timezone.utc))` then `GET /appointments`; actual: direct `CitaRead(...)` and `ClienteRead(...)` model construction + integration smoke tests + `CitaCreate.model_validate` validator probe). **Soundness**: necessary adaptation. SQLite strips tzinfo on read, so a DB-injected aware datetime becomes naive on the way back through the ORM, masking the production bug. The model-level assertion is the only probe that catches the production failure mode on SQLite. The `get_busy_slots` test uses `app.dependency_overrides[get_session]` with a `MagicMock` carrying `tzinfo=timezone.utc` to inject the production failure mode at the DB boundary while keeping the test as an integration-style HTTP test.
2. **`naive()` redefined locally in `get_busy_slots` then hoisted to above the for-loop** (planned: use the existing module-level `naive()`; actual: redefined locally and hoisted above the for-loop). **Soundness**: necessary adaptation. The pre-existing module-level `naive()` was removed or never re-defined at module level in the current `main.py`; defining it above the for-loop (not nested inside) was required to fix C-1 because the comparison at the new line 914 runs BEFORE the `for` body where a hypothetical nested def would be reached.
3. **`field_validator` mode changed from `"before"` to `"after"`** (planned: `mode="before"`; actual: `mode="after"`, W-1 fix). **Soundness**: critical correctness fix. `mode="before"` was a no-op for the production failure mode (Z-suffix strings are parsed by Pydantic AFTER the validator runs in `before` mode, so the validator saw a parsed aware datetime, not the Z-suffix string). `mode="after"` runs the validator AFTER Pydantic parses the string, so it sees a `datetime` object and can call `replace(tzinfo=None)` on it. The strengthened test `CitaCreate.model_validate({"fecha_hora_cita": "2026-06-29T09:00:00Z"}).fecha_hora_cita.tzinfo is None` is the only assertion that distinguishes `mode="before"` from `mode="after"` on SQLite.
4. **`frontend/src/lib/datetime.ts` does not exist** (planned: verify the docstring; actual: the file does not exist). **Soundness**: design assumption was incorrect. The frontend uses inline `toLocaleTimeString('es-AR', ...)` and a local `formatAppointmentDate` helper inside `ClientSection.tsx`. All of these consume the date string via `new Date(fecha_hora_cita)` with no `timeZone` option, which is correct for naive strings + Argentina browser. No frontend code change is needed.

---

## Findings during review

Two findings were raised by the review and addressed in the re-apply batch (commits `221132b`, `052ad4f`, `6f16b50`):

- **C-1: Comparison crash in `get_busy_slots`** (CRITICAL). The `get_busy_slots` endpoint at `main.py:907` compared `cita.fecha_hora_cita` (potentially aware UTC from PostgreSQL) against `start_of_day`/`end_of_day` (naive), raising `TypeError: can't compare offset-naive and offset-aware datetimes` and returning 500. SQLite could not reproduce because its driver strips tzinfo. **Fix**: hoisted `naive()` above the for-loop and wrapped BOTH sides of the comparison.
- **W-1: `field_validator(mode="before")` no-op for Z-suffix strings** (WARNING). In `mode="before"`, the validator runs before Pydantic parses the string. A `"2026-06-29T09:00:00Z"` string has no `tzinfo` attribute, so the validator returned it unchanged. Pydantic then parsed it into an aware datetime that flowed through to the DB. **Fix**: switched to `mode="after"`; strengthened the test to assert via `CitaCreate.model_validate(...)` that the validated model's `tzinfo is None`.

**0 outstanding issues at archive time.**

---

## SUGGESTIONs (not blockers, deferred)

- **S-1**: Add a test that constructs `datetime(2026, 6, 29, 9, 0, tzinfo=timezone(timedelta(hours=-3)))` and asserts naive output. The validator's body is offset-agnostic by construction (`v.replace(tzinfo=None) if v.tzinfo else v`), so this is documentation as much as verification. ~5 lines.
- **S-2**: Add a PATCH round-trip test (POST a cita, PATCH with `"2026-06-29T11:00:00Z"`, GET `/appointments`, assert naive output). The `CitaUpdate` validator is structurally identical to `CitaCreate`, but no explicit round-trip assertion exists. ~20 lines.

---

## PENDING-MANUAL

- **Production data audit + 09:00 booking check on Supabase environment** (cannot be automated in SQLite). Recommended next step: deploy `fix/tz-argentina-display` to staging, insert a cita with `tzinfo=UTC` via `psql`, GET `/busy_slots?date_str=YYYY-MM-DD` and confirm 200 + naive ISO output; POST a cita with `fecha_hora_cita: "2026-06-29T09:00:00Z"` and confirm the GET returns `"2026-06-29T09:00:00"` (no Z, no offset); verify that admin appointment list shows 09:00 (not 06:00) and the public calendar shows 09:00 as "Ocupado".

---

## Stale task reconciliation (prior `timezone-fix` change)

The orchestrator explicitly authorized reconciling the prior `timezone-fix` change's stale implementation checkboxes as part of the same archive batch. The 5 unchecked tasks in `openspec/changes/archive/2026-06-26-timezone-fix/tasks.md` are reconciled as follows:

- **4.2** (`AppointmentModal.tsx` view mode replace `new Date(cita.fecha_hora_cita)` with direct string parsing): **Done in effect**. The current `AppointmentModal.tsx` already uses `toLocaleTimeString('es-AR', ...)` on `new Date(fecha_hora_cita)`, which is correct for naive strings + Argentina browser. The structural change is no longer required.
- **4.3** (`AppointmentModal.tsx` `handleSave()` verify `editDate + ':00'` produces a naive string): **Done in effect**. The current `handleSave()` builds the payload as `editDate + 'T' + editTime + ':00'` (a string concat), which produces a naive ISO string. No `.toISOString()` path exists.
- **5.1** (Run `python -m pytest` in `backend/` to confirm no regressions): **Done**. Confirmed by the `tz-argentina-display` full suite (134 passed + 4 pre-existing rate-limiting failures, unchanged from main).
- **5.2** (Run `tsc --noEmit` in `frontend/`): **Done**. Confirmed by the `tz-argentina-display` verify report (`exit 0`, no output).
- **5.3** (Manual production verification): **PENDING-MANUAL** (same blocker as the current change — requires a deployed Supabase environment).

Reconciliation reason: the prior `timezone-fix` change was archived as PASS despite these tasks being unchecked, because the verify report was a false positive on the serializer wiring. The follow-up `tz-argentina-display` change superseded the unchecked frontend tasks (turns out the frontend code was already correct, just not for the reason the design assumed), and the verification tasks have been satisfied by the `tz-argentina-display` verify phase.

This is an **intentional archive with stale-checkbox reconciliation**, authorized by the orchestrator. The audit trail records what was missing and why the work is now complete.

---

## Engram observation lineage

| Artifact | Observation ID | Title |
|---|---|---|
| Explore | 221 | `sdd/tz-argentina-display/explore` |
| Proposal | 222 | `sdd/tz-argentina-display/proposal` |
| Spec | 223 | `sdd/tz-argentina-display/spec` |
| Design | 224 | `sdd/tz-argentina-display/design` |
| Tasks | 225 | `sdd/tz-argentina-display/tasks` |
| Apply progress | 226 | `sdd/tz-argentina-display/apply-progress` |
| Verify report | 228 | `sdd/tz-argentina-display/verify-report` |
| Archive report | (this one) | `sdd/tz-argentina-display/archive-report` |

Prior `timezone-fix` lineage (archived today):

| Artifact | Observation ID | Title |
|---|---|---|
| Proposal | 153 | `sdd/timezone-fix/proposal` |
| Spec | 154 | `sdd/timezone-fix/spec` |
| Design | 155 | `sdd/timezone-fix/design` |
| Tasks | 156 | `sdd/timezone-fix/tasks` |
| Apply progress | 157 | `sdd/timezone-fix/apply-progress` |
| Verify report | 159 | `sdd/timezone-fix/verify-report` |

---

## Next steps

- [ ] Push branch to origin: `git push origin fix/tz-argentina-display`
- [ ] Open PR `fix/tz-argentina-display` against `main`
- [ ] After PR merge, manual production check: book a 09:00 appointment via the public flow, verify (a) admin list shows 09:00 (not 06:00), (b) public calendar shows 09:00 as "Ocupado"
- [ ] Optional: implement S-1 and S-2 in a follow-up change
