# Tasks: Astro + Infrastructure Migration

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~380 (additions + deletions) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR (6 atomic commits) |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | All 6 commits | PR 1 | Single PR per proposal; each commit independently revertable |

## Phase 1: SQLite → Supabase PostgreSQL (Commit 1)

- [x] 1.1 Replace `PRAGMA table_info(cliente)` in `run_migration()` (`backend/app/main.py:71`) with `information_schema.columns` query for PostgreSQL compatibility
- [x] 1.2 Create `supabase/migrations/001_initial_schema.sql` with CREATE TABLE statements matching SQLModel models (Cliente, ClienteTelefono, Servicio, Cita, CitaServicio, Configuracion, HorarioSemanal, ExcepcionHorario, Usuario)
- [x] 1.3 Verify `database.py` conditional `connect_args` handles PostgreSQL correctly (already does — confirm no SQLite-only paths remain)
- [x] 1.4 Run `python -m pytest` — all 36+ tests must pass with `DATABASE_URL` pointing to PostgreSQL

## Phase 2: Backend for Render (Commit 2)

- [x] 2.1 Remove `StaticFiles` mount and `app.mount("/assets", ...)` from `backend/app/main.py:945`
- [x] 2.2 Remove SPA fallback routes (`serve_root`, `serve_spa`) from `backend/app/main.py:949-955`
- [x] 2.3 Remove `FileResponse` import from `backend/app/main.py:7`
- [x] 2.4 Update CORS origins to read from `CORS_ORIGINS` env var (already exists at line 118 — verify default includes `localhost:5173` for dev)
- [x] 2.5 Change cookie `samesite="strict"` → `samesite="none"` and add `secure=True` on all three `set_cookie` calls (login:157, login:165, refresh:204)
- [x] 2.6 Rewrite `backend/Dockerfile` to backend-only (remove Stage 1 `frontend-builder`, remove `COPY --from=frontend-builder`)
- [x] 2.7 Add version to `/health` response: `{"status": "ok", "version": "0.1.0"}`
- [x] 2.8 Run `python -m pytest` — all tests pass; verify `/health` returns version field

## Phase 3: Frontend to Vercel (Commit 3)

- [x] 3.1 Update `frontend/src/api.ts:5` — change default from `''` to `'http://localhost:8000'` for dev fallback
- [x] 3.2 Add `withCredentials: true` to axios instance in `frontend/src/api.ts:7`
- [x] 3.3 Create `vercel.json` at project root with SPA rewrites and asset cache headers (from design doc)
- [x] 3.4 Verify `tsc --noEmit` passes with no type errors
- [x] 3.5 Verify `npm run build` succeeds in `frontend/`

## Phase 4: Cold Start Mitigation (Commit 4)

- [x] 4.1 Create `cron-config.md` at project root documenting cron-job.org setup (URL: `https://wings-nails-api.onrender.com/health`, interval: 14 minutes)
- [x] 4.2 Create `frontend/src/components/SkeletonLoader.tsx` — reusable skeleton component for loading states
- [x] 4.3 Add skeleton loading state to `frontend/src/contexts/AuthContext.tsx` during initial auth check
- [x] 4.4 Add skeleton loading state to config-dependent views (admin dashboard, booking page)

## Phase 5: CI/CD Split (Commit 5)

- [x] 5.1 Create `.github/workflows/deploy-frontend.yml` — Vercel deploy on push to `main` (paths: `frontend/**`)
- [x] 5.2 Create `.github/workflows/deploy-backend.yml` — Render deploy on push to `main` (paths: `backend/**`)
- [x] 5.3 Verify both workflows have correct path filters and don't trigger on unrelated changes

## Phase 6: Testing + Polish (Commit 6)

- [x] 6.1 Add integration test for cross-origin auth: login returns `SameSite=None; Secure` cookies (in `backend/tests/test_auth.py`)
- [x] 6.2 Add integration test for `/health` endpoint returning version field (in `backend/tests/test_api.py`)
- [x] 6.3 Add CORS headers test: verify `Access-Control-Allow-Origin` matches `CORS_ORIGINS` env var
- [x] 6.4 Run full test suite — all tests pass
- [x] 6.5 Run `tsc --noEmit` in frontend — no type errors
- [x] 6.6 Manual E2E verification checklist: login → admin → booking flow across Vercel + Render domains

## Dependencies

```
Phase 1 (DB) ─────┐
                   ├─▶ Phase 3 (Frontend) ──▶ Phase 5 (CI/CD)
Phase 2 (Backend) ─┤                           │
                   ├─▶ Phase 4 (Cold Start) ──┤
                   │                           │
                   └───────────────────────────┴─▶ Phase 6 (Testing)
```

- Phase 1 and Phase 2 are independent (can be done in parallel)
- Phase 3 depends on Phase 2 (CORS + cookie changes must exist for frontend to work)
- Phase 4 depends on Phase 2 (health endpoint must exist) and Phase 3 (frontend must be deployable)
- Phase 5 depends on all prior phases (CI/CD deploys the final state)
- Phase 6 depends on all prior phases (validates the complete system)

## Effort Estimation

| Phase | Tasks | Size | Rationale |
|-------|-------|------|-----------|
| Phase 1 | 4 | M | PRAGMA refactor is surgical; migration SQL is boilerplate |
| Phase 2 | 8 | L | Most files touched; cookie changes need care; Dockerfile rewrite |
| Phase 3 | 5 | S | Small API change + config file |
| Phase 4 | 4 | S | Skeleton components are straightforward |
| Phase 5 | 2 | S | Two YAML files, well-understood pattern |
| Phase 6 | 6 | M | Integration tests require careful setup |
| **Total** | **29** | **L** | |

## Files Affected (Complete List)

| File | Action | Phases |
|------|--------|--------|
| `backend/app/main.py` | Modify | 1, 2 |
| `backend/Dockerfile` | Modify | 2 |
| `frontend/src/api.ts` | Modify | 3 |
| `frontend/src/contexts/AuthContext.tsx` | Modify | 4 |
| `frontend/src/components/SkeletonLoader.tsx` | Create | 4 |
| `vercel.json` | Create | 3 |
| `render.yaml` | Create | 2 |
| `supabase/migrations/001_initial_schema.sql` | Create | 1 |
| `cron-config.md` | Create | 4 |
| `.github/workflows/deploy-frontend.yml` | Create | 5 |
| `.github/workflows/deploy-backend.yml` | Create | 5 |
| `backend/tests/test_auth.py` | Modify | 6 |
| `backend/tests/test_api.py` | Modify | 6 |
