# Wings Nails App

## Requisitos

- Python 3.11+
- Node.js 18+
- (Opcional) PostgreSQL local o cuenta Supabase

---

## Backend (FastAPI + SQLModel)

### Setup local (SQLite — por defecto)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Copiá el archivo de env vars y completalo:

```bash
cp .env.example .env
# Editá .env con tus valores (ver sección Environment Variables)
```

Corré el servidor:

```bash
uvicorn app.main:app --reload --port 8000
```

La API estará en `http://localhost:8000`. La DB SQLite (`dev.db`) se crea automáticamente.

### Setup con Supabase (PostgreSQL)

1. Creá un proyecto en [Supabase](https://supabase.com) (free tier)
2. Andá a **Settings → Database** y copiá la connection string (URI mode)
3. Seteá la env var:

```bash
export DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
```

4. Importá el schema:

```bash
psql $DATABASE_URL -f supabase/migrations/001_initial_schema.sql
```

5. Corré el servidor — las tablas se crean automáticamente via `SQLModel.metadata.create_all`

### Tests

```bash
cd backend
pytest
```

### Docker

```bash
# Desde la RAÍZ del repo
docker build -f backend/Dockerfile -t nails-backend .
docker run -p 8000:8000 nails-backend
```

---

## Frontend (React + Vite + TypeScript)

### Setup local

```bash
cd frontend
npm install
npm run dev
```

El frontend defaulta a `http://localhost:8000` como API URL. No necesitás setear `VITE_API_URL` en desarrollo local.

Si querés overridear:

```powershell
# Windows PowerShell
$Env:VITE_API_URL = 'http://localhost:8000'
npm run dev
```

O creá un archivo `.env`:

```
VITE_API_URL=http://localhost:8000
```

### Build de producción

```bash
npm run build    # genera dist/
npm run preview  # preview local del build
```

### Type-check

```bash
npm run typecheck
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Requerida | Default | Descripción |
|----------|-----------|---------|-------------|
| `DATABASE_URL` | No | `sqlite:///./dev.db` | Connection string de la DB |
| `JWT_SECRET_KEY` | **Sí** | — | Secret para firmar JWTs (usá un string largo y random) |
| `ADMIN_EMAIL` | **Sí** | — | Email del admin seed (ej: `admin@wingsnails.com`) |
| `ADMIN_PASSWORD_HASH` | **Sí** | — | Hash bcrypt de la contraseña del admin |
| `CORS_ORIGINS` | No | `http://localhost:5173` | Orígenes permitidos (comma-separated) |
| `LOGIN_RATE_LIMIT` | No | `5/minute` | Rate limit para el endpoint de login |

### Frontend (`frontend/.env`)

| Variable | Requerida | Default | Descripción |
|----------|-----------|---------|-------------|
| `VITE_API_URL` | No | `http://localhost:8000` | URL del backend API |

### Generar password hash para el admin

```bash
cd backend
python -c "from app.auth import get_password_hash; print(get_password_hash('TU_PASSWORD_AQUI'))"
```

Copiá el hash generado a `ADMIN_PASSWORD_HASH` en tu `.env`.

---

## Estructura del proyecto

```
wings-nails-app/
├── backend/           # FastAPI API
│   ├── app/
│   │   ├── main.py        # Routes + startup
│   │   ├── models.py      # SQLModel entities
│   │   ├── schemas.py     # Pydantic schemas
│   │   ├── database.py    # Engine + session
│   │   ├── auth.py        # JWT utilities
│   │   └── deps.py        # FastAPI dependencies
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/          # React SPA
│   ├── src/
│   │   ├── pages/         # Home, Reservar, Admin, Login
│   │   ├── components/    # UI components
│   │   ├── hooks/         # TanStack Query hooks
│   │   ├── api.ts         # Axios client
│   │   └── main.tsx       # Entry point
│   └── package.json
├── supabase/
│   └── migrations/    # PostgreSQL schema
├── cron-config.md     # Cold start cron setup
└── openspec/          # SDD artifacts
```
