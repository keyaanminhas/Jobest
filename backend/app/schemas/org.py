from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user_id: str
    email: str
    full_name: str | None = None


class CurrentUserResponse(BaseModel):
    id: str
    email: str
    full_name: str | None = None
    created_at: datetime


class CreateJobPostingRequest(BaseModel):
    title: str
    job_description: str
    hiring_context: str
    company_priority: str | None = None
    must_have_skills: list[str] = Field(default_factory=list)
    nice_to_have_skills: list[str] = Field(default_factory=list)


class UpdateJobPostingRequest(BaseModel):
    title: str | None = None
    job_description: str | None = None
    hiring_context: str | None = None
    company_priority: str | None = None
    must_have_skills: list[str] | None = None
    nice_to_have_skills: list[str] | None = None
    status: str | None = None


class JobPostingResponse(BaseModel):
    id: str
    title: str
    job_description: str
    hiring_context: str
    company_priority: str | None = None
    status: str
    must_have_skills: list[str] = Field(default_factory=list)
    nice_to_have_skills: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class JobPostingListResponse(BaseModel):
    postings: list[JobPostingResponse] = Field(default_factory=list)


class CandidateListItemResponse(BaseModel):
    id: str
    job_posting_id: str
    job_posting_title: str
    display_name: str
    upload_status: str
    analysis_status: str
    triage_status: str
    triage_score: float
    keyword_match_score: float
    llm_triage_score: float
    triage_summary: str
    current_score: float
    current_score_type: Literal["triage", "final"]
    final_score: float | None = None
    recommendation: str | None = None
    report_ready: bool = False
    resume_url: str = ""
    created_at: datetime


class UploadCandidatesResponse(BaseModel):
    job_posting_id: str
    uploaded_count: int
    candidates: list[CandidateListItemResponse] = Field(default_factory=list)


class CandidateDetailResponse(BaseModel):
    id: str
    job_posting_id: str
    job_posting_title: str
    display_name: str
    resume_text: str
    upload_status: str
    analysis_status: str
    links: dict[str, str] = Field(default_factory=dict)
    triage_score: float = 0.0
    triage_summary: str = ""
    keyword_match_score: float = 0.0
    llm_triage_score: float = 0.0
    current_score: float = 0.0
    current_score_type: Literal["triage", "final"] = "triage"
    final_score: float | None = None
    recommendation: str | None = None
    report_ready: bool = False
    resume_url: str = ""


class StartCandidateAnalysisResponse(BaseModel):
    candidate_id: str
    analysis_run_id: str
    status: str
    queue_position: int | None = None


class CandidateAnalysisStage(BaseModel):
    stage: str
    status: str
    summary: str
    raw_output: dict
    created_at: datetime


class CandidateAnalysisResponse(BaseModel):
    candidate_id: str
    analysis_run_id: str | None = None
    status: str
    stages: list[CandidateAnalysisStage] = Field(default_factory=list)
    final_score: float | None = None
    recommendation: str | None = None
    report_summary: str | None = None


class CandidateReportResponse(BaseModel):
    candidate_id: str
    analysis_run_id: str
    score: dict
    report: dict
    panel_review: dict
    interview_pack: dict


class CandidateReportListItemResponse(BaseModel):
    candidate_id: str
    candidate_name: str
    job_posting_id: str
    job_posting_title: str
    analysis_run_id: str
    final_score: float | None = None
    recommendation: str | None = None
    completed_at: datetime | None = None


class AnalysisQueueStatusResponse(BaseModel):
    queue_size_total: int
    queue_size_user: int
    current_candidate_id: str | None = None
    current_candidate_name: str | None = None
    current_job_posting_id: str | None = None
    current_job_posting_title: str | None = None
    current_run_id: str | None = None
    current_status: str | None = None
    current_stage: str | None = None
    current_progress_percent: float = 0.0


class NotificationItemResponse(BaseModel):
    id: str
    title: str
    body: str
    notification_type: str
    candidate_id: str | None = None
    analysis_run_id: str | None = None
    is_read: bool
    created_at: datetime


class NotificationListResponse(BaseModel):
    items: list[NotificationItemResponse] = Field(default_factory=list)
    unread_count: int = 0
