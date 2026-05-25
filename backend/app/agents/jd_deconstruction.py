from pathlib import Path

from app.schemas.agent_outputs import JobRubricOutput


async def run(llm_client, job_title: str, job_description: str) -> JobRubricOutput:
    prompt = (Path(__file__).resolve().parents[1] / "prompts" / "jd_deconstruction.md").read_text(encoding="utf-8")
    payload = {"job_title": job_title, "job_description": job_description}
    result = await llm_client.call_agent("jd_deconstruction", prompt, payload)
    return JobRubricOutput.model_validate(result)
