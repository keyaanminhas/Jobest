from typing import Any, Literal

from pydantic import BaseModel, Field


class JobRubricOutput(BaseModel):
    role_title: str = ""
    seniority: str = ""
    must_have_skills: list[str] = Field(default_factory=list)
    nice_to_have_skills: list[str] = Field(default_factory=list)
    responsibilities: list[str] = Field(default_factory=list)
    domain_requirements: list[str] = Field(default_factory=list)
    red_flags: list[str] = Field(default_factory=list)
    recommended_weights: dict[str, float] = Field(default_factory=dict)


class HiringContextOutput(BaseModel):
    team_gaps: list[str] = Field(default_factory=list)
    company_priorities: list[str] = Field(default_factory=list)
    ideal_candidate_traits: list[str] = Field(default_factory=list)
    context_fit_keywords: list[str] = Field(default_factory=list)
    context_risks: list[str] = Field(default_factory=list)


class ParsedResumeOutput(BaseModel):
    candidate_name: str = ""
    education: list[dict[str, Any]] = Field(default_factory=list)
    work_experience: list[dict[str, Any]] = Field(default_factory=list)
    projects: list[dict[str, Any]] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    tools: list[str] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    achievements: list[str] = Field(default_factory=list)
    professional_links: list[str] = Field(default_factory=list)


class EvidenceItem(BaseModel):
    skill: str
    evidence: str
    source: str = "resume"
    confidence: Literal["high", "medium", "low"] = "medium"


class UnsupportedClaim(BaseModel):
    claim: str
    reason: str


class EvidenceOutput(BaseModel):
    evidence_items: list[EvidenceItem] = Field(default_factory=list)
    unsupported_claims: list[UnsupportedClaim] = Field(default_factory=list)


class TransferMatch(BaseModel):
    requirement: str
    candidate_skill: str
    evidence: str = ""
    reasoning: str = ""
    confidence: Literal["high", "medium", "low"] = "medium"


class MissingRequirement(BaseModel):
    requirement: str
    reason: str


class TransferableSkillsOutput(BaseModel):
    exact_matches: list[TransferMatch] = Field(default_factory=list)
    transferable_matches: list[TransferMatch] = Field(default_factory=list)
    missing_requirements: list[MissingRequirement] = Field(default_factory=list)


class ProfessionalFootprintOutput(BaseModel):
    portfolio_score: float = 50
    github_score: float = 50
    claim_support: str = "unknown"
    professional_evidence: list[str] = Field(default_factory=list)
    concerns: list[str] = Field(default_factory=list)
    supported_resume_claims: list[str] = Field(default_factory=list)
    unsupported_resume_claims: list[str] = Field(default_factory=list)


class RiskAuditOutput(BaseModel):
    risk_level: Literal["low", "medium", "high"] = "medium"
    risk_penalty: float = 5
    risks: list[str] = Field(default_factory=list)
    recommended_interview_focus: list[str] = Field(default_factory=list)


class PanelReviewOutput(BaseModel):
    technical_lead_view: str = ""
    hr_recruiter_view: str = ""
    hiring_manager_view: str = ""
    risk_auditor_view: str = ""
    final_panel_recommendation: str = ""


class InterviewQuestion(BaseModel):
    question: str
    what_to_listen_for: str


class InterviewPackOutput(BaseModel):
    technical_questions: list[InterviewQuestion] = Field(default_factory=list)
    behavioral_questions: list[InterviewQuestion] = Field(default_factory=list)
    risk_validation_questions: list[InterviewQuestion] = Field(default_factory=list)


class FinalReportOutput(BaseModel):
    summary: str = ""
    top_candidates: list[dict[str, Any]] = Field(default_factory=list)
    risks_to_verify: list[str] = Field(default_factory=list)
    suggested_next_action: str = ""
