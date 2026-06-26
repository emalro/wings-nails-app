# Design: Astro + Infrastructure Migration

## Technical Approach

Split the monolithic FastAPI+React SPA into three independent services: Vercel (static frontend), Render (API backend), and Supabase (PostgreSQL). Cross-origin JWT auth via httpOnly cookies with `SameSite=None; Secure`. Cold starts mitigated by external cron pinger + frontend loading skeletons.

## Architecture Diagram

```
                    ┌──────────────┐
                    │   cron-job   │
                    │  (every 14m) │
                    └──────┬───────┘
                           │ GET /health
                           ▼
┌──────────┐  HTTPS  ┌──────────────┐  psycopg2  ┌──────────────┐
│  Vercel  │────────▶│    Render     │───────────▶│   Supabase   │
│ (React   │ cookies │  (FastAPI)    │            │ (PostgreSQL) │
│  SPA)    │◀────────│  API only     │◀───────────│              │
└──────────┘         └──────────────┘            └──────────────┘
     ▲
     │ HTTPS
     │
┌──────────┐
│  User    │
│ Browser  │
└──────────┘
```

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Frontend hosting | Vercel | Netlify, Cloudflare Pages | Auto-deploy from GitHub, free tier, ISR support for Phase 2 Astro |
| Backend hosting | Render | Railway, Fly.io | Free tier with Docker deploy, existing CI integration |
| Database | Supabase (PostgreSQL) | Neon, Supabase PostgreSQL | Managed PostgreSQL, free tier, SQLModel ORM compatibility |
| Cookie SameSite | `None; Secure` | `Lax`, Bearer token | Cross-origin Vercel→Render requires `None`; `Lax` blocks POST cookies |
| Cookie delivery | httpOnly cookie + response body | Cookie only | Response body tokens enable fallback if cookies blocked |
| API URL config | `VITE_API_URL` env var | Proxy, relative URL | Vercel injects at build; no proxy needed for free tier |
| Cold start cron | cron-job.org (14min) | UptimeRobot, custom lambda | Free tier, simple HTTP ping, within Render's 15min sleep window |
| Frontend framework | Keep React SPA (Phase 1) | Astro SSG now | Phase 1 = infra only; Astro landing is Phase 2 |

## Component Contracts

### Backend API (Render)

**Modified endpoints:**

| Endpoint | Change | Notes |
|----------|--------|-------|
| `GET /health` | NEW | Public, no auth. Returns `{"status": "ok", "version": "0.1.0"}` |
| `POST /auth/login` | Cookie attrs change | `SameSite=None; Secure` instead of `strict` |
| `POST /auth/refresh` | Cookie attrs change | Same as login |
| `GET /config` | No change | Still requires auth |
| `GET /` | REMOVE | No SPA fallback |
| `GET /{path}` catch-all | REMOVE | No SPA fallback |
| `/assets/*` mount | REMOVE | No StaticFiles |

**CORS config (expanded):**
```python
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
# Production: "https://wings-nails.vercel.app"
```

**Cookie settings (modified):**
```python
response.set_cookie(
    key="access_token",
    value=access_token,
    httponly=True,
    samesite="none",    # was "strict"
    secure=True,        # new — required for SameSite=None
    max_age=1800,
    path="/",
)
```

### Frontend (Vercel)

**API connection:**
```typescript
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
```

**Credentials in requests:**
```typescript
export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,  // NEW — send cookies cross-origin
})
```

**ISR config (Phase 2 placeholder):**
```json
// vercel.json — Phase 1 (SPA)
{
  "rewrites": [{ "source": "/((?!api|assets).*)", "destination": "/index.html" }]
}
```

### Database (Supabase PostgreSQL)

**Schema migration notes:**
- SQLModel `metadata.create_all()` works identically on PostgreSQL
- `PRAGMA table_info(cliente)` in `run_migration()` → replace with `information_schema.columns`
- SQLite `BOOLEAN` → PostgreSQL `boolean` (compatible)
- SQLite `INTEGER PRIMARY KEY` → PostgreSQL `SERIAL PRIMARY KEY` (SQLModel handles)
- `ilike` operator works in PostgreSQL (case-insensitive LIKE)

**Migration SQL (Supabase Dashboard):**
```sql
-- Run after creating Supabase project
-- SQLModel creates tables via metadata.create_all on first startup
-- No manual DDL needed — just set DATABASE_URL
```

## Data Flow Diagrams

### Login Flow

```
User ──POST /auth/login──▶ Vercel (credentials:include)
                               │
                               ▼
                          Render (FastAPI)
                               │ validate credentials
                               ▼
                          Supabase (PostgreSQL)
                               │
                               ▼
                          Set-Cookie: SameSite=None; Secure
                               │
                          ◀────┘ (JSON body + Set-Cookie header)
                               │
                          Browser stores cookie for Render domain
```

### Cold Start Flow

```
User ──navigate──▶ Vercel (serves SPA instantly)
                        │
                        ├── Skeleton UI renders (<500ms)
                        │
                        └── axios GET /api/config (withCredentials:true)
                                │
                                ▼
                           Render (may be sleeping)
                                │ cold start ~30-60s
                                ▼
                           API responds → skeleton dismissed
```

## Infrastructure Config

### `vercel.json`
```json
{
  "framework": "vite",
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist",
  "installCommand": "cd frontend && npm ci",
  "rewrites": [
    { "source": "/((?!api|_next|assets).*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ]
}
```

### `render.yaml`
```yaml
services:
  - type: web
    name: wings-nails-api
    runtime: docker
    dockerfilePath: ./backend/Dockerfile
    envVars:
      - key: DATABASE_URL
        sync: false  # set manually from Supabase
      - key: JWT_SECRET_KEY
        generateValue: true
      - key: CORS_ORIGINS
        value: "https://wings-nails.vercel.app"
      - key: ADMIN_EMAIL
        sync: false
      - key: ADMIN_PASSWORD_HASH
        sync: false
    healthCheckPath: /health
    autoDeploy: true
```

### Environment Variables

| Service | Variable | Value |
|---------|----------|-------|
| Render | `DATABASE_URL` | `postgresql://...@...supabase.co:5432/postgres` |
| Render | `JWT_SECRET_KEY` | Generated secret |
| Render | `CORS_ORIGINS` | `https://wings-nails.vercel.app` |
| Render | `ADMIN_EMAIL` | Business admin email |
| Render | `ADMIN_PASSWORD_HASH` | bcrypt hash |
| Vercel | `VITE_API_URL` | `https://wings-nails-api.onrender.com` |

## Database Migration Strategy

1. Create Supabase project, get `postgresql://` connection string
2. Set `DATABASE_URL` env var on Render
3. First backend startup: `SQLModel.metadata.create_all()` creates all tables
4. Seed data: `seed_default_config()`, `seed_default_schedule()`, `seed_admin_user()` run automatically
5. Data migration: use Supabase SQL Editor to import CSV exports from SQLite (one-time)
6. Remove `PRAGMA table_info()` call in `run_migration()` — replace with `information_schema.columns` query

## Cache Strategy

| Resource | Strategy | TTL |
|----------|----------|-----|
| Landing page (Phase 2) | ISR | 60s revalidation |
| SPA assets (`/assets/*`) | Immutable | 1 year (Vite hash busting) |
| API responses | No cache | `Cache-Control: no-store` |
| `/health` | No cache | `Cache-Control: no-store` |
| Browser SPA | Vercel CDN | Edge-cached, instant |

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/app/main.py` | Modify | Remove StaticFiles mount, SPA catch-all routes; expand CORS; change cookie attrs |
| `backend/app/database.py` | Modify | PostgreSQL connection; conditional `connect_args` |
| `backend/app/main.py` (run_migration) | Modify | Replace `PRAGMA table_info` with `information_schema.columns` |
| `backend/Dockerfile` | Modify | Remove frontend build stage (backend-only) |
| `frontend/src/api.ts` | Modify | Add `withCredentials: true` to axios instance |
| `vercel.json` | Create | Vercel deploy config with SPA rewrites |
| `render.yaml` | Create | Render Blueprint for backend service |
| `.github/workflows/cd.yml` | Modify | Split into separate frontend/backend deploy jobs |

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Integration | Cross-origin auth flow | pytest + httpx with CORS headers; test cookie attributes |
| Integration | PostgreSQL schema creation | Test with `DATABASE_URL` pointing to Supabase test DB |
| E2E | Login → admin → booking | Manual verification on deployed services |
| Smoke | `/health` endpoint | curl + cron pinger validation |

## Open Questions

- [ ] Supabase connection string pooling: use `?pgbouncer=true` for free-tier connection limits?
- [ ] Render Dockerfile: keep Python 3.11 or upgrade to 3.12 for performance?
- [ ] Should `/health` return version info for debugging?
