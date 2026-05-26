# Jobest

Jobest is our AI Marathon 2026 submission for the **Intelligent Recruiter** problem statement.

It is a recruiter decision-support system that takes a job description and a pool of candidate resumes, then produces:

- shortlist-oriented triage
- visible multi-agent analysis
- evidence-backed candidate reports
- professional footprint checks
- structured scoring and final recommendation

The system is built as an **Org MVP** for live demos and local judging.

## Problem Statement

From the AI Marathon 2026 track list:

> **The Intelligent Recruiter**  
> Traditional job boards are static. Your goal is to build an agent that bridges the gap between diverse talent and hiring managers.  
> **Mission:** Create an agent that takes a job description and a pool of candidate data (resumes/profiles) and identifies the best matches.

Jobest addresses that by combining deterministic scoring with LLM-assisted specialist agents, instead of returning a single opaque ranking.

## What It Does

Jobest allows a recruiter to:

1. Create a job posting with a title, job description, hiring context, priorities, and structured skill requirements.
2. Upload candidate CV PDFs in bulk.
3. Run fast triage scoring to rank candidates before full analysis.
4. Launch deep candidate analysis through a visible agent pipeline.
5. Inspect evidence, risk, professional footprint, and final recommendation on candidate report pages.

## Core Idea

Instead of one model doing everything, Jobest decomposes hiring into specialized stages:

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

This makes the system easier to trust because each stage exposes structured output and can be inspected independently.

## Tech Stack

- Frontend: `Next.js 15`, `React 19`, `Tailwind CSS`
- Backend: `FastAPI`, `SQLAlchemy`, `SQLite`
- Document Parsing: `PyMuPDF`
- AI / LLM Routing: provider-configurable OpenAI-compatible backend

## Repository Structure

```text
jobest/
├─ backend/
│  ├─ app/
│  │  ├─ agents/
│  │  ├─ api/
│  │  ├─ prompts/
│  │  ├─ schemas/
│  │  ├─ services/
│  │  └─ storage/
│  ├─ scripts/
│  └─ requirements.txt
├─ frontend/
│  ├─ app/
│  ├─ components/
│  ├─ lib/
│  └─ package.json
└─ README.md
```

## Local Setup

### Requirements

- Python `3.10+`
- Node.js `18+`
- npm

### 1. Clone the repository

```bash
git clone https://github.com/keyaanminhas/Jobest.git
cd Jobest
```

### 2. Backend setup

From `backend/`:

```bash
python -m venv .venv
```

Activate the virtual environment:

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Windows CMD:

```cmd
.venv\Scripts\activate.bat
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create `backend/.env` and set:

```env
APP_ENV=dev
API_KEY=change-this-demo-key
JWT_SECRET_KEY=change-this-jwt-secret
DATABASE_URL=sqlite+aiosqlite:///./app/storage/jobest.db
AUTO_CREATE_DB_SCHEMA=true

LLM_MODE=mock
LLM_PROVIDER=nvidia
LLM_BASE_URL=https://integrate.api.nvidia.com/v1
LLM_API_KEY=
LLM_MODEL=meta/llama-3.1-70b-instruct

CACHE_LLM_RESPONSES=true
USE_MOCK_LLM=true
ALLOW_PROVIDER_FALLBACK=true
FALLBACK_PROVIDER=openrouter
FALLBACK_BASE_URL=https://openrouter.ai/api/v1
FALLBACK_API_KEY=
FALLBACK_MODEL=

FRONTEND_APP_URL=http://localhost:3001
```

Notes:

- `mock` mode is the safest default for first launch.
- If you want live model calls, switch `LLM_MODE=live` and provide real provider keys.
- `jobest.db` is already included for demo/testing convenience in this repo state.

### Chutes API support

Jobest supports Chutes as an OpenAI-compatible LLM provider.

Example backend `.env` values:

```env
LLM_MODE=live
LLM_PROVIDER=chutes
LLM_BASE_URL=https://llm.chutes.ai/v1
LLM_API_KEY=your_chutes_api_key
LLM_MODEL=deepseek-ai/DeepSeek-V3.2-TEE
ALLOW_PROVIDER_FALLBACK=false
USE_MOCK_LLM=false
```

You can also use provider-specific variables:

```env
CHUTES_BASE_URL=https://llm.chutes.ai/v1
CHUTES_API_KEY=your_chutes_api_key
CHUTES_MODEL=deepseek-ai/DeepSeek-V3.2-TEE
```

Run the backend:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Backend URL:

```text
http://127.0.0.1:8000
```

Swagger docs:

```text
http://127.0.0.1:8000/docs
```

### 3. Frontend setup

From `frontend/`:

```bash
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

Run the frontend:

```bash
npm run dev
```

Frontend URL:

```text
http://127.0.0.1:3001
```

## Running the Demo

### Main workflow

1. Open `http://127.0.0.1:3001`
2. Sign up or log in
3. Create or open a job posting
4. Upload candidate CV PDFs
5. Review triage ranking
6. Open a candidate
7. Run full analysis
8. Open the candidate report

### Demo CV pack

This repo includes a synthetic demo-CV generator:

```bash
python backend/scripts/generate_demo_cvs.py
```

It generates `15` synthetic resumes in:

```text
C:\Users\Keyaan\Documents\code\AI Marathon Hackathon\Demo CV Pack
```

These are useful for recording the video demo and showing ranking spread across strong, medium, and weak candidates.

## Chutes Login

The app supports Chutes OAuth login.

Required environment variables for OAuth:

```env
CHUTES_OAUTH_AUTHORIZE_URL=
CHUTES_OAUTH_TOKEN_URL=
CHUTES_OAUTH_USERINFO_URL=
CHUTES_OAUTH_CLIENT_ID=
CHUTES_OAUTH_CLIENT_SECRET=
CHUTES_OAUTH_REDIRECT_URI=
CHUTES_OAUTH_SCOPES=profile:read
```

If these are not configured, local email/password authentication still works.

## Scoring Model

Jobest uses two layers:

### Triage scoring

- fast keyword and LLM-assisted first pass
- capped at `80`
- intended only for shortlist prioritization before deep analysis

### Full analysis scoring

The deep-analysis pipeline produces a final score out of `100` using structured multi-agent outputs such as:

- requirement match
- evidence strength
- professional footprint
- hiring context fit
- risk penalty

## Why This Is Different

Most resume matching tools return a score without enough explanation.

Jobest exposes:

- live stage-by-stage execution
- raw structured outputs
- evidence tables
- supported and unsupported claims
- professional footprint signals
- recruiter-facing final panel reviews

This is useful in a real hiring workflow because recruiters need visibility, not just automation.

## Submission Notes

This repository is intended to support the AI Marathon 2026 submission requirements:

- pitch deck support through a clear system story
- visible agent workflow for the framework diagram
- video demo support through working UI and candidate analysis flow
- source code and setup instructions through this README

## Team

**C0nc3pt Squad**

## License

Hackathon project. No open-source license has been applied yet.
