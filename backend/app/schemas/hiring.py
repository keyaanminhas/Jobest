from datetime import datetime
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field

from app.schemas.candidate import CandidateInput


class CreateHiringRunRequest(BaseModel):
    title: str
    job_description: str
    hiring_context: str
    company_priority: str | None = None
    must_have_skills: list[str] = Field(default_factory=list)
    nice_to_have_skills: list[str] = Field(default_factory=list)
    candidates: list[CandidateInput] = Field(default_factory=list)


class HiringRun(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    title: str
    job_description: str
    hiring_context: str
    company_priority: str | None = None
    must_have_skills: list[str] = Field(default_factory=list)
    nice_to_have_skills: list[str] = Field(default_factory=list)
    candidates: list[CandidateInput] = Field(default_factory=list)
    status: Literal["draft", "processing", "completed", "error"] = "draft"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    results: dict[str, Any] | None = None


class HiringRunResponse(BaseModel):
    run_id: str
    status: str
    run: HiringRun


class SingleCVRunResponse(BaseModel):
    run_id: str
    status: str
    run: HiringRun


class PipelineStage(BaseModel):
    stage: str
    status: str
    summary: str
    raw_output: dict[str, Any]


class RunExecutionResponse(BaseModel):
    run_id: str
    status: str
    pipeline: list[PipelineStage] = Field(default_factory=list)
    top_candidates: list[dict[str, Any]] = Field(default_factory=list)
    report: str


class ShortlistResponse(BaseModel):
    run_id: str
    shortlist: list[dict[str, Any]]


class FinalReportResponse(BaseModel):
    run_id: str
    report: dict[str, Any]


class HealthResponse(BaseModel):
    status: str
    app_env: str
    llm_mode: str
    provider: str
    base_url: str
    model: str
