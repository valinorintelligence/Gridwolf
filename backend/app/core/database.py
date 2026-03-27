from __future__ import annotations
import os
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# Support SQLite (default for local dev) and PostgreSQL
DATABASE_URL = settings.DATABASE_URL

# If using SQLite, ensure async driver
if DATABASE_URL.startswith("sqlite"):
    if "sqlite+aiosqlite" not in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace("sqlite://", "sqlite+aiosqlite://", 1)
    engine = create_async_engine(DATABASE_URL, echo=settings.DEBUG, connect_args={"check_same_thread": False})
else:
    engine = create_async_engine(DATABASE_URL, echo=settings.DEBUG)

async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# Keep backward compatibility
async_session = async_session_factory


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Create all tables. Call on startup."""
    async with engine.begin() as conn:
        # Import all models so they are registered
        from app.models import user, ontology  # noqa
        from app.models import ics  # noqa
        await conn.run_sync(Base.metadata.create_all)
