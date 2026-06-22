# Tasks: Carga Manual de Citas + Buscador Predictivo

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~420 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr-default |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

## Layer 1: Backend schema + index

- [x] **T1.1** — Add `estado_cita: Optional[EstadoCita] = None` and `metodo_pago_sena: Optional[str] = None` to `CitaCreate` in schemas.py
  - Files: `backend/app/schemas.py`
  - Deps: None
  - AC: `CitaCreate` accepts both fields as optional; existing POSTs without them still pass
  - Est: ~3 lines

- [x] **T1.2** — Add `from sqlmodel import Index` and `__table_args__` composite index `idx_cliente_search` on `(nombre, apellido, telefono)` to `Cliente`
  - Files: `backend/app/models.py`
  - Deps: None
  - AC: Index creates on next app start; migrations not required (SQLModel auto-create)
  - Est: ~4 lines

## Layer 2: Backend endpoint + logic

- [x] **T2.1** — Implement `GET /clients/search?q=` in main.py with `ilike` matching on nombre/apellido/telefono, min 2 chars → empty list, max 10 results, response `list[ClienteRead]`
  - Files: `backend/app/main.py`
  - Deps: T1.2 (index exists, though optional for correctness)
  - AC: Search by "mar" matches "Maria García"; search by "3415" matches by phone; "xyz" returns []; "a" returns []
  - Est: ~10 lines

- [x] **T2.2** — In `create_appointment`, read `appointment.estado_cita` and pass it to `Cita(...)` constructor when provided, falling back to model default `Pendiente` when None
  - Files: `backend/app/main.py`
  - Deps: T1.1 (schema has the field)
  - AC: POST with `estado_cita: "Confirmado"` creates confirmed cita; POST without it creates Pendiente; conflict detection still works
  - Est: ~3 lines

## Layer 3: Backend tests

- [x] **T3.1** — Write tests for client search: by nombre, apellido, telefono, partial match, empty results, < 2 chars
  - Files: `backend/tests/test_api.py`
  - Deps: T2.1 (endpoint exists)
  - AC: 5+ test functions covering all CMC-001 scenarios
  - Est: ~65 lines

- [x] **T3.2** — Write tests for manual creation: Confirmado via POST, default Pendiente via POST without estado_cita, conflict 409, Efectivo pago via metodo_pago_sena
  - Files: `backend/tests/test_api.py`
  - Deps: T2.2 (endpoint accepts estado_cita)
  - AC: 3+ test functions covering CMC-002 scenarios
  - Est: ~55 lines

## Layer 4: Frontend API + hooks

- [x] **T4.1** — Add `searchClients(q: string): Promise<ClienteRead[]>` to api.ts
  - Files: `frontend/src/api.ts`
  - Deps: T2.1 (endpoint exists)
  - AC: Calls `GET /clients/search?q=` and returns typed result
  - Est: ~5 lines

- [x] **T4.2** — Create `useClientSearch.ts` hook with `useQuery`, queryKey `['clients', 'search', query]`, `enabled: query.length >= 2`, staleTime 30s
  - Files: `frontend/src/hooks/useClientSearch.ts`
  - Deps: T4.1 (API function)
  - AC: Hook fires only when query >= 2 chars; returns `{ data, isLoading, isError }`
  - Est: ~18 lines

- [x] **T4.3** — Create `useCreateManualAppointment.ts` mutation hook with `useMutation` on `createAppointment`, invalidates `['appointments']` on success
  - Files: `frontend/src/hooks/useCreateManualAppointment.ts`
  - Deps: T1.1 (schema supports estado_cita)
  - AC: Mutation sends POST with payload; on success refreshes appointment list
  - Est: ~18 lines

- [x] **T4.4** — Export both hooks from hooks/index.ts barrel
  - Files: `frontend/src/hooks/index.ts`
  - Deps: T4.2, T4.3 (hooks exist)
  - AC: `import { useClientSearch, useCreateManualAppointment } from '../hooks'` works
  - Est: ~2 lines

## Layer 5: Frontend component

- [x] **T5.1** — Build `ManualAppointmentModal.tsx` with: ClientSearch (debounced input + dropdown + "Crear nueva ficha"), ServiceSelector (useServices), DateTimePicker (date+time inputs), StatusToggle (Pendiente/Confirmado), PaymentToggle (Transferencia/Efectivo), Submit button (disabled until complete), error display for 409
  - Files: `frontend/src/components/ManualAppointmentModal.tsx`
  - Deps: T4.4 (hooks available), T4.1 (searchClients available), T2.2 (backend accepts estado_cita)
  - AC: All CMC-003, 004, 005 scenarios covered; 409 shows inline error; submit is disabled until valid
  - Est: ~180 lines

- [x] **T5.2** — Add `.manual-modal`, `.search-dropdown`, `.client-search-input`, `.quick-client-form` styles to styles.css (overlay, dropdown positioning, search input styling, inline form)
  - Files: `frontend/src/styles.css`
  - Deps: T5.1 (component exists to style)
  - AC: Modal renders as overlay with backdrop; dropdown appears below search input; styles match existing design system
  - Est: ~35 lines

## Layer 6: Frontend integration

- [x] **T6.1** — Add "Cargar Turno Manual" button above CalendarView in Admin.tsx, `showManualModal` state, conditional render of ManualAppointmentModal
  - Files: `frontend/src/pages/Admin.tsx`
  - Deps: T5.1 (modal component exists)
  - AC: Button visible above calendar; click opens modal; close restores calendar view
  - Est: ~15 lines

- [x] **T6.2** — Wire `onAppointmentCreated` callback: on modal success, call `refetch()` on appointments query to refresh calendar
  - Files: `frontend/src/pages/Admin.tsx`
  - Deps: T6.1 (modal integrated)
  - AC: After manual creation, calendar shows new appointment without manual refresh
  - Est: ~5 lines
