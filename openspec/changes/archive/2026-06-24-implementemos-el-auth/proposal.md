# Proposal: Implementemos el auth

## Intent

The admin panel (`/admin`) is completely public — anyone can access CRUD operations, client data, appointments, and configuration. This change adds JWT-based authentication to protect the admin area with a single admin user seeded from environment variables.

## Scope

### In Scope
- Backend: `Usuario` model, JWT access/refresh tokens, login endpoint, FastAPI dependency for route protection, startup seed from env vars
- Frontend: `AuthContext` + `useAuth` hook, `LoginPage` component, `ProtectedRoute` wrapper, axios interceptor for token injection, logout flow
- Admin.tsx extraction into smaller components (prerequisite — reduces 696→~150 lines)
- Env vars: `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` (bcrypt)
- Tokens stored in httpOnly cookies (not localStorage)
- Navbar: add "Ingresar" button that links to `/login` (or `/admin` if already authenticated)

### Out of Scope
- Password recovery (requires email service — deferred)
- Supabase migration (future work, documented in DOCUMENTATION.md)
- Role-based access control (single `admin` role for now)
- Registration endpoint (admin seeded, not created via UI)

## Capabilities

### New Capabilities
- `user-auth`: JWT authentication system — login, token management, route protection, admin seed

### Modified Capabilities
- `admin-agenda-visual`: All admin routes become protected behind auth dependency

## Approach

JWT + Refresh Token pattern. Backend issues short-lived access tokens (30min) + longer refresh tokens (7d). Frontend uses React Context for auth state, axios interceptor adds `Authorization: Bearer <token>`. Admin credentials stored as bcrypt hash in env vars, re-seeded on FastAPI startup if missing from DB.

**Dependencies**: `python-jose[cryptography]`, `passlib[bcrypt]` (backend). No new frontend packages.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/app/models.py` | Modified | Add `Usuario` model (email, hashed_password, role, is_active) |
| `backend/app/schemas.py` | Modified | Add auth schemas (LoginRequest, TokenResponse) |
| `backend/app/main.py` | Modified | Add auth endpoints, protected route dependency, seed logic |
| `backend/app/database.py` | Modified | Import `Usuario` in `create_db_and_tables` |
| `backend/requirements.txt` | Modified | Add `python-jose[cryptography]`, `passlib[bcrypt]` |
| `frontend/src/api.ts` | Modified | Add auth API functions, axios interceptor |
| `frontend/src/main.tsx` | Modified | Wrap routes with `AuthProvider` |
| `frontend/src/pages/Admin.tsx` | Modified | Extract sections, wrap with `ProtectedRoute` |
| `frontend/src/pages/Login.tsx` | New | Login page component |
| `frontend/src/contexts/AuthContext.tsx` | New | Auth state management |
| `frontend/src/components/ProtectedRoute.tsx` | New | Route guard component |
| `frontend/src/components/Navbar.tsx` | Modified | Add "Ingresar" link → `/login` or `/admin` based on auth state |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Admin.tsx extraction breaks existing functionality | Medium | Extract components first, verify no regressions before adding auth |
| CORS `*` with credentials is insecure | High | Tighten CORS to production domain before deploying auth |
| Token refresh edge cases (race conditions) | Low | Implement retry with exponential backoff on 401 |

## Rollback Plan

1. Remove `Usuario` model and auth endpoints from backend
2. Remove `AuthProvider`, `ProtectedRoute`, `LoginPage` from frontend
3. Restore original `Admin.tsx` from git history
4. Remove `python-jose` and `passlib` from requirements.txt
5. Delete auth-related env vars

## Dependencies

- Admin.tsx extraction (prerequisite — must complete before auth integration)
- CORS configuration already modified (confirmed by user)

## Success Criteria

- [ ] Unauthenticated requests to `/admin` redirect to `/login`
- [ ] Valid credentials issue JWT + refresh tokens in httpOnly cookies
- [ ] Protected API routes return 401 without valid token
- [ ] Admin panel fully functional after auth integration
- [ ] Logout clears tokens and redirects to home
- [ ] Startup re-seeds admin if missing from DB
