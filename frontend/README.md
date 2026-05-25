# Jobest Frontend

Local Next.js frontend for the Jobest hackathon demo.

## Setup
```bash
cd jobest/frontend
copy .env.local.example .env.local
npm install
npm run dev
```

## Environment
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_API_KEY=change-this-demo-key
```

## Pages
- `/`
- `/runs/new`
- `/runs/[id]/pipeline`
- `/runs/[id]/shortlist`
- `/runs/[id]/candidates/[candidateId]`
- `/runs/[id]/report`

If the backend is unavailable, the UI can still run using the built-in polished demo scenario.
