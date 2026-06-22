## Exploration: Stack change to TanStack + backend focus with FastAPI

### Current State

**Backend (FastAPI / Python):**
- Minimal CRUD API at `backend/app/main.py` with 8 endpoints: health, create/list clients, create/update/list services, create/list/update appointments, busy slots query
- SQLModel ORM (SQLAlchemy + Pydantic) with SQLite; 4 tables: Cliente, Servicio, Cita, CitaServicio
- No authentication, no file uploads, no background tasks, no email/WhatsApp integration
- Simple CORS with `origins = ["*"]`
- No middleware, no structured error handling (raw HTTPException)
- One test file (`backend/tests/test_api.py`) with 3 integration tests covering health, client CRUD, and conflict detection
- No Alembic migrations, no env-based config management beyond `.env`
- No background scheduler for vencimiento logic (REQ-4), no notification system (REQ-5)

**Frontend (React 18 + TypeScript + Vite 8):**
- Plain React with `useState` + `useEffect` for all state management — no caching, no deduplication, no background refetch
- `react-router-dom` v6 with basic `<Routes>` — three routes: `/` (Home placeholder), `/reservar` (Reservar), `/admin` (Admin)
- Axios-based API client (`frontend/src/api.ts`) — thin wrapper, no interceptors, no retry, no error normalization
- Single component (`Calendar.tsx`) handles date picking + time slot generation client-side
- Both pages (`Reservar.tsx`, `Admin.tsx`) fetch data on mount via `useEffect` — leads to "flash of loading" and no cache
- Form state is raw `useState` — no validation library, no controlled form abstraction
- Admin page has inline CRUD for services and appointment status changes — all logic in one file (~361 lines)
- No test runner, no component tests, no type-safe routing

**Current pain points:**
1. Every page re-fetches data on mount — no caching, no stale-while-revalidate
2. Loading/error states managed manually per-component with scattered `useState` flags
3. No optimistic updates — status changes in Admin wait for server response
4. Routing has no type safety — routes are magic strings
5. Calendar overlap logic is duplicated in Calendar.tsx AND main.py
6. Backend has zero security — anyone can hit `/admin` endpoints
7. No file upload for comprobantes de transferencia
8. No background automation for vencimientos or notifications

### Affected Areas

```
backend/                             # Backend focus improvements
├── app/main.py                      # Add auth, middleware, file upload, background tasks
├── app/models.py                    # Add User model, notification config, more fields
├── app/schemas.py                   # Add auth schemas, file upload schemas
├── app/database.py                  # May need migration setup
├── app/auth.py                      # NEW: JWT auth, password hashing
├── app/tasks.py                     # NEW: Background job scheduling
├── app/notifications.py             # NEW: WhatsApp/email integration
├── app/upload.py                    # NEW: File upload handling
├── requirements.txt                 # Add python-multipart, httpx, apscheduler, bcrypt, etc.
├── tests/                           # Expand test coverage significantly
│   ├── test_api.py                  # Updated with auth, file upload, notifications tests
│   └── test_tasks.py                # NEW: Background task tests

frontend/                            # TanStack migration
├── package.json                     # Replace react-router-dom with @tanstack/react-router, add @tanstack/react-query
├── vite.config.ts                   # May need TanStack Router plugin
├── src/
│   ├── main.tsx                     # Replace BrowserRouter + Routes with TanStack Router
│   ├── App.tsx                      # Simplify — TanStack Router handles layout
│   ├── api.ts                       # REMOVED — replaced by TanStack Query hooks
│   ├── hooks/                       # NEW: Custom hooks using TanStack Query
│   │   ├── useServices.ts
│   │   ├── useAppointments.ts
│   │   ├── useClients.ts
│   │   └── useBusySlots.ts
│   ├── routes/                      # NEW: TanStack Router route definitions
│   │   ├── __root.tsx
│   │   ├── index.tsx
│   │   ├── reservar.tsx
│   │   └── admin.tsx
│   ├── pages/                       # Reduced surface — TanStack Router handles more
│   │   ├── Home.tsx                 # Needs full landing page per REQUIREMENTS.md
│   │   ├── Reservar.tsx             # Refactor to use TanStack Query hooks
│   │   └── Admin.tsx               # Refactor to use TanStack Query + possibly Table
│   └── components/
│       └── Calendar.tsx             # May simplify with TanStack Query hook

openspec/
├── config.yaml                      # Update context
└── changes/stack-refactor-tanstack/ # This exploration

STACK.md                             # Must be filled in with concrete choices
DOCUMENTATION.md                     # Must document the change
```

### Approaches

1. **Full TanStack migration + backend overhaul** — Move the entire frontend to TanStack Router + TanStack Query in one pass, while simultaneously hardening the backend with auth, file upload, background tasks.

   - Pros: Clean break, single coherent effort, no legacy patterns left behind, type-safe from day one
   - Cons: High risk of regression, very large change surface (400+ lines), blocks all feature work during migration, coordination hell between frontend and backend changes
   - Effort: **Very High** — 2-3 weeks for a single dev

2. **Incremental frontend migration + parallel backend focus** — Add TanStack Query first (lowest effort, highest value), then migrate to TanStack Router independently. Backend improvements happen in parallel slices. Treat frontend and backend as two independent workstreams.

   - Pros: Smaller reviewable slices, can ship value faster (Query first), backend auth can start immediately, minimal risk of blocking feature work
   - Cons: Temporary hybrid state (some pages on Query, others not), need to maintain both patterns during transition
   - Effort: **Medium** — 1 week for Query + 1 week for Router + 2-3 weeks backend in parallel

3. **Backend-first, frontend later** — Focus exclusively on backend (auth, file upload, notifications, background tasks) for the next sprint. Leave the frontend as-is until the API surface stabilizes. Then migrate to TanStack when the API is solid.

   - Pros: Cleanest API-first approach, frontend migration has a stable target, avoids migrating twice if API contracts change
   - Cons: Frontend stays in pain longer, delays the value of better server state management, risk of divergence between current frontend patterns and new API design
   - Effort: **Low-Medium** for backend (2 weeks) + **Medium** for later frontend (1-2 weeks)

### Recommendation

**Approach 2 (Incremental) is the recommended path.**

Here's why: TanStack Query gives the highest value-to-effort ratio of any TanStack library — it replaces `useEffect`-based fetching, adds caching, deduplication, stale-while-revalidate, and background refetch with minimal code changes. It can be added incrementally without touching routing.

TanStack Router is valuable but has a higher migration cost (route definition overhaul, type-safe params require discipline). It should come second.

The backend needs auth before anything else — without authentication the admin panel is public. That's a security risk that should be addressed in parallel with the frontend work, not after.

**Proposed slice order:**
1. **Backend: Auth system** (JWT + password hashing + login endpoint) — needed immediately, blocks nothing but secures everything
2. **Frontend: Add TanStack Query** — replace `api.ts` calls with hooks, add query client provider, minimal refactor of Reservar.tsx and Admin.tsx
3. **Backend: File upload + migrations** — comprobantes are a core requirement
4. **Frontend: Migrate to TanStack Router** — type-safe routes, loaders, layout
5. **Backend: Background tasks + notifications** — vencimientos, WhatsApp reminders
6. **Frontend: Polish** — TanStack Table for admin dashboard, TanStack Form if needed

### Risks

- **TanStack Router has a learning curve and is less battle-tested** than react-router-dom. The API has changed significantly across versions. Verify compatibility with the current React 18 + Vite 8 setup before committing.
- **SQLModel limitations**: SQLModel v0.0.8+ has known issues with relationship loading and async support. If the backend grows significantly, consider switching to raw SQLAlchemy + Pydantic v2 for more control.
- **SQLite concurrency**: SQLite does not handle concurrent writes well. If the app gets real traffic, this WILL be a bottleneck. Plan for PostgreSQL migration early.
- **No frontend testing**: The frontend has zero tests. Adding TanStack Query without tests means refactoring blind. Consider adding at least basic smoke tests (Vitest + React Testing Library) before or during the migration.
- **API contract churn**: If backend endpoints change significantly (auth headers, response shapes), TanStack Query hooks need updating. This is manageable but adds coordination cost.
- **Monorepo complexity**: The current monorepo has no shared types between frontend and backend. Consider openapi-generator or orval to auto-generate TypeScript types from the FastAPI schema.

### Ready for Proposal

**Yes** — but with the following caveat the orchestrator should communicate to the user:

1. This is NOT a single change — it's a program of work spanning multiple SDD changes. Each slice above is its own change proposal.
2. The user should confirm the slice order and whether they want all slices or a subset.
3. The user should decide: do they want to proceed as an `sdd-new` for the full program, or start with Slice 1 (backend auth) and Slice 2 (TanStack Query) as the first discrete change?
4. Recommend the user start with a proposal for "Add TanStack Query + JWT auth" as a single coherent change (backend + frontend in one slice), then tackle TanStack Router and other items in subsequent changes.
