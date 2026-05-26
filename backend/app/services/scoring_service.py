from __future__ import annotations

from app.schemas.agent_outputs import (
    EvidenceOutput,
    HiringContextOutput,
    JobRubricOutput,
    ProfessionalFootprintOutput,
    RiskAuditOutput,
    TransferableSkillsOutput,
)
from app.schemas.candidate import CandidateScore


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _confidence_score(label: str) -> float:
    value = label.strip().lower()
    if value == "high":
        return 1.0
    if value == "medium":
        return 0.65
    return 0.35


def _recommendation(score: float) -> str:
    if score >= 85:
        return "Strong Shortlist"
    if score >= 70:
        return "Shortlist"
    if score >= 55:
        return "Maybe"
    return "Reject"


def _requirement_match_score(
    rubric: JobRubricOutput,
    transferable: TransferableSkillsOutput,
) -> tuple[float, str]:
    must = [m.strip().lower() for m in rubric.must_have_skills if m.strip()]
    nice = [n.strip().lower() for n in rubric.nice_to_have_skills if n.strip()]

    exact = {m.requirement.strip().lower() for m in transferable.exact_matches if m.requirement.strip()}
    transfer = {m.requirement.strip().lower() for m in transferable.transferable_matches if m.requirement.strip()}

    must_exact = sum(1 for req in must if req in exact)
    must_transfer = sum(1 for req in must if req in transfer and req not in exact)
    nice_exact = sum(1 for req in nice if req in exact)
    nice_transfer = sum(1 for req in nice if req in transfer and req not in exact)

    points = 0.0
    points += must_exact * 1.0
    points += must_transfer * 0.6
    points += nice_exact * 0.5
    points += nice_transfer * 0.25

    max_points = (len(must) * 1.0) + (len(nice) * 0.5)
    score = round((points / max_points) * 100, 2) if max_points > 0 else 0.0

    summary = (
        f"must exact={must_exact}/{len(must)}, must transferable={must_transfer}/{len(must)}, "
        f"nice exact={nice_exact}/{len(nice)}, nice transferable={nice_transfer}/{len(nice)}"
    )
    return score, summary


def _evidence_strength_score(evidence: EvidenceOutput) -> tuple[float, str]:
    if evidence.evidence_items:
        avg_conf = sum(_confidence_score(item.confidence) for item in evidence.evidence_items) / len(evidence.evidence_items)
        base = avg_conf * 100
    else:
        base = 35.0

    breadth_bonus = min(len(evidence.evidence_items) * 1.5, 12.0)
    unsupported_penalty = min(len(evidence.unsupported_claims) * 6.0, 30.0)

    score = _clamp(base + breadth_bonus - unsupported_penalty, 0.0, 100.0)
    score = round(score, 2)

    summary = (
        f"evidence items={len(evidence.evidence_items)}, unsupported claims={len(evidence.unsupported_claims)}, "
        f"unsupported penalty={unsupported_penalty:.1f}"
    )
    return score, summary


def _professional_footprint_score(footprint: ProfessionalFootprintOutput) -> tuple[float, str]:
    has_explicit_evidence = bool(footprint.professional_evidence)
    claim_support = (footprint.claim_support or "").strip().lower()

    if not has_explicit_evidence and claim_support in {"", "unknown", "unavailable", "not_provided", "none"}:
        return 50.0, "No professional links/evidence provided; neutral footprint score applied"

    base = (float(footprint.portfolio_score) + float(footprint.github_score)) / 2.0

    support_adjust = 0.0
    if claim_support in {"strong", "high"}:
        support_adjust = 8.0
    elif claim_support in {"moderate", "medium"}:
        support_adjust = 3.0
    elif claim_support in {"weak", "low"}:
        support_adjust = -8.0

    supported_bonus = min(len(footprint.supported_resume_claims) * 1.5, 8.0)
    unsupported_penalty = min(len(footprint.unsupported_resume_claims) * 4.0, 20.0)
    concerns_penalty = min(len(footprint.concerns) * 2.0, 10.0)

    score = _clamp(base + support_adjust + supported_bonus - unsupported_penalty - concerns_penalty, 0.0, 100.0)
    score = round(score, 2)

    summary = (
        f"base={base:.1f}, claim_support={claim_support or 'unknown'}, "
        f"supported claims={len(footprint.supported_resume_claims)}, "
        f"unsupported claims={len(footprint.unsupported_resume_claims)}"
    )
    return score, summary


def _hiring_context_fit_score(
    context: HiringContextOutput,
    evidence: EvidenceOutput,
    transferable: TransferableSkillsOutput,
) -> tuple[float, str]:
    keywords = {k.strip().lower() for k in context.context_fit_keywords if k.strip()}
    gaps = {g.strip().lower() for g in context.team_gaps if g.strip()}

    corpus_parts: list[str] = []
    corpus_parts.extend(item.skill for item in evidence.evidence_items)
    corpus_parts.extend(item.evidence for item in evidence.evidence_items)
    corpus_parts.extend(item.requirement for item in transferable.exact_matches)
    corpus_parts.extend(item.candidate_skill for item in transferable.exact_matches)
    corpus_parts.extend(item.requirement for item in transferable.transferable_matches)
    corpus_parts.extend(item.candidate_skill for item in transferable.transferable_matches)
    corpus = " ".join(corpus_parts).lower()

    if not keywords and not gaps:
        return 50.0, "No context keywords/team gaps provided; neutral context-fit score applied"

    keyword_hits = sum(1 for kw in keywords if kw in corpus)
    gap_hits = sum(1 for gap in gaps if gap in corpus)

    keyword_ratio = (keyword_hits / len(keywords)) if keywords else 0.5
    gap_ratio = (gap_hits / len(gaps)) if gaps else 0.5

    score = (keyword_ratio * 60.0) + (gap_ratio * 40.0)
    score = round(_clamp(score, 0.0, 100.0), 2)

    summary = f"keyword hits={keyword_hits}/{len(keywords) if keywords else 0}, gap hits={gap_hits}/{len(gaps) if gaps else 0}"
    return score, summary


def calculate_score(
    rubric: JobRubricOutput,
    context: HiringContextOutput,
    evidence: EvidenceOutput,
    transferable: TransferableSkillsOutput,
    footprint: ProfessionalFootprintOutput,
    risk: RiskAuditOutput,
) -> CandidateScore:
    requirement_match, req_summary = _requirement_match_score(rubric, transferable)
    evidence_strength, evidence_summary = _evidence_strength_score(evidence)
    professional_footprint, footprint_summary = _professional_footprint_score(footprint)
    hiring_context_fit, context_summary = _hiring_context_fit_score(context, evidence, transferable)

    risk_penalty = round(_clamp(float(risk.risk_penalty), 0.0, 15.0), 2)

    final_score = (
        requirement_match * 0.35
        + evidence_strength * 0.35
        + professional_footprint * 0.10
        + hiring_context_fit * 0.15
        - risk_penalty
    )
    final_score = round(_clamp(final_score, 0.0, 100.0), 2)
    recommendation = _recommendation(final_score)

    score_explanation = (
        f"Requirement match={requirement_match}, Evidence strength={evidence_strength}, "
        f"Professional footprint={professional_footprint}, Hiring context fit={hiring_context_fit}, "
        f"Risk penalty={risk_penalty}. "
        f"Details: [{req_summary}] [{evidence_summary}] [{footprint_summary}] [{context_summary}]"
    )

    return CandidateScore(
        requirement_match=requirement_match,
        evidence_strength=evidence_strength,
        professional_footprint=professional_footprint,
        hiring_context_fit=hiring_context_fit,
        risk_penalty=risk_penalty,
        final_score=final_score,
        recommendation=recommendation,
        score_explanation=score_explanation,
    )


if __name__ == "__main__":
    rubric = JobRubricOutput(
        role_title="Junior AI Backend Engineer",
        seniority="junior",
        must_have_skills=["Python", "FastAPI", "SQL", "Git"],
        nice_to_have_skills=["Docker", "AWS"],
    )

    context = HiringContextOutput(
        team_gaps=["API design", "SQL integration", "deployment"],
        context_fit_keywords=["fastapi", "sql", "docker", "deployment"],
    )

    evidence = EvidenceOutput.model_validate(
        {
            "evidence_items": [
                {
                    "skill": "Python",
                    "evidence": "Built Python backend for ML inference",
                    "source": "resume",
                    "confidence": "high",
                },
                {
                    "skill": "SQL",
                    "evidence": "Designed PostgreSQL schema",
                    "source": "resume",
                    "confidence": "medium",
                },
            ],
            "unsupported_claims": [{"claim": "Docker", "reason": "No clear proof"}],
        }
    )

    transferable = TransferableSkillsOutput.model_validate(
        {
            "exact_matches": [
                {
                    "requirement": "Python",
                    "candidate_skill": "Python",
                    "evidence": "Backend service",
                    "confidence": "high",
                },
                {
                    "requirement": "SQL",
                    "candidate_skill": "SQL",
                    "evidence": "PostgreSQL work",
                    "confidence": "medium",
                },
            ],
            "transferable_matches": [
                {
                    "requirement": "FastAPI",
                    "candidate_skill": "Flask",
                    "reasoning": "Transferable API framework experience",
                    "confidence": "medium",
                }
            ],
            "missing_requirements": [{"requirement": "Git", "reason": "Not mentioned"}],
        }
    )

    footprint = ProfessionalFootprintOutput(
        portfolio_score=72,
        github_score=80,
        claim_support="moderate",
        professional_evidence=["GitHub has API repo", "Portfolio shows deployments"],
        concerns=["Limited tests"],
        supported_resume_claims=["Python", "SQL"],
        unsupported_resume_claims=["Docker"],
    )

    risk = RiskAuditOutput(
        risk_level="medium",
        risk_penalty=6,
        risks=["Docker claim weak"],
        recommended_interview_focus=["deployment depth"],
    )

    print(calculate_score(rubric, context, evidence, transferable, footprint, risk).model_dump_json(indent=2))
