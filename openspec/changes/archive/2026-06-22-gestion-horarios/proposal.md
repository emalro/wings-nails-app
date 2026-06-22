# Propuesta: Gestión de Horarios de Atención

## Intención

La manicurista necesita configurar su semana laboral y manejar excepciones puntuales (feriados, cambios temporales). Hoy el calendario público usa horarios fijos 8–18 y no refleja la disponibilidad real. Esta feature agrega gestión de horarios semanales + excepciones por fecha, y conecta el calendario público con los horarios reales del negocio.

## Alcance

### Incluye
- Modelo de datos: `HorarioSemanal` (7 registros, uno por día) y `ExcepcionHorario`
- CRUD de horario semanal desde admin: toggle activo/inactivo + hora apertura/cierre por día
- CRUD de excepciones desde admin: agregar/quitar fechas con horario distinto o día cerrado
- Endpoint `/schedule/effective?date=` que devuelve horario efectivo (excepción > semanal > cerrado)
- Calendario público (`Calendar.tsx`) consume dicho endpoint en lugar de hardcodear 8–18
- Hooks TanStack Query siguiendo patrón `useConfig`

### Excluido
- Bloqueo de creación de citas fuera del horario (solo se muestran slots disponibles; el backend ya rechaza solapamientos)
- Notificaciones al cliente por cambios de horario
- Historial de cambios de horario
- Integración con calendarios externos (Google Calendar, iCal)

## Capacidades

### Nuevas
- `horario-semanal`: Gestión de horario semanal (7 días) + excepciones por fecha desde el panel admin, incluyendo CRUD completo en backend y UI administrativa
- `horarios-efectivos`: Endpoint público que combina reglas de excepción → horario semanal → cerrado, consumido por `Calendar.tsx` para mostrar solo slots dentro del horario real

### Modificadas
Ninguna — no se alteran especificaciones existentes.

## Enfoque

Backend: dos nuevas tablas SQLModel, 5 endpoints REST bajo `/schedule`, validación de consistencia (cierre > apertura). Frontend: nueva sección "Horarios" en `Admin.tsx` con tabla de 7 días + sub-sección de excepciones, modificación localizada en `Calendar.tsx` para reemplazar constantes 8–18 por consulta a horario efectivo. Mismo patrón de hooks que `useConfig`.

## Áreas Afectadas

| Área | Impacto | Descripción |
|------|---------|-------------|
| `backend/app/models.py` | +2 modelos | HorarioSemanal, ExcepcionHorario |
| `backend/app/schemas.py` | +5 schemas | Create/Read/Update para cada modelo + EffectiveHours |
| `backend/app/main.py` | +5 endpoints | CRUD semanal, CRUD excepciones, GET effective |
| `frontend/src/api.ts` | +4 funciones | getSchedule, updateSchedule, getExceptions, createException, deleteException |
| `frontend/src/hooks/` | +2 hooks | useSchedule, useExceptions (TanStack Query) |
| `frontend/src/pages/Admin.tsx` | +sección | Nueva pestaña "Horarios" con tabla semanal + excepciones |
| `frontend/src/components/Calendar.tsx` | Modificado | Hardcoded 8–18 → consulta efectiva por fecha |

## Riesgos

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| Usuario setea cierre < apertura | Media | Validación backend + UI con select de horas (evita input libre) |
| Timezone implícito (HH:MM sin tz) | Baja | Misma zona horaria que el resto de la app; documentado |
| Superposición de excepción con turnos existentes | Baja | El endpoint effective solo informa — no modifica turnos |
| Día desactivado con turnos ya agendados | Baja | Se muestra igual en admin; el calendario público no bloquea, solo oculta slots |

## Plan de Rollback

Revert commits de backend (modelos, schemas, endpoints) y frontend (componentes, hooks, API functions). La tabla `test.db` se recrea al iniciar. Los endpoints existentes no se modifican — solo se agregan nuevos bajo `/schedule`.

## Dependencias

Ninguna.

## Criterios de Éxito

- [ ] Admin puede configurar los 7 días (activo/inactivo + horarios)
- [ ] Admin puede agregar y eliminar excepciones por fecha
- [ ] Endpoint `GET /schedule/effective?date=` devuelve horario correcto según prioridad: excepción > semanal > cerrado
- [ ] Calendario público solo muestra slots dentro del horario efectivo del día
- [ ] Días sin horario (inactivos o excepción cerrada) no muestran slots disponibles
- [ ] Tests de integración backend pasan (pytest)
