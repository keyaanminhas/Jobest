from __future__ import annotations

import json
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db_session
from app.deps import get_current_user
from app.models import AgentChatMessage, AgentChatSession, AgentPendingAction, AgentToolTrace, Candidate, JobPosting, User, UserAgentSettings
from app.schemas.agent_chat import (
    AgentChatMessageItem,
    AgentChatMessageRequest,
    AgentChatSessionItem,
    AgentChatSessionResponse,
    AgentChatTurnResponse,
    AgentPendingActionItem,
    AgentToolTraceItem,
    CreateAgentChatSessionRequest,
)
from app.services.agent_runtime import ISOLATED_STAGE_PREREQUISITES, RecruiterAgentRuntime, TOOL_MAP
from app.services.model_router import ModelRouter, ProviderConfig
from app.services.secret_crypto import decrypt_secret

router = APIRouter(prefix="/api/agent-chat", tags=["agent-chat"])
runtime = RecruiterAgentRuntime()
MAX_AGENT_TOOL_STEPS = 6
DEFAULT_COPILOT_TITLE = "Recruiter Copilot"
GENERIC_CAPABILITY_FALLBACK = (
    "I can search resumes, inspect jobs and queues, draft postings, rerun triage, queue candidate analysis, "
    "request focused stage refreshes, and tune safe runtime limits. Name a posting in the message or select it in Context when the action targets one."
)


def _dynamic_tool_step_limit(content: str) -> int:
    lower = content.lower()
    compound_markers = (
        ("compare", "report"),
        ("compare", "outreach email"),
        ("report", "outreach email"),
        ("then", "finally"),
    )
    if any(all(marker in lower for marker in markers) for markers in compound_markers):
        return max(MAX_AGENT_TOOL_STEPS, 8)
    if any(
        token in lower
        for token in (
            "most candidates",
            "least candidates",
            "fewest candidates",
            "candidate count",
            "how many candidates",
            "how many current candidates",
            "current candidates",
        )
    ):
        return 3
    if any(token in lower for token in ("compare candidates", "side-by-side", "versus", "vs")):
        return 4
    if any(token in lower for token in ("outreach email", "rejection email", "targeted interview questions")):
        return 3
    return MAX_AGENT_TOOL_STEPS


def _is_scoped_candidate_list_prompt(content: str) -> bool:
    lower = content.lower()
    return (
        any(
            token in lower
            for token in (
                "name all the candidates",
                "name all candidates",
                "name each candidate",
                "name each one",
                "list all candidates",
                "show all candidates",
                "all the candidates",
                "all candidates",
                "applicants",
            )
        )
        or (
            any(token in lower for token in ("how many candidates", "how many current candidates", "current candidates"))
            and any(token in lower for token in ("here", "this posting", "this job", "this role", "in this posting"))
        )
    )


def _is_workspace_candidate_count_prompt(content: str) -> bool:
    lower = content.lower()
    return (
        any(
            token in lower
            for token in (
                "most candidates",
                "least candidates",
                "fewest candidates",
                "candidate count",
                "how many candidates",
                "how many current candidates",
                "current candidates",
            )
        )
        and not _is_scoped_candidate_list_prompt(content)
    )


def _is_candidate_count_comparison_prompt(content: str) -> bool:
    lower = content.lower()
    return _is_workspace_candidate_count_prompt(content) and any(token in lower for token in ("job", "posting", "listing", "position", "role"))


def _message_item(row: AgentChatMessage) -> AgentChatMessageItem:
    return AgentChatMessageItem(
        id=row.id,
        role=row.role,
        content=row.content,
        metadata=row.metadata_json or {},
        created_at=row.created_at,
    )


def _trace_item(row: AgentToolTrace) -> AgentToolTraceItem:
    return AgentToolTraceItem(
        id=row.id,
        tool_name=row.tool_name,
        risk_class=row.risk_class,
        status=row.status,
        arguments=row.arguments_json or {},
        result=row.result_json or {},
        created_at=row.created_at,
    )


def _pending_item(row: AgentPendingAction) -> AgentPendingActionItem:
    return AgentPendingActionItem(
        id=row.id,
        tool_name=row.tool_name,
        arguments=row.arguments_json or {},
        summary=row.summary,
        status=row.status,
        expires_at=row.expires_at,
    )


async def _owned_session(db: AsyncSession, user_id: str, session_id: str) -> AgentChatSession:
    session = await db.scalar(
        select(AgentChatSession).where(AgentChatSession.id == session_id, AgentChatSession.user_id == user_id)
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Copilot session not found")
    return session


async def _session_response(db: AsyncSession, session: AgentChatSession) -> AgentChatSessionResponse:
    messages = (
        await db.scalars(
            select(AgentChatMessage)
            .where(AgentChatMessage.session_id == session.id)
            .order_by(AgentChatMessage.created_at.asc(), AgentChatMessage.id.asc())
        )
    ).all()
    traces = (
        await db.scalars(
            select(AgentToolTrace)
            .where(AgentToolTrace.session_id == session.id)
            .order_by(AgentToolTrace.created_at.desc(), AgentToolTrace.id.desc())
            .limit(30)
        )
    ).all()
    pending = (
        await db.scalars(
            select(AgentPendingAction)
            .where(AgentPendingAction.session_id == session.id, AgentPendingAction.status == "pending")
            .order_by(AgentPendingAction.created_at.desc())
        )
    ).all()
    return AgentChatSessionResponse(
        id=session.id,
        title=session.title,
        job_posting_id=session.job_posting_id,
        candidate_id=session.candidate_id,
        created_at=session.created_at,
        updated_at=session.updated_at,
        messages=[_message_item(row) for row in messages],
        traces=[_trace_item(row) for row in traces],
        pending_actions=[_pending_item(row) for row in pending if row.expires_at > datetime.utcnow()],
    )


def _result_summary(tool_name: str, result: dict) -> str:
    if tool_name == "list_job_postings":
        postings = result.get("postings", [])
        if result.get("classification_hint") == "cs_related":
            def is_cs_related(title: str) -> bool:
                normalized = title.lower()
                keywords = (
                    "software",
                    "engineer",
                    "developer",
                    "backend",
                    "frontend",
                    "full stack",
                    "fullstack",
                    "ai",
                    "ml",
                    "machine learning",
                    "data",
                    "cyber",
                    "security",
                    "saas",
                    "computer",
                    "robotics",
                    "mechatronics",
                )
                return any(keyword in normalized for keyword in keywords)

            matched = [row for row in postings if is_cs_related(str(row.get("title") or ""))]
            if not matched:
                return "I did not find any clearly computer-science-related job postings in this workspace."
            return "These job postings look computer-science-related:\n\n" + "\n".join(
                f"- {row['title']} (`{row['id']}`)" for row in matched[:12]
            )
        return f"Found {len(postings)} job postings.\n\n" + "\n".join(f"- {row['title']} (`{row['id']}`)" for row in postings[:12])
    if tool_name == "get_job_posting":
        return (
            f"Loaded job posting `{result.get('title', 'Unknown posting')}`.\n\n"
            f"Status: {result.get('status', 'unknown')}\n\n"
            f"{result.get('hiring_context') or result.get('job_description') or 'Posting details are available in the trace.'}"
        )
    if tool_name == "get_candidate_detail":
        return (
            f"Loaded candidate `{result.get('candidate_name', 'Unknown candidate')}`.\n\n"
            f"Role: {result.get('job_posting_title', 'Unknown role')}\n"
            f"Triage: {result.get('triage_score', 0)}\n"
            f"Status: {result.get('analysis_status', 'unknown')}"
        )
    if tool_name == "list_candidates":
        rows = result.get("candidates", [])
        if result.get("completed_only"):
            return f"Found {len(rows)} completed candidates.\n\n" + "\n".join(
                f"- {row['name']}: final {row.get('final_score', 'n/a')}, {row.get('recommendation') or row['analysis_status']}" for row in rows[:15]
            )
        return f"Found {len(rows)} candidates.\n\n" + "\n".join(f"- {row['name']}: triage {row['triage_score']}/80, {row['analysis_status']}" for row in rows[:15])
    if tool_name == "search_resumes":
        rows = result.get("matches", [])
        return f"Found {result.get('count', len(rows))} resume matches for `{result.get('query', '')}`.\n\n" + "\n".join(
            f"- {row['candidate_name']} ({row['job_posting_title']}): {row['snippet']}" for row in rows[:10]
        )
    if tool_name == "find_unsupported_claims":
        rows = result.get("matches", [])
        return f"Found {result.get('count', len(rows))} unsupported-claim matches for `{result.get('query', '')}`.\n\n" + "\n".join(
            f"- {row['candidate_name']}: {row['claim']} -> {row['reason']}" for row in rows[:10]
        )
    if tool_name == "get_analysis_queue":
        return (
            f"Queue status: {result.get('active_for_user', 0)} active, "
            f"{result.get('queued_for_user', 0)} waiting in your workspace, {result.get('queued_total', 0)} waiting overall."
        )
    if tool_name == "get_candidate_report":
        score = result.get("score", {})
        report = result.get("report", {})
        return (
            f"Candidate report loaded. Final score: {score.get('final_score', 'n/a')}. "
            f"Recommendation: {score.get('recommendation', 'n/a')}.\n\n"
            f"{report.get('summary', 'Stored report is available in the tool trace.')}"
        )
    if tool_name == "get_job_insights":
        rows = result.get("entries", [])
        mode = result.get("mode")
        title = result.get("job_title", "this posting")
        if mode == "completed_candidates":
            return f"Completed candidates for `{title}`: {result.get('completed_count', len(rows))}.\n\n" + "\n".join(
                f"- {row['candidate_name']}: final {row.get('final_score', 'n/a')}, {row.get('recommendation') or row['analysis_status']}" for row in rows[:10]
            )
        if mode == "job_report":
            return (
                f"Final report view for `{title}`: {result.get('candidate_count', 0)} candidates, {result.get('completed_count', 0)} completed.\n\n"
                + "\n".join(
                    f"- {row['candidate_name']}: final {row.get('final_score', 'n/a')}, {row.get('recommendation') or row['analysis_status']}" for row in rows[:5]
                )
                + (f"\n\n{result.get('report_summary')}" if result.get("report_summary") else "")
            )
        return f"Top candidates for `{title}`:\n\n" + "\n".join(
            f"- {row['candidate_name']}: final {row.get('final_score', 'n/a')}, triage {row.get('triage_score', 0)}, {row.get('recommendation') or row['analysis_status']}" for row in rows[:10]
        )
    if tool_name == "get_workspace_summary":
        postings = result.get("postings", [])
        return (
            f"Workspace coverage: {result.get('posting_count', 0)} job postings, {result.get('candidate_count', 0)} candidates, "
            f"{result.get('completed_count', 0)} completed analyses.\n\n"
            + "\n".join(f"- {row['title']} (`{row['id']}`)" for row in postings[:12])
        )
    if tool_name == "get_runtime_settings_safe":
        return (
            f"Current runtime settings: provider `{result.get('provider', 'unknown')}`, model `{result.get('model', 'unknown')}`, "
            f"parallel agents `{result.get('parallel_agents_limit', 0)}`, retry attempts `{result.get('retry_attempts', 0)}`, "
            f"retry delay `{result.get('retry_delay_seconds', 0)} seconds`."
        )
    if tool_name == "get_public_application_link":
        links = result.get("links", [])
        if links:
            return "Public application links:\n\n" + "\n".join(
                (
                    f"- {row.get('title', 'Unknown posting')}: {row.get('public_application_url', 'Unavailable')} "
                    f"({'open' if row.get('public_applications_enabled') else 'closed'})"
                )
                for row in links
            )
        return (
            f"Public application link for `{result.get('title', 'Unknown posting')}`:\n\n"
            f"- Link: {result.get('public_application_url', 'Unavailable')}\n"
            f"- Applications open: {'yes' if result.get('public_applications_enabled') else 'no'}\n"
            f"- Posting status: `{result.get('status', 'unknown')}`"
        )
    if tool_name == "upload_candidate_pdfs_to_job":
        created = result.get("created_candidates", [])
        return (
            f"Uploaded candidate PDFs into `{result.get('job_title', 'Unknown posting')}`.\n\n"
            f"- Created candidates: **{result.get('uploaded_count', len(created))}**\n"
            + "\n".join(f"- {row.get('name', 'Unknown candidate')} (`{row.get('candidate_id', '')}`)" for row in created[:15])
        )
    if tool_name == "upload_candidate_pdfs_to_multiple_jobs":
        rows = result.get("results", [])
        return (
            f"Uploaded candidate PDFs across **{result.get('target_count', len(rows))}** job postings.\n\n"
            + "\n".join(f"- `{row.get('job_title', 'Unknown posting')}`: {row.get('uploaded_count', 0)} created" for row in rows[:15])
        )
    if tool_name == "duplicate_candidate_to_job":
        return (
            f"Duplicated `{result.get('candidate_name', 'Unknown candidate')}` into `{result.get('target_job_title', 'Unknown posting')}`.\n\n"
            f"- New candidate id: `{result.get('new_candidate_id', '')}`"
        )
    if tool_name == "generate_outreach_email":
        subject = result.get("email_subject") or ""
        body = result.get("email_body") or ""
        email_type = result.get("email_type", "outreach").title()
        candidate = result.get("candidate_name") or "Candidate"
        return (
            f"### {email_type} Email Draft for {candidate}\n\n"
            f"**Subject:** {subject}\n\n"
            f"---\n\n"
            f"{body}\n\n"
            f"---\n"
            f"*You can copy this text directly to send to the candidate.*"
        )
    if tool_name == "update_public_application_access":
        return (
            f"Public applications for `{result.get('title', 'Unknown posting')}` are now "
            f"**{'open' if result.get('public_applications_enabled') else 'closed'}**.\n\n"
            f"Share link: {result.get('public_application_url', 'Unavailable')}"
        )
    if tool_name == "move_candidate_to_job":
        return (
            f"Moved `{result.get('candidate_name', 'Unknown candidate')}` into `{result.get('target_job_title', 'Unknown posting')}`.\n\n"
            "Role-specific analysis artifacts were reset and triage was rerun for the destination posting."
        )
    if tool_name == "compare_candidates":
        job_title = result.get("job_title") or "the job posting"
        candidates = result.get("candidates", [])
        comparison = result.get("comparison") or ""
        recommended = result.get("recommended") or "None"

        matrix_rows = []
        for c in candidates:
            matrix_rows.append(
                f"| **{c.get('name')}** | {c.get('role') or 'Unknown'} | {c.get('triage_score', 'N/A')} | {c.get('score', 'N/A')} | {c.get('verdict')} |"
            )

        matrix_table = (
            "| Candidate | Role | Triage | Score | Brief Verdict |\n"
            "| --- | --- | --- | --- | --- |\n"
            + "\n".join(matrix_rows)
        )
        
        return (
            f"### Side-by-Side Candidate Comparison for `{job_title}`\n\n"
            f"{matrix_table}\n\n"
            f"#### Detailed Evaluation\n"
            f"{comparison}\n\n"
            f"**Shortlist Recommendation:** 🌟 **{recommended}**"
        )
    if tool_name == "generate_targeted_interview_questions":
        candidate = result.get("candidate_name") or "Candidate"
        questions = result.get("questions", [])
        
        question_list = []
        for i, q in enumerate(questions, 1):
            question_list.append(
                f"{i}. **Area/Claim:** *{q.get('claim')}*\n"
                f"   * **Question:** \"{q.get('question')}\"\n"
                f"   * **Assessment Intent:** {q.get('intent')}\n"
            )
            
        questions_markdown = "\n".join(question_list) if question_list else "No targeted questions were generated."
        
        return (
            f"### Targeted Probing Interview Questions for {candidate}\n\n"
            f"These questions focus on validating unsupported resume claims, resolving discrepancies, and checking risk flags:\n\n"
            f"{questions_markdown}"
        )
    return f"`{tool_name}` completed.\n\n```json\n{json.dumps(result, indent=2)}\n```"


def _pending_summary(tool_name: str, arguments: dict) -> str:
    if tool_name == "run_stage_on_candidates":
        stage = str(arguments.get("stage") or "").strip()
        stage_mode = str(arguments.get("stage_mode") or "prerequisite_aware").strip().lower() or "prerequisite_aware"
        if stage_mode == "isolated":
            prerequisites = ISOLATED_STAGE_PREREQUISITES.get(stage, [])
            prereq_text = ", ".join(f"`{item}`" for item in prerequisites) if prerequisites else "none"
            return (
                f"Approve isolated `{stage}` refresh with arguments: {json.dumps(arguments, ensure_ascii=True)}\n\n"
                "Warning: this may be less accurate because prerequisite stages will not be rerun. "
                f"Typical prerequisites for `{stage}` are: {prereq_text}.\n\n"
                f"Would you like to continue with isolated mode, or would you prefer the safer path? "
                f"To use the safer path, cancel this and rerun `{stage}` without isolated mode so Jobest refreshes the prerequisites first."
            )
    return f"Approve `{tool_name}` with arguments: {json.dumps(arguments, ensure_ascii=True)}"


async def _planner_provider_override(db: AsyncSession, user_id: str) -> ProviderConfig | None:
    settings = await db.scalar(select(UserAgentSettings).where(UserAgentSettings.user_id == user_id))
    if settings is None:
        return None
    router = ModelRouter.from_env()
    provider_name = (settings.provider or router.primary.provider or "chutes").strip().lower()
    default_provider = router.primary
    if router.fallback is not None and provider_name == router.fallback.provider:
        default_provider = router.fallback

    api_key = ""
    try:
        if settings.encrypted_api_key:
            api_key = decrypt_secret(settings.encrypted_api_key).strip()
    except Exception:
        api_key = ""
    if not api_key:
        if provider_name == router.primary.provider:
            api_key = router.primary.api_key
        elif router.fallback is not None and provider_name == router.fallback.provider:
            api_key = router.fallback.api_key
        else:
            api_key = default_provider.api_key
    if not api_key.strip():
        return None
    return ProviderConfig(
        provider=provider_name or default_provider.provider,
        base_url=settings.base_url or default_provider.base_url,
        api_key=api_key,
        model=settings.model or default_provider.model,
    )


@router.post("/sessions", response_model=AgentChatSessionResponse)
async def create_session(
    payload: CreateAgentChatSessionRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> AgentChatSessionResponse:
    if payload.job_posting_id:
        posting = await db.scalar(
            select(JobPosting).where(JobPosting.id == payload.job_posting_id, JobPosting.user_id == current_user.id)
        )
        if posting is None:
            raise HTTPException(status_code=404, detail="Job posting context not found in this workspace")
    if payload.candidate_id:
        candidate = await db.scalar(
            select(Candidate)
            .join(JobPosting, Candidate.job_posting_id == JobPosting.id)
            .where(Candidate.id == payload.candidate_id, JobPosting.user_id == current_user.id)
        )
        if candidate is None:
            raise HTTPException(status_code=404, detail="Candidate context not found in this workspace")
    session = AgentChatSession(
        user_id=current_user.id,
        title=payload.title.strip() or DEFAULT_COPILOT_TITLE,
        job_posting_id=payload.job_posting_id,
        candidate_id=payload.candidate_id,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return await _session_response(db, session)


@router.get("/sessions", response_model=list[AgentChatSessionItem])
async def list_sessions(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> list[AgentChatSessionItem]:
    rows = (
        await db.scalars(
            select(AgentChatSession)
            .where(AgentChatSession.user_id == current_user.id)
            .order_by(AgentChatSession.updated_at.desc())
            .limit(20)
        )
    ).all()
    return [
        AgentChatSessionItem(
            id=row.id,
            title=row.title,
            job_posting_id=row.job_posting_id,
            candidate_id=row.candidate_id,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
        for row in rows
    ]


@router.get("/sessions/{session_id}", response_model=AgentChatSessionResponse)
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> AgentChatSessionResponse:
    return await _session_response(db, await _owned_session(db, current_user.id, session_id))


@router.post("/sessions/{session_id}/messages", response_model=AgentChatTurnResponse)
async def send_message(
    session_id: str,
    payload: AgentChatMessageRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> AgentChatTurnResponse:
    session = await _owned_session(db, current_user.id, session_id)
    if (session.title or "").strip() == DEFAULT_COPILOT_TITLE:
        first_prompt = " ".join(payload.content.strip().split())
        if first_prompt:
            session.title = first_prompt[:72]
    user_message = AgentChatMessage(session_id=session.id, role="user", content=payload.content, metadata_json={})
    db.add(user_message)
    session.updated_at = datetime.utcnow()
    await db.commit()

    history_rows = (
        await db.scalars(
            select(AgentChatMessage)
            .where(AgentChatMessage.session_id == session.id)
            .order_by(AgentChatMessage.created_at.asc())
        )
    ).all()
    pending_row = None
    metadata: dict[str, object] = {"planner": "unknown"}
    provider_override = await _planner_provider_override(db, current_user.id)
    session_context = {"job_posting_id": session.job_posting_id, "candidate_id": session.candidate_id}
    tool_results: list[dict[str, object]] = []
    seen_read_signatures: set[str] = set()
    assistant_text = "I need more detail before I can act."
    workspace_candidate_count_prompt = _is_workspace_candidate_count_prompt(payload.content)
    scoped_candidate_list_prompt = _is_scoped_candidate_list_prompt(payload.content)

    step_limit = _dynamic_tool_step_limit(payload.content)
    for _ in range(step_limit):
        plan = await runtime.plan(
            db,
            user_id=current_user.id,
            content=payload.content,
            session_context=session_context,
            history=[{"role": row.role, "content": row.content} for row in history_rows],
            tool_results=tool_results,
            provider_override=provider_override,
        )
        metadata = {"planner": plan.get("planner", "unknown")}
        tool_name = plan.get("tool_name")
        arguments = plan.get("arguments") or {}
        if (
            workspace_candidate_count_prompt
            and tool_results
            and not any(row.get("tool_name") == "get_workspace_summary" for row in tool_results)
            and tool_name in {"list_job_postings", "list_candidates"}
        ):
            tool_name = "get_workspace_summary"
            arguments = {}
            metadata["planner"] = f"{metadata['planner']}_coerced"
        resolved_posting_id = arguments.get("job_posting_id") if isinstance(arguments, dict) else None
        resolved_candidate_id = None
        if isinstance(arguments, dict):
            candidate_ids = arguments.get("candidate_ids")
            if isinstance(candidate_ids, list) and candidate_ids:
                resolved_candidate_id = candidate_ids[0]
            resolved_candidate_id = resolved_candidate_id or arguments.get("candidate_id")
        if resolved_posting_id and not session.job_posting_id:
            posting = await db.scalar(
                select(JobPosting).where(JobPosting.id == resolved_posting_id, JobPosting.user_id == current_user.id)
            )
            if posting is not None:
                session_context["job_posting_id"] = posting.id
        if resolved_candidate_id and not session.candidate_id:
            session_context["candidate_id"] = resolved_candidate_id

        if tool_name is None:
            if workspace_candidate_count_prompt and not any(row.get("tool_name") == "get_workspace_summary" for row in tool_results):
                tool_name = "get_workspace_summary"
                arguments = {}
                metadata["planner"] = f"{metadata['planner']}_coerced"
            elif scoped_candidate_list_prompt and not any(row.get("tool_name") == "list_candidates" for row in tool_results):
                tool_name = "list_candidates"
                arguments = {"job_posting_id": session.job_posting_id} if session.job_posting_id else {}
                metadata["planner"] = f"{metadata['planner']}_coerced"
            else:
                if tool_results:
                    # Always synthesize from tool results — never trust the planner's
                    # raw text when we already have completed tool data.
                    assistant_text = await runtime.answer_from_tool_results(
                        content=payload.content,
                        tool_results=tool_results,
                        provider_override=provider_override,
                    )
                else:
                    assistant_text = str(plan.get("answer") or "I need more detail before I can act.")
                break

        spec = TOOL_MAP[tool_name]
        metadata.update({"tool_name": tool_name, "risk_class": spec.risk_class, "tool_steps": len(tool_results) + 1})
        if spec.risk_class != "read":
            summary = _pending_summary(tool_name, arguments)
            pending_row = AgentPendingAction(
                session_id=session.id,
                user_id=current_user.id,
                tool_name=tool_name,
                arguments_json=arguments,
                summary=summary,
                status="pending",
                expires_at=datetime.utcnow() + timedelta(minutes=10),
            )
            db.add(pending_row)
            db.add(
                AgentToolTrace(
                    session_id=session.id,
                    user_id=current_user.id,
                    tool_name=tool_name,
                    risk_class=spec.risk_class,
                    status="awaiting_confirmation",
                    arguments_json=arguments,
                    result_json={"pending": True, "tool_results": tool_results},
                )
            )
            await db.flush()
            assistant_text = f"This action changes workspace state and needs confirmation.\n\n{summary}"
            break

        signature = json.dumps({"tool_name": tool_name, "arguments": arguments}, sort_keys=True, ensure_ascii=True)
        if signature in seen_read_signatures:
            if tool_results:
                assistant_text = await runtime.answer_from_tool_results(
                    content=payload.content,
                    tool_results=tool_results,
                    provider_override=provider_override,
                )
            else:
                plan_answer = str(plan.get("answer") or "").strip()
                assistant_text = plan_answer or "I reached the same read step twice and need a clearer target to continue."
            break
        seen_read_signatures.add(signature)
        try:
            result = await runtime.execute(db, user_id=current_user.id, tool_name=tool_name, arguments=arguments)
            db.add(
                AgentToolTrace(
                    session_id=session.id,
                    user_id=current_user.id,
                    tool_name=tool_name,
                    risk_class=spec.risk_class,
                    status="completed",
                    arguments_json=arguments,
                    result_json=result,
                )
            )
            tool_results.append(
                {
                    "tool_name": tool_name,
                    "arguments": arguments,
                    "result": result,
                    "summary": _result_summary(tool_name, result),
                }
            )
            assistant_text = _result_summary(tool_name, result)
            continue
        except Exception as exc:
            db.add(
                AgentToolTrace(
                    session_id=session.id,
                    user_id=current_user.id,
                    tool_name=tool_name,
                    risk_class=spec.risk_class,
                    status="error",
                    arguments_json=arguments,
                    result_json={"error": str(exc)},
                )
            )
            assistant_text = f"I could not run `{tool_name}`: {exc}"
            break

    if pending_row is None and tool_results and (
        not assistant_text
        or assistant_text == _result_summary(tool_results[-1]["tool_name"], tool_results[-1]["result"])
        or assistant_text.startswith("I reached the same read step twice")
    ):
        assistant_text = await runtime.answer_from_tool_results(
            content=payload.content,
            tool_results=tool_results,
            provider_override=provider_override,
        )

    assistant = AgentChatMessage(session_id=session.id, role="assistant", content=assistant_text, metadata_json=metadata)
    db.add(assistant)
    await db.commit()
    await db.refresh(assistant)
    if pending_row is not None:
        await db.refresh(pending_row)
    return AgentChatTurnResponse(
        session=await _session_response(db, session),
        assistant_message=_message_item(assistant),
        pending_action=_pending_item(pending_row) if pending_row else None,
    )


@router.post("/pending-actions/{action_id}/confirm", response_model=AgentChatTurnResponse)
async def confirm_action(
    action_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> AgentChatTurnResponse:
    action = await db.scalar(
        select(AgentPendingAction).where(AgentPendingAction.id == action_id, AgentPendingAction.user_id == current_user.id)
    )
    if action is None:
        raise HTTPException(status_code=404, detail="Pending action not found")
    if action.status != "pending":
        raise HTTPException(status_code=409, detail=f"Pending action is already {action.status}")
    if action.expires_at <= datetime.utcnow():
        action.status = "expired"
        await db.commit()
        raise HTTPException(status_code=409, detail="Pending action expired")
    session = await _owned_session(db, current_user.id, action.session_id)
    spec = TOOL_MAP.get(action.tool_name)
    if spec is None:
        raise HTTPException(status_code=400, detail="Unknown pending tool")
    try:
        result = await runtime.execute(db, user_id=current_user.id, tool_name=action.tool_name, arguments=action.arguments_json or {})
        action.status = "executed"
        action.executed_at = datetime.utcnow()
        status = "completed"
        assistant_text = _result_summary(action.tool_name, result)
    except Exception as exc:
        action.status = "error"
        action.executed_at = datetime.utcnow()
        status = "error"
        result = {"error": str(exc)}
        assistant_text = f"I could not run `{action.tool_name}`: {exc}"
    db.add(
        AgentToolTrace(
            session_id=session.id,
            user_id=current_user.id,
            tool_name=action.tool_name,
            risk_class=spec.risk_class,
            status=status,
            arguments_json=action.arguments_json or {},
            result_json=result,
        )
    )
    assistant = AgentChatMessage(session_id=session.id, role="assistant", content=assistant_text, metadata_json={"tool_name": action.tool_name, "confirmed": True})
    db.add(assistant)
    session.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(assistant)
    return AgentChatTurnResponse(session=await _session_response(db, session), assistant_message=_message_item(assistant))


@router.post("/pending-actions/{action_id}/cancel", response_model=AgentChatSessionResponse)
async def cancel_action(
    action_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> AgentChatSessionResponse:
    action = await db.scalar(
        select(AgentPendingAction).where(AgentPendingAction.id == action_id, AgentPendingAction.user_id == current_user.id)
    )
    if action is None:
        raise HTTPException(status_code=404, detail="Pending action not found")
    if action.status == "pending":
        action.status = "cancelled"
        await db.commit()
    return await _session_response(db, await _owned_session(db, current_user.id, action.session_id))
