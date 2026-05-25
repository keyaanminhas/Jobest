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
```

## Pages
- `/`
- `/auth/login`
- `/auth/signup`
- `/jobs`
- `/jobs/new`
- `/jobs/[id]`
- `/candidates`
- `/candidates/[id]`
- `/candidates/[id]/report`
- `/reports`

## Dashboard Polish Plan
1. Increase information density with compact metrics for posting load, applicant volume, and report completion.
2. Keep the top shortlist and recent postings side-by-side for faster recruiter decisions.
3. Preserve a clear two-phase scoring story: triage is normalized to `0-80`, full analysis remains `0-100`.
4. Keep recent posting cards concise (title, priority, applicant count) and avoid long job-description dumps.
5. Maintain a functional top search bar that routes to filtered candidate results and supports `Ctrl+K` focus.

Legacy `/runs/*` pages are kept for backwards compatibility while the org workflow is now the primary path.
