# Design: Carga Manual de Citas + Buscador Predictivo

## Technical Approach

Extend existing `POST /appointments` with optional `estado_cita`, add `GET /clients/search?q=` for predictive search, and build a self-contained `ManualAppointmentModal` that keeps the Admin page clean. Backend-first: minimal schema changes, zero model mutations, reuse all conflict detection logic.

## Architecture Decisions

### Decision: Schema extension over new endpoint

| Option | Tradeoff | Decision |
|--------|----------|----------|
| New `POST /manual-appointments` | Duplicates creation logic, extra router | Rejected |
| Extend `CitaCreate` with optional `estado_cita` | One field, no breaking change | **Chosen** |
| **Rationale**: `estado_cita` default is already `Pendiente` at the model level. Passing `None` from the schema leaves the model default active — zero BP for web flow. |

### Decision: `ClienteRead` for search response

| Option | Tradeoff | Decision |
|--------|----------|----------|
| New `ClienteSearchRead` (id, nombre, apellido, telefono only) | Duplicate schema, mapping overhead | Rejected |
| Reuse `ClienteRead` | Extra fields (counters, fecha) are ignored by frontend | **Chosen** |
| **Rationale**: `ClienteRead` already has `from_attributes=True`. Same schema for `/clients` and `/clients/search`, less code, no mapping needed. |

### Decision: Self-contained modal (not inline in Admin.tsx)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Inline form in Admin.tsx | 622-line file grows further, hard to maintain | Rejected |
| `ManualAppointmentModal.tsx` + 2 hooks | Clean separation, testable in isolation | **Chosen** |
| **Rationale**: Admin.tsx is already large. A self-contained modal with its own local state prevents bloat and follows the pattern set by `AppointmentModal`. |

## Data Flow

```
Admin.tsx
  │  [Click "Cargar Turno Manual"]
  ▼
ManualAppointmentModal
  │
  ├── ClientSearch (debounced 300ms, min 2 chars)
  │     ├── GET /clients/search?q= → dropdown results
  │     └── No results → QuickClientForm → POST /clients
  │
  ├── ServiceSelector (useServices hook)
  ├── DateTimePicker (date + time inputs)
  ├── StatusToggle (Pendiente / Confirmado)
  ├── PaymentToggle (Transferencia / Efectivo)
  │
  └── Submit → POST /appointments {..., estado_cita?, metodo_pago_sena?}
        │
        ├── 200 → invalidate ['appointments'] query → close modal
        └── 409 → show "El horario elegido ya está ocupado" → keep open
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/app/schemas.py` | Modify | Add `estado_cita: Optional[EstadoCita] = None` to `CitaCreate` |
| `backend/app/models.py` | Modify | Add `__table_args__` with composite index `idx_cliente_search` on `(nombre, apellido, telefono)` |
| `backend/app/main.py` | Modify | Add `GET /clients/search` endpoint; set `estado_cita` on Cita in `create_appointment` when provided |
| `backend/tests/test_api.py` | Modify | Add tests: search by name, phone, empty, short query; manual creation Confirmado, default Pendiente, conflict |
| `frontend/src/api.ts` | Modify | Add `searchClients(q)` API function |
| `frontend/src/hooks/useClientSearch.ts` | New | Debounced search hook via `useQuery`, enabled when `query.length >= 2` |
| `frontend/src/hooks/useCreateManualAppointment.ts` | New | Mutation hook wrapping `createAppointment`, invalidates `['appointments']` |
| `frontend/src/components/ManualAppointmentModal.tsx` | New | Multi-step modal with ClientSearch, ServiceSelector, DateTimePicker, toggles, submit |
| `frontend/src/pages/Admin.tsx` | Modify | Add "Cargar Turno Manual" button + `showManualModal` state + `onAppointmentCreated` callback |
| `frontend/src/styles.css` | Modify | Add `.manual-modal`, `.search-dropdown`, `.client-search-input` styles |

## Interfaces / Contracts

### Backend

```python
# schemas.py — CitaCreate extended
class CitaCreate(BaseModel):
    id_cliente: int
    fecha_hora_cita: datetime
    precio_historico_cobrado: float
    sena_historica_pagada: float
    metodo_pago_sena: Optional[str] = "Transferencia"
    estado_cita: Optional[EstadoCita] = None  # NEW
    servicios: List[CitaServicioCreate]
```

```python
# main.py — new endpoint
@app.get("/clients/search", response_model=list[ClienteRead])
def search_clients(q: str = Query(min_length=0), session: Session = Depends(get_session)):
    if len(q) < 2:
        return []
    statement = select(Cliente).where(
        Cliente.nombre.ilike(f"%{q}%") |
        Cliente.apellido.ilike(f"%{q}%") |
        Cliente.telefono.ilike(f"%{q}%")
    ).limit(10)
    return session.exec(statement).all()
```

### Frontend

```typescript
// api.ts
export async function searchClients(q: string): Promise<ClienteRead[]> {
  const r = await api.get('/clients/search', { params: { q } })
  return r.data
}
```

```typescript
// useClientSearch.ts
function useClientSearch(query: string) {
  return useQuery({
    queryKey: ['clients', 'search', query],
    queryFn: () => searchClients(query),
    enabled: query.length >= 2,
    staleTime: 30_000,
  })
}
```

```typescript
// ManualAppointmentModal props
interface ManualAppointmentModalProps {
  isOpen: boolean
  onClose: () => void
  onAppointmentCreated: () => void  // triggers calendar refresh
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Integration (API) | Search by nombre, apellido, teléfono, partial match, no results, < 2 chars | `TestClient` — reuse `_create_test_client_and_appointment` pattern |
| Integration (API) | Manual creation with Confirmado, default Pendiente, conflict 409 | `TestClient` — POST with/without `estado_cita`, assert response and busy_slots |
| Unit (Frontend) | `useClientSearch` enabled/disabled by query length | Mock `searchClients`, assert queryFn called only when >= 2 |
| E2E | Full modal flow: search → select → create → refresh calendar | Manual or Playwright (future) |

## Migration / Rollout

No migration required. Schema change is additive (optional field). DB index added via SQLModel metadata — creates on next app start. Existing appointments retain their `Pendiente` default.

## Correcciones Post-Revisión

| # | Issue | Fix |
|---|-------|-----|
| 1 | `@router.get` usado en vez de `@app.get` | Cambiado a `@app.get` — `main.py` define `app`, no `router` |
| 2 | Barrel export faltante | Agregar `export { useClientSearch } from './useClientSearch'` y `export { useCreateManualAppointment } from './useCreateManualAppointment'` en `hooks/index.ts` |
| 3 | `Index` no importado en `models.py` | Agregar `from sqlmodel import Field, SQLModel, Relationship, Index` en `models.py` |
| 4 | Índice no óptimo para búsqueda solo por teléfono | Para <5000 registros el índice compuesto funciona; si escala, agregar índice separado en `telefono` |

## Open Questions

- [ ] None — all decisions are scoped and unambiguous.

