# Tasks: Implementemos el auth

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 900–1,200 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Delivery strategy | stacked-to-main |
| Chain strategy | stacked-to-main |
| Split | PR #1: Extraction (~400 lines) + PR #2: Auth (~800 lines) |

### Work Units

| PR | Goal | Tasks | Estimated Lines |
|----|------|-------|-----------------|
| **PR #1** | Admin.tsx extraction | Phase 1 (1.1–1.6) | ~400 |
| **PR #2** | Full auth implementation | Phases 2–5 (2.1–5.7) | ~800 |

> **PR #1** must merge before **PR #2** starts. Stacked-to-main: each PR merges to main in order.

## Phase 1: Admin.tsx Extraction (Prerequisite) — PR #1

- [x] 1.1 Create `frontend/src/components/admin/ScheduleSection.tsx` — extract weekly schedule table (~100 lines)
- [x] 1.2 Create `frontend/src/components/admin/ExceptionsSection.tsx` — extract exceptions CRUD (~80 lines)
- [x] 1.3 Create `frontend/src/components/admin/BusinessConfigSection.tsx` — extract business config form (~60 lines)
- [x] 1.4 Create `frontend/src/components/admin/ServicesSection.tsx` — extract service CRUD + list (~150 lines)
- [x] 1.5 Refactor `frontend/src/pages/Admin.tsx` — import section components, manage shared state, compose layout (~150 lines)
- [x] 1.6 Verify: `tsc --noEmit` passes, manual test all admin features unchanged

## Phase 2: Backend Auth Infrastructure — PR #2

- [x] 2.1 (RED) Write failing tests in `backend/tests/test_auth.py` — test JWT creation/verification, password hashing
- [x] 2.2 (GREEN) Add `python-jose[cryptography]`, `passlib[bcrypt]`, `slowapi` to `backend/requirements.txt`
- [x] 2.3 Create `backend/app/auth.py` — `create_access_token()`, `create_refresh_token()`, `verify_token()`, `get_password_hash()` utilities
- [x] 2.4 (GREEN) Make JWT/password tests pass
- [x] 2.5 (RED) Write failing tests — test Usuario model creation, unique email constraint
- [x] 2.6 Modify `backend/app/models.py` — add `Usuario` model (id, email, hashed_password, role, is_active, created_at)
- [x] 2.7 (GREEN) Make Usuario model tests pass
- [x] 2.8 Modify `backend/app/schemas.py` — add `LoginRequest`, `TokenResponse`, `UserRead` schemas
- [x] 2.9 Modify `backend/app/database.py` — import `Usuario` in `create_db_and_tables`

## Phase 3: Backend Auth Dependencies & Endpoints — PR #2

- [x] 3.1 (RED) Write failing tests — test `get_current_user` dependency with valid/invalid/missing tokens
- [x] 3.2 Create `backend/app/deps.py` — `get_current_user()` dependency (reads cookie or Authorization header, validates JWT, returns `Usuario`)
- [x] 3.3 (GREEN) Make dependency tests pass
- [x] 3.4 (RED) Write failing tests — test POST /auth/login (success 200, invalid creds 401), POST /auth/logout (clears cookies), POST /auth/refresh (valid/invalid refresh), GET /auth/me (authenticated/unauthenticated)
- [x] 3.5 Modify `backend/app/main.py` — add rate limiting middleware (slowapi), CORS env-based config (`CORS_ORIGINS`), auth endpoints (login, logout, refresh, me), `seed_admin_user()` in lifespan, protect admin routes with `get_current_user` dependency
- [x] 3.6 (GREEN) Make endpoint tests pass
- [x] 3.7 (RED) Write failing test — seed admin on startup, no duplicate on re-start
- [x] 3.8 Verify: `python -m pytest` passes all backend tests

## Phase 4: Frontend Auth Integration — PR #2

- [x] 4.1 Create `frontend/src/contexts/AuthContext.tsx` — React Context with user state, login(), logout(), isLoading, isAuthenticated
- [x] 4.2 Create `frontend/src/hooks/useAuth.ts` — hook consuming AuthContext
- [x] 4.3 Create `frontend/src/pages/Login.tsx` — login form (email + password), calls POST /auth/login, redirects to /admin on success
- [x] 4.4 Create `frontend/src/components/ProtectedRoute.tsx` — redirects to /login if unauthenticated, renders children if authenticated
- [x] 4.5 Modify `frontend/src/api.ts` — add auth API functions (login, logout, getMe, refreshToken), axios interceptor for Authorization header + 401 retry with refresh
- [x] 4.6 Modify `frontend/src/main.tsx` — wrap with `AuthProvider`, add `/login` route (public), wrap `/admin` with `ProtectedRoute`
- [x] 4.7 Modify `frontend/src/App.tsx` — add "Ingresar" nav link → `/login` (unauthenticated) or `/admin` (authenticated) based on auth state
- [x] 4.8 Verify: `tsc --noEmit` passes, manual test login/logout/protected routes

## Phase 5: Testing & Verification — PR #2

- [x] 5.1 Verify all backend tests pass: `python -m pytest` (JWT utils, model, endpoints, seed)
- [x] 5.2 Verify frontend compiles: `tsc --noEmit`
- [x] 5.3 Manual E2E: unauthenticated → /admin redirects to /login
- [x] 5.4 Manual E2E: login with valid creds → /admin accessible
- [x] 5.5 Manual E2E: logout clears session, redirects to home
- [x] 5.6 Manual E2E: page refresh preserves session
- [x] 5.7 Verify: all Admin.tsx features still functional post-extraction

## Phase 6: Post-Verify Remediation

- [x] 6.1 Protect all CRUD endpoints with `Depends(get_current_user)` — /config, /clients, /services, /appointments, /schedule, /busy_slots, phone sub-resources, client appointment history
- [x] 6.2 Add `@limiter.limit("5/minute")` to POST /auth/login, configurable via `LOGIN_RATE_LIMIT` env var
- [x] 6.3 Update test suites: set `LOGIN_RATE_LIMIT` env var in `test_endpoints.py` and `test_api.py`, add auth setup (create user + login) in `test_api.py`
- [x] 6.4 Add flash message in ProtectedRoute redirect: `?reason=auth-required` when unauthenticated
- [x] 6.5 Add flash message display on Login.tsx: read `reason` query param, show "Debe iniciar sesión" or "Su sesión ha expirado"
- [x] 6.6 Add `?reason=session-expired` redirect in axios interceptor when refresh token fails
