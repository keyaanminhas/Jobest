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

    @staticmethod
    def _normalize_confidence(raw: Any) -> str:
        text = str(raw or "").strip().lower()
        if text in {"high", "medium", "low"}:
            return text
        if "high" in text:
            return "high"
        if "low" in text:
            return "low"
        return "medium"

    @staticmethod
    def _coerce_evidence_items(value: Any) -> list[dict[str, Any]]:
        if not isinstance(value, list):
            return []
        coerced: list[dict[str, Any]] = []
        for item in value:
            if isinstance(item, dict):
                skill = str(item.get("skill") or item.get("requirement") or item.get("name") or "").strip()
                evidence = str(
                    item.get("evidence")
                    or item.get("details")
                    or item.get("evidence_text")
                    or item.get("proof")
                    or ""
                ).strip()
                if not skill and evidence:
                    skill = "Unspecified skill"
                if not evidence and skill:
                    evidence = "Normalized from partial model output."
                if not skill and not evidence:
                    continue
                coerced.append(
                    {
                        "skill": skill or "Unspecified skill",
                        "evidence": evidence or "Normalized from model output.",
                        "source": str(item.get("source") or "resume").strip() or "resume",
                        "confidence": EvidenceOutput._normalize_confidence(item.get("confidence")),
                    }
                )
            elif isinstance(item, str):
                text = item.strip()
                if not text:
                    continue
                coerced.append(
                    {
                        "skill": text,
                        "evidence": "Normalized from string output.",
                        "source": "resume",
                        "confidence": "medium",
                    }
                )
        return coerced

    @staticmethod
    def _coerce_unsupported_claims(value: Any) -> list[dict[str, Any]]:
        if not isinstance(value, list):
            return []
        coerced: list[dict[str, Any]] = []
        for item in value:
            if isinstance(item, dict):
                claim = str(item.get("claim") or item.get("skill") or item.get("requirement") or "").strip()
                reason = str(item.get("reason") or item.get("evidence_gap") or "").strip()
                if not claim and not reason:
                    continue
                coerced.append(
                    {
                        "claim": claim or "Unspecified claim",
                        "reason": reason or "Evidence not clearly provided.",
                    }
                )
            elif isinstance(item, str):
                text = item.strip()
                if not text:
                    continue
                coerced.append({"claim": text, "reason": "Evidence not clearly provided."})
        return coerced

    @field_validator("evidence_items", mode="before")
    @classmethod
    def _normalize_evidence_items(cls, value: Any) -> list[dict[str, Any]]:
        return cls._coerce_evidence_items(value)

    @field_validator("unsupported_claims", mode="before")
    @classmethod
    def _normalize_unsupported_claims(cls, value: Any) -> list[dict[str, Any]]:
        return cls._coerce_unsupported_claims(value)


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
                requirement = str(
                    item.get("requirement")
                    or item.get("job_requirement")
                    or item.get("skill_requirement")
                    or item.get("target_skill")
                    or ""
                ).strip()
                candidate_skill = str(
                    item.get("candidate_skill")
                    or item.get("matched_skill")
                    or item.get("resume_skill")
                    or item.get("skill")
                    or ""
                ).strip()
                evidence = str(
                    item.get("evidence")
                    or item.get("details")
                    or item.get("proof")
                    or ""
                ).strip()
                reasoning = str(
                    item.get("reasoning")
                    or item.get("rationale")
                    or item.get("explanation")
                    or ""
                ).strip()
                confidence = str(item.get("confidence") or "medium").strip().lower()
                if confidence not in {"high", "medium", "low"}:
                    confidence = "medium"
                if not requirement and candidate_skill:
                    requirement = candidate_skill
                if not candidate_skill and requirement:
                    candidate_skill = requirement
                if not requirement and not candidate_skill:
                    continue
                coerced.append(
                    {
                        "requirement": requirement or "Unspecified requirement",
                        "candidate_skill": candidate_skill or "Unspecified skill",
                        "evidence": evidence,
                        "reasoning": reasoning or "Normalized from model output",
                        "confidence": confidence,
                    }
                )
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
                requirement = str(
                    item.get("requirement")
                    or item.get("job_requirement")
                    or item.get("skill_requirement")
                    or ""
                ).strip()
                reason = str(
                    item.get("reason")
                    or item.get("gap_reason")
                    or item.get("details")
                    or ""
                ).strip()
                if not requirement and not reason:
                    continue
                coerced.append(
                    {
                        "requirement": requirement or "Unspecified requirement",
                        "reason": reason or "Normalized from model output",
                    }
                )
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

    @staticmethod
    def _coerce_string_list(value: Any, *, from_dict_keys: tuple[str, ...] = ()) -> list[str]:
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
                text = ""
                for key in from_dict_keys:
                    candidate = str(item.get(key) or "").strip()
                    if candidate:
                        text = candidate
                        break
                if text:
                    normalized.append(text)
        return normalized

    @field_validator("claim_support", mode="before")
    @classmethod
    def _normalize_claim_support(cls, value: Any) -> str:
        text = str(value or "").strip().lower()
        if not text:
            return "unknown"
        canonical = {
            "strong": "strong",
            "moderate": "moderate",
            "weak": "weak",
            "partial": "partial",
            "high": "strong",
            "medium": "moderate",
            "low": "weak",
            "yes": "strong",
            "no": "weak",
            "unknown": "unknown",
        }
        if text in canonical:
            return canonical[text]
        # Heuristic normalization for verbose model outputs.
        if "no evidence" in text or "unsupported" in text or "low confidence" in text:
            return "weak"
        if "some evidence" in text or "moderate" in text or "partial" in text:
            return "moderate"
        if "strong evidence" in text or "well supported" in text or "high confidence" in text:
            return "strong"
        return text

    @field_validator("portfolio_score", "github_score", mode="before")
    @classmethod
    def _normalize_footprint_scores(cls, value: Any) -> float:
        try:
            score = float(value)
        except Exception:
            return 50.0
        # Accept 0-10 model outputs and convert to 0-100 scale.
        if 0.0 <= score <= 10.0:
            score = score * 10.0
        return max(0.0, min(100.0, score))

    @field_validator("professional_evidence", mode="before")
    @classmethod
    def _normalize_professional_evidence(cls, value: Any) -> list[str]:
        base = cls._coerce_string_list(value, from_dict_keys=("evidence", "details", "skill", "summary"))
        if base:
            return base
        return []

    @field_validator("concerns", mode="before")
    @classmethod
    def _normalize_concerns(cls, value: Any) -> list[str]:
        return cls._coerce_string_list(value, from_dict_keys=("concern", "reason", "issue", "summary"))

    @field_validator("supported_resume_claims", mode="before")
    @classmethod
    def _normalize_supported_claims(cls, value: Any) -> list[str]:
        return cls._coerce_string_list(value, from_dict_keys=("claim", "skill", "requirement"))

    @field_validator("unsupported_resume_claims", mode="before")
    @classmethod
    def _normalize_unsupported_resume_claims(cls, value: Any) -> list[str]:
        return cls._coerce_string_list(value, from_dict_keys=("claim", "skill", "requirement", "reason"))

    @field_validator("visited_links", mode="before")
    @classmethod
    def _normalize_visited_links(cls, value: Any) -> list[dict[str, Any]]:
        if not isinstance(value, list):
            return []
        normalized: list[dict[str, Any]] = []
        for item in value:
            if isinstance(item, dict):
                original_url = str(item.get("original_url") or item.get("url") or "").strip()
                final_url = str(item.get("final_url") or original_url).strip()
                status = str(item.get("status") or "visited").strip() or "visited"
                link_type = str(item.get("link_type") or "unknown").strip() or "unknown"
                summary = str(item.get("summary") or "No summary provided.").strip() or "No summary provided."
                http_status_raw = item.get("http_status")
                http_status: int | None
                try:
                    http_status = int(http_status_raw) if http_status_raw is not None else None
                except Exception:
                    http_status = None
                if not original_url and final_url:
                    original_url = final_url
                if not original_url:
                    continue
                normalized.append(
                    {
                        "link_type": link_type,
                        "original_url": original_url,
                        "final_url": final_url or original_url,
                        "status": status,
                        "http_status": http_status,
                        "summary": summary,
                    }
                )
                continue
            if isinstance(item, str):
                url = item.strip()
                if not url:
                    continue
                normalized.append(
                    {
                        "link_type": "unknown",
                        "original_url": url,
                        "final_url": url,
                        "status": "visited",
                        "http_status": None,
                        "summary": "Normalized from string output.",
                    }
                )
        return normalized

    @field_validator("github_repos", mode="before")
    @classmethod
    def _normalize_github_repos(cls, value: Any) -> list[dict[str, Any]]:
        if not isinstance(value, list):
            return []
        normalized: list[dict[str, Any]] = []
        for item in value:
            if isinstance(item, dict):
                name = str(item.get("name") or item.get("repo") or item.get("title") or "").strip()
                if not name:
                    continue
                description = str(item.get("description") or item.get("details") or "").strip()
                language = str(item.get("language") or "").strip()
                stars_raw = item.get("stars", item.get("stargazers_count", 0))
                try:
                    stars = int(stars_raw or 0)
                except Exception:
                    stars = 0
                url = str(item.get("url") or item.get("html_url") or "").strip()
                normalized.append(
                    {
                        "name": name,
                        "description": description,
                        "language": language,
                        "stars": stars,
                        "url": url,
                    }
                )
                continue
            if isinstance(item, str):
                name = item.strip()
                if not name:
                    continue
                normalized.append(
                    {
                        "name": name,
                        "description": "",
                        "language": "",
                        "stars": 0,
                        "url": "",
                    }
                )
        return normalized

    @field_validator("fetch_failures", mode="before")
    @classmethod
    def _normalize_fetch_failures(cls, value: Any) -> list[dict[str, str]]:
        if not isinstance(value, list):
            return []
        normalized: list[dict[str, str]] = []
        for item in value:
            if isinstance(item, dict):
                normalized.append(
                    {
                        "link_type": str(item.get("link_type") or "unknown"),
                        "url": str(item.get("url") or ""),
                        "reason": str(item.get("reason") or ""),
                    }
                )
                continue
            if isinstance(item, str):
                reason = item.strip()
                if not reason:
                    continue
                normalized.append(
                    {
                        "link_type": "unknown",
                        "url": "",
                        "reason": reason,
                    }
                )
        return normalized


class RiskAuditOutput(BaseModel):
    risk_level: Literal["low", "medium", "high"] = "medium"
    risk_penalty: float = 5
    risks: list[str] = Field(default_factory=list)
    recommended_interview_focus: list[str] = Field(default_factory=list)

    @field_validator("risk_level", mode="before")
    @classmethod
    def _normalize_risk_level(cls, value: Any) -> str:
        text = str(value or "").strip().lower()
        if text in {"low", "medium", "high"}:
            return text
        if "high" in text:
            return "high"
        if "low" in text:
            return "low"
        return "medium"

    @field_validator("risks", "recommended_interview_focus", mode="before")
    @classmethod
    def _normalize_string_lists(cls, value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        normalized: list[str] = []
        for item in value:
            if isinstance(item, str):
                text = item.strip()
                if text:
                    normalized.append(text)
            elif isinstance(item, dict):
                text = str(item.get("risk") or item.get("reason") or item.get("focus") or item.get("summary") or "").strip()
                if text:
                    normalized.append(text)
        return normalized


class PanelReviewOutput(BaseModel):
    technical_lead_view: str = ""
    hr_recruiter_view: str = ""
    hiring_manager_view: str = ""
    risk_auditor_view: str = ""
    final_panel_recommendation: str = ""

    @field_validator(
        "technical_lead_view",
        "hr_recruiter_view",
        "hiring_manager_view",
        "risk_auditor_view",
        "final_panel_recommendation",
        mode="before",
    )
    @classmethod
    def _normalize_panel_fields(cls, value: Any) -> str:
        if isinstance(value, str):
            return value.strip()
        if isinstance(value, dict):
            return str(value.get("summary") or value.get("view") or value.get("recommendation") or "").strip()
        if isinstance(value, list):
            return " ".join(str(item).strip() for item in value if str(item).strip())
        return str(value or "").strip()


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

    @field_validator("summary", "suggested_next_action", mode="before")
    @classmethod
    def _normalize_text_fields(cls, value: Any) -> str:
        if isinstance(value, str):
            return value.strip()
        if isinstance(value, list):
            return " ".join(str(item).strip() for item in value if str(item).strip())
        if isinstance(value, dict):
            return str(value.get("summary") or value.get("action") or "").strip()
        return str(value or "").strip()

    @field_validator("risks_to_verify", mode="before")
    @classmethod
    def _normalize_risks_to_verify(cls, value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        normalized: list[str] = []
        for item in value:
            if isinstance(item, str):
                text = item.strip()
                if text:
                    normalized.append(text)
            elif isinstance(item, dict):
                text = str(item.get("risk") or item.get("reason") or item.get("summary") or "").strip()
                if text:
                    normalized.append(text)
        return normalized

    @field_validator("top_candidates", mode="before")
    @classmethod
    def _normalize_top_candidates(cls, value: Any) -> list[dict[str, Any]]:
        if not isinstance(value, list):
            return []
        normalized: list[dict[str, Any]] = []
        for item in value:
            if isinstance(item, dict):
                normalized.append(item)
            elif isinstance(item, str):
                normalized.append({"name": item.strip(), "score": None, "status": ""})
        return normalized
