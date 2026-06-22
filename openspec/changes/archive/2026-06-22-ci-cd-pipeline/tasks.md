# Tasks: CI/CD Pipeline

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~100-120 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr-default |
| Chain strategy | not applicable |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Frontend & Backend Foundation

- [x] 1.1 Add `"typecheck": "tsc --noEmit"` script to `frontend/package.json`
- [x] 1.2 Add `StaticFiles` import and mount in `backend/app/main.py` — import `from fastapi.staticfiles import StaticFiles`, append `app.mount("/", StaticFiles(directory="static", html=True), name="static")` after all API routes

## Phase 2: Containerization

- [x] 2.1 Replace `backend/Dockerfile` with multi-stage: stage 1 `node:20-alpine` builds frontend (`npm ci && npm run build`); stage 2 `python:3.11-slim` copies backend + `frontend/dist/`, pip installs deps, adds HEALTHCHECK, removes gcc/build-essential

## Phase 3: CI/CD Workflows

- [x] 3.1 Create `.github/workflows/ci.yml` — parallel jobs: backend-tests (Python 3.11, pip install, pytest) + frontend-check (Node 20, npm ci, tsc --noEmit, npm run build); trigger: pull_request + push to main
- [x] 3.2 Create `.github/workflows/cd.yml` — single job: Docker buildx with cache, push to ghcr.io/emalro/wings-nails-app (tags: latest, sha-$sha); trigger: push to main; uses GITHUB_TOKEN for ghcr.io auth

## Phase 4: Verification

- [x] 4.1 Verify locally: `npm run typecheck` exits 0, `pytest` passes, `docker build -t test .` succeeds with healthcheck
- [ ] 4.2 Open PR with trivial change (e.g. README whitespace) to confirm CI passes; merge to verify CD publishes image to ghcr.io
