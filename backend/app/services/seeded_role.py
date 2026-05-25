from dataclasses import dataclass


@dataclass(frozen=True)
class FirstRunPreset:
    title: str
    job_description: str
    hiring_context: str
    company_priority: str
    must_have_skills: list[str]
    nice_to_have_skills: list[str]


FIRST_RUN_PRESET = FirstRunPreset(
    title="AI Software Engineer",
    job_description=(
        "Design, build, and ship AI-powered product features using Python and modern backend "
        "frameworks. Own end-to-end implementation across LLM integration, agent orchestration, "
        "evaluation, observability, and production API delivery for customer-facing workflows."
    ),
    hiring_context=(
        "Fast-moving product team building AI-native workflows for hiring and talent operations. "
        "Need engineers who can ship pragmatic LLM systems, balance reliability with speed, and "
        "collaborate closely with product and design under tight hackathon-like timelines."
    ),
    company_priority="Ship reliable AI features fast with clear measurable impact",
    must_have_skills=[
        "Python",
        "FastAPI",
        "LLM Integration",
        "API Design",
        "Software Engineering",
    ],
    nice_to_have_skills=[
        "Vector Databases",
        "Prompt Engineering",
        "Agent Orchestration",
        "CI/CD",
        "Cloud Deployment",
    ],
)
