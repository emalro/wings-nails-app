# Proposal: Admin Client Management

## Intent

Manicurista needs a dedicated admin section to manage clients — currently invisible beyond appointment search. No profile view, no edits, no phone management, no appointment history.

## Scope

### In Scope
- `ClienteTelefono` table (3NF), migrate existing `telefono`
- Remove `telefono` from `Cliente`; add `activo` flag for soft-delete
- Backend: `GET/PATCH/DELETE /clients/{id}`, phone CRUD sub-resource
- Update `POST /clients` find-or-create and `GET /clients/search` to query `ClienteTelefono`
- Admin UI: "Clientas" tab with list, detail, edit, phone mgmt, appointment history
- Migration: existing single phone → `ClienteTelefono` row with `principal=True`

### Out of Scope
- Authentication (3.B not implemented)
- Client creation in admin (handled in ManualAppointmentModal)
- Bulk import/export, label-based search

## Design Decisions

| Question | Decision |
|----------|----------|
| `telefono` field | Removed. All phones in `ClienteTelefono`, one `principal`. |
| Find-or-create | Searches `ClienteTelefono` exclusively. |
| Phone label | Free text (not enum). |
| Delete | Soft-delete via `activo`. Reactivation supported. |
| Detail view | Shows past + future appointments. |

## Capabilities

**New**: `admin-client-management` — Admin UI for client list, detail, edit, phones, appointment history.
**Modified**: `gestion-clientes` — multi-phone, update/delete, cross-table search, soft-delete (REQ-CLI-001–005).

## Approach

1. **Model**: `ClienteTelefono(id, id_cliente FK, telefono, etiqueta, principal)`. `Cliente.activo` added. `Cliente.telefono` removed.
2. **Migration**: On startup if `ClienteTelefono` empty, copy existing `telefono` → `ClienteTelefono` with `principal=True`.
3. **Endpoints**: `GET/PATCH/DELETE /clients/{id}`, `POST/GET/DELETE /clients/{id}/phones`, search/find-or-create join `ClienteTelefono`.
4. **Frontend**: New "Clientas" tab — searchable list, detail/edit panel, phone add/remove, appointment timeline.

## Affected Areas

| Area | Impact |
|------|--------|
| `backend/app/models.py` | New `ClienteTelefono`, amend `Cliente` |
| `backend/app/schemas.py` | New phone schemas |
| `backend/app/main.py` | New CRUD/phone/search endpoints |
| `backend/tests/test_api.py` | Tests for update, delete, phones, search |
| `frontend/src/api.ts` | New client + phone API functions |
| `frontend/src/hooks/` | New hooks for client CRUD + phones |
| `frontend/src/pages/Admin.tsx` | New "Clientas" section |
| `REQUIREMENTS.md` | Update §6 entity definition |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Data loss during migration | Low | Test on dev data, write-verify |
| Find-or-create misses existing client | Low | Update match logic to `ClienteTelefono` |
| Search perf with join | Low | Small SQLite dataset, index on telefono |
| Admin panel complexity | Med | Self-contained component with own state |

## Rollback Plan

Revert files to previous commit. Drop `ClienteTelefono`, restore `telefono` on `Cliente`, remove `activo`. Migration script repopulates `telefono` from first `ClienteTelefono` with `principal=True`.

## Success Criteria

- [ ] All existing client tests pass after migration
- [ ] `ClienteTelefono` stores phones with `principal` flag
- [ ] Admin can view, edit, soft-delete, reactivate clients
- [ ] Admin can add/remove phones with labels
- [ ] Client detail shows appointment history
- [ ] Search & find-or-create work across all phones
