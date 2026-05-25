# Jobest Setup Guide

This file lists the minimum setup needed to run Jobest locally.

## Project Structure

- `backend/` FastAPI API and agent orchestration
- `frontend/` Next.js demo dashboard

## Requirements

- Python 3.10+
- Node.js 18+
- npm

## Backend Environment

Create `backend/.env` (or copy from `backend/.env.example`) and set:

- `APP_ENV=dev`
- `API_KEY=change-this-demo-key`
- `JWT_SECRET_KEY=change-this-jwt-secret`
- `DATABASE_URL=sqlite+aiosqlite:///./app/storage/jobest.db` (default)
- `AUTO_CREATE_DB_SCHEMA=true`
- `LLM_MODE=mock|cached|live`
- `LLM_PROVIDER=nvidia` (or your provider)
- `LLM_BASE_URL=https://integrate.api.nvidia.com/v1` (or provider base URL)
- `LLM_API_KEY=...` **required for live mode**
- `LLM_MODEL=meta/llama-3.1-70b-instruct` (or allowed model)
- `CACHE_LLM_RESPONSES=true|false`
- `USE_MOCK_LLM=true|false`
- `ALLOW_PROVIDER_FALLBACK=true|false`
- `FALLBACK_PROVIDER=openrouter` (optional)
- `FALLBACK_BASE_URL=https://openrouter.ai/api/v1` (optional)
- `FALLBACK_API_KEY=...` (optional)
- `FALLBACK_MODEL=...` (optional)

### API Keys Needed

- Required for `LLM_MODE=live`:
  - `LLM_API_KEY`
- Optional fallback:
  - `FALLBACK_API_KEY`

If you use NVIDIA NIM, set your NVIDIA key in `LLM_API_KEY`.

## Frontend Environment

Create `frontend/.env.local` (or copy from `.env.local.example`):

- `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`

## Run Backend

From `backend/`:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Run Frontend

From `frontend/`:

```bash
npm install
npm run dev
```

Open: `http://localhost:3000`

## Org MVP Flow

- Open `http://localhost:3000`
- Sign up / login
- Create a job posting
- Upload CV PDFs on posting page (triage ranking happens on upload)
- Open candidate page and click **Run Full Analysis**
- Poll live stage progress and open candidate report

## Live Provider Mode

Use any OpenAI-compatible provider directly from backend `.env`:
- `LLM_MODE=live`
- `LLM_PROVIDER=nvidia` (or `openrouter` / `chutes`)
- `LLM_BASE_URL=<provider_base_url>/v1`
- `LLM_API_KEY=<provider_key>`
- `LLM_MODEL=<provider_model_id>`

Jobest orchestrates its own sub-agents entirely in backend code.

## Notes

- Keep secrets only in local `.env` files.
- `.env` files are gitignored and should not be committed.
- Use `mock` mode first for demos without live provider calls.
- Postgres is optional; if you want it, override `DATABASE_URL` with your Postgres DSN.
