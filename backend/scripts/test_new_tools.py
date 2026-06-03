import os
import sys
import asyncio
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

# Setup path so imports work
project_dir = Path(__file__).resolve().parents[1]
if str(project_dir) not in sys.path:
    sys.path.insert(0, str(project_dir))

# Configure database
db_path = project_dir / "app" / "storage" / "demo" / "test_new_tools.db"
if db_path.exists():
    db_path.unlink()

os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{db_path.as_posix()}"
os.environ["AUTO_CREATE_DB_SCHEMA"] = "true"
os.environ["APP_ENV"] = "dev"
os.environ["LLM_MODE"] = "mock"
os.environ["USE_MOCK_LLM"] = "true"
os.environ["CACHE_LLM_RESPONSES"] = "false"

from app.db import Base, engine
from app.models import User, JobPosting, Candidate, CandidateTriage, CandidateAnalysisRun, CandidateStageOutput, CandidateFinalOutput
from app.services.agent_runtime import RecruiterAgentRuntime
from app.api.ai_routes import _result_summary

async def run_tests():
    # Force schema creation
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Initialize session factory
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    async with async_session() as db:
        # Create User
        user = User(
            email="test-user@example.com",
            password_hash="fake-hash",
            full_name="Test Recruiter",
        )
        db.add(user)
        await db.flush()

        # Create Job Posting
        posting = JobPosting(
            user_id=user.id,
            title="Senior Developer",
            job_description="Python, FastAPI, SQL, Docker",
            hiring_context="Tech lead hire",
        )
        db.add(posting)
        await db.flush()

        # Create Candidate
        candidate = Candidate(
            job_posting_id=posting.id,
            uploaded_by_user_id=user.id,
            display_name="Alice Candidate",
            resume_file_path="/path/to/resume.pdf",
            resume_sha256="fake-sha",
            resume_text="Experienced engineer specializing in Python and database architectures.",
        )
        db.add(candidate)
        await db.flush()

        triage = CandidateTriage(
            candidate_id=candidate.id,
            triage_score=75.0,
            triage_summary="Solid Python match, lacks Kubernetes detail.",
        )
        db.add(triage)
        await db.flush()

        # Add mock runs/stages for interview question check
        run = CandidateAnalysisRun(
            candidate_id=candidate.id,
            status="completed",
            requested_by_user_id=user.id,
        )
        db.add(run)
        await db.flush()

        evidence_stage = CandidateStageOutput(
            analysis_run_id=run.id,
            stage_name=f"Candidate Evidence Agent ({candidate.display_name})",
            status="completed",
            raw_output_json={
                "unsupported_claims": [
                    {"claim": "Kubernetes orchestration", "reason": "No project matches"}
                ]
            }
        )
        db.add(evidence_stage)

        risk_stage = CandidateStageOutput(
            analysis_run_id=run.id,
            stage_name=f"Risk & Contradiction Agent ({candidate.display_name})",
            status="completed",
            raw_output_json={
                "risks": ["Lacks production deployment experience"]
            }
        )
        db.add(risk_stage)

        final_out = CandidateFinalOutput(
            candidate_id=candidate.id,
            analysis_run_id=run.id,
            score_json={"final_score": 88.0, "recommendation": "Strong Hire"},
            report_json={"summary": "Excellent technical candidate with system design experience."}
        )
        db.add(final_out)
        await db.commit()

        # Setup runtime
        runtime = RecruiterAgentRuntime()

        # Test 1: Generate Outreach Email
        print("Testing generate_outreach_email...")
        args_email = {"candidate_id": candidate.id, "email_type": "outreach"}
        res_email = await runtime.execute(db, user_id=user.id, tool_name="generate_outreach_email", arguments=args_email)
        print("Raw Email Output:", res_email)
        summary_email = _result_summary("generate_outreach_email", res_email)
        print("\nSummary markdown:\n", summary_email)
        print("="*60)

        # Test 2: Compare Candidates
        print("Testing compare_candidates...")
        args_compare = {"candidate_ids": [candidate.id], "job_posting_id": posting.id}
        res_compare = await runtime.execute(db, user_id=user.id, tool_name="compare_candidates", arguments=args_compare)
        print("Raw Comparison Output:", res_compare)
        summary_compare = _result_summary("compare_candidates", res_compare)
        print("\nSummary markdown:\n", summary_compare)
        print("="*60)

        # Test 3: Generate Targeted Interview Questions
        print("Testing generate_targeted_interview_questions...")
        args_questions = {"candidate_id": candidate.id}
        res_questions = await runtime.execute(db, user_id=user.id, tool_name="generate_targeted_interview_questions", arguments=args_questions)
        print("Raw Questions Output:", res_questions)
        summary_questions = _result_summary("generate_targeted_interview_questions", res_questions)
        print("\nSummary markdown:\n", summary_questions)
        print("="*60)

        # Test 4: Heuristic Plan Routing Checks
        print("Testing heuristic plan routing...")
        # Mock session context and history
        session_context = {"job_posting_id": posting.id, "candidate_id": candidate.id}
        history = []
        
        # Test heuristic for outreach
        plan = await runtime._heuristic_plan(db, user_id=user.id, content="write outreach email for Alice", session_context=session_context, history=history)
        print("Heuristic Plan (outreach):", plan)
        assert plan["tool_name"] == "generate_outreach_email"

        # Test heuristic for compare
        plan = await runtime._heuristic_plan(db, user_id=user.id, content="compare candidates", session_context=session_context, history=history)
        print("Heuristic Plan (compare):", plan)
        assert plan["tool_name"] == "compare_candidates"

        # Test heuristic for targeted interview questions
        plan = await runtime._heuristic_plan(db, user_id=user.id, content="give me targeted interview questions for Alice", session_context=session_context, history=history)
        print("Heuristic Plan (questions):", plan)
        assert plan["tool_name"] == "generate_targeted_interview_questions"

        print("ALL TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(run_tests())
