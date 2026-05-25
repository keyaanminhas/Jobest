from pathlib import Path

from app.schemas.agent_outputs import RiskAuditOutput


async def run(llm_client, resume_evidence: dict, transferable_skills: dict, professional_footprint: dict, job_rubric: dict) -> RiskAuditOutput:
    prompt = (Path(__file__).resolve().parents[1] / "prompts" / "risk_auditor.md").read_text(encoding="utf-8")
    payload = {
        "resume_evidence": resume_evidence,
        "transferable_skills": transferable_skills,
        "professional_footprint": professional_footprint,
        "job_rubric": job_rubric,
    }
    result = await llm_client.call_agent("risk_auditor", prompt, payload)
    return RiskAuditOutput.model_validate(result)
