# Proposal: Astro + Infrastructure Migration

## Intent

The monolithic SPA (FastAPI serves React + API in one container) prevents SEO indexing of the landing page, creates vendor lock-in to a single deploy target, and suffers from Render free-tier cold starts that hurt first-visit UX. This migration separates concerns: static landing on Vercel (SEO), API on Render, database on Supabase (managed PostgreSQL), and cold-start mitigation via cron pinger + loading states.

## Scope

### In Scope
- **Phase 1 (NOW):** Infrastructure separation — Vercel (frontend) + Render (backend API) + Supabase (PostgreSQL) + cold start mitigation (cron pinger + skeleton UI)
- **Phase 2 (LATER):** Astro landing page — SSG for zero-JS SEO on `/`
- **Phase 3 (OPTIONAL):** Astro admin islands — only if complexity justifies it

### Out of Scope
- Full Astro rewrite of admin panel or booking flow (Phase 3 is deferred indefinitely)
- Paid Render tier ($7/mo) — user chose free tier + mitigation
- Domain restructuring (subdomains, CDN proxying)
- Service worker caching strategies
- Supabase paid plan — free tier is sufficient

## Capabilities

### New Capabilities
- `infra-separation`: Split monolith into Vercel frontend + Render backend + Supabase database with cross-origin auth
- `cold-start-mitigation`: External cron pinger + frontend loading skeletons to mask Render free-tier cold starts

### Modified Capabilities
- `user-auth`: Cookie SameSite must change from `strict` to `none; secure` for cross-origin Vercel→Render auth
- `ci-cd-pipeline`: Split monolithic Docker deploy into separate Vercel + Render deploy pipelines
- `online-booking`: API base URL changes from same-origin to cross-origin; axios interceptor must handle new API_URL env var

## Approach

**Phase 1 (this PR):** 6 atomic commits with per-commit rollback:

| Commit | Change | Rollback |
|--------|--------|----------|
| 1 | SQLite → Supabase PostgreSQL (schema migration + `PRAGMA` refactor) | Revert `database.py`, restore SQLite |
| 2 | Backend Dockerfile for Render (remove StaticFiles mount, add CORS origins) | Revert Dockerfile, restore `main.py` |
| 3 | Frontend → Vercel (CORS, cookie `SameSite`, `API_URL` env var) | Revert `api.ts`, `main.py` CORS |
| 4 | Cold start mitigation (cron config + skeleton loading states) | Remove loading components |
| 5 | CI/CD split (separate frontend/backend workflows) | Revert to monolithic `cd.yml` |
| 6 | Testing + polish (cross-origin auth validation, E2E smoke) | Revert test files |

**Key Technical Decisions:**
- SQLModel abstracts PostgreSQL differences; only `PRAGMA table_info()` calls need refactoring
- Cookie auth: `SameSite=None; Secure` required for cross-origin; Vercel auto-provides HTTPS
- Cron pinger: cron-job.org free tier, ping `/health` every 14min (within 15min sleep window)
- Frontend: axios `baseURL` from `VITE_API_URL` env var (Vercel injects at build)

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/app/main.py` | Modified | Remove StaticFiles mount, expand CORS origins |
| `backend/app/database.py` | Modified | PostgreSQL connection, remove SQLite PRAGMAs |
| `backend/Dockerfile` | Modified | Backend-only container (no frontend build stage) |
| `frontend/src/api.ts` | Modified | Dynamic `API_URL` from env var |
| `frontend/src/components/AuthContext.tsx` | Modified | Cross-origin cookie handling |
| `.github/workflows/cd.yml` | Modified | Split into frontend/backend deploys |
| `vercel.json` | New | Vercel deploy config |
| `render.yaml` | New | Render Blueprint (optional) |
| `supabase/migrations/` | New | Schema migration SQL |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cookie SameSite=none breaks on older browsers | Low | HTTPS required; all modern browsers support it |
| Supabase free-tier pause after 7 days inactivity | Medium | Cron pinger keeps backend alive; DB pauses but Render sleeps first |
| PRAGMA refactor breaks migration logic | Low | SQLModel handles ORM; only `run_migration()` inspection needs update |
| Cross-origin CORS misconfiguration | Medium | Test locally with separate frontend/backend ports before deploy |
| Cold start still visible to some users | Low | 14-min pinger prevents 95%+ of cold starts; skeletons handle the rest |

## Rollback Plan

Each commit is independently revertable. If Phase 1 fails:
- Revert all commits → restore monolithic Docker deploy
- No data loss (Supabase can be abandoned; SQLite file remains in repo)
- Vercel frontend can be deleted; Render can be redeployed with original Dockerfile

## Dependencies

- Supabase account (free tier, 2 active projects max)
- Vercel account (free tier)
- Render account (free tier, 750 hrs/month)
- cron-job.org or FastCron account (free tier)

## Success Criteria

- [ ] Frontend loads from Vercel domain, API responds from Render domain
- [ ] Cross-origin JWT auth works (login → admin → booking flow)
- [ ] Landing page indexed by Google (Lighthouse SEO score ≥ 95)
- [ ] Render cold start masked by loading skeleton (< 3s perceived for returning users)
- [ ] Cron pinger prevents > 95% of cold starts (monitor for 1 week)
- [ ] All 36+ existing tests pass with PostgreSQL backend
- [ ] CI/CD deploys frontend and backend independently
