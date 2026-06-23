# Tasks: Client Uniqueness

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 100–130 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | single-pr |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Foundation — Model & Schema Changes

- [x] 1.1 Add `dni: str = Field(unique=True)` to `ClienteBase` in `backend/app/models.py`
- [x] 1.2 Add `dni: str` to `ClienteCreate` and `ClienteRead` in `backend/app/schemas.py`
- [x] 1.3 Add `normalize_phone()` function and `@field_validator("telefono")` with Argentine phone validation to `ClienteCreate` in `backend/app/schemas.py`

## Phase 2: Core Implementation — Find-or-Create Endpoint

- [x] 2.1 Replace `POST /clients` in `backend/app/main.py`: normalize phone, search by phone first then DNI, return 200 on match or 201 on create

## Phase 3: Testing — Update Existing + Add New Tests

- [x] 3.1 Add `dni` field to all 7 existing client-creation payloads in `backend/tests/test_api.py`
- [x] 3.2 Change `assert 200` to `assert 201` on all 7 first-time client creates in `backend/tests/test_api.py`
- [x] 3.3 Add tests for REQ-CLI-001 (DNI valid/duplicate/missing), REQ-CLI-002 (phone validation), REQ-CLI-003 (phone normalization)
- [x] 3.4 Add tests for REQ-CLI-004 (find-or-create: phone match, DNI match, phone priority) and REQ-CLI-005 (all fields required)
- [x] 3.5 Run full test suite and confirm all pass
