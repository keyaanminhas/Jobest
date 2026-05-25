from typing import Any, Literal

from pydantic import BaseModel, Field


class ProfessionalLinks(BaseModel):
    github: str | None = None
    portfolio: str | None = None
    linkedin: str | None = None
    kaggle: str | None = None
    scholar: str | None = None


class CandidateInput(BaseModel):
    name: str
    resume_text: str
    professional_links: ProfessionalLinks | None = None
    notes: str | None = None


class CandidateScore(BaseModel):
    requirement_match: float
    evidence_strength: float
    professional_footprint: float
    hiring_context_fit: float
    risk_penalty: float
    final_score: float
    recommendation: Literal["Strong Shortlist", "Shortlist", "Maybe", "Reject"]
    score_explanation: str = ""


class CandidatePipelineState(BaseModel):
    candidate: CandidateInput
    outputs: dict[str, Any] = Field(default_factory=dict)
    score: CandidateScore | None = None
