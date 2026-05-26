from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


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

    @staticmethod
    def _coerce_transfer_list(value: Any) -> list[dict[str, Any]]:
        if not isinstance(value, list):
            return []
        coerced: list[dict[str, Any]] = []
        for item in value:
            if isinstance(item, dict):
                coerced.append(item)
            elif isinstance(item, str):
                coerced.append(
                    {
                        "requirement": item,
                        "candidate_skill": item,
                        "evidence": "",
                        "reasoning": "Normalized from string output",
                        "confidence": "medium",
                    }
                )
        return coerced

    @staticmethod
    def _coerce_missing_list(value: Any) -> list[dict[str, Any]]:
        if not isinstance(value, list):
            return []
        coerced: list[dict[str, Any]] = []
        for item in value:
            if isinstance(item, dict):
                coerced.append(item)
            elif isinstance(item, str):
                coerced.append(
                    {
                        "requirement": item,
                        "reason": "Normalized from string output",
                    }
                )
        return coerced

    @field_validator("exact_matches", "transferable_matches", mode="before")
    @classmethod
    def _normalize_match_fields(cls, value: Any) -> list[dict[str, Any]]:
        return cls._coerce_transfer_list(value)

    @field_validator("missing_requirements", mode="before")
    @classmethod
    def _normalize_missing_fields(cls, value: Any) -> list[dict[str, Any]]:
        return cls._coerce_missing_list(value)


class ProfessionalFootprintOutput(BaseModel):
    portfolio_score: float = 50
    github_score: float = 50
    claim_support: str = "unknown"
    professional_evidence: list[str] = Field(default_factory=list)
    concerns: list[str] = Field(default_factory=list)
    supported_resume_claims: list[str] = Field(default_factory=list)
    unsupported_resume_claims: list[str] = Field(default_factory=list)
    visited_links: list[dict[str, Any]] = Field(default_factory=list)
    github_repos: list[dict[str, Any]] = Field(default_factory=list)
    fetch_failures: list[dict[str, str]] = Field(default_factory=list)

    @field_validator("professional_evidence", mode="before")
    @classmethod
    def _normalize_professional_evidence(cls, value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        normalized: list[str] = []
        for item in value:
            if isinstance(item, str):
                text = item.strip()
                if text:
                    normalized.append(text)
                continue
            if isinstance(item, dict):
                skill = str(item.get("skill") or "").strip()
                evidence = str(item.get("evidence") or item.get("details") or "").strip()
                confidence = str(item.get("confidence") or "").strip()
                composed = ""
                if skill and evidence:
                    composed = f"{skill}: {evidence}"
                elif skill:
                    composed = skill
                elif evidence:
                    composed = evidence
                if composed and confidence:
                    composed = f"{composed} ({confidence})"
                if composed:
                    normalized.append(composed)
        return normalized


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

    @staticmethod
    def _coerce_questions(value: Any) -> list[dict[str, Any]]:
        if not isinstance(value, list):
            return []
        coerced: list[dict[str, Any]] = []
        for item in value:
            if isinstance(item, dict):
                coerced.append(item)
            elif isinstance(item, str):
                coerced.append(
                    {
                        "question": item,
                        "what_to_listen_for": "Ask for concrete, role-relevant evidence and measurable outcomes.",
                    }
                )
        return coerced

    @field_validator("technical_questions", "behavioral_questions", "risk_validation_questions", mode="before")
    @classmethod
    def _normalize_question_fields(cls, value: Any) -> list[dict[str, Any]]:
        return cls._coerce_questions(value)


class FinalReportOutput(BaseModel):
    summary: str = ""
    top_candidates: list[dict[str, Any]] = Field(default_factory=list)
    risks_to_verify: list[str] = Field(default_factory=list)
    suggested_next_action: str = ""
