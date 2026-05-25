from pathlib import Path

from app.schemas.agent_outputs import InterviewPackOutput


async def run(llm_client, job_rubric: dict, strengths: list[str], gaps: list[str], risk_audit: dict) -> InterviewPackOutput:
    prompt = (Path(__file__).resolve().parents[1] / "prompts" / "interview_pack.md").read_text(encoding="utf-8")
    payload = {
        "job_rubric": job_rubric,
        "strengths": strengths,
        "gaps": gaps,
        "risk_audit": risk_audit,
    }
    result = await llm_client.call_agent("interview_pack", prompt, payload)
    return InterviewPackOutput.model_validate(result)
