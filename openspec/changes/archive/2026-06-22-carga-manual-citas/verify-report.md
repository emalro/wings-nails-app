## Verification Report

**Change**: `carga-manual-citas` — Carga Manual de Citas + Buscador Predictivo
**Version**: N/A (initial delta spec)
**Mode**: Standard (no Strict TDD flag)

---

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 14 |
| Tasks complete | 14 |
| Tasks incomplete | 0 |

All 14 tasks from `tasks.md` are checked complete. No blocking gaps.

---

### Build & Tests Execution

**TypeScript (Build / Type Check)**: ✅ Passed
```
cd frontend && npx tsc --noEmit → (no output, exit 0)
```

**Python Tests**: ✅ 36 passed, 0 failed, 0 skipped
```
python3 -m pytest backend/tests/ -v → 36/36 passed in 6.26s
```

| Test Group | Count | Status |
|---|---|---|
| Health/Client CRUD | 2 | ✅ |
| PATCH endpoint (STRICT TDD) | 13 | ✅ |
| Schedule endpoints (STRICT TDD) | 12 | ✅ |
| Client search (T3.1 — this change) | 5 | ✅ |
| Manual creation (T3.2 — this change) | 4 | ✅ |
| **Total** | **36** | **✅ All pass** |

---

### Spec Compliance Matrix

#### CMC-001 — Client Search Endpoint

| Scenario | Test(s) | Result |
|----------|---------|--------|
| Búsqueda por nombre parcial | `test_search_clients_by_nombre` | ✅ COMPLIANT |
| Búsqueda por teléfono | `test_search_clients_by_telefono` | ✅ COMPLIANT |
| Búsqueda sin resultados | `test_search_clients_no_results` | ✅ COMPLIANT |
| Búsqueda con 1 carácter (< 2) | `test_search_clients_short_query` | ✅ COMPLIANT |
| Búsqueda por apellido parcial | `test_search_clients_partial_apellido` | ✅ COMPLIANT |

#### CMC-002 — POST /appointments extendido

| Scenario | Test(s) | Result |
|----------|---------|--------|
| Crear turno como Confirmado | `test_create_appointment_with_confirmado` | ✅ COMPLIANT |
| Crear turno como Pendiente (default) | `test_create_appointment_default_pendiente` | ✅ COMPLIANT |
| Conflicto de horario (409) | `test_busy_slots_and_conflict_detection` | ✅ COMPLIANT |
| Pago Efectivo | `test_create_appointment_efectivo` | ✅ COMPLIANT |

#### CMC-003 — ClientSearch (frontend)

| Scenario | Test(s) | Result |
|----------|---------|--------|
| Debounce evita requests excesivos | (no frontend test suite) | ⚠️ UNTESTED — implemented in component (debounce 300ms) but no automated coverage |
| Dropdown se cierra al seleccionar | (no frontend test suite) | ⚠️ UNTESTED — implemented in `handleSelectClient` but no automated coverage |

#### CMC-004 — Registro Express

| Scenario | Test(s) | Result |
|----------|---------|--------|
| Crear clienta nueva desde el modal | (no frontend test suite) | ⚠️ UNTESTED — `handleCreateQuickClient` implemented, no automated coverage |

#### CMC-005 — ManualAppointmentModal

| Scenario | Test(s) | Result |
|----------|---------|--------|
| Carga manual completa (Confirmado + Efectivo) | API: `test_create_appointment_with_confirmado` + `test_create_appointment_efectivo` | ⚠️ PARTIAL — API side covered; frontend flow untested |
| Conflicto de horario desde el modal | `test_busy_slots_and_conflict_detection` (API 409) | ⚠️ PARTIAL — API 409 tested; frontend error display untested |

#### CAL-001 — Admin Agenda (modified)

| Scenario | Test(s) | Result |
|----------|---------|--------|
| Botón abre modal de carga manual | (no frontend/E2E test suite) | ⚠️ UNTESTED — implemented in Admin.tsx (lines 593-601, 633-639) |

#### Frontend Data Fetching

| Scenario | Test(s) | Result |
|----------|---------|--------|
| Hook solo se ejecuta con >= 2 caracteres | (no frontend unit tests) | ⚠️ UNTESTED — `enabled: query.length >= 2` in code |

**Compliance summary**: 10/15 scenarios with API coverage (COMPLIANT/PARTIAL), 5 scenarios untested (frontend-only).

---

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| `GET /clients/search?q=` | ✅ Implemented | Lines 120-129 in main.py — ilike, min 2 chars, limit 10 |
| `estado_cita` optional in `CitaCreate` | ✅ Implemented | Line 59 in schemas.py — `Optional[EstadoCita] = None` |
| `find_conflicting_appointment` reused | ✅ Implemented | Not modified (lines 190-200 in main.py) |
| `searchClients()` API function | ✅ Implemented | Lines 159-161 in api.ts |
| `useClientSearch` hook | ✅ Implemented | Lines 4-11 in useClientSearch.ts — enabled >= 2, staleTime 30s |
| `useCreateManualAppointment` mutation | ✅ Implemented | Lines 4-13 in useCreateManualAppointment.ts — invalidates appointments + busy-slots |
| Barrel exports | ✅ Implemented | hooks/index.ts lines 7-8 export both hooks |
| ManualAppointmentModal component | ✅ Implemented | All required elements present |
| "Cargar Turno Manual" button | ✅ Implemented | Admin.tsx lines 593-601 |
| `onAppointmentCreated` refreshes calendar | ✅ Implemented | Admin.tsx lines 636-638 — calls `refetchAppointments()` |
| Index `idx_cliente_search` | ✅ Implemented | models.py lines 23-25 |

---

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Schema extension over new endpoint | ✅ Yes | `CitaCreate` extended with optional `estado_cita` |
| `ClienteRead` for search response | ✅ Yes | `response_model=list[ClienteRead]` in main.py |
| Self-contained modal (not inline) | ✅ Yes | `ManualAppointmentModal.tsx` is a separate component |
| `@app.get` (not `@router.get`) | ✅ Yes | Line 120: `@app.get("/clients/search", ...)` |
| Barrel export for hooks | ✅ Yes | `hooks/index.ts` exports both new hooks |
| `Index` imported in models.py | ✅ Yes | Line 5: `from sqlmodel import ..., Index` |
| Composite index on (nombre, apellido, telefono) | ✅ Yes | `__table_args__` with `idx_cliente_search` |
| Conflict detection reused (no changes) | ✅ Yes | `find_conflicting_appointment` untouched |

---

### Edge Cases Not Tested

| Edge Case | Impact | Suggested Test |
|-----------|--------|----------------|
| Search with SQL wildcards (`%`, `_`) | Low — LIKE is safe against injection but `%` in query could return unexpected results | `GET /clients/search?q=%` should not crash |
| Case-insensitive matching | Low — SQLite LIKE is case-insensitive for ASCII by default | Could add explicit test with uppercase query |
| Limit=10 enforcement with >10 matches | Low — test creates only 1 client per search test | Create 11+ clients, search, assert len <= 10 |
| Frontend debounce behavior | Medium — manual testing only | Unit test with fake timers |
| Frontend mutation invalidation | Medium — manual testing only | Unit test that `queryClient.invalidateQueries` is called on success |
| Full modal E2E flow | Medium — manual testing only | Playwright/Cypress test |

---

### Issues Found

**CRITICAL**: None

**WARNING**:
- 5 frontend-only spec scenarios have no automated test coverage (CMC-003 debounce, CMC-003 dropdown close, CMC-004 quick client creation, CAL-001 button open, frontend hook enabled logic). These are implemented in code but rely on manual testing.

**SUGGESTION**:
- `useCreateManualAppointment` invalidates `['busy-slots']` in addition to `['appointments']` — a detail not in the spec/design. Consider documenting in design.
- `searchClients` API function uses generic `any` type in `ManualAppointmentModal.tsx` for client objects in the dropdown map — prefer `ClienteRead` for type safety.
- No test verifies that `POST /appointments` with `metodo_pago_sena` explicitly set to `"Transferencia"` (the default) still works.

---

### Verdict

**PASS WITH WARNINGS**

All 14 tasks complete. All 36 backend tests pass. TypeScript compiles with zero errors. All design decisions followed (including post-review fixes: `@app.get`, barrel exports, `Index` import). The 5 frontend-only untested scenarios are implemented correctly in code but lack automated test coverage — this is acceptable as the project has no frontend test suite yet. Backend API coverage is complete for all spec scenarios.

Key risks addressed:
- ✅ Schema extension is backward-compatible (no breaking changes)
- ✅ Conflict detection is reused, not reimplemented
- ✅ Admin.tsx stays clean via extracted component
- ✅ All existing tests continue to pass
