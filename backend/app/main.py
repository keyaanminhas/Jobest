import os
import logging
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

PROJECT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(PROJECT_DIR / ".env", override=False)

from app.api.org_routes import router as org_api_router  # noqa: E402
from app.api.routes import router as api_router  # noqa: E402
from app.db import init_db_schema  # noqa: E402
from app.services.model_router import ModelRouter  # noqa: E402

app = FastAPI(title="Jobest Backend", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router)
app.include_router(org_api_router)


@app.on_event("startup")
async def startup_init_schema() -> None:
    if os.getenv("AUTO_CREATE_DB_SCHEMA", "true").strip().lower() == "true":
        try:
            await init_db_schema()
        except Exception as exc:
            logging.getLogger("jobest.startup").warning("DB schema init skipped: %s", exc)


@app.get("/health")
async def health() -> dict:
    router = ModelRouter.from_env()
    primary = router.primary
    return {
        "status": "ok",
        "app_env": router.app_env,
        "llm_mode": router.llm_mode,
        "provider": primary.provider,
        "base_url": primary.base_url,
        "model": primary.model,
    }
