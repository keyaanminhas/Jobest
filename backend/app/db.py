import os
from pathlib import Path
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


def _default_database_url() -> str:
    db_file = Path(__file__).resolve().parent / "storage" / "jobest.db"
    db_file.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite+aiosqlite:///{db_file.as_posix()}"


DATABASE_URL = os.getenv("DATABASE_URL", _default_database_url())
engine = create_async_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


async def init_db_schema() -> None:
    # Lazy import to avoid circular dependency when models import Base.
    from app import models  # noqa: F401

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await connection.exec_driver_sql(
            """
            CREATE TABLE IF NOT EXISTS user_agent_settings (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) UNIQUE,
                provider VARCHAR(64) NOT NULL DEFAULT 'chutes',
                base_url TEXT NOT NULL DEFAULT 'https://llm.chutes.ai/v1',
                model VARCHAR(255) NOT NULL DEFAULT 'Qwen/Qwen2.5-Coder-32B-Instruct-TEE',
                encrypted_api_key TEXT,
                api_key_last4 VARCHAR(8),
                parallel_agents_limit INTEGER NOT NULL DEFAULT 1,
                retry_attempts INTEGER NOT NULL DEFAULT 0,
                retry_delay_seconds INTEGER NOT NULL DEFAULT 30,
                created_at DATETIME,
                updated_at DATETIME
            )
            """
        )

        pragma = await connection.exec_driver_sql("PRAGMA table_info(candidate_analysis_runs)")
        existing = {row[1] for row in pragma.fetchall()}
        alter_statements = [
            ("requested_by_user_id", "ALTER TABLE candidate_analysis_runs ADD COLUMN requested_by_user_id VARCHAR(36)"),
            ("attempt_count", "ALTER TABLE candidate_analysis_runs ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0"),
            ("max_attempts", "ALTER TABLE candidate_analysis_runs ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 0"),
            ("retry_delay_seconds", "ALTER TABLE candidate_analysis_runs ADD COLUMN retry_delay_seconds INTEGER NOT NULL DEFAULT 30"),
            ("current_stage_name", "ALTER TABLE candidate_analysis_runs ADD COLUMN current_stage_name VARCHAR(255)"),
            ("current_stage_summary", "ALTER TABLE candidate_analysis_runs ADD COLUMN current_stage_summary TEXT"),
            ("progress_percent", "ALTER TABLE candidate_analysis_runs ADD COLUMN progress_percent FLOAT NOT NULL DEFAULT 0"),
            ("provider_used", "ALTER TABLE candidate_analysis_runs ADD COLUMN provider_used VARCHAR(64)"),
            ("model_used", "ALTER TABLE candidate_analysis_runs ADD COLUMN model_used VARCHAR(255)"),
            ("key_label_used", "ALTER TABLE candidate_analysis_runs ADD COLUMN key_label_used VARCHAR(32)"),
            ("worker_slot_index", "ALTER TABLE candidate_analysis_runs ADD COLUMN worker_slot_index INTEGER"),
            ("requested_stage", "ALTER TABLE candidate_analysis_runs ADD COLUMN requested_stage VARCHAR(64)"),
        ]
        for column, statement in alter_statements:
            if column not in existing:
                await connection.exec_driver_sql(statement)
