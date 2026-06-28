# Design: Argentina Timezone Display — Serializer Fix

**Change**: `tz-argentina-display`
**Status**: Design
**Spec**: `openspec/changes/tz-argentina-display/specs/datetime-coordination/spec.md` (REQ-DCO-004, REQ-DCO-005)
**Proposal**: `openspec/changes/tz-argentina-display/proposal.md`
**Prior change continuity**: `openspec/changes/timezone-fix/design.md` (intent was correct; serializer was never wired in)

## Technical Approach

Add a Pydantic v2 `@field_serializer` to the three response fields that currently emit `Z` for aware datetimes, plus a defensive `@field_validator` on the two input fields to keep POST/PATCH round-trips symmetric. The single endpoint that bypasses `response_model` (`get_busy_slots`) gets explicit `naive()` wraps. One new regression test exercises the tz-aware path that the previous test gap missed.

This matches the original `timezone-fix` design intent and the proposal's Approach 1. It is a pure serialization fix — no DB migration, no frontend change, no domain model change.

## Architecture Decisions

### Decision: Field-level `@field_serializer` (not global base class)

| Aspect | Detail |
|---|---|
| **Choice** | Add `_strip_tz(v: datetime) -> str` helper at the top of `backend/app/schemas.py`. Decorate `CitaRead.fecha_hora_cita`, `CitaRead.fecha_registro_cita`, and `ClienteRead.fecha_creacion` with `@field_serializer(...)` calling it. |
| **Alternatives considered** | (2) Global `BaseReadModel` with class-level serializer; (3) dict-build-time normalization; (4) response-rewriting middleware. |
| **Rationale** | The bug surface is exactly 3 fields. A base-class abstraction would commit every future `datetime` to the naive convention (a hidden cost the project hasn't earned). Dict-build-time normalization is fragile — `CitaRead` re-validates the response and may re-introduce `Z` depending on Pydantic default_tz config. Middleware breaks the OpenAPI schema (explicitly rejected by `timezone-fix/design.md` line 14). Field-serializers run during model serialization, which is the only guaranteed-correct spot for this fix. |

### Decision: `get_busy_slots` — explicit `naive()` in the endpoint

| Aspect | Detail |
|---|---|
| **Choice** | Replace `cita.fecha_hora_cita.isoformat()` and `cita_end.isoformat()` (lines 926-927 of `main.py`) with `naive(cita.fecha_hora_cita).isoformat()` and `naive(cita_end).isoformat()`. Add a 1-line code comment pointing future maintainers to the schema-level serializer. |
| **Alternatives considered** | Declare a `response_model=` on the endpoint (would require a new list-of-slot schema, breaking the existing minimal contract); return a `CitaRead`-shaped dict (more work, more surface area). |
| **Rationale** | The endpoint returns a list of raw dicts that the frontend already consumes as `{cita_id, start, end, estado}`. The cheapest, most surgical fix is to wrap the two `isoformat()` calls. The comment guards against a future maintainer "helpfully" removing the `naive()` wrap because the `CitaRead` serializer "already handles it" — it doesn't, because this endpoint doesn't go through `CitaRead`. |

### Decision: Input validator strips via `v.replace(tzinfo=None)` (no UTC conversion)

| Aspect | Detail |
|---|---|
| **Choice** | `@field_validator("fecha_hora_cita")` on `CitaCreate` and `CitaUpdate` does `return v.replace(tzinfo=None) if v.tzinfo else v`. |
| **Alternatives considered** | Convert to UTC and then strip: `v.astimezone(timezone.utc).replace(tzinfo=None)`. |
| **Rationale** | The system operates in a single timezone (Argentina, UTC-3). The naive-storage convention is "store what the user meant, not what UTC says it is". A client sending `"2026-06-29T09:00:00Z"` clearly means "09:00 wall-clock" (the only sensible interpretation given the project's domain). Stripping tzinfo directly is simpler and matches the existing `naive()` helper's semantics. UTC conversion would silently shift the wall-clock hour for clients in any non-UTC offset, which is the exact bug we are trying to prevent. |

### Decision: `_strip_tz` helper lives at the top of `schemas.py`

| Aspect | Detail |
|---|---|
| **Choice** | Module-level helper in `backend/app/schemas.py` (top of file, after imports and before the first schema). |
| **Alternatives considered** | In `main.py` next to `naive()`; new `serializers.py` module. |
| **Rationale** | It is a Pydantic concern, called only by `@field_serializer` decorators in this file. The existing `naive()` in `main.py` has a different role (comparison normalization) and is still needed there for the `get_busy_slots` date-range filter (lines 920-922) and the appointment-conflict paths. A new `serializers.py` module is over-organization for a 5-line helper. |

### Decision: Keep the existing `naive()` helper in `main.py`

| Aspect | Detail |
|---|---|
| **Choice** | Do not remove `naive()` from `main.py` even though the schema-level serializer will be a no-op for already-naive datetimes. |
| **Alternatives considered** | Remove `naive()` and rely solely on the schema-level serializer. |
| **Rationale** | The schema serializer only applies to endpoints that declare a `response_model`. `get_busy_slots` does not. The new `_strip_tz` helper in `schemas.py` and `naive()` in `main.py` have identical semantics (strip tzinfo) but different scopes. Keeping both is defensive and zero-cost. The name `naive()` is now slightly ambiguous (compare vs. serialize) but the docstring at lines 27-33 already explains its purpose; rename only if readability suffers in future review. |

## Data Flow

### Broken (current production state)

```
PostgreSQL/Supabase           FastAPI serializer                Argentina browser (UTC-3)
─────────────────────         ────────────────────              ──────────────────────────
Cita row:                     Pydantic v2 default               new Date("2026-06-29T09:00:00Z")
  fecha_hora_cita =           emits aware datetimes             → parsed as UTC
  2026-06-29 09:00 UTC        as "2026-06-29T09:00:00Z"        → toLocal = 06:00 wall-clock
                                  │
                                  ▼
                             Calendar.tsx builds slotStart
                             via setHours(9) → browser-local
                             → toISOString = 12:00:00Z
                                  │
                                  ▼
                             Overlap check: 12:00Z < 09:00Z+60m?
                             → false → slot marked "available"
                             → "Ocupado" tag missing
```

### Fixed (this change)

```
PostgreSQL/Supabase           FastAPI serializer                Argentina browser (UTC-3)
─────────────────────         ────────────────────              ──────────────────────────
Cita row:                     @field_serializer strips          new Date("2026-06-29T09:00:00")
  fecha_hora_cita =           tzinfo → emits                    → parsed as local
  2026-06-29 09:00 UTC        "2026-06-29T09:00:00"             → getHours() = 9 ✓
                                  │
                                  ▼
                             Calendar.tsx slotStart
                             via setHours(9) → 12:00:00Z
                                  │
                                  ▼
                             Busy slot parsed: 12:00:00Z
                             (same TZ conversion applies)
                                  │
                                  ▼
                             Overlap: 12:00Z < 12:00Z+60m? ✓
                             → "Ocupado" tag rendered
```

The key insight: the **same** naive string is parsed by the browser using **the same** local-TZ conversion for both slot and busy. The 3h shift is applied equally to both sides, so the overlap check is now self-consistent.

## File Changes

| File | Action | Lines | Description |
|------|--------|-------|-------------|
| `backend/app/schemas.py` | Modify | ~25 | Add `_strip_tz` helper (~5 lines) at top; add 3 `@field_serializer` decorators on `CitaRead` (2 fields) and `ClienteRead` (1 field) (~10 lines); add 2 `@field_validator` decorators on `CitaCreate.fecha_hora_cita` and `CitaUpdate.fecha_hora_cita` (~10 lines). |
| `backend/app/main.py` | Modify | ~5 | Wrap 2 `isoformat()` calls in `get_busy_slots` (lines 926-927) with `naive()` (~2 lines); add code comment pointing to schema-level serializer (~3 lines). |
| `backend/tests/test_api.py` | Modify | ~30 | Add `test_appointment_datetime_aware_input_serializes_naive` regression test directly below `test_appointment_datetime_no_z_suffix` (line 1655). `timezone` is already imported (line 3). |
| `backend/app/schemas.py` | Edit imports | ~1 | Add `field_serializer` to the existing `from pydantic import` line (line 5). `field_validator` is already imported. |
| **Total diff** | | **~60** | Well under the 400-line review budget. No chained PR needed. |

## Interfaces / Contracts

### `_strip_tz` helper + serializers (sketch)

```python
# backend/app/schemas.py (top of file, after imports)
from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator, model_validator

def _strip_tz(v: datetime) -> str:
    """Serialize a datetime to ISO format with no tzinfo suffix.

    Pydantic v2's default datetime serializer appends `Z` to aware datetimes
    (e.g. those returned by PostgreSQL TIMESTAMP WITH TIME ZONE). That
    suffix causes JavaScript Date parsers in Argentina (UTC-3) to shift
    the wall-clock hour by 3. The system operates in a single timezone
    (Argentina), so wall-clock time is the only time that matters.
    Naive datetimes pass through unchanged.
    """
    return v.replace(tzinfo=None).isoformat() if v.tzinfo else v.isoformat()

# ... existing schemas unchanged ...

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
    telefonos: list[ClienteTelefonoRead]

    @field_serializer("fecha_creacion")
    def _ser_fecha_creacion(self, v: datetime) -> str:
        return _strip_tz(v)


class CitaCreate(BaseModel):
    id_cliente: int
    fecha_hora_cita: datetime
    # ... other fields ...

    @field_validator("fecha_hora_cita", mode="before")
    @classmethod
    def _accept_naive_or_aware(cls, v):
        return v.replace(tzinfo=None) if hasattr(v, "tzinfo") and v.tzinfo else v

    @model_validator(mode="after")
    def check_sena_no_supera_precio(self):
        # ... existing ...


class CitaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    id_cliente: int
    cliente_nombre: Optional[str] = None
    fecha_hora_cita: datetime
    precio_historico_cobrado: float
    sena_historica_pagada: float
    comprobante_transferencia_url: Optional[str]
    comprobante_verificado_manual: bool
    monto_recibido_en_caja: float
    estado_cita: EstadoCita
    metodo_pago_sena: str
    fecha_registro_cita: datetime
    duracion_total_minutos: int = 0
    servicios: List[CitaServicioRead] = []

    @field_serializer("fecha_hora_cita", "fecha_registro_cita")
    def _ser_fechas(self, v: datetime) -> str:
        return _strip_tz(v)
```

### `get_busy_slots` endpoint change

```python
# backend/app/main.py (lines 903-931)
@app.get("/busy_slots")
def get_busy_slots(date_str: str, session: Session = Depends(get_session)):
    # ... existing logic through line 922 ...
    busy_slots.append({
        "cita_id": cita.id,
        # The naive() wrap is REQUIRED: this endpoint does not declare a
        # response_model, so the CitaRead field_serializer does not run.
        # Any new endpoint returning a datetime MUST declare a response_model
        # (CitaRead / ClienteRead) or apply naive() manually.
        "start": naive(cita.fecha_hora_cita).isoformat(),
        "end": naive(cita_end).isoformat(),
        "estado": cita.estado_cita,
    })
    return busy_slots
```

## Testing Strategy

**Mode**: RED-first (per `openspec/config.yaml` `rules.apply.tdd: false` — this change overrides to true for the new test only, because the fix cannot be implemented TDD-vertically for an existing 3-field schema).

| Layer | What to Test | Approach |
|---|---|---|
| Unit | `_strip_tz` helper with naive and aware inputs | Optional — implicit via integration test. |
| Integration | Aware datetime round-trips naive (PROD-A, PROD-B, PROD-C, PROD-E from spec) | New test below; RED-watch-GREEN-watch. |
| Integration | Input normalization on Z/offset strings (PROD-D from spec) | Add to the same new test as sub-assertions. |
| Regression | All 132 existing tests still pass | `pytest backend/tests/` after the fix. |

### New regression test (RED-first)

The test must be added **before** the fix is applied, then run pytest, watch it fail, then apply the fix, watch it pass. This proves the test actually exercises the bug.

```python
# backend/tests/test_api.py (insert after line 1655, ~30 lines)

def test_appointment_datetime_aware_input_serializes_naive():
    """REQ-DCO-004 + REQ-DCO-005: Aware datetimes serialize naive; Z/offset inputs normalized.

    Reproduces the production (PostgreSQL/Supabase) failure mode by injecting
    a tz-aware datetime directly into the DB, then asserts all three response
    paths emit naive ISO strings.
    """
    client_id, service_id, _ = _new_test_client_service()

    # Simulate the production aware-UTC datetime path
    aware_dt = datetime(2026, 6, 29, 9, 0, tzinfo=timezone.utc)

    with Session(engine) as session:
        cita = Cita(
            id_cliente=client_id,
            fecha_hora_cita=aware_dt,
            fecha_registro_cita=aware_dt,
            precio_historico_cobrado=2500.0,
            sena_historica_pagada=500.0,
            estado_cita="Pendiente",
            metodo_pago_sena="Transferencia",
            monto_recibido_en_caja=0.0,
            comprobante_verificado_manual=False,
        )
        session.add(cita)
        session.commit()
        session.refresh(cita)
        cita_id = cita.id

    # PROD-A: GET /appointments emits naive ISO
    r = client.get("/appointments")
    assert r.status_code == 200
    target = next(a for a in r.json() if a["id"] == cita_id)
    assert target["fecha_hora_cita"] == "2026-06-29T09:00:00"
    assert not target["fecha_hora_cita"].endswith("Z")
    assert "+" not in target["fecha_hora_cita"].split("T")[1]

    # PROD-B: GET /busy_slots emits naive start and end
    r = client.get("/busy_slots", params={"date_str": "2026-06-29"})
    assert r.status_code == 200
    busy = [s for s in r.json() if s["cita_id"] == cita_id]
    assert len(busy) == 1
    assert busy[0]["start"] == "2026-06-29T09:00:00"
    assert not busy[0]["start"].endswith("Z")
    assert "T09:00:00" in busy[0]["end"]

    # PROD-C: GET /clients/{id} emits naive fecha_creacion
    r = client.get(f"/clients/{client_id}")
    assert r.status_code == 200
    assert r.json()["fecha_creacion"] == "2026-06-29T09:00:00"

    # PROD-D: POST with Z suffix is normalized to naive
    payload = {
        "id_cliente": client_id,
        "fecha_hora_cita": "2026-06-29T10:00:00Z",
        "precio_historico_cobrado": 2500.0,
        "sena_historica_pagada": 500.0,
        "servicios": [{"servicio_id": service_id, "duracion_minutos": 60,
                       "precio_unitario": 2500.0, "subtotal": 2500.0}],
    }
    r = client.post("/appointments", json=payload)
    assert r.status_code == 200
    assert r.json()["fecha_hora_cita"] == "2026-06-29T10:00:00"

    # PROD-E (negative): no string in any response contains Z or +00:00
    for endpoint in ["/appointments", f"/clients/{client_id}"]:
        r = client.get(endpoint)
        body = r.text
        assert "Z" not in body, f"{endpoint} contains Z: {body[:200]}"
        assert "+00:00" not in body, f"{endpoint} contains +00:00: {body[:200]}"
```

**Coverage**: no coverage tool is installed in this project (per `timezone-fix/verify-report.md`). Coverage numbers are intentionally not reported. The new test plus all 132 existing tests give structural confidence.

## Risks and Rollback

| # | Risk | Likelihood | Mitigation in this design |
|---|------|------------|---------------------------|
| 1 | Round-trip asymmetry on PATCH (Z input → UTC shift on storage → naive strip on read) | Med | The `@field_validator` on `CitaCreate.fecha_hora_cita` and `CitaUpdate.fecha_hora_cita` normalizes input to naive **before** storage, so the stored value is always naive regardless of column type. Covered by PROD-D sub-assertion in the new test. |
| 2 | `get_busy_slots` regresses if a future maintainer refactors it to use `CitaRead` (and the schema serializer is missed) | Low | Code comment at lines 926-927 explicitly warns: "any new endpoint returning a datetime MUST declare a response_model or apply naive() manually". |
| 3 | SQLite test pollution masks the regression (SQLite returns naive regardless of input) | Med | The new test directly constructs `datetime(..., tzinfo=timezone.utc)` and uses `Session.add()` — bypasses the API and the input validator, simulating the production aware-datetime path. The test would have failed against the current code and passes only after the serializer is wired in. |
| 4 | `naive()` helper semantics now span "compare" and "serialize" — name ambiguity | Low | Both semantics are "strip tzinfo" — safe. The helper's docstring (lines 27-33 of `main.py`) already documents its purpose. Rename only if a future review flags it. |
| 5 | Production DB rows may have wrong wall-clock times (DB stored UTC-3 wall-clock under TIMESTAMP WITH TIME ZONE) | Out of scope | User decision recorded in the proposal: production DB is "mega alpha", no real users, ignore. The serializer fix will faithfully emit whatever is in the DB — it does not invent or shift times. |
| 6 | The previous `verify-report.md` was a false positive (PR #46 archived as PASS without the serializer) | Historical | This design explicitly requires the new test (RED→GREEN) and a manual production check as acceptance criteria (see `proposal.md` "Success Criteria"). The `sdd-verify` phase for this change will not accept a green test alone without inspecting the serializer wiring in `schemas.py`. |

**Rollback** (4 steps, ~5 minutes, no data loss):
1. Revert the 3 `@field_serializer` decorators and 2 `@field_validator` decorators in `backend/app/schemas.py`.
2. Revert the 2 `naive()` wraps and the comment in `get_busy_slots` (`backend/app/main.py` lines 926-927).
3. Revert the new regression test in `backend/tests/test_api.py`.
4. Restart the backend service. The API returns to the pre-change state (bug returns, but system is otherwise intact — no schema drift, no DB change, no frontend change).

## Migration / Rollout

No migration required. The serializer fix is transparent to the database — it only changes the wire format of GET responses and the normalization of incoming POST/PATCH payloads. Existing rows in SQLite (naive) and PostgreSQL (potentially aware) are both handled correctly by the defensive `_strip_tz` helper.

Deployment: standard FastAPI service restart. No feature flag needed (the system has a single timezone, no per-tenant config).

## Open Questions

- [x] **Does the test framework support `tzinfo=timezone.utc` insertion via SQLAlchemy directly, or do we need raw SQL?** Resolved: `from datetime import datetime, timedelta, timezone` is already imported at `backend/tests/test_api.py:3`. `Session.add(Cita(... tzinfo=timezone.utc))` works on SQLModel/SQLAlchemy 2.x — the new test uses this path.
- [x] **Is there any other endpoint that returns a datetime via a raw dict?** Resolved: `grep isoformat\( backend/app/main.py` returns only lines 906 (`date.fromisoformat` — date, not datetime), 926, and 927. `get_busy_slots` is the only raw-dict datetime endpoint. No other surprises.

## Traceability Matrix

| Requirement | Spec scenario | Satisfied by |
|---|---|---|
| REQ-DCO-004 (defensive serializer on aware datetimes) | PROD-A, PROD-B, PROD-C, PROD-E | `_strip_tz` helper + 3 `@field_serializer` decorators in `backend/app/schemas.py` (covers PROD-A, PROD-C); 2 `naive()` wraps in `get_busy_slots` (`backend/app/main.py` lines 926-927) (covers PROD-B); PROD-E negative test in the new regression test. |
| REQ-DCO-005 (input normalization on aware datetimes) | PROD-D, PATCH round-trip, naive unchanged | 2 `@field_validator` decorators in `backend/app/schemas.py` on `CitaCreate.fecha_hora_cita` and `CitaUpdate.fecha_hora_cita`. Sub-assertions in the new regression test. |
| Traceability to prior change | Continues REQ-DCO-001..003 from `timezone-fix` | Both `naive()` (existing) and `_strip_tz` (new) implement the same "strip tzinfo" semantics — no behavioral drift from the prior fix's intent. |
