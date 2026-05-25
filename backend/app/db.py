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
