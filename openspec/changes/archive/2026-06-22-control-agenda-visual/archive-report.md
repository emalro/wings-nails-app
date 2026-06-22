# Archive Report — Control de Agenda Visual

| Field | Value |
|-------|-------|
| **Change Name** | `control-agenda-visual` |
| **Title** | Control de Agenda Visual |
| **Archive Date** | 2026-06-22 |
| **Chain Strategy** | `feature-branch-chain` |
| **Artifact Store Mode** | `both` (Engram + OpenSpec) |
| **Verification Verdict** | PASS |

---

## Summary

Replaced the admin panel's textual appointment list with a visual calendar (react-big-calendar) supporting day/week/month toggle with color-coded appointments by status. Added appointment detail modal and "Mark as Attended" flow with editable accounting breakdown (price - deposit = balance). Extended the backend PATCH endpoint to accept `monto_recibido_en_caja`, increment `cantidad_turnos_abonados` on the client when marking Asistido.

## What Was Built

### Backend
- Extended `CitaUpdate` schema with optional `monto_recibido_en_caja: Optional[float]`
- Extended `PATCH /appointments/{id}` to validate ≥0, accept monto, and increment `cliente.cantidad_turnos_abonados` on Asistido transition
- 5 new integration tests: negative monto → 422, backward compat, increment counter, no-client crash, cancelado without monto

### Frontend
- **CalendarView**: react-big-calendar wrapper with day/week/month toggle, navigation, color-coded events (`eventPropGetter`), empty state "Sin turnos registrados"
- **AppointmentModal**: overlay with full appointment details (client, services, amounts, status), "Mark as Attended" button conditional on Confirmado state
- **MarkAttendedModal**: accounting breakdown (Precio - Seña = Saldo), editable `monto_recibido_en_caja`, confirm/cancel, error + retry state
- **Admin.tsx**: replaced list section with CalendarView + modal orchestration
- Extended `api.ts` and `useAppointments.ts` hook for extended PATCH payload + `['clients']` invalidation

## Verification

| Metric | Result |
|--------|--------|
| Tasks total | 10/10 complete |
| Tests (backend) | 8/8 passed (5 new + 3 pre-existing) |
| TypeScript | `tsc --noEmit` passed with 0 errors |
| Spec compliance | 12/12 scenarios compliant |
| Issues | 3 suggestions (no CRITICAL, no WARNING) |
| **Verdict** | **PASS** |

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| D1: Calendar library | `react-big-calendar` + `date-fns` | 30KB gzip, native day/week/month views, eventPropGetter for colors, responsive |
| D2: Color palette | Amber/Green/Gray/Red | Matches status semantics: pending (warm), confirmed (positive), attended (neutral), cancelled (negative) |
| D3: Only increment `cantidad_turnos_abonados` | Confirmed | `cantidad_turnos_tomados` already incremented on POST; spec resolved this correctly |
| D4: monto validation | Backend ≥0 check → 422 | Consistent with existing validation pattern; Pydantic `ge=0` on field level |

## Stale Checkbox Reconciliation

The persisted `tasks.md` artifact had all 10 tasks showing `- [ ]` (unchecked) despite completion. This was reconciled at archive time — backed by verify-report proof (10/10 tasks complete, PASS verdict, 8/8 tests passing, 12/12 spec scenarios compliant). The archived `tasks.md` now shows all tasks as `- [x]`.

## Archived Artifacts

| Artifact | Status |
|----------|--------|
| `proposal.md` | ✅ Archived |
| `spec.md` | ✅ Archived (delta spec covering admin-agenda-visual + frontend-data-fetching) |
| `design.md` | ✅ Archived |
| `tasks.md` | ✅ Archived (10/10 complete, reconciled) |
| `verify-report.md` | ✅ Archived (PASS) |
| `archive-report.md` | ✅ This file |

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `admin-agenda-visual` | **Created** | New domain spec — CAL-001, CAL-002, CAL-003 with scenarios and edge cases |
| `frontend-data-fetching` | **Updated** | FE-001 extended: `useUpdateAppointmentStatus` now accepts `monto_recibido_en_caja`, invalidates `['clients']`; API function renamed to `updateAppointment` |

### Note on API-001

The delta spec also modifies API-001 (CitaUpdate schema extension). This backend schema change is documented in the archived delta spec under `spec.md` but has no corresponding main spec in `openspec/specs/` yet (no `backend-api` domain exists). The change is captured in the archive audit trail.

## Key Learnings

- react-big-calendar's `eventPropGetter` provides clean per-event styling without custom CSS-in-JS solutions
- The `monto_recibido_en_caja` field already existed in the SQLModel schema with `default=0.0`, making the schema extension purely a Pydantic `CitaUpdate` change
- TanStack Query's automatic request deduplication handles rapid view toggle without explicit cancellation logic
- The `cliente` increment logic required a guard for deleted clients (no crash, graceful fallback)

## What Remains for Future Changes

- Frontend component tests (CalendarView, AppointmentModal, MarkAttendedModal) — currently only manual/visual QA
- Dashboard/KPIs (REQ 3.E) — listed as out of scope in proposal
- Appointment rescheduling, notifications, Google Calendar integration — excluded from this change
- Dead code cleanup: unused `handleStatusChange` function in `Admin.tsx`
- UX polish: "Cliente #{id}" fallback when client deleted (vs. spec "Cliente no disponible")

---

*Archived by `sdd-archive` executor on 2026-06-22.*
