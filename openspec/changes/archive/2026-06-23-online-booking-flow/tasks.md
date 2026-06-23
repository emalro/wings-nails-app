# Tasks: Online Booking Flow

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~200 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Backend — Config Payment Fields

- [x] 1.1 Add `cbu_alias: str = ""` and `cbu_number: str = ""` to `Configuracion` model (`backend/app/models.py`)
- [x] 1.2 Add both fields as `Optional[str]` to `ConfiguracionUpdate` (`backend/app/schemas.py`)
- [x] 1.3 Add pytest: config model persists new fields, GET/PUT /config returns them

## Phase 2: Frontend — Calendar Labels

- [x] 2.1 Show "Ocupado" text for unavailable time slots in `Calendar.tsx` (line 166)
- [x] 2.2 Add privacy message below time-slot grid: "Los horarios ocupados no muestran datos de otras clientas por protección de datos personales."

## Phase 3: Frontend — Admin Panel

- [x] 3.1 Add `cbu_alias` and `cbu_number` inputs to `Admin.tsx` config form section (after address field, ~line 428)

## Phase 4: Frontend — Reservation Multi-Step Flow

- [x] 4.1 Add `ConfigType` with `cbu_alias` and `cbu_number` to `api.ts`
- [x] 4.2 Refactor `Reservar.tsx` with `Step` enum and conditional render sections for steps 1-4
- [x] 4.3 Add DNI field to step 2 form with required validation
- [x] 4.4 Add step 3 (confirm): summary card + "Confirmar turno" → sequential POST /clients then POST /appointments with 409/422/5xx error handling per design
- [x] 4.5 Add step 4 (payment): fetch config on mount, show CBU/Alias + seña amount, WhatsApp deep link with pre-redacted message, fallback text when config empty
- [ ] 4.6 Manual verify: walk 4 steps, DNI validation, 409 conflict banner, WhatsApp link params, "Ocupado" labels, admin CBU/Alias persist
