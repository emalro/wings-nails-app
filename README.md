# Frontend (React + Vite)

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
