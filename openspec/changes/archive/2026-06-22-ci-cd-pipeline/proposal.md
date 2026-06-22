# Propuesta: Pipeline CI/CD con GitHub Actions

## Intención

Automatizar la validación y entrega del sistema mediante gates automáticos que ejecuten tests, verifiquen tipos y construyan la imagen Docker en cada PR y push a `main`, eliminando el riesgo de integrar código roto sin detectarlo.

## Alcance

### Incluye
- Workflow CI: tests backend + type-check y build frontend en cada PR y push a `main`
- Workflow CD: build multi-stage y push a ghcr.io en push a `main`
- Dockerfile multi-stage (Node build frontend → Python sirve frontend + API)
- Mount estático de frontend build desde FastAPI
- Script `typecheck` en `package.json`

### Excluye
- Despliegue a un host concreto (solo publicación de imagen en ghcr.io)
- Tests frontend (no hay runner disponible)
- Linting o formateo automático
- Entornos de staging o preview

## Capacidades

### Nuevas Capacidades
- `ci-cd-pipeline`: pipeline automatizado de integración continua y entrega continua con GitHub Actions

### Capacidades Modificadas
Ninguna — no cambia comportamiento existente del sistema.

## Enfoque

1. **CI** (`.github/workflows/ci.yml`): triggers en PR y push a `main`. Jobs en paralelo: backend corre tests con pytest, frontend corre `tsc --noEmit` + `vite build`.
2. **CD** (`.github/workflows/cd.yml`): trigger en push a `main`. Build multi-stage Docker: stage 1 build frontend con Node, stage 2 sirve con Python. Push a `ghcr.io/emalro/wings-nails-app:latest` y tag semver.
3. **Dockerfile**: reemplazar el actual single-stage por multi-stage con `node:20-alpine` para build frontend y `python:3.11-slim` para runtime.
4. **FastAPI**: agregar `Mount("/", StaticFiles(directory="dist", html=True))` para servir frontend desde el backend.
5. **package.json**: agregar script `"typecheck": "tsc --noEmit"`.

## Áreas Afectadas

| Archivo | Impacto | Descripción |
|---------|---------|-------------|
| `.github/workflows/ci.yml` | Nuevo | Workflow de integración continua |
| `.github/workflows/cd.yml` | Nuevo | Workflow de entrega continua |
| `backend/Dockerfile` | Modificado | Multi-stage con build frontend |
| `backend/.dockerignore` | Modificado | Excluir node_modules, .venv |
| `backend/app/main.py` | Modificado | Mount de frontend build |
| `frontend/package.json` | Modificado | Script `typecheck` |

## Riesgos

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| Secrets de ghcr.io mal configurados | Baja | Documentar setup de `CR_PAT` en setup inicial |
| Build de Docker lento (>10 min) | Media | Cache de capas de Docker, dependencias separadas |
| Frontend build falla en CI pero funciona local | Baja | CI corre mismo comando `vite build` que local |

## Plan de Rollback

Revertir PR que agregue los workflows y el Dockerfile. La imagen previa en ghcr.io sigue disponible con tag `latest` anterior.

## Dependencias

- Cuenta GitHub con GitHub Actions habilitado
- Personal Access Token (classic) con `write:packages` para ghcr.io, configurado como `CR_PAT` en secrets del repo

## Criterios de Éxito

- [ ] CI corre tests backend y type-check frontend en cada PR
- [ ] CD build y push de imagen Docker a ghcr.io en cada push a `main`
- [ ] Frontend build se sirve correctamente desde FastAPI vía static mount
