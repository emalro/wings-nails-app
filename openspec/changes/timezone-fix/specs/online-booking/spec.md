# Delta for Online Booking

## ADDED Requirements

### REQ-BKG-006 — Past Slot Filtering (MUST)

When the selected date in `Calendar.tsx` is today, time slots that have already passed MUST NOT be displayed. This filtering is client-side, using the user's local clock.

(Previously: All generated slots were shown regardless of current time.)

#### Scenario: Today with past slots hidden
- GIVEN it is 13:00 on 2026-06-26
- WHEN the user selects today's date in the calendar
- THEN slots before 13:00 (e.g., 09:00, 09:30, …, 12:30) are NOT shown
- AND slots from 13:00 onward ARE shown

#### Scenario: Future date shows all slots
- GIVEN it is 13:00 on 2026-06-26
- WHEN the user selects 2026-06-27 in the calendar
- THEN all slots for that day are shown (no filtering)

#### Scenario: All slots passed
- GIVEN it is 20:00 and business closes at 18:00
- WHEN the user selects today
- THEN no slots are shown (or a "no available slots" message appears)

#### Scenario: First slot of the day is still available
- GIVEN it is 08:30 and business opens at 09:00
- WHEN the user selects today
- THEN the 09:00 slot IS shown
