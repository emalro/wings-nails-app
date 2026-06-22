# Design: Gestión de Horarios de Atención

## Enfoque Técnico

Agregar dos modelos SQLModel (`HorarioSemanal`, `ExcepcionHorario`), 6 endpoints REST bajo `/schedule`, seed de 7 filas semanales al iniciar la app, y UI administrativa en Admin.tsx. El Calendar.tsx público consume `GET /schedule/effective?date=` reemplazando las constantes 8–18. Mismos patrones de hooks TanStack Query que `useConfig`.

## Arquitectura

### Decisiones

| Opción | Trade-offs | Decisión |
|--------|------------|----------|
| Batch upsert vs individual PUT | Un solo PUT evita N requests, pero más payload | **Batch**: PUT reemplaza los 7 días. La UI admin edita todo y guarda una vez |
| Seed externo vs inline | Script separado da control, inline es más simple | **Inline** en `lifespan()`, siguiendo el patrón `seed_default_config` existente |
| Router separado vs main.py | Router es más limpio, pero rompe convención del proyecto | **main.py** — todo endpoint actual está ahí; mantener consistencia |
| time objects vs str HH:MM | Objetos time son tipados, string es más simple con SQLite | **str HH:MM** — SQLite no tiene tipo time; la validación Pydantic garantiza formato |
| Componente Schedule separado vs inline en Admin | Separado es más mantenible, inline baja complejidad inicial | **Inline** en Admin.tsx — misma sección que servicios y config, sin navegación extra |

### Mapeo de Días

```
Python weekday():   0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
Schema dia_semana:  0=Dom, 1=Lun, 2=Mar, 3=Mie, 4=Jue, 5=Vie, 6=Sab
Mapping:            schema_day = (python_weekday + 1) % 7
```

## Data Flow

```
Admin.tsx ──PUT /schedule/weekly──→ Backend (valida cierre>apertura, upsert 7 rows)
Admin.tsx ──POST/DELETE /schedule/exceptions──→ Backend (valida fecha única)

Calendar.tsx ──GET /schedule/effective?date=──→ Backend (excepción > semanal > cerrado)
       │
       └── generateTimeSlots() usa hora_apertura/hora_cierre en vez de 8/18
```

## Time Select Options

```typescript
// Utilitario compartido para selects de hora en Admin.tsx
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) =>
  `${String(i).padStart(2, '0')}:00`
).concat(
  Array.from({ length: 24 }, (_, i) =>
    `${String(i).padStart(2, '0')}:30`)
).sort()
// → ["00:00", "00:30", "01:00", ..., "23:30"]
```

## File Changes

| File | Acción | Descripción |
|------|--------|-------------|
| `backend/app/models.py` | +2 clases | `HorarioSemanal`, `ExcepcionHorario` — SQLModel table=True |
| `backend/app/schemas.py` | +7 schemas | `HorarioSemanalCreate`, `HorarioSemanalRead`, `HorarioSemanalUpdate` batch, `ExcepcionHorarioCreate`, `ExcepcionHorarioRead`, `EffectiveHoursResponse` |
| `backend/app/main.py` | +6 endpoints + seed | `GET/PUT /schedule/weekly`, `GET/POST/DELETE /schedule/exceptions`, `GET /schedule/effective`. Seed en lifespan() |
| `backend/app/database.py` | +imports | Importar modelos nuevos en `create_db_and_tables()` |
| `frontend/src/api.ts` | +6 funciones | `getWeeklySchedule`, `updateWeeklySchedule`, `getExceptions`, `createException`, `deleteException`, `getEffectiveHours` |
| `frontend/src/hooks/useSchedule.ts` | **NUEVO** | `useWeeklySchedule`, `useUpdateWeeklySchedule`, `useExceptions`, `useCreateException`, `useDeleteException`, `useEffectiveHours(dateStr)` |
| `frontend/src/hooks/index.ts` | +exports | Exportar hooks nuevos |
| `frontend/src/pages/Admin.tsx` | +sección "Horarios" | Tabla 7 días editable + sub-sección de excepciones. Inline en la página, sin navegación extra |
| `frontend/src/components/Calendar.tsx` | Modificado | Reemplazar `startHour=8`, `endHour=18` por fetch a effective hours; mostrar "Sin horarios disponibles" si `abierto=false` |

## Interfaces

### Backend — Schemas Pydantic

```python
class HorarioSemanalCreate(BaseModel):
    dia_semana: int = Field(ge=0, le=6)
    activo: bool = False
    hora_apertura: str = Field(default="09:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    hora_cierre: str = Field(default="18:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")

class HorarioSemanalRead(HorarioSemanalCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int

class ExcepcionHorarioCreate(BaseModel):
    fecha: date
    cerrado: bool = False
    hora_apertura: Optional[str] = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    hora_cierre: Optional[str] = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")

class ExcepcionHorarioRead(ExcepcionHorarioCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int

class EffectiveHoursResponse(BaseModel):
    abierto: bool
    hora_apertura: Optional[str] = None
    hora_cierre: Optional[str] = None
```

### Frontend — API Functions

```typescript
export async function getWeeklySchedule(): Promise<HorarioSemanalRead[]>
export async function updateWeeklySchedule(payload: HorarioSemanalCreate[]): Promise<HorarioSemanalRead[]>
export async function getExceptions(): Promise<ExcepcionHorarioRead[]>
export async function createException(payload: ExcepcionHorarioCreate): Promise<ExcepcionHorarioRead>
export async function deleteException(id: number): Promise<{ ok: boolean }>
export async function getEffectiveHours(date: string): Promise<EffectiveHoursResponse>
```

## Estrategia de Testing

| Capa | Qué probar | Enfoque |
|------|-----------|---------|
| Integración (backend) | 6 endpoints schedule | `TestClient` + `test.db` — mismo patrón que `test_api.py`. Usar `_unique_date_offset` para aislamiento. Validar HOR-001 a HOR-009 |
| Integración (backend) | Validaciones: hora inválida, apertura>=cierre, fecha duplicada | Tests separados por código de error (400, 409, 422, 404) |
| Unitario (frontend) | `generateTimeSlots` con horarios dinámicos | Mock de `useEffectiveHours`, verificar slots generados vs rango esperado |
| Unitario (frontend) | "Sin horarios disponibles" cuando abierto=false | Mock de `useEffectiveHours` devolviendo `{abierto: false}` |

## Migración / Rollout

No se requiere migración. Las tablas se crean via `SQLModel.metadata.create_all()` al iniciar. Seed de 7 filas inactivas en `lifespan()`. Rollback: revertir commits de backend y frontend.

## Preguntas Abiertas

- [ ] Ninguna — el spec cubre todos los escenarios y el enfoque está alineado con la arquitectura existente.
