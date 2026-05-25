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

## API key header
All `/api/*` routes require:
- Header: `X-API-Key: <API_KEY from .env>`

## Endpoints
- `GET /health`
- `POST /api/hiring-runs`
- `POST /api/hiring-runs/{run_id}/run`
- `GET /api/hiring-runs/{run_id}/shortlist`
- `GET /api/hiring-runs/{run_id}/report`

## Modes
- `LLM_MODE=mock`: Uses `app/storage/demo/*.json`
- `LLM_MODE=cached`: Uses only cached LLM responses (`app/storage/cache`)
- `LLM_MODE=live`: Calls OpenAI-compatible provider
