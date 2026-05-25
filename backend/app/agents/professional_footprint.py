from pathlib import Path

from app.schemas.agent_outputs import ProfessionalFootprintOutput


async def run(llm_client, profile_links: dict, candidate_evidence: dict, job_rubric: dict) -> ProfessionalFootprintOutput:
    prompt = (Path(__file__).resolve().parents[1] / "prompts" / "professional_footprint.md").read_text(encoding="utf-8")
    payload = {
        "profile_links": profile_links,
        "candidate_evidence": candidate_evidence,
        "job_rubric": job_rubric,
    }
    result = await llm_client.call_agent("professional_footprint", prompt, payload)
    return ProfessionalFootprintOutput.model_validate(result)
