# Design: Implementemos el auth

## Technical Approach

JWT + httpOnly cookie authentication protecting the admin panel. Backend seeds a single admin user from env vars on startup, validates credentials, and issues short-lived access tokens (30min) + longer refresh tokens (7d). Frontend uses React Context for auth state with axios interceptor for token injection. Admin.tsx (696 lines) is extracted into focused section components first, then auth is layered on top.

This follows the proposal's approach exactly: stateless JWT, httpOnly cookies for XSS protection, and SameSite=Strict for CSRF.

## Architecture Decisions

### Decision: Token Storage — httpOnly Cookies

**Choice**: Store access + refresh tokens in httpOnly cookies, not localStorage
**Alternatives**: localStorage (simpler but XSS-vulnerable), sessionStorage (same risk)
**Rationale**: httpOnly cookies are inaccessible to JavaScript, eliminating XSS token theft. SameSite=Strict provides CSRF protection without requiring a separate CSRF token mechanism. The proposal explicitly requires this.

### Decision: Cookie-based Auth with Authorization Header Fallback

**Choice**: Use httpOnly cookies for token transport (automatic by browser). Add `Authorization: Bearer` header via axios interceptor as belt-and-suspenders.
**Alternatives**: Cookies-only (no header), Header-only (no cookies)
**Rationale**: Cookies handle automatic transport. The interceptor adds Authorization header for any edge cases where cookies aren't sent (e.g., cross-origin dev setup). FastAPI's `Cookie` dependency reads the cookie; the dependency can fall back to header.

### Decision: Admin.tsx Extraction — Phase Before Auth

**Choice**: Extract Admin.tsx into 4 section components (ScheduleSection, ExceptionsSection, BusinessConfigSection, ServicesSection) as a prerequisite, then add auth.
**Alternatives**: Add auth directly to the monolith, parallel extraction
**Rationale**: 696-line Admin.tsx is unmaintainable. Extracting first reduces auth integration risk. Each section becomes a focused ~80-120 line component. Admin.tsx becomes an orchestrator (~150 lines) that composes sections and manages shared state.

### Decision: Single Admin Role, No RBAC

**Choice**: Single `admin` role in the Usuario model, no permission system.
**Alternatives**: Multi-role with permission bits, role-based middleware
**Rationale**: Single-user admin panel for a manicurista. The model supports future roles (field exists), but no middleware complexity needed now. Proposal explicitly scopes this out.

### Decision: No Registration Endpoint

**Choice**: Admin user seeded from env vars only, no POST /auth/register.
**Alternatives**: Registration endpoint with admin-only guard
**Rationale**: Single admin user. Registration adds attack surface with no benefit. Env var seeding is simpler and auditable.

### Decision: CORS Restriction

**Choice**: Replace `origins=["*"]` with explicit allowed origins. Use env var `CORS_ORIGINS` (comma-separated) with fallback to `localhost` in development.
**Alternatives**: Keep `*` (insecure), whitelist only production domain (breaks local dev)
**Rationale**: `origins=["*"]` with `allow_credentials=True` allows any site to make authenticated requests via cookies (CSRF attack vector). Explicit origins block cross-origin abuse while keeping local dev working.

### Decision: Rate Limiting on Login

**Choice**: Add slowapi rate limiting middleware on `/auth/login` — 5 attempts per minute per IP, 15-minute lockout after 3 failures.
**Alternatives**: No rate limiting (defer), IP blocking at reverse proxy level
**Rationale**: Prevents brute-force attacks on admin credentials. slowapi is lightweight and integrates directly with FastAPI middleware. Lockout duration is short enough for legitimate mistakes but blocks automated attacks.

## Data Flow

```
Login Flow:
Browser ──POST /auth/login (email, password)──→ FastAPI
  ├── Validate credentials (bcrypt check)
  ├── Generate access_token (30min) + refresh_token (7d)
  ├── Set httpOnly cookies: access_token, refresh_token
  └── Return { user: { email, role } }

Request Flow (authenticated):
Browser ──GET /admin/*──→ FastAPI
  ├── Cookie automatically sent by browser
  ├── get_current_user dependency:
  │   ├── Read access_token from cookie
  │   ├── Validate JWT signature + expiry
  │   └── Return Usuario from DB
  └── Route handler proceeds

Refresh Flow:
Browser ──POST /auth/refresh──→ FastAPI
  ├── Read refresh_token from cookie
  ├── Validate JWT signature + expiry
  ├── Issue new access_token (30min)
  └── Set httpOnly cookie for access_token

Logout Flow:
Browser ──POST /auth/logout──→ FastAPI
  ├── Clear access_token cookie
  ├── Clear refresh_token cookie
  └── Return 200 OK
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/requirements.txt` | Modify | Add `python-jose[cryptography]`, `passlib[bcrypt]`, `slowapi` |
| `backend/app/models.py` | Modify | Add `Usuario` model (id, email, hashed_password, role, is_active, created_at) |
| `backend/app/schemas.py` | Modify | Add LoginRequest, TokenResponse, UserRead schemas |
| `backend/app/auth.py` | Create | JWT utilities: create_access_token, create_refresh_token, verify_token, get_password_hash |
| `backend/app/deps.py` | Create | FastAPI dependencies: get_current_user, get_session (extracted from main.py) |
| `backend/app/main.py` | Modify | Add auth endpoints, CORS env-based config, rate limiting middleware, seed_admin_user in lifespan, import Usuario in create_db_and_tables |
| `backend/app/database.py` | Modify | Import Usuario in create_db_and_tables |
| `frontend/src/api.ts` | Modify | Add auth API functions (login, logout, getMe, refreshToken), axios interceptor for Authorization header and 401 retry |
| `frontend/src/contexts/AuthContext.tsx` | Create | React Context: user state, login(), logout(), isLoading, isAuthenticated |
| `frontend/src/hooks/useAuth.ts` | Create | useAuth() hook consuming AuthContext |
| `frontend/src/components/ProtectedRoute.tsx` | Create | Route guard: redirects to /login if unauthenticated |
| `frontend/src/pages/Login.tsx` | Create | Login form: email + password, calls POST /auth/login |
| `frontend/src/App.tsx` | Modify | Wrap with AuthProvider, add "Ingresar" nav link → /login or /admin based on auth state |
| `frontend/src/main.tsx` | Modify | Add /login route (public), wrap /admin with ProtectedRoute |
| `frontend/src/components/admin/ScheduleSection.tsx` | Create | Extracted from Admin.tsx: weekly schedule table (~100 lines) |
| `frontend/src/components/admin/ExceptionsSection.tsx` | Create | Extracted from Admin.tsx: exceptions CRUD (~80 lines) |
| `frontend/src/components/admin/BusinessConfigSection.tsx` | Create | Extracted from Admin.tsx: business config form (~60 lines) |
| `frontend/src/components/admin/ServicesSection.tsx` | Create | Extracted from Admin.tsx: service CRUD + list (~150 lines) |
| `frontend/src/pages/Admin.tsx` | Modify | Refactor to ~150 lines: import section components, manage shared state, compose layout |

## Interfaces / Contracts

### Backend: Usuario Model

```python
class Usuario(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    role: str = Field(default="admin")
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```

### Backend: Auth Schemas

```python
class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: UserRead

class UserRead(BaseModel):
    email: str
    role: str
```

### Backend: JWT Structure

```python
# Access token payload: { sub: user_id, exp: 30min, type: "access" }
# Refresh token payload: { sub: user_id, exp: 7d, type: "refresh" }
# Secret from env: JWT_SECRET_KEY
# Algorithm: HS256
```

### Frontend: AuthContext

```typescript
interface AuthContextType {
  user: { email: string; role: string } | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}
```

### Frontend: Axios Interceptor

```typescript
// Request interceptor: attach Authorization header if token available
// Response interceptor: on 401, attempt refresh, retry original request
// On refresh failure: clear user state, redirect to /login
```

### Env Vars Required

```
JWT_SECRET_KEY=<random-32-chars>
ADMIN_EMAIL=admin@nailsstudio.com
ADMIN_PASSWORD_HASH=$2b$12$<bcrypt-hash>
CORS_ORIGINS=http://localhost:5173,https://tusitio.com
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | JWT creation/verification, password hashing | pytest with python-jose and passlib |
| Integration | Login endpoint, token refresh, protected route dependency | pytest + httpx TestClient |
| Integration | Seed admin on startup, duplicate seed prevention | pytest with test DB |
| E2E | Login flow, protected admin routes, logout | Manual + future Cypress |

## Migration / Rollout

1. Add Usuario model — new table, no migration needed (create_db_and_tables handles it)
2. Seed admin on first startup from env vars
3. No existing data affected — new table only
4. Deploy env vars (JWT_SECRET_KEY, ADMIN_EMAIL, ADMIN_PASSWORD_HASH) before deploying auth code

## Open Questions

- [x] CORS configuration → **Resolved**: Env var `CORS_ORIGINS` with explicit origins, fallback to localhost in dev
- [x] Rate limiting → **Resolved**: slowapi middleware, 5 attempts/min, 15-min lockout after 3 failures
