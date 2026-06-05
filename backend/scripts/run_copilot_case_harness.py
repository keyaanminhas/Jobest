from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any

from sqlalchemy import select


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.api.ai_routes import (  # noqa: E402
    _dynamic_tool_step_limit,
    _is_candidate_count_comparison_prompt,
    _pending_summary,
    _planner_provider_override,
    _result_summary,
)
from app.db import SessionLocal  # noqa: E402
from app.models import Candidate, JobPosting, User  # noqa: E402
from app.services.agent_runtime import TOOL_MAP, RecruiterAgentRuntime  # noqa: E402


DEFAULT_CASES = ROOT / "app" / "storage" / "demo" / "copilot_use_cases.json"
DEFAULT_OUTPUT = ROOT / "app" / "storage" / "demo" / "copilot_harness_results.json"
GENERIC_FALLBACK_SNIPPETS = (
    "i can list jobs and candidates",
    "i can search resumes",
    "i need more detail before i can act",
)


def _case_matches(case: dict[str, Any], selected_ids: set[int]) -> bool:
    return not selected_ids or int(case["id"]) in selected_ids


async def _pick_user(email: str | None) -> User:
    async with SessionLocal() as db:
        if email:
            user = await db.scalar(select(User).where(User.email == email))
        else:
            user = await db.scalar(select(User).order_by(User.created_at.asc()))
        if user is None:
            raise RuntimeError("No matching user found for harness execution.")
        return user


async def _default_context(user_id: str, scope_hint: str) -> dict[str, str | None]:
    async with SessionLocal() as db:
        postings = (
            await db.scalars(
                select(JobPosting)
                .where(JobPosting.user_id == user_id)
                .order_by(JobPosting.created_at.asc(), JobPosting.title.asc())
            )
        ).all()
        preferred_posting = next((row for row in postings if row.title == "Senior SaaS Engineer"), None) or (postings[0] if postings else None)
        context: dict[str, str | None] = {"job_posting_id": None, "candidate_id": None}
        if scope_hint in {"job", "candidate"} and preferred_posting is not None:
            context["job_posting_id"] = preferred_posting.id
        if scope_hint == "candidate":
            candidate = await db.scalar(
                select(Candidate)
                .where(Candidate.job_posting_id == preferred_posting.id if preferred_posting else False)
                .order_by(Candidate.created_at.asc(), Candidate.display_name.asc())
            )
            if candidate is None:
                candidate = await db.scalar(select(Candidate).order_by(Candidate.created_at.asc(), Candidate.display_name.asc()))
            context["candidate_id"] = candidate.id if candidate is not None else None
        return context


async def run_case(
    *,
    runtime: RecruiterAgentRuntime,
    user: User,
    case: dict[str, Any],
    planner_mode: str,
) -> dict[str, Any]:
    tool_results: list[dict[str, Any]] = []
    tool_steps: list[dict[str, Any]] = []
    seen_read_signatures: set[str] = set()
    assistant_text = "I need more detail before I can act."
    history: list[dict[str, str]] = []
    session_context = await _default_context(user.id, str(case.get("scope_hint") or "workspace"))
    candidate_count_prompt = _is_candidate_count_comparison_prompt(case["prompt"])

    async with SessionLocal() as db:
        provider_override = None if planner_mode == "mock" else await _planner_provider_override(db, user.id)
        for _ in range(_dynamic_tool_step_limit(case["prompt"])):
            plan = await runtime.plan(
                db,
                user_id=user.id,
                content=case["prompt"],
                session_context=session_context,
                history=history,
                tool_results=tool_results,
                provider_override=provider_override,
            )
            tool_name = plan.get("tool_name")
            arguments = dict(plan.get("arguments") or {})
            planner = str(plan.get("planner") or "unknown")

            if candidate_count_prompt and tool_results and not any(row.get("tool_name") == "get_workspace_summary" for row in tool_results):
                if tool_name in {"list_job_postings", "list_candidates"}:
                    tool_name = "get_workspace_summary"
                    arguments = {}
                    planner = f"{planner}_coerced"

            if tool_name is None:
                if candidate_count_prompt and not any(row.get("tool_name") == "get_workspace_summary" for row in tool_results):
                    tool_name = "get_workspace_summary"
                    arguments = {}
                    planner = f"{planner}_coerced"
                else:
                    assistant_text = str(plan.get("answer") or assistant_text)
                    break

            spec = TOOL_MAP[tool_name]
            if spec.risk_class != "read":
                assistant_text = f"This action changes workspace state and needs confirmation.\n\n{_pending_summary(tool_name, arguments)}"
                tool_steps.append(
                    {
                        "tool_name": tool_name,
                        "risk_class": spec.risk_class,
                        "status": "awaiting_confirmation",
                        "arguments": arguments,
                        "planner": planner,
                    }
                )
                break

            signature = json.dumps({"tool_name": tool_name, "arguments": arguments}, sort_keys=True, ensure_ascii=True)
            if signature in seen_read_signatures:
                plan_answer = str(plan.get("answer") or "").strip()
                if not plan_answer and tool_results:
                    assistant_text = await runtime.answer_from_tool_results(
                        content=case["prompt"],
                        tool_results=tool_results,
                        provider_override=provider_override,
                    )
                else:
                    assistant_text = plan_answer or "I reached the same read step twice and need a clearer target to continue."
                break
            seen_read_signatures.add(signature)

            try:
                result = await runtime.execute(db, user_id=user.id, tool_name=tool_name, arguments=arguments)
            except Exception as exc:
                error_text = f"I could not run `{tool_name}`: {exc}"
                tool_steps.append(
                    {
                        "tool_name": tool_name,
                        "risk_class": spec.risk_class,
                        "status": "error",
                        "arguments": arguments,
                        "planner": planner,
                        "error": str(exc),
                    }
                )
                assistant_text = error_text
                break

            summary = _result_summary(tool_name, result)
            tool_results.append(
                {
                    "tool_name": tool_name,
                    "arguments": arguments,
                    "result": result,
                    "summary": summary,
                }
            )
            tool_steps.append(
                {
                    "tool_name": tool_name,
                    "risk_class": spec.risk_class,
                    "status": "completed",
                    "arguments": arguments,
                    "planner": planner,
                    "summary": summary,
                }
            )
            assistant_text = summary
            history.append({"role": "assistant", "content": assistant_text})

        if tool_results and (
            assistant_text == str(tool_results[-1].get("summary") or "")
            or assistant_text.startswith("I reached the same read step twice")
        ):
            assistant_text = await runtime.answer_from_tool_results(
                content=case["prompt"],
                tool_results=tool_results,
                provider_override=provider_override,
            )

    answer_lower = assistant_text.lower()
    generic_fallback_detected = any(snippet in answer_lower for snippet in GENERIC_FALLBACK_SNIPPETS)
    awaiting_confirmation = any(step["status"] == "awaiting_confirmation" for step in tool_steps)

    return {
        "id": case["id"],
        "section": case["section"],
        "prompt": case["prompt"],
        "expected": case["expected"],
        "scope_hint": case.get("scope_hint"),
        "action_class": case.get("action_class"),
        "tool_step_count": len(tool_steps),
        "tool_steps": tool_steps,
        "answer": assistant_text,
        "used_tools": [row["tool_name"] for row in tool_steps],
        "awaiting_confirmation": awaiting_confirmation,
        "generic_fallback_detected": generic_fallback_detected,
        "answered_directly": bool(assistant_text.strip()) and not generic_fallback_detected,
    }


async def main() -> None:
    parser = argparse.ArgumentParser(description="Run Jobest copilot use cases through the copilot planner/runtime loop.")
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--email", type=str, default=None)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--ids", type=str, default="")
    parser.add_argument("--planner-mode", choices=["current", "mock"], default="current")
    args = parser.parse_args()

    payload = json.loads(args.cases.read_text(encoding="utf-8"))
    selected_ids = {int(item.strip()) for item in args.ids.split(",") if item.strip()}
    cases = [case for case in payload.get("cases", []) if _case_matches(case, selected_ids)]
    if args.limit > 0:
        cases = cases[: args.limit]

    user = await _pick_user(args.email)
    runtime = RecruiterAgentRuntime()
    if args.planner_mode == "mock":
        runtime.llm.router.llm_mode = "mock"

    results = []
    for case in cases:
        results.append(await run_case(runtime=runtime, user=user, case=case, planner_mode=args.planner_mode))

    summary = {
        "user_email": user.email,
        "planner_mode": args.planner_mode,
        "case_count": len(results),
        "cases_with_tools": sum(1 for row in results if row["tool_step_count"] > 0),
        "cases_with_confirmation": sum(1 for row in results if row["awaiting_confirmation"]),
        "generic_fallback_count": sum(1 for row in results if row["generic_fallback_detected"]),
        "direct_answer_count": sum(1 for row in results if row["answered_directly"]),
    }
    output_payload = {"summary": summary, "results": results}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output_payload, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))
    print(f"Wrote harness results to {args.output}")


if __name__ == "__main__":
    asyncio.run(main())
