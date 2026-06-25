# Tasks: Stack Refactor — TanStack Router + UI Polish

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~470 net (650 new + modified, −180 deleted) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Foundation (Vitest + Router) ~140 net ⋅ PR 2: DataTable ~200 net ⋅ PR 3: Validation ~115 net |
| Delivery strategy | single-pr-default |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Base | Notes |
|------|------|-----------|------|-------|
| 1 | Vitest setup + Router migration | PR 1 | `feature/stack-refactor-tanstack` | Zero behavioral change; pure refactor + infra |
| 2 | DataTable component + admin integration | PR 2 | PR 1 branch | Additive; no router changes |
| 3 | Form validation hook + form integration | PR 3 | PR 2 branch | Additive; no DataTable dependency |

---

## Phase 1: Testing Infrastructure (Vitest)

- [x] 1.1 Add `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` to `frontend/package.json` devDependencies + `"test": "vitest run"` script
- [x] 1.2 Create `frontend/vitest.config.ts` — jsdom environment, setupFile pointing to test-setup
- [x] 1.3 Create `frontend/src/test-setup.ts` — `import '@testing-library/jest-dom'`
- [x] 1.4 Write smoke test e.g. `frontend/src/__tests__/setup.test.tsx` verifying vitest + jsdom work

## Phase 2: Router Migration

- [x] 2.1 Swap `react-router-dom` → `@tanstack/react-router` in `frontend/package.json`
- [x] 2.2 Add `authPromise` to `AuthContext` — module-level deferred promise resolved after initial `/auth/me` completes
- [x] 2.3 Create `frontend/src/routes/__root.tsx` — root layout importing `App.tsx` as component
- [x] 2.4 Create `frontend/src/routes/index.tsx` — renders `<Home />`
- [x] 2.5 Create `frontend/src/routes/reservar.tsx` — renders `<Reservar />`
- [x] 2.6 Create `frontend/src/routes/login.tsx` — renders `<Login />`; NO `beforeLoad` guard
- [x] 2.7 Create `frontend/src/routes/admin.tsx` — `beforeLoad` guard: `await authPromise`, if !authenticated → `throw redirect({ to: '/login', search: { reason: 'auth-required' } })`
- [x] 2.8 Update `frontend/src/main.tsx` — replace `BrowserRouter`/`Routes`/`Route` with `createRouter` + `RouterProvider`
- [x] 2.9 Update `frontend/src/App.tsx` — replace `Outlet`/`Link` imports with `@tanstack/react-router` equivalents; keep layout + nav/footer
- [x] 2.10 Update `frontend/src/pages/Login.tsx` — `useNavigate` → `useNavigate` from `@tanstack/react-router`; `useSearchParams` → `URLSearchParams(window.location.search)`
- [x] 2.11 Update `frontend/src/pages/Home.tsx` — `useNavigate` → `useNavigate` from `@tanstack/react-router`
- [x] 2.12 Delete `frontend/src/components/ProtectedRoute.tsx`
- [x] 2.13 Verify: `tsc --noEmit` passes with zero type errors

## Phase 3: DataTable Component

- [x] 3.1 Create `frontend/src/components/DataTable.tsx` — generic `DataTable<T>` with `ColumnDef<T>[]`, client-side sort (click header toggle asc/desc), text filter, responsive card collapse ≤768px, loading skeleton, empty state, `hideOnMobile` per column
- [x] 3.2 Integrate DataTable in `Admin.tsx` — appointments table (date, client, service, status) above CalendarView, with status dropdown filter
- [x] 3.3 Integrate DataTable in `Admin.tsx` — clients table inside ClientSection section (nombre, apellido, DNI, teléfono, turnos count)
- [x] 3.4 Integrate DataTable in `Admin.tsx` — services table inside ServicesSection section (nombre, duración, precio, seña)
- [x] 3.5 Verify: `tsc --noEmit` passes

## Phase 4: Form Validation

- [x] 4.1 Create `frontend/src/hooks/useFormValidation.ts` — hook accepting `ValidationSchema` (field → rules[]), returning `{ values, errors, touched, setField, validateField, validateAll, clearErrors, reset, isValid, isDirty }`; trims whitespace before validation
- [x] 4.2 Create `frontend/src/components/FieldError.tsx` — renders error message string or null
- [x] 4.3 Apply validation to `Login.tsx` — email required + valid format, password required; show `FieldError` inline, disable submit while invalid
- [x] 4.4 Apply validation to appointment form — client required, date required + future, at least one service, observaciones required + max 500
- [x] 4.5 Apply validation to admin client form — nombre/apellido/dni/teléfono required, DNI digits-only, teléfono Argentine format, email optional + valid format
- [x] 4.6 Verify: `tsc --noEmit` passes

## Phase 5: Final Verification

- [x] 5.1 Backend: `python -m pytest` passes (no regressions) — 116 passed
- [x] 5.2 Frontend: `tsc --noEmit` passes
- [x] 5.3 Frontend: `npm run build` succeeds
- [x] 5.4 Manual E2E: login flow, admin guard redirect with reason param, table sort/filter, form validation errors clear on valid input
