# Copilot Validation Status

This document records the current executable validation status for the Jobest recruiter copilot.

## Artifacts

- Use-case matrix: `docs/copilot-use-cases.md`
- Test strategy: `docs/copilot-test-strategy.md`
- Structured corpus: `backend/app/storage/demo/copilot_use_cases.json`
- Harness scripts:
  - `backend/scripts/export_copilot_use_cases.py`
  - `backend/scripts/run_copilot_case_harness.py`

## Current Coverage

### Mock planner baseline

Target workspace:
- `chutes_4bdb7947-29c8-5f16-bb18-f98cb18fb6e3@oauth.jobest.local`

Latest full-pass artifact:
- `backend/app/storage/demo/copilot_harness_results_oauth_v3.json`

Summary:
- `case_count`: `150`
- `cases_with_tools`: `120`
- `cases_with_confirmation`: `29`
- `generic_fallback_count`: `0`
- `direct_answer_count`: `150`

Interpretation:
- The deterministic mock-backed planner/executor baseline covers the entire 150-case matrix without dropping into the generic fallback answer.

### Live planner validation

Latest full-pass live artifact:
- `backend/app/storage/demo/copilot_harness_results_oauth_live150.json`

Summary:
- `case_count`: `150`
- `cases_with_tools`: `120`
- `cases_with_confirmation`: `29`
- `generic_fallback_count`: `0`
- `direct_answer_count`: `150`

Interpretation:
- The live Chutes-backed planner cleared the full 150-case matrix for the OAuth recruiter workspace without generic fallback behavior.

## What Was Added To Reach This State

- Structured export from the 150-case markdown matrix into machine-readable JSON.
- Executable harness for planner/tool-loop verification.
- New copilot read paths for:
  - job posting details
  - candidate detail
  - recruiter-safe runtime settings
  - major risk flag lookup
- Stronger aggregate answer synthesis for workspace and posting-level recruiter questions.
- Broader write-intent routing for posting updates, filtered reruns, focused stages, and runtime settings.
- Fallback recovery when repeated read plans already produced enough tool evidence to answer.

## Remaining Work

- Add stronger semantic pass/fail scoring beyond generic-fallback detection for nuanced answer quality.
- Add API-level and frontend-level executable checks for the UX-sensitive cases already documented in the matrix.
