# Delta for Gestión de Horarios

## ADDED Requirements

### REQ-HOR-010 — Appointment Time Validation (MUST)

Backend MUST validate that the appointment datetime falls within the effective business hours for that day, using `GET /schedule/effective`. If the appointment time is before opening or at/after closing, the backend MUST return 422 with a clear error message.

#### Scenario: Appointment within business hours
- GIVEN effective hours for 2026-06-26 are 09:00–18:00
- WHEN a booking request is made for 10:00 on 2026-06-26
- THEN the appointment is created successfully

#### Scenario: Appointment before opening
- GIVEN effective hours for 2026-06-26 are 09:00–18:00
- WHEN a booking request is made for 08:30 on 2026-06-26
- THEN the backend returns 422
- AND the error message indicates the time is outside business hours

#### Scenario: Appointment at closing time
- GIVEN effective hours for 2026-06-26 are 09:00–18:00
- WHEN a booking request is made for 18:00 on 2026-06-26
- THEN the backend returns 422
- AND the error message indicates the time is outside business hours

#### Scenario: Day is closed
- GIVEN effective hours for 2026-06-27 indicate `abierto: false`
- WHEN a booking request is made for any time on 2026-06-27
- THEN the backend returns 422

### REQ-HOR-011 — Service Duration Validation with Grace Period (MUST)

Backend MUST validate that the service duration fits before closing time WITH a 1-hour grace period. The appointment start time + service duration MUST be ≤ closing time + 1 hour. If it exceeds closing + 1 hour, the backend MUST return 422 with a clear error message.

**Rule**: `start + duration <= closing + 1h` → VALID | `start + duration > closing + 1h` → INVALID

#### Scenario: Service fits before closing
- GIVEN closing at 18:00, service duration 60 min, appointment at 17:00
- WHEN the booking request is submitted
- THEN the appointment is created successfully (17:00 + 60 min = 18:00, valid)

#### Scenario: Service extends 30 min past closing (within grace)
- GIVEN closing at 18:00, service duration 90 min, appointment at 17:00
- WHEN the booking request is submitted
- THEN the appointment is created successfully (17:00 + 90 min = 18:30, within 1h grace)

#### Scenario: Service extends exactly 1 hour past closing (boundary)
- GIVEN closing at 18:00, service duration 120 min, appointment at 17:00
- WHEN the booking request is submitted
- THEN the appointment is created successfully (17:00 + 120 min = 19:00, exactly at grace limit)

#### Scenario: Service exceeds 1 hour past closing (INVALID)
- GIVEN closing at 18:00, service duration 150 min, appointment at 17:00
- WHEN the booking request is submitted
- THEN the backend returns 422
- AND the error message indicates the service extends too far past closing

#### Scenario: Short service near closing (within grace)
- GIVEN closing at 18:00, service duration 30 min, appointment at 17:45
- WHEN the booking request is submitted
- THEN the appointment is created successfully (17:45 + 30 = 18:15, within 1h grace)

#### Scenario: Short service exceeds grace
- GIVEN closing at 18:00, service duration 30 min, appointment at 18:31
- WHEN the booking request is submitted
- THEN the backend returns 422 (18:31 + 30 = 19:01 > 19:00)

#### Scenario: Last valid slot
- GIVEN closing at 18:00, service duration 30 min
- WHEN booking at 18:30
- THEN the appointment is created successfully (18:30 + 30 = 19:00, exactly at grace limit)
