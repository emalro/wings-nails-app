# Proposal: Timezone Fix — Appointment Time Coordination

## Intent

When users select 9:00 AM, the appointment saves as 7:00 AM (or 6:00 AM) due to a timezone mismatch between frontend and backend. The frontend generates naive datetimes (no timezone), the backend serializes them with a `Z` suffix (implying UTC), and the frontend then interprets them as UTC — converting to Argentina time (UTC-3). Additionally, past time slots for "today" should not appear in the calendar, and backend should validate that appointments fall within business hours.

## Scope

### In Scope
- **Fix timezone bug**: Remove `Z` suffix from backend datetime serialization so naive datetimes are treated consistently as wall-clock time across the stack
- **Past slot filtering**: Hide time slots in `Calendar.tsx` that have already passed when the selected date is today
- **Business-hours validation**: Backend validates that appointment time falls within the effective schedule for that day (using `GET /schedule/effective`)
- **Service duration check**: Backend validates that service fits before closing time
- **Admin edit fix**: `AppointmentModal.tsx` uses the same corrected datetime handling

### Out of Scope
- Full timezone-aware datetime migration (e.g., storing UTC with offset metadata)
- Multi-timezone support (single studio, single timezone)
- Frontend test infrastructure (no test runner exists yet)
- Changes to WhatsApp receipt or payment flow

## Capabilities

### New Capabilities
- `datetime-coordination`: Ensures consistent datetime handling between frontend and backend (naive datetime, no timezone suffix)

### Modified Capabilities
- `online-booking`: Add past-slot filtering for today's date in Calendar component
- `gestion-horarios`: Add backend validation that appointments respect effective schedule hours

## Approach

**Strategy: Naive datetime with no timezone suffix (Option B)**

The simplest correct fix for a single-timezone nail studio:
1. Backend: Configure Pydantic/SQLModel to serialize `datetime` fields WITHOUT the `Z` suffix (naive datetimes)
2. Frontend: Continue sending naive datetimes (no change needed in `Reservar.tsx` or `AppointmentModal.tsx` for sending)
3. Frontend: Parse backend responses without UTC conversion (treat as wall-clock time)
4. Frontend: In `Calendar.tsx`, when selected date is today, filter out slots where `slotTime < currentTime`
5. Backend: In `create_appointment`, validate slot falls within effective schedule hours
6. Backend: In `create_appointment`, validate service duration fits before closing

**Why this approach**: The business operates in a single timezone (Argentina). Wall-clock time is what matters. Adding UTC offsets would add complexity without benefit for this use case.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/app/schemas.py` | Modified | Remove `Z` suffix from datetime serialization config (line ~114) |
| `backend/app/main.py` | Modified | Add business-hours validation in `create_appointment` (line ~667) |
| `frontend/src/components/Calendar.tsx` | Modified | Filter past slots for today (line ~88) |
| `frontend/src/components/CalendarView.tsx` | Modified | Parse datetime without UTC assumption (line ~99) |
| `frontend/src/components/AppointmentModal.tsx` | Modified | Ensure consistent datetime handling when admin edits (line ~82) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Existing appointments in DB have wrong times | High | One-time migration script to fix stored datetimes (or document as known data issue) |
| Other consumers expect UTC format | Low | API is internal (single frontend); verify no webhook/external consumers |
| Past-slot filter timezone mismatch | Medium | Ensure frontend system clock is reliable; fallback to showing all slots if clock unreliable |

## Rollback Plan

1. Revert the Pydantic serialization config change in `schemas.py` (restore `Z` suffix)
2. Remove past-slot filtering logic from `Calendar.tsx`
3. Remove business-hours validation from `main.py`
4. Existing appointments remain as-is (wrong times persist but no new breakage)

## Dependencies

- `GET /schedule/effective` endpoint (already exists per `gestion-horarios` spec)
- `busy_slots` endpoint (already exists)

## Success Criteria

- [ ] User selecting 9:00 AM for today sees appointment at 9:00 AM in both frontend and backend
- [ ] Past time slots for today do not appear in the calendar
- [ ] Booking outside business hours returns 422 error with clear message
- [ ] Service duration that extends past closing time returns 422 error
- [ ] Admin editing appointments maintains correct time
- [ ] `tsc --noEmit` passes with no type errors
