from pathlib import Path

from app.schemas.agent_outputs import TransferableSkillsOutput


async def run(llm_client, job_rubric: dict, candidate_evidence: dict) -> TransferableSkillsOutput:
    prompt = (Path(__file__).resolve().parents[1] / "prompts" / "transferable_skills.md").read_text(encoding="utf-8")
    payload = {
        "job_rubric": job_rubric,
        "candidate_evidence": candidate_evidence,
    }
    result = await llm_client.call_agent("transferable_skills", prompt, payload)
    return TransferableSkillsOutput.model_validate(result)
