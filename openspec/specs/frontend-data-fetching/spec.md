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

### Verdict (original — stack-refactor-auth)

**No specification-level changes required.** The system behaves identically from the user's and API's perspective. This section exists solely to document that the refactor was intentionally reviewed for spec impact and none was found.

### Subsequent Extension (control-agenda-visual)

The `control-agenda-visual` change extended `useUpdateAppointmentStatus` with behavioral impact:
- Accepts optional `monto_recibido_en_caja` for the "Marcar como Asistido" flow
- Invalidates `['clients']` in addition to `['appointments']` after Asistido transition
- API function renamed from `updateAppointmentStatus` to `updateAppointment`

See FE-001 section below for full contract and scenarios.

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
| `PATCH /appointments/{id}` | `Admin.tsx` (via MarkAttendedModal) | `useUpdateAppointmentStatus` (extended) | `useMutation` (extended payload + `['clients']` invalidation) |
| `GET /clients/search?q=` | `ManualAppointmentModal.tsx` | `searchClients` via `useClientSearch` | `useQuery` |
| `POST /appointments` (extended con `estado_cita`) | `ManualAppointmentModal.tsx` | `useCreateManualAppointment` | `useMutation` |

---

## FE-002 — Hooks for Carga Manual de Citas

**Change source**: `carga-manual-citas` (archived 2026-06-22)

The following hooks and API function were added to support manual appointment creation with predictive client search.

### ADDED: API function `searchClients`

```typescript
export async function searchClients(q: string): Promise<ClienteRead[]> {
  const r = await api.get('/clients/search', { params: { q } })
  return r.data
}
```

- Calls `GET /clients/search?q={query}`
- Returns `ClienteRead[]` (up to 10 results)
- Empty array when `q.length < 2` or no matches

### ADDED: Hook `useClientSearch`

```typescript
function useClientSearch(query: string): {
  data: ClienteRead[] | undefined
  isLoading: boolean
  isError: boolean
}
```

- Uses `useQuery` with `queryKey: ['clients', 'search', query]`
- Fires only when `query.length >= 2` (leveraging `enabled`)
- Debounce 300ms managed by the component (not the hook)
- `staleTime: 30_000`

#### Escenario: Hook solo se ejecuta con >= 2 caracteres
- DADO `useClientSearch` con `query = "a"`
- THEN `enabled = false` — no se dispara fetch
- CUANDO `query` cambia a `"ma"`
- THEN `enabled = true` — se dispara `GET /clients/search?q=ma`

### ADDED: Hook `useCreateManualAppointment`

```typescript
function useCreateManualAppointment(): {
  mutate: (payload: CitaCreateConEstado) => void
  isPending: boolean
  error: Error | null
  data: CitaRead | undefined
}
```

- Uses `useMutation` over `POST /appointments`
- Type `CitaCreateConEstado` extends `CitaCreate` with optional `estado_cita`
- On success: invalidates `['appointments']` AND `['busy-slots']`
- On error (409): error is surfaced for inline display in ManualAppointmentModal

---

## Verification Criteria

1. Each hook compiles and exports the expected query key, fetcher, and mutation functions.
2. Each page renders the same data as before at initial mount.
3. Mutations trigger refetch of dependent queries (invalidation) matching prior manual refetch behavior.
4. No `useEffect`-based API calls remain in component files after migration completes.

---

## FE-001 — Hook useUpdateAppointmentStatus (extended)

**Change source**: `control-agenda-visual` (archived 2026-06-22)

The hook `useUpdateAppointmentStatus` was extended to support the "Marcar como Asistido" flow. It now accepts an optional `monto_recibido_en_caja` field for the PATCH payload.

### Contract

```typescript
interface UpdateAppointmentParams {
  appointmentId: number
  estado_cita: EstadoCita
  montoRecibidoEnCaja?: number  // ADDED: optional, for "Asistido" transition
}
```

### Behavior

- When called with `montoRecibidoEnCaja`, it sends `PATCH /appointments/{id}` with `{estado_cita, monto_recibido_en_caja}`.
- When called without `montoRecibidoEnCaja` (e.g., cancellations), it sends `PATCH /appointments/{id}` with `{estado_cita}` only — full backward compatibility.
- On success, it invalidates `['appointments']` AND `['clients']` (to reflect updated `cantidad_turnos_abonados`).

### API Layer

The underlying API function in `api.ts` was renamed from `updateAppointmentStatus` to `updateAppointment` to reflect the broader contract.

### Invalidation

| Query Key | When Invalidated |
|-----------|-----------------|
| `['appointments']` | After every successful PATCH |
| `['clients']` | After successful PATCH to `Asistido` (contador update) |

#### Escenario: Actualización con monto
- DADO el hook `useUpdateAppointmentStatus`
- CUANDO se llama con `{appointmentId: 5, estado_cita: "Asistido", monto_recibido_en_caja: 4500}`
- THEN envía `PATCH /appointments/5` con `{estado_cita: "Asistido", monto_recibido_en_caja: 4500}`
- Y al success invalida `['appointments']` y `['clients']`

#### Escenario: Actualización sin monto (compatibilidad)
- DADO el hook `useUpdateAppointmentStatus`
- CUANDO se llama con `{appointmentId: 3, estado_cita: "Cancelado_Cliente"}` (sin monto)
- THEN envía `PATCH /appointments/3` con `{estado_cita: "Cancelado_Cliente"}`
- Y funciona como antes (compatibilidad hacia atrás)
