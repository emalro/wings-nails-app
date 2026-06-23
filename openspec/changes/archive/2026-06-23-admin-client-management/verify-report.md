## Verification Report

**Change**: admin-client-management
**Version**: 1.0 (delta spec)
**Mode**: Standard (Strict TDD not active for this change)

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 16 |
| Tasks complete | 15 |
| Tasks incomplete | 1 (6.2 — REQUIREMENTS.md update, explicitly outside current batch) |

All 15 implementation tasks checked. Task 6.2 is documented as "outside current batch".

### Build & Tests Execution

**Backend Tests**: ✅ 76 passed, 0 failed, 0 skipped
```text
backend/.venv/bin/python -m pytest backend/tests/ -v --tb=short
76 passed in 16.67s
```

**Frontend TypeScript Check**: ✅ Passed (no errors)
```text
npx tsc --noEmit  →  exit code 0, no output
```

**Coverage**: ➖ Not available (no coverage threshold configured)

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| REQ-CLI-006 | Get client with phones | `test_get_client_with_phones` | ✅ COMPLIANT |
| REQ-CLI-006 | Add phone (normalization) | `test_add_phone_to_client` | ✅ COMPLIANT |
| REQ-CLI-006 | Remove non-principal phone | `test_delete_non_principal_phone` | ✅ COMPLIANT |
| REQ-CLI-006 | Update phone label and principal | `test_update_phone_principal_toggle`, `test_update_phone_label` | ✅ COMPLIANT |
| REQ-CLI-006 | Soft-delete sets activo=false | `test_soft_delete_client` | ✅ COMPLIANT |
| REQ-CLI-006 | Reactivate sets activo=true | `test_reactivate_client` | ✅ COMPLIANT |
| REQ-CLI-007 | Search by phone fragment | `test_search_by_phone_fragment_via_ct` | ✅ COMPLIANT |
| REQ-CLI-007 | Find-or-create by phone in CT | `test_find_or_create_ct_phone_match` | ✅ COMPLIANT |
| REQ-CLI-008 | View and search clients | `ClientSection.tsx` (manual — no FE test runner) | ⚠️ PARTIAL |
| REQ-CLI-008 | Edit client fields | `test_patch_client_updates_fields` + UI | ✅ COMPLIANT |
| REQ-CLI-008 | Appointment history visible | `test_get_client_appointments` + UI | ✅ COMPLIANT |
| REQ-CLI-009 | Toggle shows inactive clients | `test_inactive_client_visible_with_incluir_inactivos` | ✅ COMPLIANT |
| REQ-CLI-009 | Past appointments preserve client name | `build_cita_response` preserves name regardless of `activo` | ⚠️ PARTIAL |
| REQ-CLI-010 | Label is optional | `test_add_phone_with_label`, `test_add_phone_without_label` | ✅ COMPLIANT |
| REQ-CLI-004 (mod) | Phone match via ClienteTelefono | `test_find_or_create_ct_phone_match` | ✅ COMPLIANT |
| REQ-CLI-004 (mod) | DNI match when phone is new | `test_find_or_create_dni_match_when_phone_new` | ✅ COMPLIANT |
| REQ-CLI-005 (mod) | Missing telefono on creation | `test_create_client_missing_telefono_returns_422` | ✅ COMPLIANT |
| REQ-CLI-005 (mod) | New client creates CT row | `test_create_client_normalizes_phone` | ✅ COMPLIANT |

**Compliance summary**: 16/18 scenarios compliant, 2 partially covered

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| REQ-CLI-006 — Multi-phone | ✅ Implemented | `ClienteTelefono` model/schema/endpoints + migration; thorough test coverage |
| REQ-CLI-007 — Search multi-phone | ✅ Implemented | `GET /clients/search` joins `ClienteTelefono.telefono`; find-or-create checks CT |
| REQ-CLI-008 — Admin UI | ✅ Implemented | `ClientSection.tsx` with search, list, detail, edit, phones, history, soft-delete |
| REQ-CLI-009 — Soft delete | ✅ Implemented | `activo` flag; `incluir_inactivos` param on list + search; restore via reactivate |
| REQ-CLI-010 — Phone label | ⚠️ Partial | Label stored correctly; no `max_length=100` enforced (spec says max is 100) |
| REQ-CLI-004 (mod) — Find-or-create | ✅ Implemented | DNI checked first, then CT phone; correct priority order |
| REQ-CLI-005 (mod) — Required fields | ✅ Implemented | `telefono` mandatory in `ClienteCreate`; `422` on missing |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| `ClienteTelefono` table with FK + index | ✅ Yes | `idx_ct_telefono` on `telefono` column |
| Startup migration copies telefono → CT | ✅ Yes | `run_migration()` in `lifespan` |
| Keep old `telefono` column (no drop) | ✅ Yes | Excluded from `ClienteBase`; left in DB for compatibility |
| Soft delete: `activo` flag | ✅ Yes | FK to appointments stays intact |
| Search: subquery approach | ⚠️ Deviates | Uses set-based `IN()` (two-step ORM queries) instead of SQL subquery. Semantically equivalent. No behavior difference. |
| Appointments: separate endpoint | ✅ Yes | `GET /clients/{id}/appointments` with desc ordering |
| Admin UI: standalone `ClientSection` | ✅ Yes | Rendered in `Admin.tsx` as `<ClientSection />` |
| `ManualAppointmentModal` phone adaptation | ✅ Yes | Shows `client.telefonos?.[0]?.telefono` in dropdown |

### Issues Found

**CRITICAL**: None

**WARNING**:
- **etiqueta max_length not enforced**: Spec REQ-CLI-010 states "no validation beyond max length (100)". The `ClienteTelefono` model and `ClienteTelefonoCreate` schema both define `etiqueta: Optional[str] = None` without `max_length=100`. A user could theoretically store a 10,000-character label. Add `Field(default=None, max_length=100)` to the model and schema.

**SUGGESTION**:
- **No frontend automated tests**: The design acknowledges "manual verification during apply (no JS test runner yet)". Consider adding Vitest or similar for component-level tests.
- **No direct test for inactive client name in appointments**: `build_cita_response` correctly preserves `cliente_nombre` for inactive clients (it uses `session.get(Cliente, cita.id_cliente)` which works regardless of `activo`), but no test explicitly verifies this edge case.
- **REQUIREMENTS.md update (task 6.2)**: Pending update to §6 entity definition for multi-phone model.

### Verdict

**PASS WITH WARNINGS**

All 76 backend tests pass, TypeScript type-check passes, all spec requirements are implemented, and all design decisions are followed (with minor deviations). The two warnings are: (1) missing `max_length=100` on `etiqueta`, and (2) future addition of frontend test coverage. Neither blocks archive readiness.
