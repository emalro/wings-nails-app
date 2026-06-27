# Archive Report: Production Hotfixes (2026-06-27)

**Status**: ARCHIVED
**Archive Date**: 2026-06-27
**Type**: Hotfix (ad-hoc, outside SDD cycle)

## Summary

Multiple production issues were discovered and fixed in a single session after deploying the auth system to Vercel + Render + Supabase.

## Fixes Applied

### 1. CORS URL Mismatch (PR #35)
- **Problem**: `render.yaml` had `wings-nails.vercel.app` but the actual Vercel URL is `wings-nails-app.vercel.app`
- **Fix**: Corrected `CORS_ORIGINS` in `render.yaml`
- **Files**: `render.yaml`

### 2. JWT Token Not Sent (PR #36)
- **Problem**: Frontend received `access_token` from `/auth/login` but never stored or sent it. With `withCredentials: false`, neither cookies nor Authorization header were sent → 401 on all endpoints.
- **Fix**: Added token management (localStorage) + request interceptor for `Authorization: Bearer` header in `api.ts`
- **Files**: `frontend/src/api.ts`

### 3. AuthContext Not Storing Token (PR #37)
- **Problem**: `AuthContext.login()` called `api.post()` directly instead of using `setToken()` from `api.ts`. Token was received but discarded.
- **Fix**: Import and call `setToken()` after login, `clearToken()` on logout
- **Files**: `frontend/src/contexts/AuthContext.tsx`

### 4. FK Constraint on DELETE (PR #40)
- **Problem**: `DELETE /appointments/{id}` and `DELETE /services/{id}` failed with 500 because PostgreSQL FK constraints blocked ORM cascade deletes of `CitaServicio` children.
- **Fix**: Use `session.execute()` with raw SQL to delete children before parent
- **Files**: `backend/app/main.py`

### 5. Timezone-Aware vs Naive DateTime Comparison (PR #42)
- **Problem**: PostgreSQL returns timezone-aware datetimes (`2026-06-27T15:00:00+00:00`) but frontend sends naive datetimes (`2026-06-27T15:00:00`). Python throws `TypeError` when comparing them.
- **Fix**: Normalize datetimes by stripping `tzinfo` before comparison in `appointment_overlaps`, `find_conflicting_appointment`, and `validate_appointment_hours`
- **Files**: `backend/app/main.py`

### 6. Manual Appointment Validation (PR #39, #41)
- **Problem**: Submit button failed silently when form validation returned false. Also, `appointmentDate`/`appointmentTime` states were not synced with `form.validation`.
- **Fix**: Show validation errors on submit, sync date/time states with `form.setField()`, allow same-day appointments
- **Files**: `frontend/src/components/ManualAppointmentModal.tsx`

## PRs Created

| PR | Title | Status |
|----|-------|--------|
| #35 | fix(deploy): correct CORS_ORIGINS URL | Merged |
| #36 | fix(auth): store JWT token and send Authorization header | Merged |
| #37 | fix(auth): store token in AuthContext after login | Merged |
| #38 | fix(backend): use raw SQL to delete CitaServicio | Merged (partial) |
| #39 | fix(frontend): show validation errors in ManualAppointmentModal | Merged |
| #40 | fix(backend): use session.execute() for DELETE endpoints | Open |
| #41 | fix(frontend): sync fecha/hora into form validation | Merged |
| #42 | fix(backend): fix naive vs aware datetime TypeError | Open |

## Key Learnings

1. **CORS URLs must be exact** — `wings-nails` vs `wings-nails-app` caused silent failures
2. **Auth flow requires full chain** — login → store → attach → refresh. Missing any step breaks everything
3. **SQLModel `session.exec()` vs `session.execute()`** — `exec()` only accepts statements, not params
4. **PostgreSQL returns timezone-aware datetimes** — always normalize before comparing with naive datetimes
5. **ORM cascade deletes fail on PostgreSQL** — use raw SQL for child deletion when FK constraints exist
6. **Form validation needs state sync** — separate React state must be synced with `useFormValidation` hook

## Files Changed

- `render.yaml` — CORS URL fix
- `backend/app/main.py` — session.execute(), timezone normalization
- `frontend/src/api.ts` — token management, request interceptor
- `frontend/src/contexts/AuthContext.tsx` — token storage on login/logout
- `frontend/src/components/ManualAppointmentModal.tsx` — validation fixes
