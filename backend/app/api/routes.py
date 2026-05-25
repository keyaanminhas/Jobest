import io
import json
import os
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile, File, BackgroundTasks
import pypdf

from app.schemas.hiring import (
    CreateHiringRunRequest,
    FinalReportResponse,
    HiringRun,
    HiringRunResponse,
    RunExecutionResponse,
    ShortlistResponse,
)
from app.services.orchestrator import PipelineOrchestrator

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


def _run_path(run_id: str) -> Path:
    return RUNS_DIR / f"{run_id}.json"


def _save_run(run: dict) -> None:
    _run_path(run["id"]).write_text(json.dumps(run, indent=2, ensure_ascii=True), encoding="utf-8")


def _load_run(run_id: str) -> dict:
    path = _run_path(run_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Run not found")
    return json.loads(path.read_text(encoding="utf-8"))


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


@router.post("/hiring-runs/{run_id}/run", response_model=RunExecutionResponse, dependencies=[Depends(require_api_key)])
async def run_pipeline(run_id: str, background_tasks: BackgroundTasks) -> RunExecutionResponse:
    run = _load_run(run_id)
    
    if run.get("status") == "processing":
        results = run.get("results") or {}
        return RunExecutionResponse(
            run_id=run_id,
            status="processing",
            pipeline=results.get("pipeline", []),
            top_candidates=results.get("top_candidates", []),
            report=results.get("report", "Pipeline is currently running..."),
        )
        
    run["status"] = "processing"
    # Initialize basic results on start
    run["results"] = {
        "run_id": run_id,
        "status": "processing",
        "pipeline": [],
        "top_candidates": [],
        "report": "Initializing pipeline deconstruction...",
    }
    _save_run(run)

    async def execute_pipeline():
        try:
            def save_progress_callback(pipeline_stages: list):
                run["results"] = {
                    "run_id": run_id,
                    "status": "processing",
                    "pipeline": pipeline_stages,
                    "top_candidates": [],
                    "report": "Analyzing candidates...",
                }
                _save_run(run)

            results = await orchestrator.run_pipeline(run, on_progress=save_progress_callback)
            run["results"] = results
            run["status"] = "completed"
            _save_run(run)
        except Exception as exc:
            run["status"] = "error"
            run["results"] = {
                "run_id": run_id,
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
                "report": f"Pipeline failed: {str(exc)}",
                "error": str(exc),
            }
            _save_run(run)

    background_tasks.add_task(execute_pipeline)

    return RunExecutionResponse(
        run_id=run_id,
        status="processing",
        pipeline=[],
        top_candidates=[],
        report="Started background pipeline execution.",
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


@router.get("/hiring-runs/{run_id}", dependencies=[Depends(require_api_key)])
async def get_hiring_run(run_id: str) -> dict:
    return _load_run(run_id)


@router.get("/hiring-runs", dependencies=[Depends(require_api_key)])
async def list_hiring_runs() -> list:
    runs = []
    for path in RUNS_DIR.glob("*.json"):
        try:
            runs.append(json.loads(path.read_text(encoding="utf-8")))
        except Exception:
            pass
    runs.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    return runs


@router.post("/parse-pdf", dependencies=[Depends(require_api_key)])
async def parse_pdf(file: UploadFile = File(...)) -> dict:
    try:
        content = await file.read()
        pdf_file = io.BytesIO(content)
        reader = pypdf.PdfReader(pdf_file)
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        
        filename = file.filename or "Candidate"
        # Remove extension
        name_part = filename.rsplit(".", 1)[0]
        # Clean up separators and camelCase/capitalization
        cleaned = name_part.replace("_", " ").replace("-", " ").title()
        
        # Clean common professional suffixes for a cleaner Candidate Name
        words = cleaned.split()
        cleaned_words = []
        for word in words:
            if word.lower() not in ["resume", "cv", "portfolio", "developer", "engineer", "architect", "fullstack", "frontend", "backend", "dev", "analyst", "specialist"]:
                cleaned_words.append(word)
        
        candidate_name = " ".join(cleaned_words).strip()
        if not candidate_name:
            candidate_name = cleaned
        
        return {
            "candidate_name": candidate_name,
            "resume_text": text.strip()
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse PDF resume: {exc}")
