# Tasks: Stack Refactor — TanStack Query for API Layer

**Change**: `stack-refactor-auth`
**Phase**: tasks
**Total estimated changed lines**: ~372 (under 400 budget)

---

## Review Workload Forecast

- **Decision needed before apply**: No
- **Chained PRs recommended**: No
- **Chain strategy**: size-exception (not needed, budget safe)
- **400-line budget risk**: Low

---

## Phase 1: Foundation

### 1.1 Install `@tanstack/react-query`
**File**: `frontend/package.json`
**Action**: Add `"@tanstack/react-query": "^5.0.0"` to `dependencies`.
**Verify**: `npm ls @tanstack/react-query` resolves, `tsc --noEmit` passes.

- [x] 1.1

### 1.2 Add QueryClientProvider to app root
**File**: `frontend/src/main.tsx`
**Action**:
- Import `QueryClient`, `QueryClientProvider` from `@tanstack/react-query`
- Create `const queryClient = new QueryClient()` outside the component tree
- Wrap `<BrowserRouter>` with `<QueryClientProvider client={queryClient}>`
**Verify**: App renders without runtime errors, Query DevTools not included (deferred).

- [x] 1.2

---

## Phase 2: Core Hooks

### 2.1 Create `useServices` hook
**File**: `frontend/src/hooks/useServices.ts` (new)
**Exports**: `useServices` (query, `['services']`), `useCreateService` (mutation, invalidates `['services']`), `useUpdateService` (mutation, invalidates `['services']`)
**Dependencies**: imports `listServices`, `createService`, `updateService` from `../api`
**Verify**: Hook compiles, query key convention matches design doc.

- [x] 2.1

### 2.2 Create `useAppointments` hook
**File**: `frontend/src/hooks/useAppointments.ts` (new)
**Exports**: `useAppointments` (query, `['appointments']`), `useCreateAppointment` (mutation, invalidates `['appointments']`, `['busy-slots']`), `useUpdateAppointmentStatus` (mutation, invalidates `['appointments']`)
**Dependencies**: imports `listAppointments`, `createAppointment`, `updateAppointmentStatus` from `../api`
**Verify**: Hook compiles, mutation onSuccess chains invalidation correctly.

- [x] 2.2

### 2.3 Create `useClients` hook
**File**: `frontend/src/hooks/useClients.ts` (new)
**Exports**: `useCreateClient` (mutation — no cache to invalidate since clients are not listed)
**Dependencies**: imports `createClient` from `../api`
**Verify**: Hook compiles, mutation returns `client.id` for downstream chaining.

- [x] 2.3

### 2.4 Create `useBusySlots` hook
**File**: `frontend/src/hooks/useBusySlots.ts` (new)
**Exports**: `useBusySlots(dateStr: string)` (query, `['busy-slots', dateStr]` — per-date cache isolation)
**Dependencies**: imports `getBusySlots` from `../api`
**Verify**: Hook compiles, query is `enabled` only when `dateStr` is truthy.

- [x] 2.4

---

## Phase 3: Component Migration

### 3.1 Refactor `Reservar.tsx` to use hooks
**File**: `frontend/src/pages/Reservar.tsx`
**Changes**:
- Replace `useEffect` + `useState` for services with `useServices()` hook (destructure `data`, `isLoading`)
- Replace `useEffect` + `useState` for busy slots with `useBusySlots(dateStr)` hook (derive date from `fechaHora`)
- Replace `createClient` + `createAppointment` calls with `useCreateClient` + `useCreateAppointment` mutations
- Handle mutation `onSuccess` to reset form and show success message
- Handle mutation `onError` to show error message
- Remove direct `api.ts` imports (now covered by hooks)
**Verify**: Same data loads, form submission works, calendar component receives busy slots.

- [x] 3.1

### 3.2 Refactor `Calendar.tsx` to use `useBusySlots`
**File**: `frontend/src/components/Calendar.tsx`
**Changes**:
- Replace `useEffect` + `getBusySlots` + `busySlots` state with `useBusySlots(dateStr)` hook
- Busy slots arrive as query data instead of local state
- The `generateTimeSlots` dependency on `busySlots` is now reactive via the hook's `data`
- Remove `import { getBusySlots } from '../api'`
**Verify**: Calendar shows/hides busy slots correctly, no effect-based fetch remains.

- [x] 3.2

### 3.3 Refactor `Admin.tsx` to use hooks
**File**: `frontend/src/pages/Admin.tsx`
**Changes**:
- Replace `useEffect` for appointments with `useAppointments()` hook
- Replace `useEffect` for services with `useServices()` hook (pass `all` param via `showInactive`)
- Replace `handleStatusChange`, `handleCreateService`, `handleUpdateService`, `handleDeactivateService` with corresponding mutations (`useUpdateAppointmentStatus`, `useCreateService`, `useUpdateService`)
- Optimistic local state updates are replaced by cache invalidation on mutation success
- Remove direct `api.ts` imports for replaced calls
**Verify**: Both data sections load, CRUD operations succeed, status changes persist.

- [x] 3.3

---

## Phase 4: Cleanup & Verify

- [x] 4.1 — all 8 functions still used by hooks

### 4.1 Remove unused `api.ts` exports
**File**: `frontend/src/api.ts`
**Action**: Confirm all 8 functions are still imported by hooks. If any remain unused after migration, remove them. Keep `api.ts` as the transport layer since hooks depend on it.
**Verify**: No unused exports warning from TypeScript.

- [x] 4.2

### 4.2 Type-check and smoke test
**Command**: `npx tsc --noEmit` in `frontend/`
**Actions**:
- Fix any TypeScript errors
- Manual smoke test: load Home, Reservar (verify services load + form submission), Admin (verify appointments + services sections), Calendar (verify date selection + busy slot display)
**Verify**: Zero type errors, all pages render without console errors.

---

## Task Dependency Graph

```
1.1 (install) ──→ 1.2 (provider)
                       │
            ┌──────────┼──────────┐
            ▼          ▼          ▼
          2.1        2.2        2.3  2.4
       (services) (appts)   (clients) (busySlots)
            │          │        │        │
            ▼          ▼        ▼        ▼
          3.1 (Reservar) ←──────┘────────┘
          3.2 (Calendar) ←────────────────┘
          3.3 (Admin) ←───┘───┘
            │
            ▼
      4.1 (cleanup) → 4.2 (verify)
```

Tasks 2.1–2.4 are independent and can be parallelized. Tasks 3.1–3.3 are independent (parallelizable after all hooks exist). Task 4.2 is the final gate.

**Total estimated changed lines**: ~372 | **Budget**: 400 | **Risk**: Low
