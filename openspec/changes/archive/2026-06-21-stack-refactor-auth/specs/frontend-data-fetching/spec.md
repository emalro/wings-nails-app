# Delta Spec: Stack Refactor — TanStack Query for API Layer

**Change**: `stack-refactor-auth`
**Domain**: `frontend-data-fetching`
**Spec Type**: Delta (refactor — zero behavioral impact)
**Proposal Ref**: `openspec/changes/stack-refactor-auth/proposal.md`

---

## Context

This delta spec documents a **pure client-side refactor** of the data-fetching layer in the frontend application. The current pattern uses `useState` + `useEffect` + raw `axios` calls directly in components (`Reservar.tsx`, `Admin.tsx`, `Calendar.tsx`), causing:

- Redundant fetches on every mount
- Scattered loading/error state across components
- No caching, deduplication, or stale-while-revalidate semantics

The refactor replaces this with **TanStack Query (React Query v5)** hooks that wrap the same underlying HTTP calls. The API contract with the backend is **unchanged** — same endpoints, same request/response shapes, same error codes.

### Behavioral Impact Assessment

| Dimension | Assessment |
|-----------|------------|
| API contract | **Identical** — no endpoint, payload, or response changes |
| User-visible behavior | **Identical** — same data, same loading/error presentation (via different internal state mechanism) |
| Network behavior | **Improved** — caching, deduplication, stale-while-revalidate reduce redundant requests |
| Error handling | **Equivalent** — TanStack Query error states mapped to same UI presentation |
| Loading states | **Equivalent** — TanStack Query `isLoading`/`isFetching` replaces manual `useState<boolean>` |

### Verdict

**No specification-level changes required.** The system behaves identically from the user's and API's perspective. This section exists solely to document that the refactor was intentionally reviewed for spec impact and none was found.

---

## ADDED Requirements

*None — no new capabilities or behaviors are introduced.*

---

## MODIFIED Requirements

*None — no existing requirement changes its behavior, contract, or acceptance criteria.*

---

## REMOVED Requirements

*None — no existing requirements are removed.*

---

## RENAMED Requirements

*None — no existing requirements are renamed.*

---

## Refactor Mapping (Informative)

This section maps each existing API interaction to its new hook, confirming behavioral equivalence. It is **not** normative — it exists to verify completeness.

| Endpoint | Existing Caller | New Hook Proxy | Hook Type |
|----------|----------------|----------------|-----------|
| `GET /services` | `Reservar.tsx` | `useServices` | `useQuery` |
| `GET /appointments` | `Admin.tsx` | `useAppointments` | `useQuery` |
| `GET /busy-slots` | `Calendar.tsx` | `useBusySlots` | `useQuery` |
| `POST /clients` | `Reservar.tsx` | `useCreateClient` | `useMutation` |
| `POST /appointments` | `Reservar.tsx` | `useCreateAppointment` | `useMutation` |
| `POST /services` | `Admin.tsx` | `useCreateService` | `useMutation` |
| `PUT /services/:id` | `Admin.tsx` | `useUpdateService` | `useMutation` |
| `PUT /appointments/:id/status` | `Admin.tsx` | `useUpdateAppointmentStatus` | `useMutation` |

---

## Verification Criteria

1. Each hook compiles and exports the expected query key, fetcher, and mutation functions.
2. Each page renders the same data as before at initial mount.
3. Mutations trigger refetch of dependent queries (invalidation) matching prior manual refetch behavior.
4. No `useEffect`-based API calls remain in component files after migration completes.
