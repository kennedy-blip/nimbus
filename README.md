# Signal Audit: Real-Time Data & Code Audit Dashboard

A full-stack dataset audit dashboard built with FastAPI, Polars, React, and Tailwind CSS. Upload a CSV or Parquet file to calculate dataset dimensions, completeness, per-column missingness and cardinality, numeric statistics, duplicate-row count, processing time, and a ten-row preview.

Uploads are processed in memory and are not written to disk or stored in a database. The API enforces a 25 MiB default file limit and accepts `.csv` and `.parquet` extensions only.

## Repository layout

```text
.
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── auditor.py
│   │   └── main.py
│   ├── .dockerignore
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/AuditSummary.jsx
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── .env.example
│   ├── Dockerfile
│   ├── index.html
│   ├── nginx.conf
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── vite.config.js
├── docker-compose.yml
├── render.yaml
└── README.md
```

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness check for hosting platforms. |
| `POST` | `/api/audit` | Multipart form upload with field name `file`; returns dataset metrics and preview. |
| `GET` | `/api/metrics` | Process-local counters: completed audits, bytes processed, and average processing time. |
| `GET` | `/docs` | Interactive OpenAPI documentation. |

The audit response includes `file_name`, `file_size_bytes`, `rows`, `columns`, `total_cells`, `missing_cells`, `completeness_pct`, `duplicate_rows`, `processing_ms`, `column_details`, and `preview`. Numeric columns include min, max, mean, median, and standard deviation. Nulls and floating-point NaNs are counted as missing.

### Example API request

```bash
curl -X POST http://localhost:8000/api/audit \\
  -F "file=@./sample.csv"
```

## Run locally

Requirements: Python 3.12+ and Node.js 20+.

### Option A: Docker Compose

From the repository root:

```bash
docker compose up --build
```

Open `http://localhost:8080`. The API runs at `http://localhost:8000`; API docs are at `http://localhost:8000/docs`.

### Option B: Run services separately

Start the backend in one terminal:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
# Windows PowerShell: .venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Start the frontend in another terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`. Set `VITE_API_BASE_URL` in `frontend/.env` if the API is not at `http://localhost:8000`. Vite embeds this URL at build time.

## GitHub setup

Create an empty repository on GitHub first, then from this project directory run:

```bash
git init
git add .
git commit -m "Build data and code audit dashboard"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USER/YOUR_REPOSITORY.git
git push -u origin main
```

Replace the remote URL with the repository URL GitHub gives you. If Git prompts for credentials, authenticate using GitHub's supported Git Credential Manager or SSH setup; do not put a personal access token in the URL.

## Deploy the backend on Render

1. Push the repository to GitHub using the commands above.
2. In Render, create a new **Blueprint** from the repository. Render will read `render.yaml` and build the Docker service from `backend/`.
3. Set the service environment variable `CORS_ORIGINS` to your exact deployed Vercel origin, for example `https://your-dashboard.vercel.app` (no trailing slash). The Blueprint marks this value as manual.
4. Wait for the service to become healthy. Confirm `https://YOUR_RENDER_SERVICE.onrender.com/health` returns `{"status":"ok"}`. Copy the service base URL.

The service binds to Render's `PORT` variable. `MAX_UPLOAD_BYTES` defaults to 25 MiB.

## Deploy the frontend on Vercel

1. Import the same GitHub repository as a Vercel project.
2. Set **Root Directory** to `frontend` and use the Vite defaults: build command `npm run build`, output directory `dist`, install command `npm install`.
3. Add the environment variable `VITE_API_BASE_URL` with the Render API base URL, such as `https://YOUR_RENDER_SERVICE.onrender.com` (no trailing slash).
4. Deploy or redeploy the frontend so Vite bakes the API URL into the bundle.
5. Set the Render `CORS_ORIGINS` variable to the final Vercel origin and redeploy/restart the API if needed.

For Vercel preview deployments, either add each preview origin to `CORS_ORIGINS` or use a controlled wildcard pattern only if you implement explicit origin validation. This API intentionally uses an explicit allowlist.

## Railway alternative

Create a Railway service from the same repository and set its root directory to `backend`. Use the Dockerfile in that directory, or configure:

- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Variables: `CORS_ORIGINS=https://your-dashboard.vercel.app`, `MAX_UPLOAD_BYTES=26214400`

Deploy the frontend to Vercel as above, with `VITE_API_BASE_URL` set to the Railway service's public URL.

## Operational notes

- `/api/metrics` counters live only in the running process and reset on restart; they are not durable analytics.
- This sample has no authentication, rate limiting, or persistent audit history. Add those before exposing sensitive or high-volume workloads publicly.
- Increase the upload limit only after sizing worker memory for concurrent uploads. Polars reads the full dataset into memory for the current audit.
- Configure `CORS_ORIGINS` with the exact trusted browser origins rather than `*`.
