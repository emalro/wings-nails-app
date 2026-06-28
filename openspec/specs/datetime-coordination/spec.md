# DateTime Coordination Specification

**Domain**: `datetime-coordination`
**Status**: Active
**Source changes**: `timezone-fix` (2026-06-26, PR #46), `tz-argentina-display` (2026-06-28, PR pending)
**Merged by**: `sdd-archive` on 2026-06-28

---

## Purpose

Consistent datetime handling between frontend and backend using naive datetimes (no timezone suffix). The system operates in a single timezone (Argentina, UTC-3). Wall-clock time is the only time that matters.

The naive convention covers three concerns:

1. **Output serialization** — API responses must be parseable by the Argentina browser as the same wall-clock hour the user booked.
2. **Input normalization** — POST/PATCH payloads with a `Z` suffix or `±HH:MM` offset must be normalized to naive before storage, so write→read round-trips preserve the wall-clock hour.
3. **Internal comparison** — Date-time arithmetic inside the API (busy-slot filtering, business-hours validation, appointment-overlap checks) must compare naive datetimes only. Mixing aware and naive datetimes raises `TypeError`.

This domain was first defined by the `timezone-fix` change (REQ-DCO-001..003) and completed by `tz-argentina-display` (REQ-DCO-004, REQ-DCO-005) once a production failure showed the original serializer wiring was incomplete on PostgreSQL/Supabase.

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

### REQ-DCO-004 — Defensive Serializer on Aware Datetimes (MUST)

When the database returns a timezone-aware datetime, the API serializer MUST strip the timezone info before emitting JSON. The emitted value MUST NOT contain a `Z` suffix or a `±HH:MM` offset. The emitted value MUST be parseable by JavaScript `new Date()` in an Argentina (UTC-3) browser as the same wall-clock hour the user booked.

This applies to: `CitaRead.fecha_hora_cita`, `CitaRead.fecha_registro_cita`, `ClienteRead.fecha_creacion`, and the `get_busy_slots` response (`start` and `end` fields).

#### Scenario: Cita with aware UTC datetime serializes naive (PROD-A)

- GIVEN a cita stored as `datetime(2026, 6, 29, 9, 0, tzinfo=timezone.utc)` in the DB
- WHEN the client GETs `/appointments`
- THEN `fecha_hora_cita` equals `"2026-06-29T09:00:00"`
- AND the string contains neither `Z` nor `+00:00` nor any `±HH:MM` offset

#### Scenario: Browser in UTC-3 displays the booked wall-clock hour

- GIVEN a cita stored as `datetime(2026, 6, 29, 9, 0, tzinfo=timezone.utc)` in the DB
- WHEN the response string is parsed by `new Date("2026-06-29T09:00:00")` in an Argentina (UTC-3) browser
- THEN `getHours()` returns `9` (not `6`)

#### Scenario: get_busy_slots emits naive start and end (PROD-B)

- GIVEN a cita stored as `datetime(2026, 6, 29, 9, 0, tzinfo=timezone.utc)` in the DB
- WHEN the client GETs `/busy_slots?date_str=2026-06-29`
- THEN each busy slot entry has `start == "2026-06-29T09:00:00"`
- AND `end` is the corresponding naive ISO string with no `Z` and no offset

#### Scenario: ClienteRead fecha_creacion is naive (PROD-C)

- GIVEN a cliente with `fecha_creacion` stored as tz-aware UTC
- WHEN the client GETs `/clients/{id}`
- THEN `fecha_creacion` equals the naive ISO string
- AND the string contains no `Z` and no `±HH:MM` offset

#### Scenario: Response payload never contains Z or offset (PROD-E, negative)

- GIVEN any cita or cliente whose DB row holds a tz-aware UTC datetime
- WHEN any GET endpoint returns that entity
- THEN the JSON payload MUST NOT contain `Z`, `+00:00`, or any other offset anywhere in the response

### REQ-DCO-005 — Input Normalization on Aware Datetimes (MUST)

The API MUST accept datetime strings with a `Z` suffix or `±HH:MM` offset on incoming appointment payloads (POST `/appointments` and PATCH `/appointments/{id}`). The validator MUST normalize the value to a naive datetime before storage, so that a write→read round-trip preserves the Argentina wall-clock hour.

#### Scenario: POST with Z suffix is normalized to naive (PROD-D)

- GIVEN a client POSTs to `/appointments` with `fecha_hora_cita == "2026-06-29T09:00:00Z"`
- WHEN the API persists the cita
- THEN the stored value is the naive `2026-06-29T09:00:00` (no tzinfo)
- AND a subsequent GET returns `"2026-06-29T09:00:00"` (no Z, no offset)

#### Scenario: POST with explicit offset is normalized to naive

- GIVEN a client POSTs with `fecha_hora_cita == "2026-06-29T09:00:00-03:00"`
- WHEN the API persists the cita
- THEN the stored value is the naive `2026-06-29T09:00:00` and a subsequent GET returns `"2026-06-29T09:00:00"`

#### Scenario: PATCH round-trip preserves wall-clock

- GIVEN an existing cita booked at `09:00` Argentina time
- WHEN a client PATCHes with `fecha_hora_cita == "2026-06-29T09:00:00Z"`
- THEN the next GET returns `"2026-06-29T09:00:00"` (no hour shift)

#### Scenario: Naive input is accepted unchanged

- GIVEN a client POSTs with `fecha_hora_cita == "2026-06-29T09:00:00"` (already naive)
- WHEN the API persists the cita
- THEN the stored and returned values equal `"2026-06-29T09:00:00"`

---

## Out of Scope

- Full UTC-migration with offset metadata.
- Multi-timezone support.
- Existing appointment data correction (legacy wrong-time appointments).

---

## Lineage

| Requirement | Introduced by | Merged in | Notes |
|---|---|---|---|
| REQ-DCO-001 | `timezone-fix` (PR #46) | This spec | Originally tagged as "implemented" via Pydantic v2 default; the `tz-argentina-display` review found that the default does NOT strip tzinfo for aware PostgreSQL datetimes. The defensive serializer (DCO-004) is now the canonical implementation. |
| REQ-DCO-002 | `timezone-fix` (PR #46) | This spec | Frontend convention; no code change required for this requirement. |
| REQ-DCO-003 | `timezone-fix` (PR #46) | This spec | Frontend convention; relies on DCO-001/004 being implemented correctly. |
| REQ-DCO-004 | `tz-argentina-display` (PR pending) | This spec | New — closes the production regression that PR #46 left open. |
| REQ-DCO-005 | `tz-argentina-display` (PR pending) | This spec | New — defensive input validator (mode="after") that keeps POST/PATCH round-trips symmetric. |
