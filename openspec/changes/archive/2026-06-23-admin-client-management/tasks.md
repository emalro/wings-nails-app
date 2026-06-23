# Tasks: Admin Client Management

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 700-900 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Backend) → PR 2 (Frontend) |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend: model + migration + schemas + endpoints + tests | PR 1 | Base=main; self-contained backend change |
| 2 | Frontend: types + hooks + ClientSection + Admin wiring | PR 2 | Base=main; depends on PR 1 for API contract |

## Phase 1: Backend — Model + Migration + Schemas

- [x] 1.1 Add `ClienteTelefono` table model and `activo` to `Cliente` in `models.py`; drop `telefono` from `ClienteBase`
- [x] 1.2 Add `ClienteTelefonoRead/Create/Update` and `ClienteUpdate` schemas; rework `ClienteRead` with `telefonos: list`; keep `telefono` as input-only in `ClienteCreate`
- [x] 1.3 Add startup migration: copy existing `Cliente.telefono` → `ClienteTelefono(es_principal=True)` if CT table empty

## Phase 2: Backend — CRUD Endpoints

- [x] 2.1 Implement `GET/PATCH/DELETE /clients/{id}` and `POST /clients/{id}/reactivate`
- [x] 2.2 Implement phone sub-resource: `POST/PATCH/DELETE /clients/{id}/phones` and `GET /clients/{id}/appointments`
- [x] 2.3 Update `POST /clients` find-or-create to search `ClienteTelefono.telefono` first, then `Cliente.dni`
- [x] 2.4 Update `GET /clients/search` to join `ClienteTelefono`; add `incluir_inactivos` param to `GET /clients` and `/search`

## Phase 3: Backend — Tests

- [x] 3.1 Update existing tests: response shape changes (`telefono` → `telefonos`); find-or-create phone match via CT
- [x] 3.2 Add tests: get client with phones, add phone with normalization, remove non-principal phone, update phone label/principal toggle
- [x] 3.3 Add tests: soft-delete (204+activo=false), reactivate (200+activo=true), refuse delete of last phone (422)
- [x] 3.4 Add tests: search by phone fragment via CT, find-or-create by CT phone match, appointments endpoint ordering

## Phase 4: Frontend — API Layer + Hooks

- [x] 4.1 Update `ClienteRead` type in `api.ts` (telefonos+activo); add phone types and API functions (getClient, updateClient, deleteClient, reactivateClient, phone CRUD, getClientAppointments)
- [x] 4.2 Add hooks: `useClient`, `useUpdateClient`, `useDeleteClient`, `useReactivateClient`, `useClientsList` in `useClients.ts`; create `useClientPhones.ts` and `useClientAppointments.ts`; update `hooks/index.ts`

## Phase 5: Frontend — ClientSection Component

- [x] 5.1 Create `ClientSection.tsx`: search bar + "Mostrar inactivos" checkbox, client list table, detail/edit panel, PhoneManager (add/remove/edit labels + principal), AppointmentHistory (most recent first), soft-delete/reactivate with confirmation

## Phase 6: Frontend — Admin Integration

- [x] 6.1 Render `<ClientSection/>` in `Admin.tsx`; adapt `ManualAppointmentModal.tsx` to show primary phone from `telefonos[0]?.telefono`
- [x] 6.2 Update `REQUIREMENTS.md` §6 entity definition for multi-phone model *(reconciled at archive time — verify-report proves all implementation tasks complete; orchestrator explicitly requested this update as part of archive)*
