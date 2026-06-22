# Design: Stack Refactor — TanStack Query for API Layer

## Technical Approach

Incremental, non-destructive migration. Each `useEffect` + `useState` data-fetching pattern gets replaced by a TanStack Query hook that wraps the existing `api.ts` transport layer. No backend changes. The old `api.ts` functions remain intact — hooks import and call them. Old imports stay until all consumers are migrated, then unused exports are cleaned up at the end.

## Architecture Decisions

### Decision: Hook file organization

| Option | Tradeoff | Decision |
|--------|----------|----------|
| One file per hook | + Simple findability, - Many files, cross-imports for invalidation | ❌ |
| One giant `useApi.ts` | + Single import, - Violates SRP, hard to parallelize | ❌ |
| **Domain-based files** | + Query + mutation pairing, + Intentional cache invalidation, + Parallel PRs | ✅ |

**Chosen**: 4 domain files — `useServices`, `useAppointments`, `useClients`, `useBusySlots`.

### Decision: QueryClient placement

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `App.tsx` | + Closer to routes, - Adds nesting to non-root component | ❌ |
| Separate provider component | + Reusable, - Unnecessary indirection for one app | ❌ |
| **`main.tsx`** | + Minimal diff, + Matches `BrowserRouter` placement | ✅ |

### Decision: Keep `api.ts` as transport

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **Keep `api.ts`** | + Zero regression risk, + Working code stays, - Extra import layer | ✅ |
| Inline axios in hooks | + Single dependency, - Rewrites working code, risk of regression | ❌ |
| Delete `api.ts` entirely | + Simplest file structure, - Every consumer breaks until migration is 100% done | ❌ |

**Chosen**: Hooks call `api.ts` functions. `api.ts` stays as-is. Only unused exports are removed after all consumers migrate.

### Decision: Query key convention

```
['services']               // useServices (list)
['appointments']           // useAppointments (list)
['busy-slots', dateStr]    // useBusySlots (by date — enables per-date caching)
```

Simple string arrays. Date parameter ensures per-date cache isolation in `Calendar.tsx`. No symbol constants needed at this scale.

### Decision: Mutation side effects

`onSuccess` invalidates related query keys (e.g., creating an appointment invalidates `['appointments']` and `['busy-slots']`). Components receive updated data via automatic refetch. No optimistic updates — the app isn't latency-sensitive enough to justify the complexity.

## Data Flow

```
Before:
  Component → useEffect → api.ts → axios → API
    ↓
  useState (loading / error / data)

After:
  Component → useQuery / useMutation → api.ts → axios → API
    ↓
  TanStack Query cache
  { data, isLoading, error }  ← queries
  { mutate, isPending }       ← mutations
```

Component no longer manages fetch lifecycle. The hook is the single source of truth for loading/error/data state.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend/package.json` | Modify | Add `@tanstack/react-query` dependency |
| `frontend/src/main.tsx` | Modify | Import `QueryClient`, `QueryClientProvider`, wrap app tree |
| `frontend/src/hooks/useServices.ts` | Create | `useServices` (query), `useCreateService`, `useUpdateService` (mutations) |
| `frontend/src/hooks/useAppointments.ts` | Create | `useAppointments` (query), `useCreateAppointment`, `useUpdateAppointmentStatus` (mutations) |
| `frontend/src/hooks/useClients.ts` | Create | `useCreateClient` (mutation) |
| `frontend/src/hooks/useBusySlots.ts` | Create | `useBusySlots` (query, keyed by date) |
| `frontend/src/pages/Reservar.tsx` | Modify | Replace 2x `useEffect` + `useState` with hooks |
| `frontend/src/pages/Admin.tsx` | Modify | Replace 2x `useEffect` + `useState` + manual mutation state with hooks |
| `frontend/src/components/Calendar.tsx` | Modify | Replace `useEffect` + `getBusySlots` with `useBusySlots` hook |

## Interfaces / Contracts

```typescript
// Query keys (internal to hooks, not exported)
const serviceKeys = { all: ['services'] as const }
const appointmentKeys = { all: ['appointments'] as const }
const busySlotKeys = { all: ['busy-slots'] as const, byDate: (d: string) => ['busy-slots', d] as const }

// All hooks return standard TanStack Query v5 return types
// Consumers destructure: { data, isLoading | isPending, error } / { mutate | mutateAsync }
// No custom wrapper types needed.
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Hook logic with mocked `api.ts` | Not possible — no frontend test runner exists |
| Manual | Each page after migration | Verify same data loads, mutations succeed, no console errors |
| Type check | All files compile | `tsc --noEmit` in `frontend/` |

**Gap**: Frontend has no test runner (`openspec/config.yaml` confirms pytest only for backend). Manual verification is the sole option until one is established.

## Migration Plan (Ordered)

1. **Install**: `npm install @tanstack/react-query` (v5) in `frontend/`
2. **Provider**: Add `QueryClientProvider` in `main.tsx` with default options
3. **Hooks**: Create all 4 hook files — these compile but aren't consumed yet
4. **Reservar.tsx**: Replace `useEffect`(services) and form submission with hooks
5. **Calendar.tsx**: Replace `useEffect`(busy-slots) with `useBusySlots` hook
6. **Admin.tsx**: Replace both `useEffect`s and all mutation handlers with hooks
7. **Cleanup**: Remove now-unused `api.ts` imports (optional, low priority)
8. **Verify**: `tsc --noEmit` + manual smoke test on all pages

Steps 4-6 are independent — can be parallelized.
