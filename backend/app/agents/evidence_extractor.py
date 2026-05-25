from pathlib import Path

from app.schemas.agent_outputs import EvidenceOutput


async def run(llm_client, parsed_profile: dict, resume_text: str, job_rubric: dict) -> EvidenceOutput:
    prompt = (Path(__file__).resolve().parents[1] / "prompts" / "evidence_extractor.md").read_text(encoding="utf-8")
    payload = {
        "parsed_profile": parsed_profile,
        "resume_text": resume_text,
        "job_rubric": job_rubric,
    }
    result = await llm_client.call_agent("evidence_extractor", prompt, payload)
    return EvidenceOutput.model_validate(result)
