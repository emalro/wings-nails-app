# Pipeline CI/CD

**Domain**: `ci-cd-pipeline`
**Status**: Active

---

## Propósito

Automatizar validación y entrega del sistema mediante pipelines de GitHub Actions que ejecuten tests, type-check y build Docker en cada PR y push a `main`, eliminando el riesgo de integrar código que no pasa verificaciones.

## Requirements

### CI-001 — Integración Continua

El sistema DEBE ejecutar un workflow CI en cada pull request hacia `main` y cada push a `main`.

- Job `backend` (Python 3.11): instalar dependencias desde `requirements.txt`, ejecutar `pytest`.
- Job `frontend` (Node 20): `npm ci`, `tsc --noEmit`, `npm run build`.
- Ambos jobs DEBEN ejecutarse en paralelo. El workflow DEBE reportar `failure` si algún job falla.
- La rama `main` DEBE tener branch protection que requiera CI como check obligatorio.

#### Escenario: PR con tests y build exitosos
- DADO un PR contra `main` con todos los tests, type-check y build OK
- CUANDO GitHub Actions ejecuta el workflow CI
- THEN el workflow reporta `success`
- Y el PR puede mergearse

#### Escenario: PR con test backend fallido
- DADO un PR contra `main` con al menos un test de `pytest` fallido
- CUANDO GitHub Actions ejecuta el workflow CI
- THEN el workflow reporta `failure`
- Y el merge del PR está bloqueado

#### Escenario: PR con error de tipo en frontend
- DADO un PR contra `main` con error en `tsc --noEmit`
- CUANDO GitHub Actions ejecuta el workflow CI
- THEN el workflow reporta `failure`
- Y el merge del PR está bloqueado

### CI-002 — Entrega Continua y Docker Multi-stage

El sistema DEBE publicar una imagen Docker multi-stage en GitHub Container Registry (ghcr.io) por cada push a `main` con CI exitoso.

- Workflow CD DEBE activarse solo en push a `main`.
- Docker multi-stage: stage 1 (`node:20`) compila el frontend vía `npm run build`; stage 2 (`python:3.11-slim`) copia backend y `frontend/dist/`, instala dependencias Python, expone puerto 8000.
- La imagen DEBE incluir healthcheck via `python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"`.
- Tags: `ghcr.io/emalro/wings-nails-app:latest` y `:sha-${{ github.sha }}`.

#### Escenario: Push a main con CI exitoso
- DADO un push a `main`
- Y el workflow CI reportó `success` en ese commit
- CUANDO GitHub Actions ejecuta el workflow CD
- THEN construye la imagen multi-stage sin errores
- Y la publica en `ghcr.io/emalro/wings-nails-app:latest`
- Y la publica en `ghcr.io/emalro/wings-nails-app:sha-<sha>`

#### Escenario: Imagen contiene API y frontend
- DADO la imagen Docker publicada
- CUANDO se inicia un contenedor con `docker run`
- THEN responde `GET /health` con 200
- Y responde `GET /` con el `index.html` del frontend compilado

### CI-003 — Frontend servido por FastAPI

El backend DEBE servir el frontend compilado como contenido estático.

- DEBE montar `StaticFiles(directory="static", html=True)` en la ruta `/`.
- DEBE mantener healthcheck en `GET /health` retornando `{"status": "ok"}`.
- `html=True` DEBE habilitar SPA fallback para rutas de cliente (`/admin`, `/reservar`, etc.).

#### Escenario: SPA fallback
- DADO la imagen en ejecución
- CUANDO se solicita `GET /admin` (ruta SPA)
- THEN el servidor responde con `index.html` del frontend
- Y el router del cliente maneja la navegación

### CI-004 — Script typecheck

El frontend DEBE incluir el script `typecheck` en `package.json`.

- `"typecheck": "tsc --noEmit"`.

#### Escenario: Ejecución local
- DADO el proyecto frontend sin errores de tipo
- CUANDO se ejecuta `npm run typecheck`
- THEN termina con código 0

### CI-005 — Branch protection en main

La rama `main` DEBE tener branch protection que exija CI como check obligatorio antes del merge.

#### Escenario: Merge bloqueado por CI fallido
- DADO un PR con CI en estado `failure`
- CUANDO se intenta mergear
- THEN GitHub bloquea el merge
- Y muestra el check de CI como requerido no superado
