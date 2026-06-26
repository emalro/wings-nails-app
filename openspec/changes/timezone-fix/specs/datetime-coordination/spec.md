# DateTime Coordination Specification

**Domain**: `datetime-coordination`
**Status**: New

---

## Purpose

Consistent datetime handling between frontend and backend using naive datetimes (no timezone suffix). The system operates in a single timezone (Argentina, UTC-3). Wall-clock time is the only time that matters.

---

## Requirements

### REQ-DCO-001 — Backend Datetime Serialization (MUST)

Backend MUST serialize all datetime fields WITHOUT the `Z` suffix. Datetime strings returned by the API MUST be parseable as naive datetimes representing Argentina wall-clock time.

#### Scenario: Backend returns naive datetime
- GIVEN a datetime field with value `2026-06-26T09:00:00` (Argentina time)
- WHEN the backend serializes the response
- THEN the datetime string is `2026-06-26T09:00:00`
- AND the string does NOT contain a `Z` suffix or UTC offset

#### Scenario: Frontend parses backend datetime correctly
- GIVEN the backend returns `2026-06-26T09:00:00` (naive)
- WHEN the frontend parses this string
- THEN the resulting Date/timestamp represents 09:00 Argentina time
- AND no UTC conversion occurs

### REQ-DCO-002 — Frontend Datetime Sending (MUST)

Frontend MUST send datetime strings as naive datetimes (no `Z` suffix, no UTC offset). The backend MUST interpret these as Argentina wall-clock time.

#### Scenario: Frontend sends appointment time
- GIVEN a user selects 09:00 on 2026-06-26
- WHEN the frontend sends the appointment payload
- THEN the datetime field is `2026-06-26T09:00:00`
- AND the backend stores it as `2026-06-26T09:00:00`

#### Scenario: Admin edits appointment time
- GIVEN an admin opens AppointmentModal for an appointment at 10:00
- WHEN the admin saves with the same time
- THEN the datetime remains `2026-06-26T10:00:00` (no shift)

### REQ-DCO-003 — Consistency Across Components (MUST)

All datetime handling in `Calendar.tsx`, `CalendarView.tsx`, `Reservar.tsx`, and `AppointmentModal.tsx` MUST use the same naive-datetime convention. No component MAY apply UTC offset conversion.

#### Scenario: CalendarView displays time from backend
- GIVEN backend returns appointment at `2026-06-26T14:00:00`
- WHEN CalendarView renders the appointment
- THEN it displays "14:00" (not "11:00" or any UTC-adjusted value)

#### Scenario: Reservar creates appointment payload
- GIVEN user selects slot at 15:30 on 2026-06-26
- WHEN Reservar submits the booking
- THEN the payload datetime is `2026-06-26T15:30:00`
- AND backend persists it unchanged

## Out of Scope

- Full UTC-migration with offset metadata
- Multi-timezone support
- Existing appointment data correction (legacy wrong-time appointments)
