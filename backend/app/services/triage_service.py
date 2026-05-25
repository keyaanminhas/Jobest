import re
from typing import Any

from app.services.llm_client import LLMClient


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip()


def _contains(haystack: str, needle: str) -> bool:
    if not needle.strip():
        return False
    return _normalize(needle) in haystack


def _clamp(score: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(maximum, score))


def compute_keyword_score(
    *,
    resume_text: str,
    job_description: str,
    must_have_skills: list[str],
    nice_to_have_skills: list[str],
) -> float:
    resume = _normalize(resume_text)
    jd = _normalize(job_description)
    combined = f"{resume} {jd}"

    must_hits = sum(1 for skill in must_have_skills if _contains(combined, skill))
    nice_hits = sum(1 for skill in nice_to_have_skills if _contains(combined, skill))

    must_total = max(1, len(must_have_skills))
    nice_total = max(1, len(nice_to_have_skills))

    must_score = (must_hits / must_total) * 75.0
    nice_score = (nice_hits / nice_total) * 25.0
    return round(_clamp(must_score + nice_score), 2)


async def llm_triage_assist(
    *,
    llm_client: LLMClient,
    candidate_name: str,
    resume_text: str,
    title: str,
    job_description: str,
    must_have_skills: list[str],
    nice_to_have_skills: list[str],
) -> tuple[float, str, str]:
    if llm_client.router.llm_mode == "mock":
        return 0.0, "LLM triage skipped in mock mode", "skipped"

    prompt = (
        "You are a resume triage assistant. Return JSON only with fields: "
        "llm_triage_score (0-100 number), triage_summary (short evidence-backed text)."
    )
    payload = {
        "candidate_name": candidate_name,
        "job_title": title,
        "job_description": job_description,
        "must_have_skills": must_have_skills,
        "nice_to_have_skills": nice_to_have_skills,
        "resume_text_excerpt": resume_text[:6000],
    }
    try:
        data = await llm_client.call_agent("triage_ranker", prompt, payload, temperature=0.1)
        score = float(data.get("llm_triage_score", 0.0))
        summary = str(data.get("triage_summary", "")).strip()
        return round(_clamp(score), 2), summary or "LLM triage completed.", "completed"
    except Exception as exc:
        return 0.0, f"LLM triage unavailable: {exc}", "fallback_code_only"


async def score_candidate_triage(
    *,
    llm_client: LLMClient,
    candidate_name: str,
    resume_text: str,
    title: str,
    job_description: str,
    must_have_skills: list[str],
    nice_to_have_skills: list[str],
) -> dict[str, Any]:
    keyword_score = compute_keyword_score(
        resume_text=resume_text,
        job_description=job_description,
        must_have_skills=must_have_skills,
        nice_to_have_skills=nice_to_have_skills,
    )
    llm_score, llm_summary, triage_status = await llm_triage_assist(
        llm_client=llm_client,
        candidate_name=candidate_name,
        resume_text=resume_text,
        title=title,
        job_description=job_description,
        must_have_skills=must_have_skills,
        nice_to_have_skills=nice_to_have_skills,
    )

    # Triage is intentionally capped at 80 so it is treated as a pre-analysis filter
    # and never appears equivalent to full analysis final scoring (0-100).
    triage_base = keyword_score * 0.75 + llm_score * 0.25
    final_score = round(_clamp((triage_base / 100.0) * 80.0, maximum=80.0), 2)
    summary = (
        f"Keyword score {keyword_score}/100. "
        f"LLM assist {llm_score}/100. "
        f"Scaled triage score {final_score}/80. "
        f"{llm_summary}"
    ).strip()

    return {
        "keyword_match_score": keyword_score,
        "llm_triage_score": llm_score,
        "triage_score": final_score,
        "triage_summary": summary,
        "triage_status": triage_status,
    }
