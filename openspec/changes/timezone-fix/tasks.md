# Tasks: DateTime Coordination Fix (timezone-fix)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 85–110 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr-default |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Complete timezone-fix | PR 1 | All backend + frontend changes in one review |

## Phase 1: Backend — Naive Datetime Serialization

- [x] 1.1 Add `strip_z_suffix` field serializer to `schemas.py` and apply to `CitaRead.fecha_hora_cita`, `CitaUpdate.fecha_hora_cita`, `CitaCreate.fecha_hora_cita` — ensures API returns/accepts naive ISO strings without `Z` (REQ-DCO-001/002). ~20 lines.

## Phase 2: Backend — Business Hours & Duration Validation

- [x] 2.1 Add `validate_appointment_hours(fecha_hora_cita, service_duration_minutes, session)` helper in `main.py` — reuses `get_effective_hours` logic, checks REQ-HOR-010 (within opening..closing) and REQ-HOR-011 (start + duration ≤ closing + 1h grace). ~25 lines.
- [x] 2.2 Call `validate_appointment_hours()` in `create_appointment` before conflict check — pass `appointment.fecha_hora_cita` and computed `appointment_duration`. ~3 lines.
- [x] 2.3 Call `validate_appointment_hours()` in `update_appointment` — validate when `fecha_hora_cita` or `servicios` change, using the resolved date and new/current duration. ~8 lines.

## Phase 3: Frontend — Past Slot Filtering

- [x] 3.1 In `Calendar.tsx` `generateTimeSlots()`, after building the slot list, filter out slots where `hour < currentHour` (or `hour === currentHour && minute < currentMinute`) when the selected date is today. Add "no available slots" fallback message (REQ-BKG-006). ~8 lines.

## Phase 4: Frontend — Naive Datetime Parsing

- [x] 4.1 In `CalendarView.tsx` line 99, replace `new Date(cita.fecha_hora_cita)` with direct string parsing (split on `T`, extract hours/minutes) to build `start`/`end` Date objects without UTC conversion (REQ-DCO-001/003). ~6 lines.
- [ ] 4.2 In `AppointmentModal.tsx` view mode (lines 207, 213), replace `new Date(cita.fecha_hora_cita)` with direct string parsing for date and time display (REQ-DCO-003). ~6 lines.
- [ ] 4.3 In `AppointmentModal.tsx` `handleSave()` (line 82), verify `editDate + ':00'` produces a naive string — no change needed if backend serializer strips `Z`, but confirm no `.toISOString()` path exists. ~0–2 lines.

## Phase 5: Verification

- [ ] 5.1 Run `python -m pytest` in `backend/` to confirm no regressions from serializer and validation changes.
- [ ] 5.2 Run `tsc --noEmit` in `frontend/` to confirm no type errors from parsing changes.
- [ ] 5.3 Manual verification: create an appointment at a known time, confirm the API response lacks `Z` suffix, confirm CalendarView displays the correct local time, confirm editing preserves the time.
