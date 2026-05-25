import base64
import hashlib
import json
import os
import re
import secrets
from datetime import datetime
from pathlib import Path
from urllib.parse import urlencode, urlparse

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi import Request
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import SessionLocal, get_db_session
from app.deps import get_current_user
from app.models import (
    Candidate,
    CandidateAnalysisRun,
    CandidateFinalOutput,
    CandidateLink,
    Notification,
    CandidateStageOutput,
    CandidateTriage,
    JobPosting,
    JobPostingSkill,
    User,
)
from app.schemas.org import (
    AnalysisQueueStatusResponse,
    AuthResponse,
    CandidateAnalysisResponse,
    CandidateAnalysisStage,
    CandidateDetailResponse,
    CandidateListItemResponse,
    CandidateReportListItemResponse,
    CandidateReportResponse,
    CreateJobPostingRequest,
    CurrentUserResponse,
    JobPostingListResponse,
    JobPostingResponse,
    LoginRequest,
    NotificationItemResponse,
    NotificationListResponse,
    SignupRequest,
    StartCandidateAnalysisResponse,
    UpdateJobPostingRequest,
    UploadCandidatesResponse,
)
from app.security import create_access_token, hash_password, verify_password
from app.services.analysis_queue import analysis_queue_manager
from app.services.llm_client import LLMClient
from app.services.orchestrator import PipelineOrchestrator
from app.services.resume_ingestion import ResumeIngestionError, assert_pdf_upload, derive_candidate_name, extract_pdf_text
from app.services.triage_service import score_candidate_triage

router = APIRouter(prefix="/api", tags=["org"])
UPLOADS_DIR = Path(__file__).resolve().parents[1] / "storage" / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

_orchestrator = PipelineOrchestrator()
_triage_llm_client = LLMClient()
_OAUTH_STATE_COOKIE = "jobest_chutes_oauth_state"
_OAUTH_VERIFIER_COOKIE = "jobest_chutes_oauth_verifier"
_PROGRESS_STAGE_KEYS = [
    "JD Deconstruction Agent",
    "Hiring Context Agent",
    "Resume Parsing Agent",
    "Candidate Evidence Agent",
    "Transferable Skill Agent",
    "Professional Footprint Agent",
    "Risk & Contradiction Agent",
    "Score Aggregation Engine",
    "Hiring Panel Review Agent",
    "Interview Pack Generator Agent",
    "Final Shortlist Report Agent",
]


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def _frontend_app_url() -> str:
    return os.getenv("FRONTEND_APP_URL", "http://localhost:3000").strip().rstrip("/")


def _chutes_scopes() -> str:
    return os.getenv("CHUTES_OAUTH_SCOPES", "profile:read").strip() or "profile:read"


def _pkce_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")


def _synthetic_chutes_email(subject: str) -> str:
    return f"chutes_{subject}@oauth.jobest.local"


def _auth_error_redirect(message: str) -> RedirectResponse:
    response = RedirectResponse(
        url=f"{_frontend_app_url()}/auth/login?{urlencode({'error': message})}",
        status_code=status.HTTP_302_FOUND,
    )
    response.delete_cookie(_OAUTH_STATE_COOKIE, path="/")
    response.delete_cookie(_OAUTH_VERIFIER_COOKIE, path="/")
    return response


def _auth_success_redirect(token: str) -> RedirectResponse:
    response = RedirectResponse(
        url=f"{_frontend_app_url()}/auth/chutes/callback?{urlencode({'token': token})}",
        status_code=status.HTTP_302_FOUND,
    )
    response.delete_cookie(_OAUTH_STATE_COOKIE, path="/")
    response.delete_cookie(_OAUTH_VERIFIER_COOKIE, path="/")
    return response


async def _load_chutes_profile(client: httpx.AsyncClient, access_token: str, userinfo_url: str) -> dict:
    headers = {"Authorization": f"Bearer {access_token}"}
    try:
        userinfo_response = await client.get(userinfo_url, headers=headers)
        userinfo_response.raise_for_status()
        return userinfo_response.json()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code != status.HTTP_403_FORBIDDEN:
            raise

    fallback_response = await client.get("https://api.chutes.ai/users/me", headers=headers)
    fallback_response.raise_for_status()
    payload = fallback_response.json()
    return {
        "sub": payload.get("user_id"),
        "username": payload.get("username"),
        "created_at": payload.get("created_at"),
    }


def _job_posting_to_response(posting: JobPosting) -> JobPostingResponse:
    must_have = [item.skill_name for item in posting.skills if item.skill_type == "must_have"]
    nice_to_have = [item.skill_name for item in posting.skills if item.skill_type == "nice_to_have"]
    return JobPostingResponse(
        id=posting.id,
        title=posting.title,
        job_description=posting.job_description,
        hiring_context=posting.hiring_context,
        company_priority=posting.company_priority,
        status=posting.status,
        must_have_skills=must_have,
        nice_to_have_skills=nice_to_have,
        created_at=posting.created_at,
        updated_at=posting.updated_at,
    )


def _resume_url(candidate_id: str) -> str:
    return f"/api/candidates/{candidate_id}/resume"


def _latest_completed_analysis(candidate: Candidate) -> CandidateAnalysisRun | None:
    completed = [
        run
        for run in (candidate.analysis_runs or [])
        if run.status == "completed" and run.final_score is not None
    ]
    if not completed:
        return None
    return sorted(
        completed,
        key=lambda run: (run.completed_at or datetime.min, run.started_at or datetime.min, run.id),
        reverse=True,
    )[0]


def _candidate_score_snapshot(candidate: Candidate) -> tuple[float, str, float | None, str | None, bool]:
    latest = _latest_completed_analysis(candidate)
    if latest is not None and latest.final_score is not None:
        return (
            float(latest.final_score),
            "final",
            float(latest.final_score),
            latest.recommendation,
            candidate.final_output is not None,
        )

    triage_score = float(candidate.triage.triage_score) if candidate.triage else 0.0
    return triage_score, "triage", None, None, False


def _candidate_to_list_item(candidate: Candidate) -> CandidateListItemResponse:
    triage = candidate.triage
    current_score, current_score_type, final_score, recommendation, report_ready = _candidate_score_snapshot(candidate)
    posting_title = candidate.job_posting.title if candidate.job_posting else ""
    return CandidateListItemResponse(
        id=candidate.id,
        job_posting_id=candidate.job_posting_id,
        job_posting_title=posting_title,
        display_name=candidate.display_name,
        upload_status=candidate.upload_status,
        analysis_status=candidate.analysis_status,
        triage_status=triage.triage_status if triage else "pending",
        triage_score=triage.triage_score if triage else 0.0,
        keyword_match_score=triage.keyword_match_score if triage else 0.0,
        llm_triage_score=triage.llm_triage_score if triage else 0.0,
        triage_summary=triage.triage_summary if triage else "",
        current_score=current_score,
        current_score_type=current_score_type,
        final_score=final_score,
        recommendation=recommendation,
        report_ready=report_ready,
        resume_url=_resume_url(candidate.id),
        created_at=candidate.created_at,
    )


def _candidate_sort_key(candidate: Candidate) -> tuple[float, datetime]:
    current_score, _, _, _, _ = _candidate_score_snapshot(candidate)
    return (current_score, candidate.created_at)


def _notification_to_item(notification: Notification) -> NotificationItemResponse:
    return NotificationItemResponse(
        id=notification.id,
        title=notification.title,
        body=notification.body,
        notification_type=notification.notification_type,
        candidate_id=notification.candidate_id,
        analysis_run_id=notification.analysis_run_id,
        is_read=notification.is_read,
        created_at=notification.created_at,
    )


def _progress_from_stage_rows(stage_rows: list[CandidateStageOutput]) -> tuple[float, str | None]:
    completed: set[str] = set()
    latest_stage: str | None = None
    for row in stage_rows:
        latest_stage = row.stage_name
        for key in _PROGRESS_STAGE_KEYS:
            if row.stage_name.startswith(key) and row.status.startswith("completed"):
                completed.add(key)

    if not _PROGRESS_STAGE_KEYS:
        return 0.0, latest_stage
    percent = (len(completed) / len(_PROGRESS_STAGE_KEYS)) * 100.0
    return round(percent, 2), latest_stage


def _extract_professional_links(raw_urls: str | None) -> dict[str, str]:
    if not raw_urls:
        return {}
    tokens = [token.strip() for token in re.split(r"[\n,; ]+", raw_urls) if token.strip()]
    links: dict[str, str] = {}
    for token in tokens:
        if not token.lower().startswith(("http://", "https://")):
            continue
        host = urlparse(token).netloc.lower()
        if "github.com" in host and "github" not in links:
            links["github"] = token
        elif any(domain in host for domain in ("linkedin.com", "lnkd.in")) and "linkedin" not in links:
            links["linkedin"] = token
        elif "kaggle.com" in host and "kaggle" not in links:
            links["kaggle"] = token
        elif "scholar.google." in host and "scholar" not in links:
            links["scholar"] = token
        elif "portfolio" not in links:
            links["portfolio"] = token
    return links


def _extract_links_for_file(
    *,
    filename: str,
    additional_urls: str | None,
    additional_urls_by_filename: str | None,
) -> dict[str, str]:
    links = _extract_professional_links(additional_urls)
    if not additional_urls_by_filename:
        return links
    try:
        mapping = json.loads(additional_urls_by_filename)
    except json.JSONDecodeError:
        return links
    if not isinstance(mapping, dict):
        return links
    value = mapping.get(filename)
    if isinstance(value, str):
        links.update(_extract_professional_links(value))
    return links


async def _get_owned_posting_or_404(db: AsyncSession, user_id: str, posting_id: str) -> JobPosting:
    posting = await db.scalar(
        select(JobPosting)
        .where(JobPosting.id == posting_id, JobPosting.user_id == user_id)
        .options(selectinload(JobPosting.skills))
    )
    if posting is None:
        raise HTTPException(status_code=404, detail="Job posting not found")
    return posting


async def _get_owned_candidate_or_404(db: AsyncSession, user_id: str, candidate_id: str) -> Candidate:
    candidate = await db.scalar(
        select(Candidate)
        .join(JobPosting, Candidate.job_posting_id == JobPosting.id)
        .where(Candidate.id == candidate_id, JobPosting.user_id == user_id)
        .options(
            selectinload(Candidate.links),
            selectinload(Candidate.triage),
            selectinload(Candidate.analysis_runs),
            selectinload(Candidate.job_posting),
            selectinload(Candidate.final_output),
        )
    )
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate


@router.on_event("startup")
async def startup_analysis_queue() -> None:
    await analysis_queue_manager.start(_run_candidate_analysis_background)


@router.on_event("shutdown")
async def shutdown_analysis_queue() -> None:
    await analysis_queue_manager.stop()


@router.get("/auth/chutes/start")
async def start_chutes_auth() -> RedirectResponse:
    try:
        authorize_url = _required_env("CHUTES_OAUTH_AUTHORIZE_URL")
        client_id = _required_env("CHUTES_OAUTH_CLIENT_ID")
        redirect_uri = _required_env("CHUTES_OAUTH_REDIRECT_URI")
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": _chutes_scopes(),
        "state": state,
        "code_challenge": _pkce_challenge(verifier),
        "code_challenge_method": "S256",
    }
    response = RedirectResponse(
        url=f"{authorize_url}?{urlencode(params)}",
        status_code=status.HTTP_302_FOUND,
    )
    response.set_cookie(_OAUTH_STATE_COOKIE, state, httponly=True, max_age=600, samesite="lax", path="/")
    response.set_cookie(_OAUTH_VERIFIER_COOKIE, verifier, httponly=True, max_age=600, samesite="lax", path="/")
    return response


@router.get("/auth/chutes/callback")
async def complete_chutes_auth(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    error = request.query_params.get("error")
    error_description = request.query_params.get("error_description")
    if error:
        return _auth_error_redirect(error_description or error)

    code = request.query_params.get("code")
    returned_state = request.query_params.get("state")
    expected_state = request.cookies.get(_OAUTH_STATE_COOKIE)
    verifier = request.cookies.get(_OAUTH_VERIFIER_COOKIE)

    if not code:
        return _auth_error_redirect("Missing authorization code.")
    if not returned_state or not expected_state or returned_state != expected_state:
        return _auth_error_redirect("OAuth state validation failed.")
    if not verifier:
        return _auth_error_redirect("Missing PKCE verifier.")

    try:
        token_url = _required_env("CHUTES_OAUTH_TOKEN_URL")
        userinfo_url = _required_env("CHUTES_OAUTH_USERINFO_URL")
        client_id = _required_env("CHUTES_OAUTH_CLIENT_ID")
        client_secret = _required_env("CHUTES_OAUTH_CLIENT_SECRET")
        redirect_uri = _required_env("CHUTES_OAUTH_REDIRECT_URI")
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            token_response = await client.post(
                token_url,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code_verifier": verifier,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            token_response.raise_for_status()
            token_payload = token_response.json()
            access_token = token_payload.get("access_token")
            if not isinstance(access_token, str) or not access_token:
                return _auth_error_redirect("Chutes token response was missing an access token.")

            userinfo = await _load_chutes_profile(client, access_token, userinfo_url)
    except httpx.HTTPError as exc:
        return _auth_error_redirect(f"Chutes OAuth exchange failed: {exc}")

    subject = userinfo.get("sub")
    username = userinfo.get("username")
    if not isinstance(subject, str) or not subject:
        return _auth_error_redirect("Chutes user info did not include a stable subject.")

    synthetic_email = _synthetic_chutes_email(subject)
    user = await db.scalar(select(User).where(User.email == synthetic_email))
    if user is None:
        user = User(
            email=synthetic_email,
            password_hash=hash_password(secrets.token_urlsafe(32)),
            full_name=username if isinstance(username, str) and username else "Chutes User",
        )
        db.add(user)
        await db.flush()
    elif isinstance(username, str) and username and user.full_name != username:
        user.full_name = username

    user.last_login_at = datetime.utcnow()
    await db.commit()

    token = create_access_token(user.id)
    return _auth_success_redirect(token)


@router.post("/auth/signup", response_model=AuthResponse)
async def signup(payload: SignupRequest, db: AsyncSession = Depends(get_db_session)) -> AuthResponse:
    existing = await db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing is not None:
        raise HTTPException(status_code=409, detail="Email already exists")

    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id)
    return AuthResponse(
        access_token=token,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
    )


@router.post("/auth/login", response_model=AuthResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db_session)) -> AuthResponse:
    user = await db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    user.last_login_at = datetime.utcnow()
    await db.commit()
    token = create_access_token(user.id)
    return AuthResponse(
        access_token=token,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
    )


@router.get("/auth/me", response_model=CurrentUserResponse)
async def me(current_user: User = Depends(get_current_user)) -> CurrentUserResponse:
    return CurrentUserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        created_at=current_user.created_at,
    )


@router.post("/job-postings", response_model=JobPostingResponse)
async def create_job_posting(
    payload: CreateJobPostingRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> JobPostingResponse:
    posting = JobPosting(
        user_id=current_user.id,
        title=payload.title,
        job_description=payload.job_description,
        hiring_context=payload.hiring_context,
        company_priority=payload.company_priority,
        status="active",
    )
    db.add(posting)
    await db.flush()

    for skill in payload.must_have_skills:
        db.add(JobPostingSkill(job_posting_id=posting.id, skill_name=skill, skill_type="must_have"))
    for skill in payload.nice_to_have_skills:
        db.add(JobPostingSkill(job_posting_id=posting.id, skill_name=skill, skill_type="nice_to_have"))

    await db.commit()
    posting = await _get_owned_posting_or_404(db, current_user.id, posting.id)
    return _job_posting_to_response(posting)


@router.get("/job-postings", response_model=JobPostingListResponse)
async def list_job_postings(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> JobPostingListResponse:
    postings = (
        await db.scalars(
            select(JobPosting)
            .where(JobPosting.user_id == current_user.id)
            .options(selectinload(JobPosting.skills))
            .order_by(JobPosting.created_at.desc())
        )
    ).all()
    return JobPostingListResponse(postings=[_job_posting_to_response(posting) for posting in postings])


@router.get("/job-postings/{job_posting_id}", response_model=JobPostingResponse)
async def get_job_posting(
    job_posting_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> JobPostingResponse:
    posting = await _get_owned_posting_or_404(db, current_user.id, job_posting_id)
    return _job_posting_to_response(posting)


@router.patch("/job-postings/{job_posting_id}", response_model=JobPostingResponse)
async def update_job_posting(
    job_posting_id: str,
    payload: UpdateJobPostingRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> JobPostingResponse:
    posting = await _get_owned_posting_or_404(db, current_user.id, job_posting_id)

    if payload.title is not None:
        posting.title = payload.title
    if payload.job_description is not None:
        posting.job_description = payload.job_description
    if payload.hiring_context is not None:
        posting.hiring_context = payload.hiring_context
    if payload.company_priority is not None:
        posting.company_priority = payload.company_priority
    if payload.status is not None:
        posting.status = payload.status

    if payload.must_have_skills is not None or payload.nice_to_have_skills is not None:
        await db.execute(delete(JobPostingSkill).where(JobPostingSkill.job_posting_id == posting.id))
        for skill in payload.must_have_skills or []:
            db.add(JobPostingSkill(job_posting_id=posting.id, skill_name=skill, skill_type="must_have"))
        for skill in payload.nice_to_have_skills or []:
            db.add(JobPostingSkill(job_posting_id=posting.id, skill_name=skill, skill_type="nice_to_have"))

    await db.commit()
    posting = await _get_owned_posting_or_404(db, current_user.id, job_posting_id)
    return _job_posting_to_response(posting)


@router.delete("/job-postings/{job_posting_id}")
async def delete_job_posting(
    job_posting_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> dict:
    posting = await _get_owned_posting_or_404(db, current_user.id, job_posting_id)
    await db.delete(posting)
    await db.commit()
    return {"deleted": True}


@router.post("/job-postings/{job_posting_id}/candidates/upload", response_model=UploadCandidatesResponse)
async def upload_candidates(
    job_posting_id: str,
    cv_pdfs: list[UploadFile] = File(...),
    additional_urls: str | None = Form(default=None),
    additional_urls_by_filename: str | None = Form(default=None),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> UploadCandidatesResponse:
    posting = await _get_owned_posting_or_404(db, current_user.id, job_posting_id)
    must_have = [item.skill_name for item in posting.skills if item.skill_type == "must_have"]
    nice_to_have = [item.skill_name for item in posting.skills if item.skill_type == "nice_to_have"]

    for file in cv_pdfs:
        try:
            assert_pdf_upload(file.filename)
            file_bytes = await file.read()
            resume_text = extract_pdf_text(file_bytes)
        except ResumeIngestionError as exc:
            raise HTTPException(status_code=400, detail=f"{file.filename}: {exc}") from exc

        display_name = derive_candidate_name(
            resume_text=resume_text,
            filename=file.filename,
            name_override=None,
        )
        candidate = Candidate(
            job_posting_id=posting.id,
            uploaded_by_user_id=current_user.id,
            display_name=display_name,
            resume_file_path="",
            resume_sha256=hashlib.sha256(file_bytes).hexdigest(),
            resume_text=resume_text,
            upload_status="completed",
            analysis_status="not_started",
        )
        db.add(candidate)
        await db.flush()

        target_dir = UPLOADS_DIR / current_user.id / posting.id
        target_dir.mkdir(parents=True, exist_ok=True)
        file_path = target_dir / f"{candidate.id}.pdf"
        file_path.write_bytes(file_bytes)
        candidate.resume_file_path = str(file_path)

        links_map = _extract_links_for_file(
            filename=file.filename or "",
            additional_urls=additional_urls,
            additional_urls_by_filename=additional_urls_by_filename,
        )
        for link_type, url in links_map.items():
            db.add(CandidateLink(candidate_id=candidate.id, link_type=link_type, url=url))

        triage = await score_candidate_triage(
            llm_client=_triage_llm_client,
            candidate_name=display_name,
            resume_text=resume_text,
            title=posting.title,
            job_description=posting.job_description,
            must_have_skills=must_have,
            nice_to_have_skills=nice_to_have,
        )
        db.add(
            CandidateTriage(
                candidate_id=candidate.id,
                keyword_match_score=triage["keyword_match_score"],
                llm_triage_score=triage["llm_triage_score"],
                triage_score=triage["triage_score"],
                triage_summary=triage["triage_summary"],
                triage_status=triage["triage_status"],
                rank_last_computed_at=datetime.utcnow(),
            )
        )

    await db.commit()
    candidates = (
        await db.scalars(
            select(Candidate)
            .where(Candidate.job_posting_id == posting.id)
            .options(
                selectinload(Candidate.triage),
                selectinload(Candidate.analysis_runs),
                selectinload(Candidate.job_posting),
                selectinload(Candidate.final_output),
            )
        )
    ).all()
    candidates = sorted(candidates, key=_candidate_sort_key, reverse=True)
    return UploadCandidatesResponse(
        job_posting_id=posting.id,
        uploaded_count=len(cv_pdfs),
        candidates=[_candidate_to_list_item(item) for item in candidates],
    )


@router.get("/job-postings/{job_posting_id}/candidates", response_model=list[CandidateListItemResponse])
async def list_candidates_for_posting(
    job_posting_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> list[CandidateListItemResponse]:
    posting = await _get_owned_posting_or_404(db, current_user.id, job_posting_id)
    candidates = (
        await db.scalars(
            select(Candidate)
            .where(Candidate.job_posting_id == posting.id)
            .options(
                selectinload(Candidate.triage),
                selectinload(Candidate.analysis_runs),
                selectinload(Candidate.job_posting),
                selectinload(Candidate.final_output),
            )
        )
    ).all()
    candidates = sorted(candidates, key=_candidate_sort_key, reverse=True)
    return [_candidate_to_list_item(item) for item in candidates]


@router.get("/candidates", response_model=list[CandidateListItemResponse])
async def list_candidates_for_user(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> list[CandidateListItemResponse]:
    candidates = (
        await db.scalars(
            select(Candidate)
            .join(JobPosting, Candidate.job_posting_id == JobPosting.id)
            .where(JobPosting.user_id == current_user.id)
            .options(
                selectinload(Candidate.triage),
                selectinload(Candidate.analysis_runs),
                selectinload(Candidate.job_posting),
                selectinload(Candidate.final_output),
            )
        )
    ).all()
    candidates = sorted(candidates, key=_candidate_sort_key, reverse=True)
    return [_candidate_to_list_item(item) for item in candidates]


@router.get("/reports", response_model=list[CandidateReportListItemResponse])
async def list_reports_for_user(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> list[CandidateReportListItemResponse]:
    candidates = (
        await db.scalars(
            select(Candidate)
            .join(JobPosting, Candidate.job_posting_id == JobPosting.id)
            .where(JobPosting.user_id == current_user.id)
            .options(
                selectinload(Candidate.analysis_runs),
                selectinload(Candidate.job_posting),
            )
        )
    ).all()

    rows: list[CandidateReportListItemResponse] = []
    for candidate in candidates:
        latest = _latest_completed_analysis(candidate)
        if latest is None:
            continue
        rows.append(
            CandidateReportListItemResponse(
                candidate_id=candidate.id,
                candidate_name=candidate.display_name,
                job_posting_id=candidate.job_posting_id,
                job_posting_title=candidate.job_posting.title if candidate.job_posting else "",
                analysis_run_id=latest.id,
                final_score=latest.final_score,
                recommendation=latest.recommendation,
                completed_at=latest.completed_at,
            )
        )
    rows.sort(key=lambda item: ((item.final_score or 0.0), item.completed_at or datetime.min), reverse=True)
    return rows


@router.get("/notifications", response_model=NotificationListResponse)
async def list_notifications(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> NotificationListResponse:
    rows = (
        await db.scalars(
            select(Notification)
            .where(Notification.user_id == current_user.id)
            .order_by(Notification.created_at.desc())
            .limit(30)
        )
    ).all()
    unread_count = (
        await db.scalar(
            select(func.count(Notification.id)).where(
                Notification.user_id == current_user.id,
                Notification.is_read.is_(False),
            )
        )
    )
    return NotificationListResponse(
        items=[_notification_to_item(item) for item in rows],
        unread_count=int(unread_count or 0),
    )


@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> dict:
    item = await db.scalar(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == current_user.id)
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    if not item.is_read:
        item.is_read = True
        await db.commit()
    return {"ok": True}


@router.post("/notifications/read-all")
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> dict:
    rows = (
        await db.scalars(
            select(Notification).where(Notification.user_id == current_user.id, Notification.is_read.is_(False))
        )
    ).all()
    for row in rows:
        row.is_read = True
    if rows:
        await db.commit()
    return {"ok": True, "updated": len(rows)}


@router.get("/analysis-queue", response_model=AnalysisQueueStatusResponse)
async def get_analysis_queue_status(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> AnalysisQueueStatusResponse:
    snapshot = await analysis_queue_manager.snapshot(current_user.id)
    current_item = snapshot["current"]

    if current_item is None:
        return AnalysisQueueStatusResponse(
            queue_size_total=snapshot["queue_size_total"],
            queue_size_user=snapshot["queue_size_user"],
        )

    candidate = await db.scalar(
        select(Candidate)
        .join(JobPosting, Candidate.job_posting_id == JobPosting.id)
        .where(Candidate.id == current_item.candidate_id, JobPosting.user_id == current_user.id)
        .options(selectinload(Candidate.job_posting))
    )
    run = await db.scalar(select(CandidateAnalysisRun).where(CandidateAnalysisRun.id == current_item.analysis_run_id))
    stage_rows = (
        await db.scalars(
            select(CandidateStageOutput)
            .where(CandidateStageOutput.analysis_run_id == current_item.analysis_run_id)
            .order_by(CandidateStageOutput.created_at.asc())
        )
    ).all()
    progress, current_stage = _progress_from_stage_rows(stage_rows)

    if candidate is None:
        return AnalysisQueueStatusResponse(
            queue_size_total=snapshot["queue_size_total"],
            queue_size_user=snapshot["queue_size_user"],
            current_status=run.status if run else "processing",
            current_stage=current_stage,
            current_progress_percent=progress,
        )

    return AnalysisQueueStatusResponse(
        queue_size_total=snapshot["queue_size_total"],
        queue_size_user=snapshot["queue_size_user"],
        current_candidate_id=candidate.id,
        current_candidate_name=candidate.display_name,
        current_job_posting_id=candidate.job_posting_id,
        current_job_posting_title=candidate.job_posting.title if candidate.job_posting else None,
        current_run_id=current_item.analysis_run_id,
        current_status=run.status if run else candidate.analysis_status,
        current_stage=current_stage,
        current_progress_percent=progress,
    )


@router.get("/candidates/{candidate_id}/resume")
async def stream_candidate_resume(
    candidate_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    candidate = await _get_owned_candidate_or_404(db, current_user.id, candidate_id)
    file_path = Path(candidate.resume_file_path)
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Resume PDF not found")
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=f"{candidate.display_name.replace(' ', '_').lower()}.pdf",
    )


async def _run_candidate_analysis_background(candidate_id: str, analysis_run_id: str) -> None:
    async with SessionLocal() as db:
        candidate = await db.scalar(
            select(Candidate)
            .where(Candidate.id == candidate_id)
            .options(
                selectinload(Candidate.links),
                selectinload(Candidate.analysis_runs),
                selectinload(Candidate.job_posting).selectinload(JobPosting.skills),
            )
        )
        if candidate is None:
            return
        run = await db.scalar(select(CandidateAnalysisRun).where(CandidateAnalysisRun.id == analysis_run_id))
        if run is None:
            return

        candidate.analysis_status = "processing"
        run.status = "processing"
        run.started_at = datetime.utcnow()
        await db.commit()

        posting = candidate.job_posting
        if posting is None:
            run.status = "error"
            candidate.analysis_status = "error"
            db.add(
                Notification(
                    user_id=candidate.uploaded_by_user_id,
                    title="Pipeline failed",
                    body=f"Analysis for {candidate.display_name} could not start because the job posting was missing.",
                    notification_type="pipeline_failed",
                    candidate_id=candidate.id,
                    analysis_run_id=analysis_run_id,
                    is_read=False,
                )
            )
            await db.commit()
            return

        must_have = [item.skill_name for item in posting.skills if item.skill_type == "must_have"]
        nice_to_have = [item.skill_name for item in posting.skills if item.skill_type == "nice_to_have"]
        links = {item.link_type: item.url for item in candidate.links}

        run_data = {
            "id": analysis_run_id,
            "title": posting.title,
            "job_description": posting.job_description,
            "hiring_context": posting.hiring_context,
            "company_priority": posting.company_priority or "",
            "must_have_skills": must_have,
            "nice_to_have_skills": nice_to_have,
            "candidates": [
                {
                    "name": candidate.display_name,
                    "resume_text": candidate.resume_text,
                    "professional_links": links,
                }
            ],
        }

        stage_count = 0

        async def progress_callback(pipeline: list[dict], _: list[dict]) -> None:
            nonlocal stage_count
            if len(pipeline) <= stage_count:
                return
            new_entries = pipeline[stage_count:]
            stage_count = len(pipeline)

            for item in new_entries:
                db.add(
                    CandidateStageOutput(
                        analysis_run_id=analysis_run_id,
                        stage_name=item.get("stage", ""),
                        status=item.get("status", "completed"),
                        summary=item.get("summary", ""),
                        raw_output_json=item.get("raw_output", {}),
                    )
                )
            await db.commit()

        try:
            results = await _orchestrator.run_pipeline(run_data, progress_callback=progress_callback)
            chosen = (results.get("candidates") or [{}])[0]
            score = chosen.get("score", {})
            panel_review = chosen.get("panel_review", {})
            interview_pack = chosen.get("interview_pack", {})
            report_data = results.get("report_data", {})

            run.status = "completed"
            run.completed_at = datetime.utcnow()
            run.final_score = score.get("final_score")
            run.recommendation = score.get("recommendation")
            run.report_summary = results.get("report")
            candidate.analysis_status = "completed"
            db.add(
                Notification(
                    user_id=candidate.uploaded_by_user_id,
                    title="Pipeline completed",
                    body=(
                        f"{candidate.display_name} completed analysis for {posting.title} "
                        f"with score {float(score.get('final_score') or 0.0):.1f}."
                    ),
                    notification_type="pipeline_completed",
                    candidate_id=candidate.id,
                    analysis_run_id=analysis_run_id,
                    is_read=False,
                )
            )

            existing_output = await db.scalar(
                select(CandidateFinalOutput).where(CandidateFinalOutput.candidate_id == candidate.id)
            )
            if existing_output is None:
                existing_output = CandidateFinalOutput(
                    candidate_id=candidate.id,
                    analysis_run_id=analysis_run_id,
                    score_json=score,
                    report_json=report_data,
                    panel_review_json=panel_review,
                    interview_pack_json=interview_pack,
                )
                db.add(existing_output)
            else:
                existing_output.analysis_run_id = analysis_run_id
                existing_output.score_json = score
                existing_output.report_json = report_data
                existing_output.panel_review_json = panel_review
                existing_output.interview_pack_json = interview_pack

            await db.commit()
        except Exception as exc:
            run.status = "error"
            run.completed_at = datetime.utcnow()
            run.report_summary = str(exc)
            candidate.analysis_status = "error"
            db.add(
                CandidateStageOutput(
                    analysis_run_id=analysis_run_id,
                    stage_name="Pipeline",
                    status="error",
                    summary=f"Pipeline failed: {exc}",
                    raw_output_json={"error": str(exc)},
                )
            )
            db.add(
                Notification(
                    user_id=candidate.uploaded_by_user_id,
                    title="Pipeline failed",
                    body=f"{candidate.display_name} analysis failed for {posting.title}: {exc}",
                    notification_type="pipeline_failed",
                    candidate_id=candidate.id,
                    analysis_run_id=analysis_run_id,
                    is_read=False,
                )
            )
            await db.commit()


@router.post("/candidates/{candidate_id}/analyze", response_model=StartCandidateAnalysisResponse)
async def start_candidate_analysis(
    candidate_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> StartCandidateAnalysisResponse:
    candidate = await _get_owned_candidate_or_404(db, current_user.id, candidate_id)

    existing_active_run = await db.scalar(
        select(CandidateAnalysisRun)
        .where(
            CandidateAnalysisRun.candidate_id == candidate.id,
            CandidateAnalysisRun.status.in_(["queued", "processing"]),
        )
        .order_by(CandidateAnalysisRun.started_at.desc().nullslast(), CandidateAnalysisRun.id.desc())
    )
    if existing_active_run is not None:
        return StartCandidateAnalysisResponse(
            candidate_id=candidate.id,
            analysis_run_id=existing_active_run.id,
            status=existing_active_run.status,
            queue_position=None,
        )

    run = CandidateAnalysisRun(candidate_id=candidate.id, status="queued")
    candidate.analysis_status = "queued"
    db.add(run)
    await db.commit()
    await db.refresh(run)

    queue_position = await analysis_queue_manager.enqueue(current_user.id, candidate.id, run.id)
    return StartCandidateAnalysisResponse(
        candidate_id=candidate.id,
        analysis_run_id=run.id,
        status="queued",
        queue_position=queue_position,
    )


@router.get("/candidates/{candidate_id}", response_model=CandidateDetailResponse)
async def get_candidate_detail(
    candidate_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> CandidateDetailResponse:
    candidate = await _get_owned_candidate_or_404(db, current_user.id, candidate_id)
    links = {item.link_type: item.url for item in candidate.links}
    triage = candidate.triage
    current_score, current_score_type, final_score, recommendation, report_ready = _candidate_score_snapshot(candidate)
    return CandidateDetailResponse(
        id=candidate.id,
        job_posting_id=candidate.job_posting_id,
        job_posting_title=candidate.job_posting.title if candidate.job_posting else "",
        display_name=candidate.display_name,
        resume_text=candidate.resume_text,
        upload_status=candidate.upload_status,
        analysis_status=candidate.analysis_status,
        links=links,
        triage_score=triage.triage_score if triage else 0.0,
        triage_summary=triage.triage_summary if triage else "",
        keyword_match_score=triage.keyword_match_score if triage else 0.0,
        llm_triage_score=triage.llm_triage_score if triage else 0.0,
        current_score=current_score,
        current_score_type=current_score_type,
        final_score=final_score,
        recommendation=recommendation,
        report_ready=report_ready,
        resume_url=_resume_url(candidate.id),
    )


@router.get("/candidates/{candidate_id}/analysis", response_model=CandidateAnalysisResponse)
async def get_candidate_analysis(
    candidate_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> CandidateAnalysisResponse:
    candidate = await _get_owned_candidate_or_404(db, current_user.id, candidate_id)
    run = await db.scalar(
        select(CandidateAnalysisRun)
        .where(CandidateAnalysisRun.candidate_id == candidate.id)
        .order_by(CandidateAnalysisRun.started_at.desc().nullslast(), CandidateAnalysisRun.id.desc())
    )
    if run is None:
        return CandidateAnalysisResponse(candidate_id=candidate.id, status=candidate.analysis_status, stages=[])

    stage_rows = (
        await db.scalars(
            select(CandidateStageOutput)
            .where(CandidateStageOutput.analysis_run_id == run.id)
            .order_by(CandidateStageOutput.created_at.asc())
        )
    ).all()
    stages = [
        CandidateAnalysisStage(
            stage=row.stage_name,
            status=row.status,
            summary=row.summary,
            raw_output=row.raw_output_json,
            created_at=row.created_at,
        )
        for row in stage_rows
    ]
    return CandidateAnalysisResponse(
        candidate_id=candidate.id,
        analysis_run_id=run.id,
        status=run.status,
        stages=stages,
        final_score=run.final_score,
        recommendation=run.recommendation,
        report_summary=run.report_summary,
    )


@router.get("/candidates/{candidate_id}/report", response_model=CandidateReportResponse)
async def get_candidate_report(
    candidate_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> CandidateReportResponse:
    candidate = await _get_owned_candidate_or_404(db, current_user.id, candidate_id)
    output = await db.scalar(select(CandidateFinalOutput).where(CandidateFinalOutput.candidate_id == candidate.id))
    if output is None:
        raise HTTPException(status_code=409, detail="Candidate report not ready")
    return CandidateReportResponse(
        candidate_id=candidate.id,
        analysis_run_id=output.analysis_run_id,
        score=output.score_json,
        report=output.report_json,
        panel_review=output.panel_review_json,
        interview_pack=output.interview_pack_json,
    )
