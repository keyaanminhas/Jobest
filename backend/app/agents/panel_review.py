from pathlib import Path

from app.schemas.agent_outputs import PanelReviewOutput


async def run(llm_client, candidate_score: dict, evidence: dict, risks: dict, job_rubric: dict, hiring_context: dict) -> PanelReviewOutput:
    prompt = (Path(__file__).resolve().parents[1] / "prompts" / "panel_review.md").read_text(encoding="utf-8")
    payload = {
        "candidate_score": candidate_score,
        "evidence": evidence,
        "risks": risks,
        "job_rubric": job_rubric,
        "hiring_context": hiring_context,
    }
    result = await llm_client.call_agent("panel_review", prompt, payload)
    return PanelReviewOutput.model_validate(result)
