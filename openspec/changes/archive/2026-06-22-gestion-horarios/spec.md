# Especificación: Gestión de Horarios de Atención

## 1. Modelo de Datos

### HorarioSemanal — Tabla SQLModel (table=True)

| Campo | Tipo | Restricciones |
|-------|------|---------------|
| `id` | `int`, PK | Autoincremental |
| `dia_semana` | `int` | UNIQUE, 0=domingo … 6=sábado |
| `activo` | `bool` | Default `false` |
| `hora_apertura` | `str` | Formato HH:MM ("09:00") |
| `hora_cierre` | `str` | Formato HH:MM ("18:00") |

- SHALL existir exactamente 7 filas en la tabla (una por día).

### ExcepcionHorario — Tabla SQLModel (table=True)

| Campo | Tipo | Restricciones |
|-------|------|---------------|
| `id` | `int`, PK | Autoincremental |
| `fecha` | `date` | UNIQUE |
| `cerrado` | `bool` | Default `false` |
| `hora_apertura` | `Optional[str]` | HH:MM, usado cuando `cerrado=false` |
| `hora_cierre` | `Optional[str]` | HH:MM, usado cuando `cerrado=false` |

## 2. Endpoints API

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/schedule/weekly` | Lista los 7 registros semanales |
| `PUT` | `/schedule/weekly` | Upsert de los 7 registros (body: `list[HourarioSemanalCreate]`) |
| `GET` | `/schedule/exceptions` | Lista todas las excepciones |
| `POST` | `/schedule/exceptions` | Crea una excepción |
| `DELETE` | `/schedule/exceptions/{id}` | Elimina una excepción por ID |
| `GET` | `/schedule/effective?date=YYYY-MM-DD` | Horario efectivo para una fecha |

### Validaciones Compartidas

- `hora_apertura` y `hora_cierre` DEBEN ser HH:MM válido (00:00–23:59).
- `hora_apertura` DEBE ser < `hora_cierre`. Si no → 422.
- Fecha mal formateada → 400.
- `POST /schedule/exceptions` con `fecha` duplicada → 409.

## 3. Lógica de Horario Efectivo

`GET /schedule/effective?date=YYYY-MM-DD` implementa esta prioridad:

```
1. ¿Existe excepción para la fecha?
   ├── exception.cerrado = true → DEVOLVER { abierto: false }
   └── exception.cerrado = false → DEVOLVER { abierto: true, hora_apertura, hora_cierre }
2. ¿No hay excepción Y weekly[dia_semana].activo = true?
   └→ DEVOLVER { abierto: true, hora_apertura, hora_cierre }
3. Caso contrario → DEVOLVER { abierto: false }
```

Respuesta del endpoint (EffectiveHours):

```json
{ "abierto": true, "hora_apertura": "09:00", "hora_cierre": "18:00" }
```

## 4. Cambios en Calendar.tsx

- Agregar fetch a `GET /schedule/effective?date={dateStr}` cuando se selecciona una fecha.
- Reemplazar `startHour = 8` y `endHour = 18` por los valores del effective response.
- Si `abierto = false`: mostrar mensaje "Sin horarios disponibles" y no generar slots.
- Si `abierto = true`: generar slots cada 30 min entre `hora_apertura` y `hora_cierre`.
- Mantener detección de conflictos contra `busy_slots` intacta.
- PropTypes y nombres de variables sin cambios disruptivos.

## 5. Escenarios

### HOR-001: Configuración semanal guardada
- DADO el admin configura lunes activo 09:00–18:00 y guarda
- CUANDO se consulta `/schedule/effective?date=2026-06-22` (lunes)
- THEN devuelve `{ abierto: true, hora_apertura: "09:00", hora_cierre: "18:00" }`

### HOR-002: Excepción sobreescribe horario semanal
- DADO lunes configurado 09:00–18:00 y excepción 2026-06-22 con 10:00–15:00
- CUANDO se consulta `/schedule/effective?date=2026-06-22`
- THEN devuelve `{ abierto: true, hora_apertura: "10:00", hora_cierre: "15:00" }`

### HOR-003: Excepción cerrado
- DADO excepción para 2026-06-22 con `cerrado: true`
- CUANDO se consulta `/schedule/effective?date=2026-06-22`
- THEN devuelve `{ abierto: false }`

### HOR-004: Día sin configuración semanal
- DADO domingo con `activo: false`
- CUANDO se consulta `/schedule/effective?date=2026-06-21` (domingo)
- THEN devuelve `{ abierto: false }`

### HOR-005: Calendar.tsx muestra slots en horario efectivo
- DADO /schedule/effective devuelve `{ abierto: true, hora_apertura: "10:00", hora_cierre: "13:00" }`
- CUANDO Calendar.tsx genera slots
- THEN los slots generados son 10:00, 10:30, 11:00, 11:30, 12:00, 12:30
- Y ningún slot fuera de ese rango

### HOR-006: Calendar.tsx muestra "Sin horarios disponibles"
- DADO /schedule/effective devuelve `{ abierto: false }`
- CUANDO Calendar.tsx renderiza
- THEN muestra mensaje "Sin horarios disponibles"
- Y no genera slots

### HOR-007: Fecha inválida
- DADO consulta `/schedule/effective?date=2026-99-99`
- CUANDO el backend procesa
- THEN responde 400

### HOR-008: Apertura >= cierre
- DADO PUT /schedule/weekly con `hora_apertura: "18:00"` y `hora_cierre: "09:00"`
- CUANDO el backend valida
- THEN responde 422

### HOR-009: Duplicado de excepción
- DADO excepción existente para 2026-06-22
- CUANDO se POST /schedule/exceptions con misma fecha
- THEN responde 409

## 6. Estados de Error

| Condición | Código | Cuerpo |
|-----------|--------|--------|
| Formato HH:MM inválido | 422 | `{ "detail": "..." }` |
| hora_apertura >= hora_cierre | 422 | `{ "detail": "..." }` |
| Fecha excepción duplicada | 409 | `{ "detail": "..." }` |
| Formato de fecha inválido | 400 | `{ "detail": "..." }` |
| Excepción no encontrada (DELETE) | 404 | `{ "detail": "..." }` |

## Requisitos de Implementación

### Backend
- Modelos `HorarioSemanal` y `ExcepcionHorario` en `models.py`
- Schemas Pydantic para create/read en `schemas.py`
- 5 endpoints en `main.py` bajo `/schedule`
- Seed de 7 filas HorarioSemanal al iniciar (inactivos por defecto)
- Validaciones de consistencia temporal

### Frontend
- Funciones API en `api.ts`: `getWeeklySchedule`, `updateWeeklySchedule`, `getExceptions`, `createException`, `deleteException`, `getEffectiveHours`
- Hooks TanStack Query en `hooks/`: `useWeeklySchedule`, `useUpdateWeeklySchedule`, `useExceptions`, `useCreateException`, `useDeleteException`, `useEffectiveHours(date)`
- Sección "Horarios" en `Admin.tsx` con tabla editable de 7 días + tabla de excepciones
- Modificación de `Calendar.tsx` para consumir horario efectivo
