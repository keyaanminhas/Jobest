from pathlib import Path

from app.schemas.agent_outputs import ParsedResumeOutput


async def run(llm_client, candidate_name: str, resume_text: str, professional_links: dict | None) -> ParsedResumeOutput:
    prompt = (Path(__file__).resolve().parents[1] / "prompts" / "resume_parser.md").read_text(encoding="utf-8")
    payload = {
        "candidate_name": candidate_name,
        "resume_text": resume_text,
        "professional_links": professional_links or {},
    }
    result = await llm_client.call_agent("resume_parser", prompt, payload)
    return ParsedResumeOutput.model_validate(result)
