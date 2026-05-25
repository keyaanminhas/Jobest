from pathlib import Path

from app.schemas.agent_outputs import FinalReportOutput


async def run(llm_client, job_summary: dict, shortlist: list[dict], panel_outputs: list[dict], interview_packs: list[dict]) -> FinalReportOutput:
    prompt = (Path(__file__).resolve().parents[1] / "prompts" / "final_report.md").read_text(encoding="utf-8")
    payload = {
        "job_summary": job_summary,
        "shortlist": shortlist,
        "panel_outputs": panel_outputs,
        "interview_packs": interview_packs,
    }
    result = await llm_client.call_agent("final_report", prompt, payload)
    return FinalReportOutput.model_validate(result)
