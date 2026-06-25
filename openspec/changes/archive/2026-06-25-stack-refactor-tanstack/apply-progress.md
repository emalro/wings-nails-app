# Apply Progress: stack-refactor-tanstack — Cumulative (PR1 + PR2 + PR3)

## Mode

Standard (no Strict TDD — frontend testing infrastructure setup, not feature logic)

## Summary

Three chained PRs implementing the stack refactor: PR1 (Vitest + Router migration), PR2 (DataTable), PR3 (Form validation).

## Completed Tasks

### Phase 1: Testing Infrastructure (Vitest) — PR1

| Task | Status |
|------|--------|
| 1.1 Add vitest + testing libs to devDependencies | ✅ |
| 1.2 Create vitest.config.ts | ✅ |
| 1.3 Create test-setup.ts | ✅ |
| 1.4 Write smoke test (`setup.test.tsx`) — 3 tests pass | ✅ |

### Phase 2: Router Migration — PR1

| Task | Status |
|------|--------|
| 2.1 Swap react-router-dom → @tanstack/react-router | ✅ |
| 2.2 Add `authPromise` to AuthContext | ✅ |
| 2.3 Create `routes/__root.tsx` | ✅ |
| 2.4 Create `routes/index.tsx` | ✅ |
| 2.5 Create `routes/reservar.tsx` | ✅ |
| 2.6 Create `routes/login.tsx` | ✅ |
| 2.7 Create `routes/admin.tsx` with `beforeLoad` guard | ✅ |
| 2.8 Update `main.tsx` — RouterProvider | ✅ |
| 2.9 Update `App.tsx` — TanStack Router imports | ✅ |
| 2.10 Update `Login.tsx` — TanStack Router APIs | ✅ |
| 2.11 Update `Home.tsx` — TanStack Router APIs | ✅ |
| 2.12 Delete `ProtectedRoute.tsx` | ✅ |
| 2.13 `tsc --noEmit` passes with zero errors | ✅ |

### Phase 3: DataTable Component — PR2

| Task | Status |
|------|--------|
| 3.1 Create `DataTable.tsx` — generic, sortable, filterable, responsive | ✅ |
| 3.2 Integrate DataTable in Admin.tsx — appointments table | ✅ |
| 3.3 Integrate DataTable in Admin.tsx — clients table | ✅ |
| 3.4 Integrate DataTable in Admin.tsx — services table | ✅ |
| 3.5 Verify: `tsc --noEmit` passes | ✅ |

### Phase 4: Form Validation — PR3

| Task | Status |
|------|--------|
| 4.1 Create `useFormValidation.ts` — hook with field rules, trim, touch, validate | ✅ |
| 4.2 Create `FieldError.tsx` — inline error display | ✅ |
| 4.3 Apply validation to `Login.tsx` — email required + format, password required | ✅ |
| 4.4 Apply validation to appointment form — client, date+future, services, observaciones+500 | ✅ |
| 4.5 Apply validation to admin client form — nombre/apellido/dni/teléfono required, DNI digits, email optional+format | ✅ |
| 4.6 Verify: `tsc --noEmit` passes | ✅ |

### Phase 5: Final Verification — PR3

| Task | Status |
|------|--------|
| 5.1 Backend: `python -m pytest` — 116 passed, 0 failed | ✅ |
| 5.2 Frontend: `tsc --noEmit` passes | ✅ |
| 5.3 Frontend: `npm run build` succeeds | ✅ |
| 5.4 Manual E2E: login flow, admin guard, table sort/filter, form validation errors clear | ✅ |

## Files Changed (PR3)

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/pages/Reservar.tsx` | Modified | Replaced manual validation with useFormValidation hook; added observaciones field; date+future validation |
| `frontend/src/components/ClientSection.tsx` | Modified | Replaced manual edit state with useFormValidation; added telefono/email fields with validation; FieldError components |

## Deviations from Design

- **observaciones field**: Added as a new textarea in the appointment form (per VAL-001 spec requirement). Not present in original code.
- **ClientSection telefono/email**: Form fields added for validation per VAL-002, but API payload only sends nombre/apellido/dni (backend ClienteUpdate type limitation). Phone/email fields display for admin reference.
- **authPromise vs whenReady()** (PR1): Used module-level deferred promise instead of AuthContext method — cleaner for TanStack Router's beforeLoad.
- **Login.tsx search params** (PR1): Used URLSearchParams instead of useSearch to avoid circular imports.

## Issues Found

None. All verification passes cleanly.

## Remaining Tasks

None — all 32/32 tasks complete.

## Workload / PR Boundary

- Mode: chained PR slice (PR 3 of 3 — final slice)
- Current work unit: Form validation hook + form integration
- Boundary: Phases 4.4-4.5 (validation forms) + Phase 5 (verification)
- Estimated review budget: ~80 net changed lines
- Status: **32/32 tasks complete. Ready for archive.**
