# Proposal: Stack Refactor — TanStack Query for API Layer

## Intent

Replace manual `useEffect` + `axios` data fetching with TanStack Query (React Query) to eliminate boilerplate, add caching, stale-while-revalidate, and centralized loading/error state. The current pattern uses raw `useState` + `useEffect` per component, causing redundant fetches on mount and scattered state management across `Reservar.tsx`, `Admin.tsx`, and `Calendar.tsx`.

## Scope

### In Scope
- Install `@tanstack/react-query`
- Create `QueryClientProvider` wrapper in `main.tsx`
- Create custom hooks: `useServices`, `useAppointments`, `useBusySlots`, `useCreateClient`, `useCreateAppointment`, `useCreateService`, `useUpdateService`, `useUpdateAppointmentStatus`
- Refactor `Reservar.tsx` to use hooks
- Refactor `Admin.tsx` to use hooks
- Refactor `Calendar.tsx` to use hooks
- Keep `api.ts` as underlying transport or inline into hooks

### Out of Scope
- Authentication (JWT + bcrypt — deferred to separate change)
- TanStack Router (deferred — `react-router-dom` stays)
- Backend changes (all endpoints remain unchanged)
- UI/styling changes
- New pages or components
- Frontend tests (no test runner exists yet)

## Capabilities

> Pure implementation refactor — no spec-level behavior changes. The API contract is identical; only client-side fetching changes.

### New Capabilities
None

### Modified Capabilities
None

## Approach

Incremental migration: add hooks one domain at a time, keep old code working during transition.

1. Install `@tanstack/react-query`
2. Add `QueryClientProvider` at app root in `main.tsx`
3. Create `hooks/` directory with domain-specific hook files
4. Replace `useEffect` + `useState` with `useQuery` / `useMutation` in each component
5. Remove unused `api.ts` exports last

Each hook wraps existing axios calls. No backend changes required.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/package.json` | Modified | Add `@tanstack/react-query` |
| `frontend/src/main.tsx` | Modified | Wrap app with `QueryClientProvider` |
| `frontend/src/hooks/` | **New** | Custom hook files per domain |
| `frontend/src/api.ts` | Modified | May inline into hooks or keep as transport |
| `frontend/src/pages/Reservar.tsx` | Modified | Replace `useEffect` with `useQuery`/`useMutation` |
| `frontend/src/pages/Admin.tsx` | Modified | Replace `useEffect` with `useQuery`/`useMutation` |
| `frontend/src/components/Calendar.tsx` | Modified | Replace `useEffect` with `useQuery` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Regression in data display | Low | One hook per endpoint; verify each page after migration |
| TanStack Query version compatibility | Low | Check v5.x works with React 18 before installing |

## Rollback Plan

Revert `package.json` change and delete `hooks/` — `api.ts` + `useEffect` patterns remain intact since migration is incremental and non-destructive.

## Dependencies

- `@tanstack/react-query` v5.x

## Success Criteria

- [ ] All 8 API calls (`listServices`, `createClient`, `createAppointment`, `getBusySlots`, `listAppointments`, `createService`, `updateService`, `updateAppointmentStatus`) work through TanStack Query hooks
- [ ] Reservar page loads services and submits appointments without regression
- [ ] Admin page loads/manages services and appointments without regression
- [ ] Calendar shows busy slots without regression
- [ ] No `useEffect`-based API calls remain in components
