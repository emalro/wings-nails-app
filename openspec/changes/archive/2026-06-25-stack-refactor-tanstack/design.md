# Design: Stack Refactor — TanStack Router + UI Polish

## Technical Approach

Three scopes in one change: (1) Big-bang react-router-dom v6 → @tanstack/react-router migration (4 routes, no behavioral change), (2) Reusable `DataTable` component with client-side sort/filter + responsive card collapse, (3) `useFormValidation` hook absorbing existing Reservar.tsx inline validation into a reusable pattern. Zero backend changes. Auth guard moves from component wrapper (`ProtectedRoute`) to route-level `beforeLoad` with a `whenReady()` promise on `AuthContext` to prevent premature redirects.

## Architecture Decisions

### Route Migration

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Big bang | One-shot risk, but 4 routes only — flat && small | ✅ Adopt |
| Incremental dual-router | Safer but adds adapter complexity for zero value | Reject |

### Auth Guard

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `beforeLoad` + `whenReady()` | Idiomatic TS Router, no flash. Requires promise on AuthContext | ✅ Adopt |
| Wrapper component (current) | Can't prevent route load, flash of content | Reject |

### Validation

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Custom `useFormValidation` hook | ~60 lines, zero deps, absorbs existing inline pattern | ✅ Adopt |
| Zod / Yup / RHF | Libraries for 3 simple forms — overkill | Reject |

### DataTable Architecture

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Single reusable component with column defs | Covers 3 tables, ~100 lines, no extra dep | ✅ Adopt |
| @tanstack/react-table | Headless but adds dependency for 3 small tables | Reject |

### Responsive Table

| Option | Tradeoff | Decision |
|--------|----------|----------|
| CSS row→card collapse | Single render path, CSS `display` switch | ✅ Adopt |
| Separate CardList component | Dual render paths, harder to maintain | Reject |

## Data Flow

```
User clicks /admin
  → beforeLoad fires
  → await auth.whenReady()  [waits for initial /auth/me]
  → if !authenticated → throw redirect({ to: '/login', search: { redirect: '/admin' } })
  → if authenticated → render admin route

DataTable flow:
  Query hook fetches → data[] → DataTable receives data + columnDefs
  → client-side sort by clicked column
  → client-side filter by search input string (filters any text column)
  → render: table >768px, cards ≤768px

Form validation:
  useFormValidation(schema) → { values, errors, touched, setField, validateAll }
  → onSubmit → validateAll() → if !isValid → show inline errors → return
  → if isValid → call mutation → navigate
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend/package.json` | Modify | Swap react-router-dom → @tanstack/react-router |
| `frontend/src/main.tsx` | Modify | Replace BrowserRouter/Routes → RouterProvider + routeTree |
| `frontend/src/App.tsx` | Modify | Keep as layout component, no longer owns router config |
| `frontend/src/contexts/AuthContext.tsx` | Modify | Add `whenReady(): Promise<void>` method |
| `frontend/src/components/ProtectedRoute.tsx` | Delete | Logic moved to beforeLoad; orphaned |
| `frontend/src/pages/Login.tsx` | Modify | useNavigate → router.navigate, useSearchParams → useSearch |
| `frontend/src/pages/Home.tsx` | Modify | useNavigate → router.navigate |
| `frontend/src/routes/__root.tsx` | Create | Root layout with nav + footer + `<Outlet />` |
| `frontend/src/routes/index.tsx` | Create | Home page route (renders current Home.tsx content) |
| `frontend/src/routes/reservar.tsx` | Create | Reservar route |
| `frontend/src/routes/login.tsx` | Create | Login route (NO beforeLoad) |
| `frontend/src/routes/admin.tsx` | Create | Admin route with `beforeLoad` guard |
| `frontend/src/components/DataTable.tsx` | Create | Reusable sortable/filterable table |
| `frontend/src/hooks/useFormValidation.ts` | Create | Form validation hook |
| `frontend/src/components/FieldError.tsx` | Create | Inline field error display |

## Interfaces / Contracts

### DataTable

```typescript
type ColumnDef<T> = {
  key: keyof T
  label: string
  sortable?: boolean
  filterable?: boolean
  render?: (value: T[keyof T], row: T) => React.ReactNode
  hideOnMobile?: boolean  // visually hidden on ≤768px
}

type DataTableProps<T> = {
  columns: ColumnDef<T>[]
  data: T[]
  isLoading?: boolean
  emptyMessage?: string
  keyExtractor: (row: T) => string | number
}
```

### useFormValidation

```typescript
type ValidationRule = {
  validate: (value: string, allValues: Record<string, string>) => boolean
  message: string
}

type ValidationSchema = Record<string, ValidationRule[]>

function useFormValidation(opts: {
  initialValues: Record<string, string>
  schema: ValidationSchema
  onBlurValidate?: boolean  // default true
}): {
  values: Record<string, string>
  errors: Record<string, string>
  touched: Record<string, boolean>
  setField: (key: string, value: string) => void
  setFields: (fields: Record<string, string>) => void
  validateField: (key: string) => string | undefined
  validateAll: () => boolean
  clearErrors: () => void
  reset: () => void
  isValid: boolean
  isDirty: boolean
}
```

### AuthContext addition

```typescript
interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  whenReady: () => Promise<void>  // resolves after initial /auth/me completes
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | useFormValidation | Export hook, test validateAll/validateField with valid/invalid schemas |
| Unit | DataTable column sort | Pass data, click header, assert row order |
| Unit | AuthContext.whenReady | Mount AuthProvider, call whenReady(), assert resolves after isLoading flips |
| Integration | Route navigation | `tsc --noEmit` for type safety. Manual: visit all 4 routes, verify render identical |
| E2E | Auth guard redirect | Visit /admin unauthenticated → assert redirect to /login?redirect=/admin |

Note: No frontend test runner exists (no jest/vitest in package.json). Unit tests are design-only — actual execution blocked until test runner is added. Verification relies on `tsc --noEmit`.

## Migration / Rollout

Install @tanstack/react-router first. Then in one commit: create `src/routes/`, modify `main.tsx`, modify `App.tsx`, delete `ProtectedRoute.tsx`, modify `Login.tsx`/`Home.tsx`. Validate with `tsc --noEmit` and manual route visits. Rollback: revert `main.tsx`, `App.tsx`, delete `src/routes/`, restore `ProtectedRoute.tsx`, revert page files, restore `package.json`.

## Open Questions

- [ ] Test runner: should we add vitest before this change to enable unit tests for the new hook and component?
- [ ] Admin sub-routes (`/admin/appointments`, `/admin/clients`, `/admin/services`) — spec references them but current Admin.tsx has all sections in one page. Design for flat admin vs sub-routes?
- [ ] `redirect` query param name: `/login?redirect=/admin` or `/login?redirect=%2Fadmin` — confirm TanStack Router's `search` serialization behavior
