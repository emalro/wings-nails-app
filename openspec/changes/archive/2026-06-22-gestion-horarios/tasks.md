# Tasks: Gestión de Horarios de Atención

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~626 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Backend (~266) → PR 2: Frontend (~360) |
| Delivery strategy | auto-forecast |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend: modelos, schemas, endpoints, seed, tests | PR 1 | Base para frontend. Incluye tests de integración |
| 2 | Frontend: api functions, hooks, Admin.tsx, Calendar.tsx | PR 2 | Depende de PR 1. Consume endpoints nuevos |

## Fase 1: Backend — Modelos y Datos

- [x] 1.1 Agregar `HorarioSemanal` y `ExcepcionHorario` a `backend/app/models.py`
- [x] 1.2 Importar modelos nuevos en `backend/app/database.py`
- [x] 1.3 Agregar schemas a `backend/app/schemas.py`: HorarioSemanalCreate, HorarioSemanalRead, ExcepcionHorarioCreate, ExcepcionHorarioRead, EffectiveHoursResponse
- [x] 1.4 Agregar seed de 7 filas HorarioSemanal en `lifespan()` (todas inactivas, Mon-Fri 09:00-18:00)

## Fase 2: Backend — Endpoints

- [x] 2.1 `GET /schedule/weekly` — listar 7 registros
- [x] 2.2 `PUT /schedule/weekly` — batch upsert con validación cierre > apertura
- [x] 2.3 `GET /schedule/exceptions` — listar excepciones
- [x] 2.4 `POST /schedule/exceptions` — crear excepción (validar fecha única, 409 si duplicada)
- [x] 2.5 `DELETE /schedule/exceptions/{id}` — eliminar por ID (404 si no existe)
- [x] 2.6 `GET /schedule/effective?date=` — lógica prioridad: excepción > semanal > cerrado

## Fase 3: Backend — Tests de Integración

- [x] 3.1 Test: GET/PUT weekly schedule (HOR-001, HOR-008)
- [x] 3.2 Test: CRUD excepciones (HOR-002, HOR-003, HOR-009)
- [x] 3.3 Test: effective hours (HOR-004, HOR-007)
- [x] 3.4 Test: 404 exception not found, 400 invalid date, 422 bad hours

## Fase 4: Frontend — API y Hooks

- [x] 4.1 Agregar 6 funciones API en `frontend/src/api.ts`
- [x] 4.2 Crear `frontend/src/hooks/useSchedule.ts` con 6 hooks TanStack Query
- [x] 4.3 Exportar hooks nuevos desde `frontend/src/hooks/index.ts`

## Fase 5: Frontend — UI Administrativa

- [x] 5.1 Agregar sección "Horarios" en `Admin.tsx`: tabla semanal con toggle activo + selects de hora, batch save
- [x] 5.2 Agregar sub-sección de excepciones: date picker, toggle cerrado, selects de hora, delete

## Fase 6: Frontend — Calendar.tsx

- [x] 6.1 Reemplazar constantes 8-18 por fetch a `GET /schedule/effective?date=`
- [x] 6.2 Mostrar "Sin horarios disponibles" cuando `abierto = false`

## Fase 7: Verificación

- [x] 7.1 TypeScript check (`tsc --noEmit`) y corregir errores
- [x] 7.2 Ejecutar pytest (backend) y confirmar todos los tests verdes
