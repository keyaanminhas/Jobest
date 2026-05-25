from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

from app.api.routes import router as api_router
from app.services.model_router import ModelRouter

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

app = FastAPI(title="Jobest Backend", version="0.1.0")
app.include_router(api_router)


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
