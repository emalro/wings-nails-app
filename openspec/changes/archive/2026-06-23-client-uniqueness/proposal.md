# Propuesta: Unicidad de Clientes (Client Uniqueness)

## Intención

Eliminar la creación duplicada de clientas en el sistema. Hoy `POST /clients` crea un registro nuevo siempre, permitiendo 20 "Lucia Pérez" con el mismo teléfono. Necesitamos deduplicación para mantener la base de clientas limpia y evitar confusión en la agenda.

## Alcance

### In Scope
- Campo `dni` obligatorio en modelo `Cliente` (unique)
- Validación de formato de teléfono argentino en schema (rechazar basura/garbage)
- `POST /clients` con find-or-create: si existe clienta con mismo `telefono`, retornarla sin crear duplicado
- `POST /clients` con DNI: si se provee `dni` y existe clienta con ese DNI, retornarla
- Todos los campos requeridos: `nombre`, `apellido`, `dni`, `telefono`
- Migración automática SQLModel (columna `dni` en tabla `cliente`)

### Out of Scope
- UI de administración para gestionar/editar DNI de clientas existentes (posterior)
- Fusión o limpieza de clientas duplicadas existentes en DB
- Envío de SMS/WhatsApp para verificar teléfono

## Capabilities

### New Capabilities
- `gestion-clientes`: Unicidad de clientas mediante deduplicación por teléfono y DNI opcional.

### Modified Capabilities
Ninguna — no existe spec previa para clientes.

## Approach

1. Agregar `dni: str = Field(unique=True)` a `ClienteBase` en models.py.
2. Agregar `dni: str` a `ClienteCreate` y `ClienteRead` en schemas.py.
3. En `POST /clients` (main.py): antes de insertar, buscar por `telefono`. Si existe, devolver ese cliente (200). Buscar por DNI como respaldo. Si no existe en ningún caso, crear.
4. Validación de teléfono argentino en `ClienteCreate` mediante Pydantic `field_validator`: permitir +54, 11/15, espacios y guiones; rechazar letras y caracteres no válidos; mínimo 7 dígitos.
5. Normalizar teléfono a formato limpio (solo dígitos, sin prefijos de país) antes de almacenar y buscar.

**Decisión**: DNI pasa a obligatorio para admin (único por clienta). Teléfono sigue siendo clave primaria de deduplicación para el flujo de búsqueda. Validación estricta evita datos basura sin llegar a verificación SMS.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/app/models.py` | Modified | +`dni: str` con unique en `ClienteBase` |
| `backend/app/schemas.py` | Modified | +`dni: str` requerido + validator de teléfono argentino |
| `backend/app/main.py` | Modified | Lógica find-or-create + validación en `POST /clients` |

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| DNI obligatorio rompe flujo online | Alta | El flujo online aún no está implementado; se ajusta creation cuando se implemente |
| Clientas existentes sin DNI en DB | Alta | Migración requerida: asignar DNI a clientas existentes o darles valor temporal |
| Validación de teléfono rechaza formato válido | Baja | Usar regex flexible que cubra +54 argentino, 11-mobile, 15-prefijo antiguo, números fijos |
| Dos clientas comparten teléfono (familia) | Baja | El negocio asume 1 teléfono = 1 clienta. Si ocurre, la segunda se registra con DNI distinto. |

## Rollback Plan

Revertir cambios en models.py, schemas.py y main.py. La columna `dni` queda huérfana en SQLite (no soporta `DROP COLUMN` sin recreate de tabla) pero no causa errores — se ignora.

## Dependencias

Ninguna.

## Success Criteria

- [ ] `POST /clients` con teléfono existente retorna 200 con cliente existente (sin duplicado)
- [ ] `POST /clients` con DNI existente retorna 200 con cliente existente
- [ ] `POST /clients` con teléfono y DNI nuevos crea cliente normalmente
- [ ] `POST /clients` con teléfono inválido (letras, <7 dígitos) retorna 422 con error de validación
- [ ] Teléfono se normaliza a solo dígitos antes de guardar
- [ ] `dni` es obligatorio en `ClienteCreate`
- [ ] Tests existentes de creación de clientes se actualizan y pasan
