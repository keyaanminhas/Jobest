from __future__ import annotations

import json
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db_session
from app.deps import get_current_user
from app.models import AgentChatMessage, AgentChatSession, AgentPendingAction, AgentToolTrace, Candidate, JobPosting, User
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
from app.services.agent_runtime import RecruiterAgentRuntime, TOOL_MAP

router = APIRouter(prefix="/api/agent-chat", tags=["agent-chat"])
runtime = RecruiterAgentRuntime()


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
        return f"Found {len(postings)} job postings.\n\n" + "\n".join(f"- {row['title']} (`{row['id']}`)" for row in postings[:12])
    if tool_name == "list_candidates":
        rows = result.get("candidates", [])
        return f"Found {len(rows)} candidates.\n\n" + "\n".join(f"- {row['name']}: triage {row['triage_score']}/80, {row['analysis_status']}" for row in rows[:15])
    if tool_name == "search_resumes":
        rows = result.get("matches", [])
        return f"Found {result.get('count', len(rows))} resume matches for `{result.get('query', '')}`.\n\n" + "\n".join(
            f"- {row['candidate_name']} ({row['job_posting_title']}): {row['snippet']}" for row in rows[:10]
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
    return f"`{tool_name}` completed.\n\n```json\n{json.dumps(result, indent=2)}\n```"


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
        title=payload.title.strip() or "Recruiter Copilot",
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
    plan = await runtime.plan(
        content=payload.content,
        session_context={"job_posting_id": session.job_posting_id, "candidate_id": session.candidate_id},
        history=[{"role": row.role, "content": row.content} for row in history_rows],
    )
    tool_name = plan.get("tool_name")
    pending_row = None
    metadata = {"planner": plan.get("planner", "unknown")}

    if tool_name is None:
        assistant_text = str(plan.get("answer") or "I need more detail before I can act.")
    else:
        spec = TOOL_MAP[tool_name]
        arguments = plan.get("arguments") or {}
        metadata.update({"tool_name": tool_name, "risk_class": spec.risk_class})
        if spec.risk_class == "read":
            try:
                result = await runtime.execute(db, user_id=current_user.id, tool_name=tool_name, arguments=arguments)
                trace = AgentToolTrace(
                    session_id=session.id,
                    user_id=current_user.id,
                    tool_name=tool_name,
                    risk_class=spec.risk_class,
                    status="completed",
                    arguments_json=arguments,
                    result_json=result,
                )
                db.add(trace)
                assistant_text = _result_summary(tool_name, result)
            except Exception as exc:
                trace = AgentToolTrace(
                    session_id=session.id,
                    user_id=current_user.id,
                    tool_name=tool_name,
                    risk_class=spec.risk_class,
                    status="error",
                    arguments_json=arguments,
                    result_json={"error": str(exc)},
                )
                db.add(trace)
                assistant_text = f"I could not run `{tool_name}`: {exc}"
        else:
            summary = f"Approve `{tool_name}` with arguments: {json.dumps(arguments, ensure_ascii=True)}"
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
                    result_json={"pending": True},
                )
            )
            await db.flush()
            assistant_text = f"This action changes workspace state and needs confirmation.\n\n{summary}"

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
