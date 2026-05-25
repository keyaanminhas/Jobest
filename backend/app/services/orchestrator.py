import json
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from app.schemas.agent_outputs import (
    EvidenceOutput,
    FinalReportOutput,
    HiringContextOutput,
    InterviewPackOutput,
    JobRubricOutput,
    PanelReviewOutput,
    ParsedResumeOutput,
    ProfessionalFootprintOutput,
    RiskAuditOutput,
    TransferableSkillsOutput,
)
from app.schemas.candidate import CandidateScore
from app.services.llm_client import LLMClient
from app.services.scoring_service import calculate_score


class PipelineOrchestrator:
    def __init__(self, llm_client: LLMClient | None = None) -> None:
        self.llm_client = llm_client or LLMClient()
        self.prompts_dir = Path(__file__).resolve().parents[1] / "prompts"
        self.demo_dir = Path(__file__).resolve().parents[1] / "storage" / "demo"
        self.on_progress = None

    def _prompt(self, name: str) -> str:
        return (self.prompts_dir / f"{name}.md").read_text(encoding="utf-8")

    def _demo(self, name: str) -> dict[str, Any]:
        return json.loads((self.demo_dir / f"{name}.json").read_text(encoding="utf-8"))

    def _stage_entry(self, stage: str, status: str, summary: str, raw_output: dict[str, Any]) -> dict[str, Any]:
        return {
            "stage": stage,
            "status": status,
            "summary": summary,
            "raw_output": raw_output,
        }

    async def _run_agent(
        self,
        *,
        agent_name: str,
        stage_name: str,
        schema_cls,
        payload: dict[str, Any],
        pipeline: list[dict[str, Any]],
        temperature: float = 0.2,
    ):
        prompt = self._prompt(agent_name)
        try:
            data = await self.llm_client.call_agent(agent_name, prompt, payload, temperature=temperature)
            meta = self.llm_client.get_last_call_meta(agent_name)
            model = schema_cls.model_validate(data)
            summary = f"source={meta.get('source','unknown')} provider={meta.get('provider','unknown')} repaired={meta.get('repaired', False)}"
            if meta.get("errors"):
                summary += " with_errors"
            pipeline.append(self._stage_entry(stage_name, "completed", summary, model.model_dump()))
            if meta.get("errors"):
                pipeline.append(
                    self._stage_entry(
                        f"{stage_name} Meta",
                        "warning",
                        "Agent call recovered after provider/JSON issues",
                        {"errors": meta.get("errors", [])},
                    )
                )
            if self.on_progress:
                self.on_progress(list(pipeline))
            return model
        except ValidationError as exc:
            fallback_model = schema_cls.model_validate(self._demo(agent_name))
            pipeline.append(
                self._stage_entry(
                    stage_name,
                    "completed_with_fallback",
                    f"Schema validation failed, fallback mock used: {exc.errors()[0]['msg']}",
                    fallback_model.model_dump(),
                )
            )
            pipeline.append(
                self._stage_entry(
                    f"{stage_name} Meta",
                    "warning",
                    "Fallback mock used after schema validation failure",
                    {"error": str(exc)},
                )
            )
            if self.on_progress:
                self.on_progress(list(pipeline))
            return fallback_model
        except Exception as exc:
            pipeline.append(
                self._stage_entry(
                    stage_name,
                    "error",
                    f"{type(exc).__name__}: {exc}",
                    {"error": str(exc)},
                )
            )
            if self.on_progress:
                self.on_progress(list(pipeline))
            raise

    @staticmethod
    def _failed_score() -> CandidateScore:
        return CandidateScore(
            requirement_match=0.0,
            evidence_strength=0.0,
            professional_footprint=0.0,
            hiring_context_fit=0.0,
            risk_penalty=0.0,
            final_score=0.0,
            recommendation="Reject",
        )

    async def run_pipeline(self, run_data: dict, on_progress = None) -> dict:
        self.on_progress = on_progress
        pipeline: list[dict[str, Any]] = []
        candidates_out: list[dict[str, Any]] = []

        rubric = await self._run_agent(
            agent_name="jd_deconstruction",
            stage_name="JD Deconstruction Agent",
            schema_cls=JobRubricOutput,
            payload={
                "job_title": run_data["title"],
                "job_description": run_data["job_description"],
            },
            pipeline=pipeline,
        )

        context = await self._run_agent(
            agent_name="hiring_context",
            stage_name="Hiring Context Agent",
            schema_cls=HiringContextOutput,
            payload={
                "hiring_context": run_data["hiring_context"],
                "job_rubric": rubric.model_dump(),
            },
            pipeline=pipeline,
        )

        for candidate in run_data.get("candidates", []):
            candidate_name = candidate.get("name", "Unknown Candidate")
            links = candidate.get("professional_links") or {}

            try:
                parsed = await self._run_agent(
                    agent_name="resume_parser",
                    stage_name=f"Resume Parsing Agent ({candidate_name})",
                    schema_cls=ParsedResumeOutput,
                    payload={
                        "candidate_name": candidate_name,
                        "resume_text": candidate["resume_text"],
                        "professional_links": links,
                    },
                    pipeline=pipeline,
                )

                evidence = await self._run_agent(
                    agent_name="evidence_extractor",
                    stage_name=f"Candidate Evidence Agent ({candidate_name})",
                    schema_cls=EvidenceOutput,
                    payload={
                        "parsed_profile": parsed.model_dump(),
                        "resume_text": candidate["resume_text"],
                        "job_rubric": rubric.model_dump(),
                    },
                    pipeline=pipeline,
                )

                transfer = await self._run_agent(
                    agent_name="transferable_skills",
                    stage_name=f"Transferable Skill Agent ({candidate_name})",
                    schema_cls=TransferableSkillsOutput,
                    payload={
                        "job_rubric": rubric.model_dump(),
                        "candidate_evidence": evidence.model_dump(),
                    },
                    pipeline=pipeline,
                )

                footprint = await self._run_agent(
                    agent_name="professional_footprint",
                    stage_name=f"Professional Footprint Agent ({candidate_name})",
                    schema_cls=ProfessionalFootprintOutput,
                    payload={
                        "profile_links": links,
                        "candidate_evidence": evidence.model_dump(),
                        "job_rubric": rubric.model_dump(),
                    },
                    pipeline=pipeline,
                )

                risk = await self._run_agent(
                    agent_name="risk_auditor",
                    stage_name=f"Risk & Contradiction Agent ({candidate_name})",
                    schema_cls=RiskAuditOutput,
                    payload={
                        "resume_evidence": evidence.model_dump(),
                        "transferable_skills": transfer.model_dump(),
                        "professional_footprint": footprint.model_dump(),
                        "job_rubric": rubric.model_dump(),
                    },
                    pipeline=pipeline,
                )

                score = calculate_score(
                    rubric=rubric,
                    context=context,
                    evidence=evidence,
                    transferable=transfer,
                    footprint=footprint,
                    risk=risk,
                )
                pipeline.append(
                    self._stage_entry(
                        f"Score Aggregation Engine ({candidate_name})",
                        "completed",
                        "Score calculated in backend code",
                        score.model_dump(),
                    )
                )

                strengths = [item.skill for item in evidence.evidence_items][:5]
                gaps = [item.requirement for item in transfer.missing_requirements][:5]

                panel = await self._run_agent(
                    agent_name="panel_review",
                    stage_name=f"Hiring Panel Review Agent ({candidate_name})",
                    schema_cls=PanelReviewOutput,
                    payload={
                        "candidate_score": score.model_dump(),
                        "evidence": evidence.model_dump(),
                        "risks": risk.model_dump(),
                        "job_rubric": rubric.model_dump(),
                        "hiring_context": context.model_dump(),
                    },
                    pipeline=pipeline,
                )

                interview = await self._run_agent(
                    agent_name="interview_pack",
                    stage_name=f"Interview Pack Generator Agent ({candidate_name})",
                    schema_cls=InterviewPackOutput,
                    payload={
                        "job_rubric": rubric.model_dump(),
                        "strengths": strengths,
                        "gaps": gaps,
                        "risk_audit": risk.model_dump(),
                    },
                    pipeline=pipeline,
                )

                candidates_out.append(
                    {
                        "candidate": candidate,
                        "status": "completed",
                        "parsed_profile": parsed.model_dump(),
                        "evidence": evidence.model_dump(),
                        "transferable_skills": transfer.model_dump(),
                        "professional_footprint": footprint.model_dump(),
                        "risk_audit": risk.model_dump(),
                        "score": score.model_dump(),
                        "panel_review": panel.model_dump(),
                        "interview_pack": interview.model_dump(),
                    }
                )
            except Exception as exc:
                failed_score = self._failed_score()
                candidates_out.append(
                    {
                        "candidate": candidate,
                        "status": "error",
                        "error": str(exc),
                        "score": failed_score.model_dump(),
                        "panel_review": {
                            "final_panel_recommendation": f"Candidate excluded due to pipeline error: {exc}",
                        },
                        "interview_pack": {
                            "technical_questions": [],
                            "behavioral_questions": [],
                            "risk_validation_questions": [],
                        },
                    }
                )
                pipeline.append(
                    self._stage_entry(
                        f"Candidate Pipeline ({candidate_name})",
                        "error",
                        "Candidate failed and was scored low",
                        {"error": str(exc)},
                    )
                )

        ranked = sorted(candidates_out, key=lambda c: c["score"]["final_score"], reverse=True)

        top_candidates = [
            {
                "rank": i + 1,
                "candidate_name": item["candidate"].get("name", "Unknown Candidate"),
                "status": item.get("status", "completed"),
                "final_score": item["score"]["final_score"],
                "recommendation": item["score"].get("recommendation", "Reject"),
                "score_breakdown": item["score"],
                "top_strengths": [x.get("skill") for x in item.get("evidence", {}).get("evidence_items", [])[:3]],
                "key_risks": item.get("risk_audit", {}).get("risks", [])[:3],
                "why": item.get("panel_review", {}).get("final_panel_recommendation", ""),
            }
            for i, item in enumerate(ranked[:5])
        ]

        report_model = await self._run_agent(
            agent_name="final_report",
            stage_name="Final Shortlist Report Agent",
            schema_cls=FinalReportOutput,
            payload={
                "job_summary": {
                    "title": run_data["title"],
                    "hiring_context": run_data["hiring_context"],
                    "priority": run_data.get("company_priority", ""),
                },
                "shortlist": top_candidates,
                "candidate_count": len(candidates_out),
            },
            pipeline=pipeline,
        )

        report_text = report_model.summary or "Final report generated"

        return {
            "run_id": run_data["id"],
            "status": "completed",
            "pipeline": pipeline,
            "top_candidates": top_candidates,
            "report": report_text,
            "report_data": report_model.model_dump(),
            "candidates": ranked,
        }
