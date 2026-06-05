import json
import copy
from pathlib import Path
from typing import Any, Awaitable, Callable
from urllib.parse import urlparse

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
from app.services.professional_link_fetcher import fetch_professional_profiles
from app.services.scoring_service import calculate_score


def _classify_link_type(raw_url: str) -> str:
    value = str(raw_url or "").strip().lower()
    host = (urlparse(value).hostname or "").lower() if value else ""
    target = host or value
    if "github.com" in target:
        return "github"
    if "linkedin.com" in target or "lnkd.in" in target:
        return "linkedin"
    if "kaggle.com" in target:
        return "kaggle"
    if "scholar.google." in target:
        return "scholar"
    if any(domain in target for domain in ("dribbble.com", "behance.net", "medium.com", "notion.site")):
        return "portfolio"
    return "external"


def _merge_profile_links(explicit_links: dict[str, str], inferred_links: list[str]) -> dict[str, str]:
    merged: dict[str, str] = {}
    seen_values: set[str] = set()
    for key, value in (explicit_links or {}).items():
        normalized = str(value or "").strip()
        if not normalized or normalized in seen_values:
            continue
        merged[str(key)] = normalized
        seen_values.add(normalized)

    for raw in inferred_links or []:
        normalized = str(raw or "").strip()
        if not normalized or normalized in seen_values:
            continue
        base = _classify_link_type(normalized)
        key = base
        suffix = 2
        while key in merged:
            key = f"{base}_{suffix}"
            suffix += 1
        merged[key] = normalized
        seen_values.add(normalized)
    return merged


class PipelineOrchestrator:
    def __init__(self, llm_client: LLMClient | None = None, provider_override=None) -> None:
        self.llm_client = llm_client or LLMClient()
        self.provider_override = provider_override
        self.prompts_dir = Path(__file__).resolve().parents[1] / "prompts"
        self.demo_dir = Path(__file__).resolve().parents[1] / "storage" / "demo"

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

    @staticmethod
    def _cached_model(schema_cls, raw_value: Any, fallback):
        if isinstance(raw_value, schema_cls):
            return raw_value
        if raw_value:
            try:
                return schema_cls.model_validate(raw_value)
            except Exception:
                pass
        return fallback

    async def _run_agent(
        self,
        *,
        agent_name: str,
        stage_name: str,
        schema_cls,
        payload: dict[str, Any],
        pipeline: list[dict[str, Any]],
        progress_callback: Callable[[list[dict[str, Any]], list[dict[str, Any]]], Awaitable[None]] | None = None,
        candidates_out: list[dict[str, Any]] | None = None,
        temperature: float = 0.2,
    ):
        prompt = self._prompt(agent_name)
        try:
            data = await self.llm_client.call_agent(
                agent_name,
                prompt,
                payload,
                temperature=temperature,
                provider_override=self.provider_override,
            )
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
            if progress_callback is not None:
                await progress_callback(pipeline, candidates_out or [])
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
            if progress_callback is not None:
                await progress_callback(pipeline, candidates_out or [])
            return fallback_model
        except Exception as exc:
            detail = str(exc).strip() or repr(exc)
            pipeline.append(
                self._stage_entry(
                    stage_name,
                    "error",
                    f"{type(exc).__name__}: {detail}",
                    {"error": detail},
                )
            )
            if progress_callback is not None:
                await progress_callback(pipeline, candidates_out or [])
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

    async def run_pipeline(
        self,
        run_data: dict,
        progress_callback: Callable[[list[dict[str, Any]], list[dict[str, Any]]], Awaitable[None]] | None = None,
        focused_stage: str | None = None,
        stage_mode: str = "prerequisite_aware",
    ) -> dict:
        pipeline: list[dict[str, Any]] = []
        candidates_out: list[dict[str, Any]] = []

        def focused_result(stage: str) -> dict:
            return {
                "run_id": run_data["id"],
                "status": "completed",
                "pipeline": pipeline,
                "top_candidates": [],
                "report": f"Focused stage refresh completed: {stage}",
                "report_data": {"summary": f"Focused stage refresh completed: {stage}"},
                "candidates": candidates_out,
                "focused_stage": stage,
            }

        async def emit_progress() -> None:
            if progress_callback is None:
                return
            await progress_callback(copy.deepcopy(pipeline), copy.deepcopy(candidates_out))

        if focused_stage and stage_mode == "isolated":
            return await self._run_isolated_stage(
                run_data=run_data,
                focused_stage=focused_stage,
                pipeline=pipeline,
                candidates_out=candidates_out,
                emit_progress=emit_progress,
            )

        rubric = await self._run_agent(
            agent_name="jd_deconstruction",
            stage_name="JD Deconstruction Agent",
            schema_cls=JobRubricOutput,
            payload={
                "job_title": run_data["title"],
                "job_description": run_data["job_description"],
            },
            pipeline=pipeline,
            progress_callback=progress_callback,
            candidates_out=candidates_out,
        )
        if focused_stage == "jd_deconstruction":
            return focused_result(focused_stage)

        context = await self._run_agent(
            agent_name="hiring_context",
            stage_name="Hiring Context Agent",
            schema_cls=HiringContextOutput,
            payload={
                "hiring_context": run_data["hiring_context"],
                "job_rubric": rubric.model_dump(),
            },
            pipeline=pipeline,
            progress_callback=progress_callback,
            candidates_out=candidates_out,
        )
        if focused_stage == "hiring_context":
            return focused_result(focused_stage)

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
                    progress_callback=progress_callback,
                    candidates_out=candidates_out,
                )
                if focused_stage == "resume_parser":
                    candidates_out.append({"candidate": candidate, "status": "completed", "parsed_profile": parsed.model_dump()})
                    return focused_result(focused_stage)

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
                    progress_callback=progress_callback,
                    candidates_out=candidates_out,
                )
                if focused_stage == "evidence_extractor":
                    candidates_out.append(
                        {
                            "candidate": candidate,
                            "status": "completed",
                            "parsed_profile": parsed.model_dump(),
                            "evidence": evidence.model_dump(),
                        }
                    )
                    return focused_result(focused_stage)

                effective_links = _merge_profile_links(links, parsed.professional_links)

                transfer = await self._run_agent(
                    agent_name="transferable_skills",
                    stage_name=f"Transferable Skill Agent ({candidate_name})",
                    schema_cls=TransferableSkillsOutput,
                    payload={
                        "job_rubric": rubric.model_dump(),
                        "candidate_evidence": evidence.model_dump(),
                    },
                    pipeline=pipeline,
                    progress_callback=progress_callback,
                    candidates_out=candidates_out,
                )
                if focused_stage == "transferable_skills":
                    candidates_out.append(
                        {
                            "candidate": candidate,
                            "status": "completed",
                            "parsed_profile": parsed.model_dump(),
                            "evidence": evidence.model_dump(),
                            "transferable_skills": transfer.model_dump(),
                        }
                    )
                    return focused_result(focused_stage)

                fetched_profiles = await fetch_professional_profiles(effective_links)
                visited_links = fetched_profiles.get("visited_links", [])
                fetch_failures = fetched_profiles.get("fetch_failures", [])
                fetch_summary = (
                    f"Visited {len(visited_links)} professional links, "
                    f"failures={len(fetch_failures)}"
                )
                pipeline.append(
                    self._stage_entry(
                        f"Professional Link Fetcher Agent ({candidate_name})",
                        "completed",
                        fetch_summary,
                        fetched_profiles,
                    )
                )
                await emit_progress()
                if focused_stage == "professional_link_fetcher":
                    candidates_out.append(
                        {
                            "candidate": candidate,
                            "status": "completed",
                            "parsed_profile": parsed.model_dump(),
                            "evidence": evidence.model_dump(),
                            "transferable_skills": transfer.model_dump(),
                            "fetched_profiles": fetched_profiles,
                        }
                    )
                    return focused_result(focused_stage)

                footprint_stage_name = f"Professional Footprint Agent ({candidate_name})"
                footprint = await self._run_agent(
                    agent_name="professional_footprint",
                    stage_name=footprint_stage_name,
                    schema_cls=ProfessionalFootprintOutput,
                    payload={
                        "profile_links": effective_links,
                        "fetched_profiles": fetched_profiles,
                        "candidate_evidence": evidence.model_dump(),
                        "job_rubric": rubric.model_dump(),
                    },
                    pipeline=pipeline,
                    progress_callback=progress_callback,
                    candidates_out=candidates_out,
                )
                footprint = footprint.model_copy(
                    update={
                        "visited_links": fetched_profiles.get("visited_links", []),
                        "github_repos": fetched_profiles.get("github_repos", []),
                        "fetch_failures": fetched_profiles.get("fetch_failures", []),
                    }
                )
                for index in range(len(pipeline) - 1, -1, -1):
                    stage = pipeline[index]
                    if stage.get("stage") == footprint_stage_name and str(stage.get("status", "")).startswith("completed"):
                        stage["raw_output"] = footprint.model_dump()
                        break
                await emit_progress()
                if focused_stage == "professional_footprint":
                    candidates_out.append(
                        {
                            "candidate": candidate,
                            "status": "completed",
                            "parsed_profile": parsed.model_dump(),
                            "evidence": evidence.model_dump(),
                            "transferable_skills": transfer.model_dump(),
                            "professional_footprint": footprint.model_dump(),
                        }
                    )
                    return focused_result(focused_stage)

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
                    progress_callback=progress_callback,
                    candidates_out=candidates_out,
                )
                if focused_stage == "risk_auditor":
                    candidates_out.append(
                        {
                            "candidate": candidate,
                            "status": "completed",
                            "parsed_profile": parsed.model_dump(),
                            "evidence": evidence.model_dump(),
                            "transferable_skills": transfer.model_dump(),
                            "professional_footprint": footprint.model_dump(),
                            "risk_audit": risk.model_dump(),
                        }
                    )
                    return focused_result(focused_stage)

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
                await emit_progress()
                if focused_stage == "score_aggregation":
                    candidates_out.append(
                        {
                            "candidate": candidate,
                            "status": "completed",
                            "score": score.model_dump(),
                        }
                    )
                    return focused_result(focused_stage)

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
                    progress_callback=progress_callback,
                    candidates_out=candidates_out,
                )
                if focused_stage == "panel_review":
                    candidates_out.append(
                        {
                            "candidate": candidate,
                            "status": "completed",
                            "score": score.model_dump(),
                            "panel_review": panel.model_dump(),
                        }
                    )
                    return focused_result(focused_stage)

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
                    progress_callback=progress_callback,
                    candidates_out=candidates_out,
                )
                if focused_stage == "interview_pack":
                    candidates_out.append(
                        {
                            "candidate": candidate,
                            "status": "completed",
                            "score": score.model_dump(),
                            "panel_review": panel.model_dump(),
                            "interview_pack": interview.model_dump(),
                        }
                    )
                    return focused_result(focused_stage)

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
                await emit_progress()
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
                await emit_progress()

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
            progress_callback=progress_callback,
            candidates_out=candidates_out,
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

    async def _run_isolated_stage(
        self,
        *,
        run_data: dict,
        focused_stage: str,
        pipeline: list[dict[str, Any]],
        candidates_out: list[dict[str, Any]],
        emit_progress: Callable[[], Awaitable[None]],
    ) -> dict:
        candidate = (run_data.get("candidates") or [{}])[0]
        candidate_name = candidate.get("name", "Unknown Candidate")
        links = candidate.get("professional_links") or {}
        cached = candidate.get("cached_stage_outputs") or {}

        pipeline.append(
            self._stage_entry(
                "Isolated Stage Warning",
                "warning",
                f"Running isolated `{focused_stage}`. Upstream stages were not rerun; cached artifacts and safe defaults will be used where available.",
                {"focused_stage": focused_stage, "cached_keys": sorted(cached.keys())},
            )
        )
        await emit_progress()

        rubric = self._cached_model(
            JobRubricOutput,
            cached.get("rubric"),
            JobRubricOutput(
                role_title=run_data.get("title", ""),
                must_have_skills=run_data.get("must_have_skills", []) or [],
                nice_to_have_skills=run_data.get("nice_to_have_skills", []) or [],
            ),
        )
        context = self._cached_model(
            HiringContextOutput,
            cached.get("hiring_context"),
            HiringContextOutput(
                company_priorities=[str(run_data.get("company_priority") or "").strip()] if str(run_data.get("company_priority") or "").strip() else [],
                context_fit_keywords=run_data.get("must_have_skills", []) or [],
            ),
        )
        parsed = self._cached_model(
            ParsedResumeOutput,
            cached.get("parsed_profile"),
            ParsedResumeOutput(candidate_name=candidate_name, professional_links=list(links.values())),
        )
        evidence = self._cached_model(EvidenceOutput, cached.get("evidence"), EvidenceOutput())
        transfer = self._cached_model(TransferableSkillsOutput, cached.get("transferable_skills"), TransferableSkillsOutput())
        fetched_profiles = cached.get("fetched_profiles") if isinstance(cached.get("fetched_profiles"), dict) else {
            "visited_links": [],
            "github_repos": [],
            "fetch_failures": [],
        }
        effective_links = _merge_profile_links(links, parsed.professional_links)

        if focused_stage == "professional_link_fetcher":
            fetched_profiles = await fetch_professional_profiles(effective_links)
            pipeline.append(
                self._stage_entry(
                    f"Professional Link Fetcher Agent ({candidate_name})",
                    "completed",
                    f"Visited {len(fetched_profiles.get('visited_links', []))} professional links, failures={len(fetched_profiles.get('fetch_failures', []))}",
                    fetched_profiles,
                )
            )
            candidates_out.append({"candidate": candidate, "status": "completed", "fetched_profiles": fetched_profiles})
            await emit_progress()
            return {
                "run_id": run_data["id"],
                "status": "completed",
                "pipeline": pipeline,
                "top_candidates": [],
                "report": f"Isolated stage refresh completed: {focused_stage}",
                "report_data": {"summary": f"Isolated stage refresh completed: {focused_stage}"},
                "candidates": candidates_out,
                "focused_stage": focused_stage,
            }

        if focused_stage == "professional_footprint":
            if not fetched_profiles.get("visited_links") and effective_links:
                fetched_profiles = await fetch_professional_profiles(effective_links)
                pipeline.append(
                    self._stage_entry(
                        f"Professional Link Fetcher Agent ({candidate_name})",
                        "completed",
                        "Fetched links for isolated professional footprint refresh.",
                        fetched_profiles,
                    )
                )
            footprint = await self._run_agent(
                agent_name="professional_footprint",
                stage_name=f"Professional Footprint Agent ({candidate_name})",
                schema_cls=ProfessionalFootprintOutput,
                payload={
                    "profile_links": effective_links,
                    "fetched_profiles": fetched_profiles,
                    "candidate_evidence": evidence.model_dump(),
                    "job_rubric": rubric.model_dump(),
                },
                pipeline=pipeline,
                candidates_out=candidates_out,
            )
            footprint = footprint.model_copy(
                update={
                    "visited_links": fetched_profiles.get("visited_links", []),
                    "github_repos": fetched_profiles.get("github_repos", []),
                    "fetch_failures": fetched_profiles.get("fetch_failures", []),
                }
            )
            candidates_out.append(
                {
                    "candidate": candidate,
                    "status": "completed",
                    "professional_footprint": footprint.model_dump(),
                }
            )
            await emit_progress()
            return {
                "run_id": run_data["id"],
                "status": "completed",
                "pipeline": pipeline,
                "top_candidates": [],
                "report": f"Isolated stage refresh completed: {focused_stage}",
                "report_data": {"summary": f"Isolated stage refresh completed: {focused_stage}"},
                "candidates": candidates_out,
                "focused_stage": focused_stage,
            }

        footprint = self._cached_model(ProfessionalFootprintOutput, cached.get("professional_footprint"), ProfessionalFootprintOutput())
        risk = self._cached_model(RiskAuditOutput, cached.get("risk_audit"), RiskAuditOutput())
        score = cached.get("score")
        score_model = CandidateScore.model_validate(score) if score else calculate_score(
            rubric=rubric,
            context=context,
            evidence=evidence,
            transferable=transfer,
            footprint=footprint,
            risk=risk,
        )

        if focused_stage == "risk_auditor":
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
                candidates_out=candidates_out,
            )
            candidates_out.append({"candidate": candidate, "status": "completed", "risk_audit": risk.model_dump()})
            await emit_progress()
        elif focused_stage == "panel_review":
            panel = await self._run_agent(
                agent_name="panel_review",
                stage_name=f"Hiring Panel Review Agent ({candidate_name})",
                schema_cls=PanelReviewOutput,
                payload={
                    "candidate_score": score_model.model_dump(),
                    "evidence": evidence.model_dump(),
                    "risks": risk.model_dump(),
                    "job_rubric": rubric.model_dump(),
                    "hiring_context": context.model_dump(),
                },
                pipeline=pipeline,
                candidates_out=candidates_out,
            )
            candidates_out.append(
                {
                    "candidate": candidate,
                    "status": "completed",
                    "score": score_model.model_dump(),
                    "panel_review": panel.model_dump(),
                }
            )
            await emit_progress()
        else:
            raise ValueError(f"Isolated mode is not supported for '{focused_stage}'.")

        return {
            "run_id": run_data["id"],
            "status": "completed",
            "pipeline": pipeline,
            "top_candidates": [],
            "report": f"Isolated stage refresh completed: {focused_stage}",
            "report_data": {"summary": f"Isolated stage refresh completed: {focused_stage}"},
            "candidates": candidates_out,
            "focused_stage": focused_stage,
        }
