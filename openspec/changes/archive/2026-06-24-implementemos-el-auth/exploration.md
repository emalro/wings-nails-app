# Exploration: Implementemos el auth

## Current State

**Zero authentication exists.** The admin panel (`/admin`) is completely public — anyone can access all CRUD operations, client data, appointments, and configuration.

**Backend (`backend/app/`):**
- 5 Python files: `__init__.py`, `main.py`, `models.py`, `schemas.py`, `database.py`
- All routes defined flat in `main.py` (833 lines) — no router prefix separation
- No auth middleware, no JWT validation, no session management
- No `Usuario`/`Admin` model — only `Cliente`, `Servicio`, `Cita`, `Configuracion`, `HorarioSemanal`, `ExcepcionHorario`
- Session dependency: `get_session()` yields a plain `Session` — no user context
- CORS: allows all origins (`*`), credentials enabled
- DB: SQLite with SQLModel ORM, single-file `database.py`

**Frontend (`frontend/src/`):**
- React 18 + TypeScript + Vite 8, react-router-dom 6
- Routes: `/` (Home), `/reservar` (Reservar), `/admin` (Admin) — all under same `<App />` layout
- No ProtectedRoute, no AuthContext, no auth state
- API client: `api.ts` with axios, no auth headers interceptor
- All admin hooks (useAppointments, useServices, etc.) make unauthenticated requests

## Affected Areas

- `backend/app/models.py` — needs `Usuario` model (email, hashed_password, role, is_active)
- `backend/app/schemas.py` — needs auth schemas (LoginRequest, TokenResponse, UserCreate, UserRead)
- `backend/app/main.py` — needs auth endpoints (login, register, me, refresh), middleware for protected routes, password hashing
- `backend/app/database.py` — needs to import new Usuario model in `create_db_and_tables`
- `frontend/src/api.ts` — needs auth API functions (login, register, logout, refreshToken), axios interceptor for Authorization header
- `frontend/src/main.tsx` — needs AuthProvider context wrapping routes
- `frontend/src/App.tsx` — needs login/logout UI in navbar, conditional admin link
- `frontend/src/pages/Admin.tsx` — needs ProtectedRoute wrapper
- `backend/requirements.txt` — needs `python-jose[cryptography]`, `passlib[bcrypt]`

## Codebase Patterns

**Backend patterns:**
- Routes: flat functions with `@app.get/post/patch/delete` decorators, no APIRouter
- Dependencies: `Session = Depends(get_session)` for DB access
- Validation: Pydantic schemas in `schemas.py`, `model_validate()` for ORM
- Errors: `HTTPException(status_code=..., detail=...)` — Spanish messages
- Migrations: ad-hoc `run_migration()` with raw SQL ALTER TABLE
- Seed data: `seed_default_config()`, `seed_default_schedule()` in lifespan

**Frontend patterns:**
- Hooks: TanStack Query wrappers in `hooks/` directory
- Components: functional components, no context providers, no global state
- Styles: CSS custom properties
- Forms: controlled inputs, inline validation, `useState` for form state

## Approaches

### 1. JWT + Refresh Token (Recommended)
- Backend: `python-jose` for JWT, `passlib[bcrypt]` for hashing, short-lived access tokens (15-30min) + longer refresh tokens (7-30d)
- Frontend: Axios interceptor adds `Authorization: Bearer <token>`, AuthContext manages token state, auto-refresh on 401
- **Pros**: Stateless, scales well, standard pattern, works with SPA
- **Cons**: Token refresh logic adds complexity, need to handle token rotation
- **Effort**: Medium

### 2. Session-based (server-side)
- Backend: `starlette.middleware.sessions.SessionMiddleware`, store sessions in DB
- Frontend: Cookie-based, no interceptor needed
- **Pros**: Simpler frontend, server controls session lifecycle
- **Cons**: Requires DB session store (not great with SQLite), harder to scale, CSRF considerations
- **Effort**: Medium

### 3. Simple password gate (no roles)
- Backend: single hardcoded password or env var, no User model
- Frontend: simple password prompt, store in localStorage
- **Pros**: Trivial to implement
- **Cons**: No audit trail, no multiple users, no role system, doesn't meet requirements
- **Effort**: Low

## Recommendation

**Approach 1: JWT + Refresh Token.** This is the standard for SPAs and matches the requirements:
- Email-based login (`admin@<dominio>`)
- Password complexity rules + hashing
- Session management (active sessions, secure logout)
- Roles/permissions foundation for future expansion

For a single-user admin panel (the manicurista), we can simplify:
- Single role: `admin` (no complex RBAC needed yet)
- No registration endpoint initially — seed a default admin user
- Password recovery via email can be deferred (requires email service integration)
- Access tokens: 30min expiry, refresh tokens: 7d

## Dependencies Needed

**Backend (`requirements.txt`):**
- `python-jose[cryptography]` — JWT creation/validation
- `passlib[bcrypt]` — password hashing
- `python-multipart` — already included by FastAPI, needed for form data in OAuth2

**Frontend (`package.json`):**
- No new packages — React Context + axios interceptor is sufficient

## Risks

- **Admin.tsx is 696 lines** — adding auth UI here will make it worse. Consider extracting auth into its own component/page before implementation.
- **Password recovery** requires email service integration (SMTP or transactional email API) — should be deferred or marked as follow-up.
- **Single admin user** simplifies things but the model should support multiple users for future flexibility.
- **CORS `*`** needs to be tightened in production — auth tokens with `allow_credentials=True` and `origins=["*"]` is a security concern.

## Related Pending Work

**Landing Page (§2.A)**: Currently `Home.tsx` is a simplified landing page (hero + services + CTA + map). The full spec requires: navbar with dynamic social links (done), hero section (done), services cards (done), work carousel (NOT done), CTA (done), map (done), footer with dynamic year (done). Missing: work portfolio carousel. This does NOT block auth — the landing page is public and auth only protects `/admin`.

## Ready for Proposal

**Yes.** The codebase is clean, there are no auth remnants to refactor, and the patterns are clear. Key decisions for the proposal:
1. Seed a default admin user on first run (like `seed_default_config`)
2. Protect admin API routes with a FastAPI dependency
3. Create a LoginPage component separate from Admin.tsx
4. Use React Context for auth state (AuthContext + useAuth hook)
