from __future__ import annotations
import logging
import os
import secrets
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

logger = logging.getLogger("gridwolf")

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
    """Create all tables on startup, then seed the first admin account."""
    async with engine.begin() as conn:
        # Import all models so they are registered with Base.metadata
        from app.models import user, ontology  # noqa
        from app.models import ics  # noqa
        from app.models import admin  # noqa
        await conn.run_sync(Base.metadata.create_all)

    await _seed_first_admin()


async def _seed_first_admin() -> None:
    """
    Create the default admin account on a fresh installation.

    Behaviour:
    - Runs only when the users table is empty (idempotent).
    - Password source priority:
        1. GRIDWOLF_ADMIN_PASSWORD env var (set explicitly)
        2. Auto-generated random password  →  printed once to stdout
    - Always logs the admin username so operators know what to use.
    """
    from sqlalchemy import select, func
    from app.models.user import User
    from app.core.security import hash_password

    async with async_session_factory() as session:
        count = (await session.execute(select(func.count()).select_from(User))).scalar_one()
        if count > 0:
            return  # Users already exist — nothing to do

        password = settings.ADMIN_PASSWORD
        auto_generated = not password
        if auto_generated:
            password = secrets.token_urlsafe(16)

        admin = User(
            username=settings.ADMIN_USERNAME,
            email=settings.ADMIN_EMAIL,
            hashed_password=hash_password(password),
            full_name="Administrator",
            role="admin",
        )
        session.add(admin)
        await session.commit()

        # Print credentials to stdout so the operator can retrieve them from
        # container logs / serial console on first boot.
        print("\n" + "=" * 60, flush=True)
        print("  GRIDWOLF  —  First-Run Admin Account Created", flush=True)
        print("=" * 60, flush=True)
        print(f"  Username : {settings.ADMIN_USERNAME}", flush=True)
        print(f"  Password : {password}", flush=True)
        if auto_generated:
            print("  (auto-generated — set GRIDWOLF_ADMIN_PASSWORD to use your own)", flush=True)
        print("=" * 60 + "\n", flush=True)

        logger.info("First admin account created: username=%s", settings.ADMIN_USERNAME)
