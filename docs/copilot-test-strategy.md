# Jobest Copilot Test Strategy

This document defines how to turn the copilot use-case matrix into a reliable functionality verification program for Jobest. The goal is not only to test prompts, but to prove that the copilot can do everything Jobest should be able to do across recruiter workflows, backend orchestration, and frontend UX.

## 1. Current Capability Inventory

The current copilot spans these capability surfaces:

- Session and conversation management via `/api/agent-chat/sessions`, session history, pending confirmations, and embedded tool traces.
- Workspace discovery tools: `list_job_postings`, `list_candidates`, `get_workspace_summary`, `get_job_insights`, `get_analysis_queue`.
- Resume and evidence analysis tools: `search_resumes`, `find_unsupported_claims`, `get_candidate_report`.
- Write tools for recruiter actions: `create_job_posting`, `update_job_posting`, `run_triage_for_job`, `run_candidate_full_analysis`, `run_stage_on_candidates`, `update_runtime_settings_safe`.
- New read tools for recruiter workflows: `generate_outreach_email`, `compare_candidates`, `generate_targeted_interview_questions`.
- Guardrails and confirmation logic for credentials, destructive actions, isolated-stage warnings, and confirmation-gated writes.
- Frontend behaviors that matter for the product outcome: context handling, session titles, markdown rendering, tool activity visibility, and optimistic chat UX.

## 2. What Must Be Proven

The copilot should be considered functionally strong only if the following are all true:

- It answers recruiter questions directly rather than merely exposing raw tool outputs.
- It selects bounded and appropriate tools for the prompt class.
- It respects workspace-wide vs posting-scoped vs candidate-scoped intent.
- It correctly requires confirmation for writes and isolated-stage tradeoffs.
- It does not expose credentials or perform unsupported destructive actions.
- It supports recruiter workflows beyond search: ranking, reporting, outreach, comparison, interview prep, queueing, and settings.
- The frontend presents the results correctly, including markdown rendering and sensible tool-activity behavior.

## 3. Test Layers

We should test the copilot in five layers.

### Layer A: Tool Unit Coverage

Purpose: prove each tool implementation returns the right shape and handles boundary inputs.

Coverage:

- `list_job_postings`
- `list_candidates`
- `search_resumes`
- `get_candidate_report`
- `get_job_insights`
- `get_workspace_summary`
- `find_unsupported_claims`
- `get_analysis_queue`
- `create_job_posting`
- `update_job_posting`
- `run_triage_for_job`
- `run_candidate_full_analysis`
- `run_stage_on_candidates`
- `update_runtime_settings_safe`
- `generate_outreach_email`
- `compare_candidates`
- `generate_targeted_interview_questions`

Method:

- Reuse and extend the current backend demo assets in `backend/app/storage/demo/`.
- Extend `backend/scripts/test_new_tools.py` into a broader tool-test harness.
- Add deterministic mock-backed tests where final LLM phrasing is not the concern.

### Layer B: Planner and Finalizer Routing Coverage

Purpose: prove prompts route to the correct tool path and are finalized into recruiter-facing answers.

Coverage:

- One-shot direct answers.
- Single-read tool paths.
- Multi-step read loops.
- Read-then-write confirmation flows.
- Aggregate answer paths like candidate-count comparisons.
- Ambiguity resolution.
- Bounded tool-step behavior.

Method:

- Build a planner harness that records:
  - prompt
  - chosen tools
  - arguments
  - tool-step count
  - final answer
  - whether the answer directly addressed the prompt
- Use the 150-case matrix as the prompt corpus.
- First run in mock mode for deterministic routing checks.
- Then run a curated live subset against the saved Chutes model.

### Layer C: API Workflow Coverage

Purpose: prove the real `/api/agent-chat` behavior is correct end-to-end.

Coverage:

- Session creation
- First-prompt title assignment
- Workspace-wide session persistence
- Posting-scoped session persistence
- Pending write confirmation creation
- Confirmation execution
- Pending cancellation
- Trace creation
- Message metadata correctness

Method:

- Create API-level smoke scripts similar to `smoke_org_flow.py`.
- Seed a test workspace, job postings, candidates, and stage outputs.
- Assert both returned JSON and persisted DB state.

### Layer D: Frontend Interaction Coverage

Purpose: prove the recruiter-visible chat experience behaves correctly.

Coverage:

- Input clears on send
- Session history popup works
- Context selector stays stable
- Tool activity only appears when appropriate
- Tool activity is scoped to the latest assistant answer
- Markdown renders properly
- Confirmation cards render and resolve correctly
- Refresh behavior rehydrates current session

Method:

- Prefer lightweight scripted browser checks against local `/ai`.
- At minimum, maintain a manual regression checklist backed by screenshots.

### Layer E: Product Workflow Scenarios

Purpose: prove the copilot can actually do Jobest’s job, not just call tools individually.

Coverage:

- Creating or refining a posting
- Uploading candidates
- Searching resumes
- Ranking candidates
- Running triage
- Running full analysis
- Running focused stages
- Reviewing reports
- Comparing candidates
- Drafting outreach
- Drafting interview questions

Method:

- Use a realistic seeded workspace with multiple postings and overlapping candidate names.
- Run scenario-level scripts and save structured result artifacts.

## 4. Assets and Test Data

We should maintain three test data tiers.

### Tier 1: Minimal deterministic fixtures

Use the existing demo JSON and SQLite assets under `backend/app/storage/demo/` for quick reproducible tests.

### Tier 2: Mock recruiter workspace

Seed a richer SQLite workspace with:

- at least 4 postings across different domains
- duplicate candidate names across postings
- mixed status candidates: not started, queued, completed
- final reports and unsupported claims present for some candidates
- uneven candidate counts so aggregate questions can be verified

### Tier 3: Resume/PDF corpus

Use or generate PDFs from:

- the existing CV generator under `backend/scripts/generate_demo_cvs.py`
- any existing test CVs the user referenced

Goal:

- support search terms like Docker, SQL, FastAPI, ROS2, Kubernetes, robotics, leadership, GitHub, computer vision, deployment, and CI/CD
- include both strong evidence cases and intentionally unsupported-claim cases

## 5. Prioritization Strategy

Not all 150 cases should be fixed in one pass. We should run them in this order.

### Priority 0: Answer quality regressions

- cases where the copilot calls tools but does not answer the question
- cases where it answers from incomplete tool subsets
- cases where it silently changes context

### Priority 1: Core recruiter workflows

- job discovery
- candidate discovery
- resume search
- triage
- full analysis
- reports

### Priority 2: Focused analysis operations

- stage refreshes
- isolated stage warnings
- queue and agent visibility

### Priority 3: Recruiter productivity workflows

- outreach email
- candidate comparison
- interview question generation

### Priority 4: UX and polish

- markdown rendering
- session titles
- tool activity presentation
- refresh/recovery behavior

## 6. Execution Plan for the 150 Cases

### Phase 1: Convert matrix into executable corpus

- Store the 150 use cases as structured data, ideally JSON or CSV.
- Include:
  - id
  - category
  - prompt
  - expected behavior summary
  - scope requirement
  - write vs read classification
  - priority

### Phase 2: Build a result harness

- For each case, capture:
  - final answer
  - tool sequence
  - tool-step count
  - confirmation requirement
  - error state
  - pass/fail reason

### Phase 3: Run deterministic pass

- Use mock or fixture-backed mode to verify logic, guardrails, and answer synthesis.

### Phase 4: Run live pass on critical subset

- Use the Chutes configuration for a selected subset of high-value and ambiguous cases.
- Compare live behavior against deterministic expectations.

### Phase 5: Patch by failure cluster

Typical clusters:

- incorrect routing
- incomplete aggregation
- ambiguity handling
- missing final synthesis
- over-tooling
- unsupported write handling
- frontend rendering issues

### Phase 6: Re-run and tighten

- Re-run the failed cluster after each patch.
- Promote stable cases into a regression suite.

## 7. How to Judge a Case

Each case should be graded on:

- `Correct`: did it answer the user’s actual question?
- `Scoped`: did it respect workspace/job/candidate scope?
- `Efficient`: did it use a bounded and sensible tool sequence?
- `Safe`: did it obey guardrails and confirmation rules?
- `Clear`: was the final answer recruiter-friendly?
- `Visible`: did the frontend render the result and tool activity properly?

A case passes only if all relevant dimensions pass.

## 8. Immediate Next Implementation Work

After this documentation pass, the practical next step is:

1. Encode all 150 cases into a machine-readable prompt corpus.
2. Build a harness that runs every read-only case automatically.
3. Add expected result assertions for the highest-priority 40 cases first.
4. Use the resulting failures to drive targeted backend and frontend fixes.
5. Expand write-flow verification with seeded workspaces and pending-action confirmation tests.

## 9. Evidence We Should Capture

For each iteration, save:

- a JSON result file for the prompt corpus
- a summary markdown report of pass/fail counts
- backend compile results
- frontend type-check results
- any local screenshots for UI-sensitive regressions

That will turn the copilot from ad hoc prompting into a tracked, repeatable verification program.

