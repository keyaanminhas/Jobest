from pathlib import Path

from app.schemas.agent_outputs import HiringContextOutput


async def run(llm_client, hiring_context_text: str, job_rubric: dict) -> HiringContextOutput:
    prompt = (Path(__file__).resolve().parents[1] / "prompts" / "hiring_context.md").read_text(encoding="utf-8")
    payload = {"hiring_context": hiring_context_text, "job_rubric": job_rubric}
    result = await llm_client.call_agent("hiring_context", prompt, payload)
    return HiringContextOutput.model_validate(result)
