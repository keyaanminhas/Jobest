# Jobest Backend (FastAPI)

FastAPI backend for Jobest multi-agent recruiter MVP.

## Environment and safety
- Target runtime: `proot-distro login --user linux linuxdesk`
- Project root: `/home/linux/projects/jobest/backend`
- Uses local virtualenv only (`.venv`)
- Binds to `0.0.0.0:8000` for private Tailscale access
- Secrets are stored in `.env` only

## Setup
```bash
cd /home/linux/projects/jobest/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

## Run
```bash
cd /home/linux/projects/jobest/backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Live Provider Mode
Set backend `.env` directly to an OpenAI-compatible provider:
- `LLM_MODE=live`
- `LLM_PROVIDER=nvidia` (or `openrouter` / `chutes`)
- `LLM_BASE_URL=<provider_base_url>/v1`
- `LLM_API_KEY=<provider_key>`
- `LLM_MODEL=<provider_model_id>`

Jobest controls its own backend sub-agent orchestration directly.

## Database + Auth
- Default persistence is SQLite via `DATABASE_URL=sqlite+aiosqlite:///./app/storage/jobest.db`.
- DB schema can auto-create on startup when `AUTO_CREATE_DB_SCHEMA=true`.
- Alembic migration scaffolding is included under `backend/alembic`.
- New org workflow APIs use JWT bearer auth:
  - `Authorization: Bearer <token>`
- Legacy run APIs still support `X-API-Key`.

Postgres remains optional by overriding `DATABASE_URL`.

## Endpoints
- `GET /health`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/job-postings`
- `GET /api/job-postings`
- `GET /api/job-postings/{job_posting_id}`
- `PATCH /api/job-postings/{job_posting_id}`
- `DELETE /api/job-postings/{job_posting_id}`
- `POST /api/job-postings/{job_posting_id}/candidates/upload`
- `GET /api/job-postings/{job_posting_id}/candidates`
- `POST /api/candidates/{candidate_id}/analyze`
- `GET /api/candidates/{candidate_id}`
- `GET /api/candidates/{candidate_id}/analysis`
- `GET /api/candidates/{candidate_id}/report`

## Legacy Endpoints
- `POST /api/single-cv-runs` (multipart: `cv_pdf`, optional `candidate_name_override`)
- `POST /api/hiring-runs`
- `GET /api/hiring-runs/{run_id}`
- `POST /api/hiring-runs/{run_id}/run`
- `GET /api/hiring-runs/{run_id}/shortlist`
- `GET /api/hiring-runs/{run_id}/report`

## Modes
- `LLM_MODE=mock`: Uses `app/storage/demo/*.json`
- `LLM_MODE=cached`: Uses only cached LLM responses (`app/storage/cache`)
- `LLM_MODE=live`: Calls OpenAI-compatible provider

## Quick Readiness Test
Run a local end-to-end smoke test without Postgres:
```bash
cd /home/linux/projects/jobest/backend
source .venv/bin/activate
python scripts/smoke_org_flow.py
```
