# Design: Pipeline CI/CD

## Technical Approach

Reemplazar el Dockerfile single-stage actual por un multi-stage que compile el frontend y lo sirva desde FastAPI como contenido estático. Agregar dos workflows de GitHub Actions (CI en PR/push, CD en push a main) y el script `typecheck` faltante en frontend. Sin cambios en lógica de negocio ni en la API.

## Architecture Decisions

### Decision: CI job topology

| Opción | Tradeoff | Decisión |
|--------|----------|----------|
| Job único (backend + frontend secuencial) | Más rápido de escribir, más lento de ejecutar | Rejected |
| Jobs paralelos backend / frontend | Dependencia cero, feedback más rápido | **Chosen** |

**Rationale**: No hay dependencia entre jobs. Python y Node no comparten artefactos en CI. Ejecutarlos en paralelo corta el feedback a la mitad.

### Decision: CD como workflow separado (no job dentro de CI)

| Opción | Tradeoff | Decisión |
|--------|----------|----------|
| Job CD dentro de ci.yml | Un solo archivo, pero mezcla triggers distintos | Rejected |
| Workflow separado cd.yml | Cada workflow tiene su trigger y permisos | **Chosen** |

**Rationale**: CI se dispara en PRs (sin permisos de deploy). CD necesita `GITHUB_TOKEN` con scope `packages:write`. Separarlos evita mezclar concerns y permite ajustar permisos independientemente.

### Decision: Docker multi-stage sobre compilación separada

| Opción | Tradeoff | Decisión |
|--------|----------|----------|
| Build frontend en CI, copiar artifact a Docker | CI produce artifact, CD lo consume | Rejected |
| Multi-stage Docker: node compila, python ejecuta | Autocontenido, un solo artifact | **Chosen** |

**Rationale**: Multi-stage elimina la dependencia entre workflows (CI no necesita pasar artifacts a CD). La imagen es autocontenida: contiene frontend compilado + backend. Se reemplaza el Dockerfile actual.

### Decision: StaticFiles con `html=True` en ruta `/`

| Opción | Tradeoff | Decisión |
|--------|----------|----------|
| Servir frontend desde nginx en contenedor separado | Complejidad operativa, dos servicios | Rejected |
| StaticFiles montado en `/` | Simplicidad, SPA fallback automático | **Chosen** |

**Rationale**: FastAPI monta `StaticFiles` después de las rutas de API — las rutas explícitas (`/health`, `/clients`, etc.) tienen prioridad. `html=True` habilita fallback para rutas SPA (`/admin`, `/reservar`). Sin infraestructura adicional.

## Data Flow

```
.github/workflows/ci.yml
  ┌──────────────────────┐     ┌──────────────────────┐
  │  backend-tests       │     │  frontend-check      │
  │  Python 3.11         │     │  Node 20             │
  │  pip install pytest  │     │  npm ci              │
  │  pytest              │     │  tsc --noEmit        │
  │                      │     │  npm run build       │
  └──────────────────────┘     └──────────────────────┘
          │                             │
          └──────── both OK ────────────┘
                        │
                   [PR mergable]

.github/workflows/cd.yml
  push to main ──→ Docker buildx (cache) ──→ push to ghcr.io
                     │                         ├─ :latest
                     │                         └─ :sha-<sha>
                     │
                  multi-stage:
                  1. node:20 → npm ci && npm run build → /frontend/dist
                  2. python:3.11-slim → copy backend + dist → pip install → uvicorn
```

## File Changes

| File | Action | Descripción |
|------|--------|-------------|
| `.github/workflows/ci.yml` | Create | CI workflow: backend-tests + frontend-check en paralelo |
| `.github/workflows/cd.yml` | Create | CD workflow: build multi-stage, push a ghcr.io |
| `backend/Dockerfile` | Replace | De single-stage a multi-stage con node:20 + python:3.11-slim |
| `backend/app/main.py` | Modify | Agregar montaje `StaticFiles` en `/` con `html=True` |
| `frontend/package.json` | Modify | Agregar script `"typecheck": "tsc --noEmit"` |

## Interfaces / Contracts

```python
# main.py — static mount (al final, después de todas las rutas API)
from fastapi.staticfiles import StaticFiles

app.mount("/", StaticFiles(directory="static", html=True), name="static")
```

```dockerfile
# Dockerfile — reemplazo completo
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/ ./
RUN npm ci && npm run build

FROM python:3.11-slim
WORKDIR /app
COPY backend/ ./
COPY --from=frontend-builder /frontend/dist /app/static
RUN pip install --no-cache-dir -r requirements.txt
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Testing Strategy

| Capa | Qué probar | Enfoque |
|------|-----------|---------|
| Integración | CI workflow corre pytest y tsc sin errores | Validación manual en PR de prueba |
| Integración | CD construye imagen Docker y publica tags | Push a main de prueba con CI exitoso |
| Manual | Healthcheck responde 200, SPA fallback en `/admin` | `docker run` local + curl |

**Nota**: No hay tests automatizados para los workflows de GitHub Actions. La validación es práctica: crear un PR de prueba con cambios mínimos y verificar que ambos jobs pasan, luego mergear y verificar CD.

## Migration / Rollout

1. **Commit 1**: Agregar `typecheck` script a `package.json` + montaje `StaticFiles` en `main.py` + nuevo `Dockerfile` multi-stage.
2. **Commit 2**: Crear `.github/workflows/ci.yml` y `.github/workflows/cd.yml`.
3. **PR de validación**: Abrir PR con un cambio trivial (ej. espacio en README) para verificar CI. Mergear para verificar CD.
4. **Branch protection**: Configurar en GitHub (Settings → Branches → main → Require status check "backend-tests / frontend-check").

## Open Questions

- [ ] Ninguna — todas las decisiones están cubiertas por la spec.
