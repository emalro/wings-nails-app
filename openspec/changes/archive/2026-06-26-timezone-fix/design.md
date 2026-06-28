# Design: DateTime Coordination Fix

## Technical Approach

Fix the datetime round-trip problem by ensuring naive datetimes flow correctly between frontend and backend: (1) Backend serializes naive datetimes without `Z` suffix, (2) Frontend parses naive strings as local wall-clock time, (3) Backend validates business hours and service duration on create/update, (4) Frontend filters past slots for today.

## Architecture Decisions

### Decision: Backend serialization without Z suffix

**Choice**: Configure `CitaRead` and `CitaUpdate` with a custom serializer that strips timezone info from datetime fields.

**Alternatives considered**:
- Use `datetime.isoformat()` manually in response building — rejected because it bypasses Pydantic's model serialization and breaks OpenAPI schema.
- Send timezone-aware datetimes with explicit offset — rejected because the system operates in a single timezone (Argentina, UTC-3) and wall-clock time is sufficient.

**Rationale**: Pydantic v2's default datetime serialization appends `Z` to naive datetimes, causing JavaScript to interpret them as UTC. By using a `model_serializer` or `field_serializer`, we strip the suffix while keeping the ISO format.

### Decision: Frontend naive datetime parsing

**Choice**: Parse naive datetime strings by appending `:00` seconds and using `new Date()` only for display formatting (hours/minutes), never for timestamp arithmetic.

**Alternatives considered**:
- Append timezone offset (`-03:00`) when parsing — rejected because it adds unnecessary complexity and assumes the server timezone never changes.
- Use a datetime library like `date-fns` — rejected because it adds a dependency for trivial parsing.

**Rationale**: The `CalendarView.tsx` line `new Date(cita.fecha_hora_cita)` is the core bug. When the string is `"2026-06-26T09:00:00Z"`, JS interprets it as UTC and displays 06:00 in Argentina time. By removing the `Z` suffix from the API response and parsing the naive string directly (extracting hours/minutes from the string, not from a Date object), we avoid timezone conversion entirely.

### Decision: Backend business hours validation

**Choice**: Validate appointment time in `create_appointment` and `update_appointment` by fetching effective hours for the appointment date and checking:
1. `appointment_time >= opening` (strictly after opening? spec says "before opening" is invalid, "at closing" is invalid)
2. `appointment_time < closing` (at closing is invalid per spec)
3. `appointment_time + service_duration <= closing + 1 hour` (grace period)

**Alternatives considered**:
- Validate only in frontend — rejected because backend must be the source of truth.
- Validate via a database trigger — rejected because SQLite doesn't support complex procedural logic.

**Rationale**: The backend already has `GET /schedule/effective` which returns opening/closing times. We reuse this logic in a helper function `validate_appointment_hours()`.

### Decision: Frontend past slot filtering

**Choice**: In `Calendar.tsx`'s `generateTimeSlots()`, after generating slots, filter out slots where the time is before the current local time when the selected date is today.

**Alternatives considered**:
- Filter in the backend's `busy_slots` endpoint — rejected because busy_slots returns booked slots, not time validity.
- Disable past slots via CSS only — rejected because the spec requires they not be displayed at all.

**Rationale**: Client-side filtering using `new Date()` for current time is appropriate here since the user's local clock determines what "past" means. The filter runs on every render when today is selected.

## Data Flow

```
User selects slot → Calendar.tsx generates naive datetime string "2026-06-26T09:00"
     ↓
Reservar.tsx sends { fecha_hora_cita: "2026-06-26T09:00" }
     ↓
Backend CitaCreate parses as naive datetime
     ↓
create_appointment validates: within business hours? duration fits?
     ↓
SQLite stores as naive datetime (no timezone)
     ↓
Backend CitaRead serializes WITHOUT Z suffix: "2026-06-26T09:00:00"
     ↓
Frontend CalendarView.tsx parses string directly → extracts 09:00 for display
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/app/schemas.py` | Modify | Add `field_serializer` to `CitaRead.fecha_hora_cita` to strip `Z` suffix. Same for `CitaUpdate.fecha_hora_cita` and `CitaCreate.fecha_hora_cita` if needed. Also add a custom validator to ensure naive datetime on input. |
| `backend/app/main.py` | Modify | Add `validate_appointment_hours()` helper. Call it in `create_appointment` and `update_appointment` before conflict check. Return 422 with clear error messages. |
| `frontend/src/components/Calendar.tsx` | Modify | In `generateTimeSlots()`, filter slots where `hour < currentHour` (or `hour === currentHour && minute < currentMinute`) when selected date is today. |
| `frontend/src/components/CalendarView.tsx` | Modify | Parse `cita.fecha_hora_cita` string directly instead of `new Date()`. Extract hours/minutes from the naive string for display. |
| `frontend/src/components/AppointmentModal.tsx` | Modify | When building payload, ensure `editDate + ':00'` produces a naive datetime string without `Z`. |

## Interfaces / Contracts

### Backend: Business hours validation helper

```python
def validate_appointment_hours(
    fecha_hora_cita: datetime,
    service_duration_minutes: int,
    session: Session
) -> None:
    """Validate appointment falls within business hours with 1h grace period.
    
    Raises HTTPException(422) if invalid.
    """
    date_str = fecha_hora_cita.strftime("%Y-%m-%d")
    effective = get_effective_hours_logic(date_str, session)  # reuse existing logic
    
    if not effective["abierto"]:
        raise HTTPException(422, detail="El local está cerrado este día")
    
    opening = datetime.strptime(effective["hora_apertura"], "%H:%M").time()
    closing = datetime.strptime(effective["hora_cierre"], "%H:%M").time()
    
    appointment_time = fecha_hora_cita.time()
    
    # REQ-HOR-010: must be within opening..closing (at closing is invalid)
    if appointment_time < opening or appointment_time >= closing:
        raise HTTPException(422, detail=f"El horario debe estar entre {effective['hora_apertura']} y {effective['hora_cierre']}")
    
    # REQ-HOR-011: start + duration <= closing + 1 hour
    from datetime import timedelta
    appointment_end = fecha_hora_cita + timedelta(minutes=service_duration_minutes)
    grace_closing = datetime.combine(fecha_hora_cita.date(), closing) + timedelta(hours=1)
    
    if appointment_end > grace_closing:
        raise HTTPException(422, detail=f"El servicio se extiende demasiado más allá del horario de cierre ({effective['hora_cierre']})")
```

### Frontend: Naive datetime parsing utility

```typescript
// Helper to parse naive datetime string without UTC conversion
function parseNaiveDatetime(isoString: string): { date: string; time: string; hours: number; minutes: number } {
  // "2026-06-26T09:00:00" → extract parts
  const [datePart, timePart] = isoString.split('T')
  const [hours, minutes] = timePart.split(':').map(Number)
  return { date: datePart, time: timePart.substring(0, 5), hours, minutes }
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `validate_appointment_hours()` with various edge cases | Python tests with mocked session and schedule data |
| Unit | Calendar slot filtering for today | Frontend unit test with mocked Date |
| Integration | API returns naive datetime without Z | Test that `GET /appointments` returns strings without Z suffix |
| Integration | Appointment creation rejects outside business hours | Test create with time before opening, at closing, after grace |
| E2E | Full booking flow shows correct local time | Manual or Cypress test |

## Migration / Rollout

No migration required. Existing appointments in SQLite store naive datetimes correctly — only the serialization format changes. No data transformation needed.

## Risks and Rollback

| Risk | Impact | Mitigation |
|------|--------|------------|
| Pydantic serializer breaks other datetime fields | Medium | Only apply to `CitaRead`/`CitaUpdate` schemas, not global config |
| Frontend parsing breaks for malformed strings | Low | Add defensive parsing with fallback |
| Business hours validation rejects previously valid bookings | Medium | Only validate on create/update, not on read. Existing appointments unaffected. |
| Timezone detection fails on client machines | Low | Past slot filtering uses local `new Date()` which is always correct for the user's clock |

**Rollback**: Revert the Pydantic serializer change and the validation logic. Frontend changes are additive (filtering, parsing) and won't break existing functionality if reverted.

## Open Questions

- [ ] Should the backend also validate that the appointment is not in the past? (Current spec doesn't require it, but it's a logical check.)
- [ ] Should `CitaUpdate` validation also check business hours, or only `CitaCreate`? (Spec says both.)
