# Design: Admin Client Management

## Technical Approach

Multi-phone normalization (3NF): extract `telefono` from `Cliente` into a `ClienteTelefono` table with FK, `es_principal` flag, and optional `etiqueta`. Add `activo` for soft-delete. New CRUD endpoints for client detail/edit/delete/reactivate plus phone sub-resources. Admin UI: self-contained `ClientSection` component in Admin.tsx with search list, detail/edit panel, phone manager, and appointment history. Existing find-or-create and search join `ClienteTelefono`.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **Model**: new table vs JSON array | JSON loses FK integrity and searchability | `ClienteTelefono` table with FK + index |
| **Migration**: startup script vs migration tool | Alembic adds complexity for single-dev SQLite | Startup script: if `ClienteTelefono` empty, copy `Cliente.telefono` → CT row with `es_principal=True` |
| **Drop telefono column** | SQLite ALTER TABLE DROP COLUMN available since 3.35.0; safe but risky | Keep column on model as unused (exclude from `ClienteBase`), let SQLModel ignore it; drop in separate cleanup PR |
| **Soft delete**: `activo` flag vs separate table | Flag simpler, FK to appointments stays intact | `activo: bool = True`; appointments reference client FK and remain readable even when client is inactive |
| **Search strategy**: UNION vs subquery with `IN` | UNION deduplicates implicitly; subquery with `id_cliente IN (SELECT ...)` works across both name and phone without DISTINCT | Subquery approach: `Cliente.id.in_(select(ClienteTelefono.id_cliente).where(...))` — avoids join dedup issues |
| **Client detail response**: embed appointments vs separate endpoint | Embedded makes response heavier; separate keeps `GET /clients/{id}` focused | `GET /clients/{id}` returns client + phones. Appointment history via `GET /clients/{id}/appointments` — cleaner separation |
| **Admin UI**: standalone component vs inline | Component is testable, reusable, keeps Admin.tsx clean | `ClientSection` component; Admin.tsx only imports and places it |

## Data Model

### ClienteTelefono (new)

```python
class ClienteTelefono(SQLModel, table=True):
    __table_args__ = (Index("idx_ct_telefono", "telefono"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    id_cliente: int = Field(foreign_key="cliente.id")
    telefono: str                        # digits-only, normalized
    etiqueta: Optional[str] = None       # free text, max 100
    es_principal: bool = False
```

### Cliente (modified)

`ClienteBase` loses `telefono`, gains `activo: bool = True`. Index `idx_cliente_search` drops `telefono` column.

```python
class ClienteBase(SQLModel):
    nombre: str
    apellido: str
    dni: str = Field(unique=True)
    activo: bool = True                  # new

# ClienteCreate keeps telefono for new client input
class ClienteCreate(BaseModel):
    nombre: str
    apellido: str
    dni: str
    telefono: str                        # input-only; find-or-create migrates to CT
    # ... validator for telefono ...

# ClienteRead BREAKS inheritance from ClienteCreate
# — no telefono field, instead has telefonos list
class ClienteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nombre: str
    apellido: str
    dni: str
    activo: bool
    fecha_creacion: datetime
    cantidad_turnos_tomados: int
    cantidad_turnos_abonados: int
    cantidad_turnos_cancelados_vencidos: int
    telefonos: list[ClienteTelefonoRead]  # replaces single telefono
```

## API Contracts

| Method | Path | Request | Response | Notes |
|--------|------|---------|----------|-------|
| `GET` | `/clients` | `?incluir_inactivos=false` | `[ClienteRead]` | Returns active clients by default; pass `incluir_inactivos=true` to include soft-deleted |
| `GET` | `/clients/{id}` | — | `ClienteRead` with `telefonos: []` | 404 if not found |
| `PATCH` | `/clients/{id}` | `{nombre?, apellido?, dni?}` | `ClienteRead` | 404 if not found |
| `DELETE` | `/clients/{id}` | — | `204` | Sets `activo=False` |
| `POST` | `/clients/{id}/reactivate` | — | `200` with `ClienteRead` | Sets `activo=True` |
| `POST` | `/clients/{id}/phones` | `{telefono, etiqueta?}` | `201` with `ClienteTelefonoRead` | First phone auto-set to `es_principal=True` |
| `DELETE` | `/clients/{id}/phones/{phone_id}` | — | `204` | Refuse if only phone |
| `PATCH` | `/clients/{id}/phones/{phone_id}` | `{etiqueta?, es_principal?}` | `200` with `ClienteTelefonoRead` | Setting principal unsets others |
| `GET` | `/clients/search` | `q`, `incluir_inactivos?` | `[ClienteRead]` | Searches across CT.telefono too |
| `POST` | `/clients` | `ClienteCreate` | `201` new / `200` existing | Find-or-create checks CT.telefono |
| `GET` | `/clients/{id}/appointments` | — | `[CitaRead]` | Ordered by date desc |

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/app/models.py` | Modify | Remove `telefono` from `ClienteBase`; add `activo`; add `ClienteTelefono` table |
| `backend/app/schemas.py` | Modify | Drop `telefono` from `ClienteRead`; add `telefonos: list`; add `ClienteTelefonoRead/Create/Update`; add `ClienteUpdate` |
| `backend/app/main.py` | Modify | Add CRUD + phone endpoints; update find-or-create + search; add migration in `lifespan` |
| `backend/tests/test_api.py` | Modify | Update existing tests for multi-phone; add ~15 new tests for admin CP |
| `frontend/src/api.ts` | Modify | Update `ClienteRead` type (telefonos+activo); add admin client/phone API functions |
| `frontend/src/hooks/useClients.ts` | Modify | Add `useClient`, `useUpdateClient`, `useDeleteClient`, `useReactivateClient`, `useClientsList` |
| `frontend/src/hooks/useClientPhones.ts` | Create | `useAddPhone`, `useUpdatePhone`, `useDeletePhone` |
| `frontend/src/hooks/useClientAppointments.ts` | Create | `useClientAppointments` for appointment history |
| `frontend/src/hooks/index.ts` | Modify | Export new hooks |
| `frontend/src/components/ClientSection.tsx` | Create | Full client management UI (list, search, detail, edit, phones, history, soft-delete) |
| `frontend/src/pages/Admin.tsx` | Modify | Import and render `<ClientSection/>` |
| `frontend/src/components/ManualAppointmentModal.tsx` | Modify | Adapt dropdown to show primary phone from `telefonos` array |
| `REQUIREMENTS.md` | Modify | Update entity definition (§6) for multi-phone |

## Frontend Component Architecture (ClientSection.tsx)

```
ClientSection
├── SearchBar + "Mostrar inactivos" checkbox
├── Client list (table: nombre, apellido, DNI, primary phone, counters)
├── ClientDetail (expandable/modal)
│   ├── Edit form (nombre, apellido, dni)
│   ├── PhoneManager
│   │   ├── Phone list with labels, principal badge, edit/delete
│   │   └── Add phone form
│   ├── AppointmentHistory
│   │   └── Chronological list with estado, fecha, monto
│   └── Action buttons: soft-delete / reactivate with confirmation
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Integration | Multi-phone CRUD | `POST /clients/{id}/phones` → verify `ClienteTelefono` rows, principal toggle, label update, delete |
| Integration | Soft-delete + reactivate | `DELETE /clients/{id}` → `activo=False`; reactivate restores; past appointments still visible |
| Integration | Find-or-create with CT | `POST /clients` with existing phone in `ClienteTelefono` → `200` with existing |
| Integration | Search across CT | `GET /clients/search?q={phone}` returns client; search with `incluir_inactivos` toggle |
| Integration | Existing test compatibility | All existing client tests pass with CT migration seed |
| Unit (frontend) | Component rendering | Manual verification during apply (no JS test runner yet) |

## Migration / Rollout

**Data migration** (in `lifespan`):
1. If `ClienteTelefono` table has 0 rows AND any row in `Cliente` has non-empty `telefono`:
   - For each `Cliente`: create `ClienteTelefono(telefono=cliente.telefono, es_principal=True)`
2. Set `activo=True` for all existing `Cliente` rows (SQLModel default handles new rows)

**Rollback**: revert all changed files. Re-add `telefono` to `ClienteBase`. Migration reverse: populate `Cliente.telefono` from first `es_principal` row. Drop `ClienteTelefono`, remove `activo`.

**PR sizing concern**: ~600+ lines across backend + frontend. Recommend chained PRs: (1) model + migration + backend endpoints, (2) frontend API + hooks, (3) ClientSection component + Admin integration.
