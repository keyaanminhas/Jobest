import os
from pathlib import Path
from collections.abc import AsyncGenerator
import secrets

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


def _default_database_url() -> str:
    db_file = Path(__file__).resolve().parent / "storage" / "jobest.db"
    db_file.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite+aiosqlite:///{db_file.as_posix()}"


DATABASE_URL = os.getenv("DATABASE_URL", _default_database_url())
SQLITE_BUSY_TIMEOUT_SECONDS = int(os.getenv("SQLITE_BUSY_TIMEOUT_SECONDS", "300"))
connect_args = (
    {"timeout": SQLITE_BUSY_TIMEOUT_SECONDS}
    if DATABASE_URL.startswith("sqlite+aiosqlite")
    else {}
)
engine = create_async_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


async def init_db_schema() -> None:
    # Lazy import to avoid circular dependency when models import Base.
    from app import models  # noqa: F401

    async with engine.begin() as connection:
        if DATABASE_URL.startswith("sqlite+aiosqlite"):
            await connection.exec_driver_sql("PRAGMA journal_mode=WAL")
            await connection.exec_driver_sql(f"PRAGMA busy_timeout={SQLITE_BUSY_TIMEOUT_SECONDS * 1000}")

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
            ("requested_stage_mode", "ALTER TABLE candidate_analysis_runs ADD COLUMN requested_stage_mode VARCHAR(32)"),
        ]
        for column, statement in alter_statements:
            if column not in existing:
                await connection.exec_driver_sql(statement)

        posting_pragma = await connection.exec_driver_sql("PRAGMA table_info(job_postings)")
        posting_existing = {row[1] for row in posting_pragma.fetchall()}
        if "public_application_token" not in posting_existing:
            await connection.exec_driver_sql(
                "ALTER TABLE job_postings ADD COLUMN public_application_token VARCHAR(64)"
            )
        if "public_applications_enabled" not in posting_existing:
            await connection.exec_driver_sql(
                "ALTER TABLE job_postings ADD COLUMN public_applications_enabled BOOLEAN NOT NULL DEFAULT 1"
            )
        candidates_pragma = await connection.exec_driver_sql("PRAGMA table_info(candidates)")
        candidate_existing = {row[1] for row in candidates_pragma.fetchall()}
        candidate_alters = [
            ("first_name", "ALTER TABLE candidates ADD COLUMN first_name VARCHAR(255)"),
            ("last_name", "ALTER TABLE candidates ADD COLUMN last_name VARCHAR(255)"),
            ("email", "ALTER TABLE candidates ADD COLUMN email VARCHAR(255)"),
            ("phone_number", "ALTER TABLE candidates ADD COLUMN phone_number VARCHAR(64)"),
            ("external_id_text", "ALTER TABLE candidates ADD COLUMN external_id_text VARCHAR(255)"),
        ]
        for column, statement in candidate_alters:
            if column not in candidate_existing:
                await connection.exec_driver_sql(statement)

        rows = await connection.exec_driver_sql(
            "SELECT id FROM job_postings WHERE public_application_token IS NULL OR public_application_token = ''"
        )
        missing_ids = [row[0] for row in rows.fetchall()]
        for posting_id in missing_ids:
            await connection.exec_driver_sql(
                "UPDATE job_postings SET public_application_token = :token WHERE id = :posting_id",
                {"token": secrets.token_urlsafe(24), "posting_id": posting_id},
            )
        await connection.exec_driver_sql(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_job_postings_public_application_token ON job_postings(public_application_token)"
        )
        await connection.exec_driver_sql(
            """
            UPDATE job_postings
            SET public_applications_enabled = 1
            WHERE public_applications_enabled IS NULL
            """
        )
