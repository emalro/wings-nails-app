# Delta for Astro + Infrastructure Migration

**Change**: `astro-infra-migration`
**Date**: 2026-06-25
**Scope**: Phase 1 — Infrastructure separation (Vercel + Render + Supabase)

---

## New Domain: infra-separation

### Purpose

Split monolithic deployment into independent services: Vercel (static frontend), Render (API backend), and Supabase (PostgreSQL). Cross-origin auth via JWT httpOnly cookies with `SameSite=None; Secure`.

### Requirements

#### REQ-INFRA-001 — Cross-Origin Cookie Auth (MUST)

The system SHALL issue JWT tokens in httpOnly cookies with `SameSite=None; Secure` attributes. The cookie domain SHALL be the backend API domain (Render). The frontend origin (Vercel) SHALL NOT directly access cookies; cross-origin requests SHALL include `credentials: "include"`.

**Scenario: Login sets cross-origin cookie**
- GIVEN the frontend on `*.vercel.app` and API on `*.onrender.com`
- WHEN user submits valid credentials to POST /auth/login
- THEN Set-Cookie header includes `SameSite=None; Secure; Path=/`
- AND the browser stores the cookie for the Render domain

**Scenario: Authenticated cross-origin request**
- GIVEN a valid JWT cookie on the Render domain
- WHEN the frontend sends GET /admin with `credentials: "include"`
- THEN the API validates the cookie and returns protected data

**Scenario: Cookie rejected by browser**
- GIVEN the backend sets `SameSite=None; Secure` on a non-HTTPS connection
- WHEN the browser receives the Set-Cookie header
- THEN the cookie is rejected (Secure requires HTTPS)
- AND the frontend shows a session error message

#### REQ-INFRA-002 — CORS Configuration (MUST)

The backend SHALL accept requests from the Vercel frontend origin. CORS SHALL allow `credentials: true` and the specific frontend origin. Preflight requests SHALL be handled for all non-simple methods.

**Scenario: Preflight succeeds**
- GIVEN the frontend on `*.vercel.app`
- WHEN OPTIONS /auth/login is sent with `Origin: https://*.vercel.app`
- THEN response includes `Access-Control-Allow-Origin: https://*.vercel.app`
- AND `Access-Control-Allow-Credentials: true`

**Scenario: Unauthorized origin rejected**
- GIVEN an origin not in the allowed list
- WHEN a cross-origin request is made
- THEN the backend returns 403 with no CORS headers

#### REQ-INFRA-003 — API URL Configuration (MUST)

The frontend SHALL read the backend API URL from `VITE_API_URL` environment variable at build time. Axios SHALL use this as `baseURL` for all API requests.

**Scenario: API URL resolved at build**
- GIVEN `VITE_API_URL=https://wings-nails-api.onrender.com`
- WHEN the frontend build completes
- THEN all axios requests target `https://wings-nails-api.onrender.com/*`

**Scenario: Missing env var**
- GIVEN `VITE_API_URL` is not set
- WHEN the frontend builds
- THEN build fails with a clear error or falls back to a dev default

#### REQ-INFRA-004 — Backend Database Connection (MUST)

The backend SHALL connect to PostgreSQL via Supabase connection string. The connection string SHALL be provided via `DATABASE_URL` environment variable. SQLModel SHALL manage ORM differences; SQLite-specific `PRAGMA` calls SHALL be removed or conditional.

**Scenario: PostgreSQL connection on startup**
- GIVEN `DATABASE_URL` pointing to Supabase PostgreSQL
- WHEN the backend starts
- THEN it connects to PostgreSQL and creates tables via SQLModel metadata

**Scenario: SQLite fallback for local dev**
- GIVEN no `DATABASE_URL` env var
- WHEN the backend starts locally
- THEN it falls back to SQLite file for development

#### REQ-INFRA-005 — Backend Static Files Removed (MUST)

The backend SHALL NOT serve frontend static files. The `StaticFiles` mount SHALL be removed from FastAPI. The backend SHALL only serve API routes and the `/health` endpoint.

**Scenario: API-only backend**
- GIVEN the deployed Render service
- WHEN GET / is requested
- THEN the backend returns 404 (no SPA fallback)
- AND GET /health returns `{"status": "ok"}`

---

## New Domain: cold-start-mitigation

### Purpose

Mask Render free-tier cold starts (~30-60s) using an external cron pinger and frontend loading skeletons. Target: <3s perceived latency for returning users.

### Requirements

#### REQ-COLD-001 — Cron Pinger (MUST)

An external cron service SHALL ping `GET /health` every 14 minutes (within Render's 15-minute sleep window). The cron configuration SHALL be documented and reproducible.

**Scenario: Pinger prevents sleep**
- GIVEN Render free-tier with 15-min idle timeout
- WHEN the cron service pings /health every 14 minutes
- THEN Render does not enter sleep state
- AND cold starts are avoided for 95%+ of real user visits

**Scenario: Pinger fails**
- GIVEN the cron service is misconfigured or down
- WHEN 15 minutes pass without a ping
- THEN Render enters sleep state
- AND the next user request triggers a cold start

#### REQ-COLD-002 — Loading Skeleton UI (MUST)

The frontend SHALL display a branded loading skeleton while the backend cold-starts. The skeleton SHALL be lightweight (<5KB) and appear within 500ms of navigation. The skeleton SHALL auto-dismiss once the API responds.

**Scenario: Cold start with skeleton**
- GIVEN Render is in sleep state
- WHEN a user navigates to the frontend
- THEN a loading skeleton appears immediately
- AND once the API responds (<60s), the skeleton is replaced with real content

**Scenario: Warm request skips skeleton**
- GIVEN Render is awake and responding
- WHEN a user navigates to the frontend
- THEN content loads directly without skeleton (or skeleton appears <200ms and dismisses)

---

## MODIFIED: user-auth

### Requirement: Login Endpoint (MODIFIED)

The system SHALL provide a POST /auth/login endpoint that validates credentials and returns JWT access and refresh tokens in httpOnly cookies with `SameSite=None; Secure` for cross-origin use.

(Previously: `SameSite=Strict` cookies for same-origin auth)

#### Scenario: Successful login (updated)

- GIVEN a valid admin email and password
- WHEN POST /auth/login with credentials
- THEN response contains access_token and refresh_token
- AND tokens are set in httpOnly cookies with `SameSite=None; Secure`
- AND response includes user profile (email, role)

#### Scenario: Cross-origin login flow (NEW)

- GIVEN the frontend on Vercel and API on Render
- WHEN user submits login form
- THEN Set-Cookie headers include cross-origin attributes
- AND browser stores cookies for the Render domain
- AND subsequent requests with `credentials: "include"` are authenticated

---

## MODIFIED: ci-cd-pipeline

### Requirement: CI-002 — Entrega Continua y Docker Multi-stage (MODIFIED)

The system SHALL maintain separate deployment pipelines: Vercel auto-deploys the frontend on push to `main`; Render auto-deploys the backend from the same push. The monolithic Docker multi-stage build SHALL be replaced by independent deploy targets.

(Previously: Single Docker multi-stage image containing both frontend and backend)

#### Scenario: Frontend deploys to Vercel (NEW)

- GIVEN a push to `main` with frontend changes
- WHEN GitHub Actions completes CI
- THEN Vercel auto-deploys the frontend to `*.vercel.app`
- AND the deployment is live within 2 minutes

#### Scenario: Backend deploys to Render (NEW)

- GIVEN a push to `main` with backend changes
- WHEN GitHub Actions completes CI
- THEN Render auto-deploys the backend from the Dockerfile
- AND the backend serves API-only (no StaticFiles mount)

#### Scenario: Independent rollbacks (NEW)

- GIVEN a broken frontend deployment
- WHEN the frontend is rolled back on Vercel
- THEN the backend on Render continues serving normally
- AND no backend redeployment is required

### Requirement: CI-003 — Frontend servido por FastAPI (REMOVED)

The backend SHALL NOT serve frontend static files. Frontend is served by Vercel independently.

(Reason: Frontend moved to Vercel for SEO and independent deploy)
(Migration: Vercel handles SPA routing via `vercel.json` rewrites)

---

## MODIFIED: online-booking

### Requirement: REQ-BKG-002 — Flujo Multi-Step (MODIFIED)

The reservation flow SHALL function identically across the 4 steps, but API requests now originate from the Vercel frontend to the Render backend via cross-origin axios calls with `VITE_API_URL`.

(Previously: Same-origin API calls from FastAPI-served SPA)

#### Scenario: Cross-origin booking flow (NEW)

- GIVEN the frontend on Vercel and API on Render
- WHEN a client completes the 4-step booking flow
- THEN axios sends requests with `credentials: "include"` to the Render API
- AND the booking is created successfully with cross-origin auth

#### Scenario: API URL misconfigured (NEW)

- GIVEN `VITE_API_URL` pointing to wrong backend
- WHEN the booking flow reaches step 2 (data submission)
- THEN the request fails with network error
- AND the frontend shows a user-friendly error: "Servicio no disponible, intentá más tarde"

---

## Edge Cases

| Case | Behavior |
|------|----------|
| Supabase pauses (7 days inactive) | Backend returns 500 on DB queries; cron pinger keeps Render alive but not Supabase; manual unpause required |
| Render sleeps + Supabase pauses simultaneously | Cold start hits both; loading skeleton masks Render wake; Supabase unpause is automatic on first query after ~30s |
| Cookie rejected (SameSite issues) | Frontend detects 401 on first authenticated request; shows "Iniciá sesión nuevamente" and redirects to /login |
| Cron pinger fails | Render sleeps after 15min; next user sees cold start skeleton; pinger must be monitored with a separate health check |
| Old cached frontend with wrong API_URL | Users see network errors; Vercel deploys with cache-busting hashes; CDN invalidation on deploy |

---

## Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|-------------|
| AC-01 | Frontend loads from Vercel domain, API from Render domain | Manual test: open `*.vercel.app`, verify API calls go to `*.onrender.com` |
| AC-02 | Cross-origin JWT auth works (login → admin → booking) | E2E: login on Vercel, access /admin, complete booking flow |
| AC-03 | Cookie attributes correct | Inspect Set-Cookie header: `SameSite=None; Secure; Path=/` |
| AC-04 | Cold start <3s perceived | Measure time from navigation to content with skeleton visible |
| AC-05 | Cron pinger prevents >95% cold starts | Monitor Render logs for 1 week; count sleep events |
| AC-06 | All 36+ tests pass with PostgreSQL | Run `pytest` against Supabase; all green |
| AC-07 | CI/CD deploys independently | Push frontend-only change → only Vercel redeploys |
| AC-08 | Landing page SEO score ≥95 | Lighthouse audit on `*.vercel.app` |

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Supabase free-tier pause (7 days) | Medium | DB queries fail | Cron pinger keeps Render alive; document manual unpause process |
| Cross-origin cookie rejection on older browsers | Low | Auth broken | HTTPS enforced; all modern browsers support SameSite=None |
| Vercel build env var misconfiguration | Medium | Frontend can't reach API | Build-time validation; preview deploys test before prod |
| Render cold start still visible | Low | UX degradation | Loading skeleton masks wait; 95%+ prevented by pinger |
