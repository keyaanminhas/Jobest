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

## Notes

- Keep secrets only in local `.env` files.
- `.env` files are gitignored and should not be committed.
- Use `mock` mode first for demos without live provider calls.
