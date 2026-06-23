# Design: Client Uniqueness

## Technical Approach

Find-or-create on `POST /clients`: normalize phone to digits, search by phone first then DNI. Existing match → 200. No match → create → 201. Pydantic `field_validator` rejects malformed Argentine phone numbers before they reach business logic. DB-level UNIQUE on DNI as safety net against race conditions.

## Architecture Decisions

### Decision: Phone Normalization as Module-Level Function

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Inline in endpoint | Duplicated across validator and search | ❌ |
| Utility class/mixin | Over-engineered for one function | ❌ |
| Standalone `normalize_phone()` in `schemas.py` | Visible to both; `main.py` already imports schemas | ✅ |

**Rationale**: Single function consumed by both the Pydantic validator (schema layer) and the endpoint (business logic). No new imports needed — `schemas.py` is already imported in `main.py`.

### Decision: Find-or-Create Priority: Phone > DNI

| Option | Tradeoff | Decision |
|--------|----------|----------|
| DNI first | Ignores business flow: admin identifies client by phone | ❌ |
| Phone first | Matches real-world workflow; `dni` is secondary dedup | ✅ |

**Rationale**: Per REQ-CLI-004 Scenario 4, if incoming phone matches client A and incoming DNI matches client B, phone wins. The business assumes one phone = one client.

### Decision: DNI as DB UNIQUE, Not App-Level Only

| Option | Tradeoff | Decision |
|--------|----------|----------|
| App-level dedup only | Race on concurrent requests could create duplicates | ❌ |
| DB UNIQUE constraint | Catches the edge case find-or-create misses | ✅ |

**Rationale**: Find-or-create prevents 99% of conflicts, but the UNIQUE index catches concurrent-write races. SQLite enforces this; SQLModel handles it.

## Data Flow

```
POST /clients payload
        │
        ▼
ClienteCreate.validate()
        │  │
        │  └── field_validator("telefono")
        │        • normalize_phone() → strip non-digits
        │        • reject letters / special chars / <7 digits
        ▼
main.py: create_client()
        │
        ├─ phone = normalize_phone(payload.telefono)
        ├─ search by phone ─────────────► found? ──► 200
        ├─ search by dni ───────────────► found? ──► 200
        └─ INSERT new Cliente ──────────► 201
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/app/models.py` | Modify | +`dni: str = Field(unique=True)` on `ClienteBase` |
| `backend/app/schemas.py` | Modify | +`dni` on `ClienteCreate`/`ClienteRead`; +`normalize_phone()` fn; +`field_validator("telefono")` |
| `backend/app/main.py` | Modify | Replace blind insert with find-or-create in `POST /clients` |

## Interfaces / Contracts

```python
# ── schemas.py ──

import re

def normalize_phone(phone: str) -> str:
    """Strip everything except digits. Reusable in validation AND search."""
    return re.sub(r"\D", "", phone)

class ClienteCreate(BaseModel):
    nombre: str
    apellido: str
    dni: str
    telefono: str

    @field_validator("telefono")
    @classmethod
    def validate_telefono(cls, v: str) -> str:
        clean = re.sub(r"[^\d\s\-\+\(\)]", "", v)
        if clean != v:
            raise ValueError("Teléfono: caracteres no válidos")
        digits = normalize_phone(v)
        if len(digits) < 7:
            raise ValueError("Teléfono: debe tener al menos 7 dígitos")
        return digits

class ClienteRead(ClienteCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    fecha_creacion: datetime
    # ... existing counter fields


# ── main.py ── (inside create_client)

def create_client(client: ClienteCreate, session: Session = Depends(get_session)):
    normalized_phone = normalize_phone(client.telefono)

    # 1. Search by phone
    existing = session.exec(
        select(Cliente).where(Cliente.telefono == normalized_phone)
    ).first()
    if existing:
        return existing  # FastAPI defaults to 200

    # 2. Search by DNI
    existing = session.exec(
        select(Cliente).where(Cliente.dni == client.dni)
    ).first()
    if existing:
        return existing

    # 3. Create new
    data = client.model_dump()
    data["telefono"] = normalized_phone
    db_client = Cliente(**data)
    session.add(db_client)
    session.commit()
    session.refresh(db_client)
    return JSONResponse(status_code=201, content=ClienteRead.model_validate(db_client).model_dump())
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Integration | REQ-CLI-001 (DNI) | POST with/without DNI; duplicate DNI returns 200 |
| Integration | REQ-CLI-002 (Phone valid.) | Valid formats accepted; letters / <7 digits → 422 |
| Integration | REQ-CLI-003 (Normalize) | Stored digits match normalized input; search by formatted phone finds stored record |
| Integration | REQ-CLI-004 (Find-or-create) | Phone match → 200; DNI match → 200; no match → 201; phone priority over DNI |
| Integration | REQ-CLI-005 (Required) | Each missing field → 422 |

### Test Payload Updates (7 tests affected)
- All `POST /clients` payloads gain `"dni": "XXXXXXXX"` field
- First-creation calls change from `assert 200` to `assert 201`
- Affected helpers: `_create_test_client_and_appointment`, `_new_test_client_service`, `test_busy_slots_and_conflict_detection`

## Migration / Rollout

SQLModel creates the `dni` column on fresh tables. For existing SQLite databases: column must be added manually (`ALTER TABLE cliente ADD COLUMN dni VARCHAR`) or the DB file deleted for recreation — acceptable at this development stage. Existing rows have NULL DNI; backfill is out of scope.

## Open Questions

- [ ] Should the search by DNI use the DNI as-is (original input) or also normalize? Decision: use as-is — DNI has no phone-like formatting.
