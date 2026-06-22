# Archive Report — Gestión de Horarios de Atención

| Field | Value |
|-------|-------|
| **Change Name** | `gestion-horarios` |
| **Title** | Gestión de Horarios de Atención |
| **Archive Date** | 2026-06-22 |
| **Chain Strategy** | `feature-branch-chain` |
| **Artifact Store Mode** | `both` (Engram + OpenSpec) |
| **Verification Verdict** | PASS |

---

## Summary

Added schedule management for the nail studio — configurable weekly hours per day, date-specific exceptions (holidays, temporary changes), and an effective-hours endpoint that resolves actual availability. The public calendar (`Calendar.tsx`) now consumes real schedule data instead of hardcoded 8–18 slots. Admin panel gets a new "Horarios" section with inline day toggles, time selects, and exception management.

## What Was Built

### Backend
- **Models**: `HorarioSemanal` (7 rows, one per weekday, UNIQUE `dia_semana`) and `ExcepcionHorario` (date-based, UNIQUE `fecha`) in `models.py`
- **Schemas**: `HorarioSemanalCreate/Read`, `ExcepcionHorarioCreate/Read`, `EffectiveHoursResponse` in `schemas.py` with regex HH:MM validation
- **Endpoints**: 6 endpoints under `/schedule` — `GET/PUT /schedule/weekly`, `GET/POST/DELETE /schedule/exceptions`, `GET /schedule/effective`
- **Seed**: 7 default rows in `lifespan()` (Mon-Fri active 09:00-18:00, Sat 09:00-13:00, Sun inactive)
- **Effective logic**: Exception > weekly active > closed, with proper 400/404/409/422 error responses
- **Tests**: 22 integration tests covering all 9 HOR scenarios plus edge cases

### Frontend
- **API layer**: 6 functions in `api.ts` — `getWeeklySchedule`, `updateWeeklySchedule`, `getExceptions`, `createException`, `deleteException`, `getEffectiveHours`
- **Hooks**: `useSchedule.ts` with 6 TanStack Query hooks, export from `hooks/index.ts`
- **Admin UI**: Editable 7-day table with active toggles + time selects, exception sub-section with date picker, closed toggle, delete, batch save
- **Calendar.tsx**: Replaced hardcoded `startHour=8`/`endHour=18` with `useEffectiveHours(date)` fetch; shows "Sin horarios disponibles" when closed; loading state while fetching

## Verification

| Metric | Result |
|--------|--------|
| Tasks total | 19/19 complete |
| Tests (backend) | 22/22 passed |
| TypeScript | `tsc --noEmit` passed with 0 errors |
| Spec compliance | 9/9 scenarios compliant (HOR-001 to HOR-009) |
| Issues | 0 (no CRITICAL, no WARNING, no SUGGESTION) |
| **Verdict** | **PASS** |

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| D1: Batch upsert vs individual PUT | **Batch** — single `PUT /schedule/weekly` replaces all 7 days | Avoids N requests; admin edits all days and saves once |
| D2: Seed strategy | **Inline** in `lifespan()` | Follows existing `seed_default_config` pattern; simpler than external script |
| D3: Router vs main.py | **main.py** | All existing endpoints are in main.py; separate router would break project convention |
| D4: time objects vs str HH:MM | **str HH:MM** with Pydantic regex | SQLite has no time type; Pydantic validation guarantees format correctness |
| D5: Schedule component vs inline Admin | **Inline** in Admin.tsx | Same section as services and config; avoids extra navigation overhead |
| D6: Python-to-schema day mapping | `schema_day = (python_weekday + 1) % 7` | Python weekday() is 0=Mon; schema is 0=Sun; mapping ensures correct display |

## Edge Cases Covered

| Case | Coverage |
|------|----------|
| Day inactive → no slots | Calendar shows "Sin horarios disponibles" |
| Exception closed → no slots | Same path, `effectiveHours.abierto = false` |
| Exception with custom hours → slots in that range | `generateTimeSlots()` uses effective `hora_apertura`/`hora_cierre` |
| Loading state in calendar | `loadingHours` shows "Cargando horarios..." |
| Empty exceptions list | Admin shows "No hay excepciones." |
| Exception not found (DELETE) | Returns 404 |
| Required hours when exception not closed | Validation rejects missing hours |

## Engram Observation IDs

| Artifact | Observation ID |
|----------|---------------|
| `proposal` | #29 |
| `spec` | #30 |
| `design` | #31 |
| `tasks` | #32 |
| `apply-progress` | #33 |
| `verify-report` | #35 |
| `archive-report` | (this save) |

## Archived Artifacts

| Artifact | Status |
|----------|--------|
| `proposal.md` | ✅ Archived |
| `spec.md` | ✅ Archived (full spec for new domain gestion-horarios) |
| `design.md` | ✅ Archived |
| `tasks.md` | ✅ Archived (19/19 complete) |
| `verify-report.md` | ✅ Archived (PASS) |
| `archive-report.md` | ✅ This file |

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `gestion-horarios` | **Created** | New domain spec — HOR-001 through HOR-009 with scenarios, error states, and implementation requirements |

## Key Learnings

- `dia_semana` mapping between Python (0=Mon) and schema (0=Sun) required explicit `(python_weekday + 1) % 7` mapping — non-obvious and easy to get wrong
- SQLite has no native time type; storing hours as `str HH:MM` with Pydantic regex validation is the pragmatic approach matching the existing codebase pattern
- Batch upsert simplifies the admin UX but requires careful use of `db.merge()` to handle the UNIQUE constraint on `dia_semana`
- Calendar slot generation dynamically adapts to effective hours — the `generateTimeSlots()` function now takes `hora_apertura`/`hora_cierre` parameters instead of relying on module-level constants

## What Remains for Future Changes

- Frontend component tests for Calendar time-slot generation — currently verified only through static evidence
- Notification to clients when schedule changes affect existing appointments
- Schedule change history / audit log
- Google Calendar / iCal integration

---

*Archived by `sdd-archive` executor on 2026-06-22.*
