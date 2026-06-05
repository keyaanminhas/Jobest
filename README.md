# Jobest

Jobest is an AI recruiter decision-support platform built for the AI Marathon 2026 "Intelligent Recruiter" problem statement.

Jobest supports:

- recruiter auth with email/password and optional Chutes OAuth
- job posting creation with must-have and nice-to-have skills
- bulk PDF CV upload
- triage scoring for fast ranking
- queued full candidate analysis with visible pipeline progress
- recruiter-facing report pages
- public application links per job posting
- a recruiter copilot at `/ai`

The primary workflow is the app under `/jobs`, `/candidates`, `/reports`, `/settings`, and `/ai`. Legacy `/runs/*` pages and `X-API-Key` endpoints remain available for compatibility.

## Pipeline

Jobest now runs a 12-stage hiring pipeline:

1. JD Deconstruction Agent
2. Hiring Context Agent
3. Resume Parsing Agent
4. Candidate Evidence Agent
5. Transferable Skill Agent
6. Professional Link Fetcher Agent
7. Professional Footprint Agent
8. Risk & Contradiction Agent
9. Score Aggregation Engine
10. Hiring Panel Review Agent
11. Interview Pack Generator Agent
12. Final Shortlist Report Agent

How the pipeline works:

- `Professional Link Fetcher Agent` uses backend logic plus optional GitHub API access.
- `Score Aggregation Engine` is computed in backend code.
- In live mode, Jobest makes `8` LLM calls per candidate: `triage_ranker` plus `7` deep-analysis agents.
- Each hiring run also adds `3` shared LLM calls: `jd_deconstruction`, `hiring_context`, and `final_report`.

## Tech Stack

- Frontend: `Next.js 15`, `React 19`, `TypeScript`, `Tailwind CSS`, `Framer Motion`, `Radix UI`
- Backend: `FastAPI`, `SQLAlchemy 2`, `SQLite` by default, optional Postgres via `DATABASE_URL`
- PDF parsing: `PyMuPDF` (`fitz`)
- Auth: JWT bearer auth for org workflow, optional Chutes OAuth
- LLM routing: OpenAI-compatible provider interface with provider fallback support
- Persistence: SQLite database plus local filesystem uploads under `backend/app/storage` and `backend/app/storage/uploads`

## Repository Structure

```text
Jobest/
├─ backend/
│  ├─ app/
│  │  ├─ agents/
│  │  ├─ api/
│  │  ├─ prompts/
│  │  ├─ schemas/
│  │  ├─ services/
│  │  └─ storage/
│  ├─ alembic/
│  ├─ scripts/
│  ├─ requirements.txt
│  └─ .env.example
├─ frontend/
│  ├─ app/
│  ├─ components/
│  ├─ lib/
│  ├─ package.json
│  └─ .env.local.example
├─ docs/
├─ presentation/
└─ README.md
```

## Dependencies

### Runtime requirements

- `Python 3.10+`
- `Node.js 18+`
- `npm`

### Backend Python packages

Current backend dependencies are installed from `backend/requirements.txt`:

- `fastapi`
- `uvicorn`
- `pydantic`
- `python-dotenv`
- `httpx`
- `python-multipart`
- `pymupdf`
- `sqlalchemy>=2.0`
- `aiosqlite`
- `asyncpg`
- `alembic`
- `passlib[bcrypt]`
- `python-jose[cryptography]`
- `email-validator`
- `beautifulsoup4`

### Frontend npm packages

Current frontend dependencies are installed from `frontend/package.json`:

- `next`
- `react`
- `react-dom`
- `tailwindcss`
- `framer-motion`
- `lucide-react`
- `@radix-ui/react-dialog`
- `@radix-ui/react-tooltip`
- `qrcode`
- `react-markdown`
- `remark-gfm`

## Local Setup

### 1. Clone

```bash
git clone https://github.com/keyaanminhas/Jobest.git
cd Jobest
```

### 2. Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Create `backend/.env` with:

```env
APP_ENV=dev
API_KEY=change-this-demo-key
JWT_SECRET_KEY=change-this-jwt-secret
USER_AGENT_CONFIG_ENCRYPTION_KEY=change-this-32-char-secret

DATABASE_URL=sqlite+aiosqlite:///./app/storage/jobest.db
AUTO_CREATE_DB_SCHEMA=true
SQLITE_BUSY_TIMEOUT_SECONDS=300
ANALYSIS_RUN_TIMEOUT_SECONDS=900

FRONTEND_APP_URL=http://127.0.0.1:3001

LLM_MODE=mock
LLM_PROVIDER=chutes
LLM_BASE_URL=https://llm.chutes.ai/v1
LLM_API_KEY=
LLM_MODEL=deepseek-ai/DeepSeek-V3.2-TEE

CACHE_LLM_RESPONSES=true
USE_MOCK_LLM=false
ALLOW_PROVIDER_FALLBACK=true
FALLBACK_PROVIDER=openrouter
FALLBACK_BASE_URL=https://openrouter.ai/api/v1
FALLBACK_API_KEY=
FALLBACK_MODEL=meta/llama-3.1-70b-instruct

CHUTES_BASE_URL=https://llm.chutes.ai/v1
CHUTES_API_KEY=
CHUTES_MODEL=deepseek-ai/DeepSeek-V3.2-TEE

CHUTES_OAUTH_AUTHORIZE_URL=https://api.chutes.ai/idp/authorize
CHUTES_OAUTH_TOKEN_URL=https://api.chutes.ai/idp/token
CHUTES_OAUTH_USERINFO_URL=https://api.chutes.ai/idp/userinfo
CHUTES_OAUTH_CLIENT_ID=
CHUTES_OAUTH_CLIENT_SECRET=
CHUTES_OAUTH_SCOPES=profile:read

GITHUB_TOKEN=
```

Key points:

- `LLM_MODE=mock` uses the JSON fixtures under `backend/app/storage/demo/`.
- `LLM_MODE=live` uses the configured OpenAI-compatible provider.
- `USER_AGENT_CONFIG_ENCRYPTION_KEY` enables encrypted per-user API key storage from the settings page.
- The Chutes OAuth callback resolves to `http://127.0.0.1:3001/api/auth/chutes/callback` when `FRONTEND_APP_URL=http://127.0.0.1:3001`.

Run the backend:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Backend URLs:

- API: `http://127.0.0.1:8001`
- Swagger: `http://127.0.0.1:8001/docs`
- Health: `http://127.0.0.1:8001/health`

### 3. Frontend setup

```bash
cd ../frontend
npm install
cp .env.local.example .env.local
```

Create `frontend/.env.local` with:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8001
NEXT_PUBLIC_API_KEY=change-this-demo-key
BACKEND_INTERNAL_ORIGIN=http://127.0.0.1:8001
```

Key points:

- `NEXT_PUBLIC_API_BASE_URL` is used by the browser-side API client.
- `NEXT_PUBLIC_API_KEY` is used by the legacy `/api/hiring-runs` flow and public form helpers that send `X-API-Key`.
- `BACKEND_INTERNAL_ORIGIN` is used by Next.js rewrites for `/api/*`.

Run the frontend:

```bash
npm run dev
```

Frontend URL:

- `http://127.0.0.1:3001`

## Demo Account

When the bundled SQLite database `backend/app/storage/jobest.db` is included, the public demo account is:

- Email: `test_recruiter@example.com`
- Password: `StrongPass123!`

This account already includes seeded demo data in the bundled database, including job postings, uploaded candidates, and analysis results.

If you are not using the bundled database, create a local account through `/auth/signup` and load your own demo data.

## Demo Data

Included demo assets:

- bundled SQLite DB: `backend/app/storage/jobest.db`
- bundled sample CV PDFs: `backend/storage/demo_cvs/`
- demo LLM outputs for mock mode: `backend/app/storage/demo/*.json`
- submission video: `docs/submission/Jobest_demo.mp4`

There is also a CV generator script:

```bash
python3 backend/scripts/generate_demo_cvs.py
```

- `backend/scripts/generate_demo_cvs.py` currently writes to a hardcoded Windows path.
- The bundled PDFs under `backend/storage/demo_cvs/` are ready to use immediately.

## Quick Walkthrough

1. Start backend on `8001`.
2. Start frontend on `3001`.
3. Open `http://127.0.0.1:3001/auth/signup` and create the demo user above if it does not exist yet.
4. Open `/jobs` and create a job posting.
5. Upload a few PDFs from `backend/storage/demo_cvs/`.
6. Review triage scores.
7. Start candidate analysis.
8. Open candidate reports and the aggregate reports page.
9. Open `/ai` to use the recruiter copilot.

## Runtime Modes

- `LLM_MODE=mock`
  - uses `backend/app/storage/demo/*.json`
  - best for offline demos and first-time boot
- `LLM_MODE=cached`
  - serves only cached LLM outputs from `backend/app/storage/cache`
- `LLM_MODE=live`
  - calls the configured OpenAI-compatible provider

## API Surface

Main org workflow endpoints:

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/job-postings`
- `GET /api/job-postings`
- `POST /api/job-postings/{job_posting_id}/candidates/upload`
- `POST /api/candidates/{candidate_id}/analyze`
- `GET /api/candidates/{candidate_id}/analysis`
- `GET /api/candidates/{candidate_id}/report`
- `GET /api/reports`
- `GET /api/agent-settings`
- `PUT /api/agent-settings`
- `GET /api/agents/status`
- `GET /api/analysis-queue`

Legacy compatibility endpoints:

- `POST /api/single-cv-runs`
- `POST /api/hiring-runs`
- `POST /api/hiring-runs/{run_id}/run`
- `GET /api/hiring-runs/{run_id}`

## Recruiter Copilot Tools

The recruiter copilot at `/ai` supports these tools.

### Read tools

- `list_job_postings` - list workspace job postings
- `get_job_posting` - read one job posting, including hiring context, status, and skills
- `list_candidates` - list candidates, optionally filtered by job posting
- `get_candidate_detail` - read one candidate profile, triage, role, and latest outputs
- `search_resumes` - search stored resume text and triage summaries
- `get_candidate_report` - read the final candidate report
- `get_job_insights` - summarize top, completed, or report-ready candidates for one job posting
- `get_workspace_summary` - summarize workspace coverage across jobs and candidates
- `get_runtime_settings_safe` - read visible runtime settings
- `get_public_application_link` - read a job posting's public application link and status
- `find_unsupported_claims` - find candidates flagged for unsupported claims
- `find_risk_flags` - find candidates with major risk flags
- `get_analysis_queue` - inspect queued and running analysis counts
- `generate_outreach_email` - draft outreach or rejection emails for a candidate
- `compare_candidates` - compare candidates side-by-side
- `generate_targeted_interview_questions` - generate probing interview questions from risk and evidence gaps

### Action tools

- `create_job_posting` - create a new job posting
- `run_triage_for_job` - rerun triage for every candidate in a posting
- `run_candidate_full_analysis` - queue full analysis for one or more candidates
- `run_stage_on_candidates` - queue a prerequisite-aware refresh of a selected pipeline stage
- `upload_candidate_pdfs_to_job` - copy stored PDF-backed candidate profiles into another job posting
- `upload_candidate_pdfs_to_multiple_jobs` - copy stored PDF-backed candidate profiles into multiple job postings
- `duplicate_candidate_to_job` - duplicate a candidate into another job posting
- `move_candidate_to_job` - move a candidate into another job posting and reset role-specific outputs
- `update_runtime_settings_safe` - update parallel agents, retry attempts, or retry delay
- `update_job_posting` - update a job posting's title, description, context, priority, status, and skills
- `update_public_application_access` - open or close public applications for a posting

Action tools are confirmation-gated in the copilot experience.

## Team

`C0nc3pt Squad`

## License

Hackathon project. No open-source license has been applied yet.
