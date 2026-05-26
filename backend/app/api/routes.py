import json
import os
import re
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Header, HTTPException, UploadFile

from app.schemas.hiring import (
    CreateHiringRunRequest,
    FinalReportResponse,
    HiringRun,
    HiringRunResponse,
    RunExecutionResponse,
    SingleCVRunResponse,
    ShortlistResponse,
)
from app.services.orchestrator import PipelineOrchestrator
from app.services.resume_ingestion import (
    ResumeIngestionError,
    assert_pdf_upload,
    derive_candidate_name,
    extract_pdf_text,
    extract_professional_urls_from_pdf,
)
from app.services.seeded_role import FIRST_RUN_PRESET

router = APIRouter(prefix="/api", tags=["jobest"])

APP_DIR = Path(__file__).resolve().parents[1]
RUNS_DIR = APP_DIR / "storage" / "demo" / "runs"
RUNS_DIR.mkdir(parents=True, exist_ok=True)


async def require_api_key(x_api_key: str | None = Header(default=None, alias="X-API-Key")) -> None:
    expected = os.getenv("API_KEY", "").strip()
    if not expected:
        raise HTTPException(status_code=500, detail="Server API key is not configured")
    if x_api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid API key")


orchestrator = PipelineOrchestrator()

IGNORED_LINK_HOSTS: set[str] = {
    "gmail.com",
    "googlemail.com",
    "mail.google.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "icloud.com",
    "proton.me",
    "protonmail.com",
    "aol.com",
    "gmx.com",
    "yandex.com",
}


def _run_path(run_id: str) -> Path:
    return RUNS_DIR / f"{run_id}.json"


def _save_run(run: dict) -> None:
    _run_path(run["id"]).write_text(json.dumps(run, indent=2, ensure_ascii=True), encoding="utf-8")


def _load_run(run_id: str) -> dict:
    path = _run_path(run_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Run not found")
    return json.loads(path.read_text(encoding="utf-8"))


def _normalize_candidate_link(token: str) -> str | None:
    cleaned = token.strip().strip(".,;)")
    if not cleaned:
        return None
    parsed = urlparse(cleaned)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        return cleaned
    if "://" in cleaned:
        return None
    if " " in cleaned or "@" in cleaned:
        return None
    if "." not in cleaned:
        return None
    return f"https://{cleaned}"


def _is_ignored_link_host(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    if not host:
        return True
    return host in IGNORED_LINK_HOSTS or any(host.endswith(f".{domain}") for domain in IGNORED_LINK_HOSTS)


def _extract_professional_links(raw_urls: str | None) -> dict[str, str]:
    if not raw_urls:
        return {}

    tokens = [token.strip() for token in re.split(r"[\n,; ]+", raw_urls) if token.strip()]
    links: dict[str, str] = {}
    seen_urls: set[str] = set()

    def _insert_link(link_type: str, url: str) -> None:
        normalized_url = url.strip()
        if not normalized_url or normalized_url in seen_urls:
            return
        seen_urls.add(normalized_url)
        key = link_type
        suffix = 2
        while key in links:
            key = f"{link_type}_{suffix}"
            suffix += 1
        links[key] = normalized_url

    for token in tokens:
        normalized = _normalize_candidate_link(token)
        if not normalized:
            continue
        if _is_ignored_link_host(normalized):
            continue
        host = urlparse(normalized).netloc.lower()
        if "github.com" in host:
            _insert_link("github", normalized)
        elif any(domain in host for domain in ("linkedin.com", "lnkd.in")):
            _insert_link("linkedin", normalized)
        elif "kaggle.com" in host:
            _insert_link("kaggle", normalized)
        elif "scholar.google." in host:
            _insert_link("scholar", normalized)
        elif any(domain in host for domain in ("dribbble.com", "behance.net", "medium.com", "notion.site")):
            _insert_link("portfolio", normalized)
        else:
            _insert_link("external", normalized)
    return links


def _merge_link_maps(base: dict[str, str], incoming: dict[str, str]) -> dict[str, str]:
    merged = dict(base)
    existing_values = set(merged.values())
    for key, value in incoming.items():
        if value in existing_values:
            continue
        candidate_key = key
        suffix = 2
        while candidate_key in merged:
            candidate_key = f"{key}_{suffix}"
            suffix += 1
        merged[candidate_key] = value
        existing_values.add(value)
    return merged


def _run_execution_from_results(run_id: str, results: dict, status: str) -> RunExecutionResponse:
    return RunExecutionResponse(
        run_id=run_id,
        status=status,
        pipeline=results.get("pipeline", []),
        top_candidates=results.get("top_candidates", []),
        report=results.get("report", ""),
    )


async def _execute_and_persist_run(run: dict, *, persist_progress: bool = False) -> tuple[dict, RunExecutionResponse]:
    run["status"] = "processing"
    run["results"] = {
        "run_id": run["id"],
        "status": "processing",
        "pipeline": [],
        "top_candidates": [],
        "report": "",
        "report_data": {},
        "candidates": [],
    }
    _save_run(run)

    try:
        async def _progress_callback(pipeline: list[dict], candidates: list[dict]) -> None:
            if not persist_progress:
                return
            latest = _load_run(run["id"])
            latest["results"] = {
                "run_id": run["id"],
                "status": "processing",
                "pipeline": pipeline,
                "top_candidates": [],
                "report": "",
                "report_data": {},
                "candidates": candidates,
            }
            latest["status"] = "processing"
            _save_run(latest)

        results = await orchestrator.run_pipeline(run, progress_callback=_progress_callback if persist_progress else None)
        run["results"] = results
        run["status"] = "completed"
        _save_run(run)
        return run, _run_execution_from_results(run["id"], results, "completed")
    except Exception as exc:
        run["status"] = "error"
        run["results"] = {
            "run_id": run["id"],
            "status": "error",
            "pipeline": [
                {
                    "stage": "Pipeline",
                    "status": "error",
                    "summary": "Pipeline failed before completion",
                    "raw_output": {"error": str(exc)},
                }
            ],
            "top_candidates": [],
            "report": "Pipeline failed",
            "error": str(exc),
        }
        _save_run(run)
        return run, _run_execution_from_results(run["id"], run["results"], "error")


async def _execute_run_background(run_id: str) -> None:
    run = _load_run(run_id)
    await _execute_and_persist_run(run, persist_progress=True)


@router.post("/hiring-runs", response_model=HiringRunResponse, dependencies=[Depends(require_api_key)])
async def create_hiring_run(payload: CreateHiringRunRequest) -> HiringRunResponse:
    run = HiringRun(
        id=str(uuid4()),
        title=payload.title,
        job_description=payload.job_description,
        hiring_context=payload.hiring_context,
        company_priority=payload.company_priority,
        must_have_skills=payload.must_have_skills,
        nice_to_have_skills=payload.nice_to_have_skills,
        candidates=payload.candidates,
        status="draft",
        results=None,
    ).model_dump(mode="json")
    _save_run(run)
    return HiringRunResponse(run_id=run["id"], status=run["status"], run=HiringRun.model_validate(run))


@router.get("/hiring-runs/{run_id}", response_model=HiringRun, dependencies=[Depends(require_api_key)])
async def get_hiring_run(run_id: str) -> HiringRun:
    run = _load_run(run_id)
    return HiringRun.model_validate(run)


@router.post("/hiring-runs/{run_id}/run", response_model=RunExecutionResponse, dependencies=[Depends(require_api_key)])
async def run_pipeline(run_id: str) -> RunExecutionResponse:
    run = _load_run(run_id)
    _, execution = await _execute_and_persist_run(run)
    return execution


@router.post("/single-cv-runs", response_model=SingleCVRunResponse, dependencies=[Depends(require_api_key)])
async def run_single_cv(
    background_tasks: BackgroundTasks,
    cv_pdf: UploadFile = File(...),
    candidate_name_override: str | None = Form(default=None),
    additional_urls: str | None = Form(default=None),
) -> SingleCVRunResponse:
    try:
        assert_pdf_upload(cv_pdf.filename)
        file_bytes = await cv_pdf.read()
        resume_text = extract_pdf_text(file_bytes)
    except ResumeIngestionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    candidate_name = derive_candidate_name(
        resume_text=resume_text,
        filename=cv_pdf.filename,
        name_override=candidate_name_override,
    )
    professional_links = _extract_professional_links(additional_urls)
    extracted_urls = extract_professional_urls_from_pdf(file_bytes)
    if extracted_urls:
        extracted_map = _extract_professional_links(" ".join(extracted_urls))
        professional_links = _merge_link_maps(professional_links, extracted_map)

    preset = FIRST_RUN_PRESET
    run = HiringRun(
        id=str(uuid4()),
        title=preset.title,
        job_description=preset.job_description,
        hiring_context=preset.hiring_context,
        company_priority=preset.company_priority,
        must_have_skills=preset.must_have_skills,
        nice_to_have_skills=preset.nice_to_have_skills,
        candidates=[
            {
                "name": candidate_name,
                "resume_text": resume_text,
                "professional_links": professional_links,
                "notes": "additional_urls_provided=true" if professional_links else None,
            }
        ],
        status="processing",
        results={
            "run_id": "",
            "status": "processing",
            "pipeline": [],
            "top_candidates": [],
            "report": "",
            "report_data": {},
            "candidates": [],
        },
    ).model_dump(mode="json")
    run["results"]["run_id"] = run["id"]
    _save_run(run)
    background_tasks.add_task(_execute_run_background, run["id"])
    return SingleCVRunResponse(
        run_id=run["id"],
        status="processing",
        run=HiringRun.model_validate(run),
    )


@router.get("/hiring-runs/{run_id}/shortlist", response_model=ShortlistResponse, dependencies=[Depends(require_api_key)])
async def get_shortlist(run_id: str) -> ShortlistResponse:
    run = _load_run(run_id)
    results = run.get("results") or {}
    shortlist = results.get("top_candidates") or results.get("shortlist")
    if shortlist is None:
        raise HTTPException(status_code=409, detail="Shortlist not ready. Run the pipeline first.")
    return ShortlistResponse(run_id=run_id, shortlist=shortlist)


@router.get("/hiring-runs/{run_id}/report", response_model=FinalReportResponse, dependencies=[Depends(require_api_key)])
async def get_report(run_id: str) -> FinalReportResponse:
    run = _load_run(run_id)
    results = run.get("results") or {}
    report_data = results.get("report_data")
    if report_data is None:
        report_text = results.get("report")
        if report_text is None:
            raise HTTPException(status_code=409, detail="Report not ready. Run the pipeline first.")
        report_data = {"summary": report_text}
    return FinalReportResponse(run_id=run_id, report=report_data)
