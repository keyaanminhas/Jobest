import os
import sys
import time
from pathlib import Path

import fitz
from fastapi.testclient import TestClient


def make_demo_pdf_bytes() -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text(
        (72, 72),
        "\n".join(
            [
                "John Doe",
                "Senior Software Engineer",
                "Skills: Python, FastAPI, SQL, Docker, Kubernetes",
                "Experience: Built AI-backed screening APIs and async pipelines.",
                "GitHub: https://github.com/johndoe",
            ]
        ),
    )
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def main() -> None:
    project_dir = Path(__file__).resolve().parents[1]
    if str(project_dir) not in sys.path:
        sys.path.insert(0, str(project_dir))
    db_path = project_dir / "app" / "storage" / "demo" / "smoke_org.db"
    if db_path.exists():
        db_path.unlink()

    os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{db_path.as_posix()}"
    os.environ["AUTO_CREATE_DB_SCHEMA"] = "true"
    os.environ["APP_ENV"] = "dev"
    os.environ["JWT_SECRET_KEY"] = "smoke-test-secret"
    os.environ["LLM_MODE"] = "mock"
    os.environ["USE_MOCK_LLM"] = "true"
    os.environ["CACHE_LLM_RESPONSES"] = "false"

    from app.main import app

    with TestClient(app) as client:
        signup_payload = {
            "email": "smoke-user@example.com",
            "password": "StrongPass123!",
            "full_name": "Smoke User",
        }
        signup = client.post("/api/auth/signup", json=signup_payload)
        assert signup.status_code == 200, signup.text
        token = signup.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        me = client.get("/api/auth/me", headers=headers)
        assert me.status_code == 200, me.text

        posting_payload = {
            "title": "Senior Software Engineer (AI Platform)",
            "job_description": (
                "Build backend APIs, async workflows, and LLM-assisted hiring intelligence. "
                "Strong Python, FastAPI, SQL, Docker required."
            ),
            "hiring_context": "Need an engineer who can ship reliable backend systems quickly.",
            "company_priority": "Execution speed with quality",
            "must_have_skills": ["Python", "FastAPI", "SQL", "Docker"],
            "nice_to_have_skills": ["Kubernetes", "LLM", "Redis"],
        }
        create_posting = client.post("/api/job-postings", json=posting_payload, headers=headers)
        assert create_posting.status_code == 200, create_posting.text
        posting_id = create_posting.json()["id"]

        pdf_bytes = make_demo_pdf_bytes()
        upload = client.post(
            f"/api/job-postings/{posting_id}/candidates/upload",
            headers=headers,
            files=[("cv_pdfs", ("john_doe_cv.pdf", pdf_bytes, "application/pdf"))],
            data={"additional_urls": "https://github.com/johndoe https://linkedin.com/in/johndoe"},
        )
        assert upload.status_code == 200, upload.text
        candidates = upload.json()["candidates"]
        assert len(candidates) == 1, upload.text
        candidate_id = candidates[0]["id"]

        trigger = client.post(f"/api/candidates/{candidate_id}/analyze", headers=headers)
        assert trigger.status_code == 200, trigger.text

        status_value = "queued"
        analysis_payload = {}
        for _ in range(40):
            analysis = client.get(f"/api/candidates/{candidate_id}/analysis", headers=headers)
            assert analysis.status_code == 200, analysis.text
            analysis_payload = analysis.json()
            status_value = analysis_payload.get("status", "")
            if status_value in {"completed", "error"}:
                break
            time.sleep(0.25)

        assert status_value == "completed", analysis_payload

        report = client.get(f"/api/candidates/{candidate_id}/report", headers=headers)
        assert report.status_code == 200, report.text
        report_json = report.json()
        assert isinstance(report_json.get("score"), dict), report_json
        assert isinstance(report_json.get("report"), dict), report_json

        print("SMOKE TEST PASSED")
        print(f"posting_id={posting_id}")
        print(f"candidate_id={candidate_id}")
        print(f"analysis_status={status_value}")
        print(f"final_score={report_json['score'].get('final_score')}")


if __name__ == "__main__":
    main()
