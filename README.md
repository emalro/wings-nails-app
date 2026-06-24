# Wings Nails App

## Backend (FastAPI + SQLite)

Run locally:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.
A SQLite database (`dev.db`) is created automatically on first run.

Set the database URL with an environment variable (optional, defaults to SQLite):

```bash
export DATABASE_URL="sqlite:///./dev.db"
```

Run tests:

```bash
cd backend
pytest
```

### Docker

```bash
cd backend
docker build -t nails-backend .
docker run -p 8000:8000 nails-backend
```

---

## Frontend (React + Vite)

Run locally:

```bash
cd frontend
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

The app is scaffolded with TypeScript and `react-router-dom`.
Set the API base URL using an environment variable `VITE_API_URL` (e.g. `http://localhost:8000`).
Example on Windows PowerShell:

```powershell
$Env:VITE_API_URL = 'http://localhost:8000'
npm run dev
```

Or create a `.env` file with `VITE_API_URL=http://localhost:8000`.
