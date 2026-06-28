# Delta for DateTime Coordination

**Domain**: `datetime-coordination`
**Change**: `tz-argentina-display`
**Status**: Delta — extends the `timezone-fix` spec (REQ-DCO-001..003)

---

## Context

Completes what the previously-merged `timezone-fix` change left undone.
PR #46 added the `naive()` comparison helper but never wired
`field_serializer` into `CitaRead` / `ClienteRead`; the existing
regression test only exercises the SQLite naive path. This delta closes
the gap with a defensive output serializer (DCO-004) and an input
normalizer (DCO-005) so production (PostgreSQL/Supabase, tz-aware
UTC) behaves identically to local SQLite (naive).

---

## ADDED Requirements

### REQ-DCO-004 — Defensive Serializer on Aware Datetimes (MUST)

When the database returns a timezone-aware datetime, the API serializer
MUST strip the timezone info before emitting JSON. The emitted value
MUST NOT contain a `Z` suffix or a `±HH:MM` offset. The emitted value
MUST be parseable by JavaScript `new Date()` in an Argentina (UTC-3)
browser as the same wall-clock hour the user booked.

This applies to: `CitaRead.fecha_hora_cita`, `CitaRead.fecha_registro_cita`,
`ClienteRead.fecha_creacion`, and the `get_busy_slots` response
(`start` and `end` fields).

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

The API MUST accept datetime strings with a `Z` suffix or `±HH:MM` offset
on incoming appointment payloads (POST `/appointments` and PATCH
`/appointments/{id}`). The validator MUST normalize the value to a naive
datetime before storage, so that a write→read round-trip preserves the
Argentina wall-clock hour.

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

## Background

- **Prior change**: `openspec/changes/timezone-fix/specs/datetime-coordination/spec.md`
  defines REQ-DCO-001..003. This delta adds DCO-004 and DCO-005; it does
  not modify the existing requirements.
- **Prior regression**: `backend/tests/test_api.py::test_appointment_datetime_no_z_suffix`
  only exercises the SQLite naive path. The new regression test required
  by DCO-004 MUST inject `tzinfo=timezone.utc` directly to exercise the
  production failure mode.
