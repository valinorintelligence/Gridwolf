from __future__ import annotations
import logging
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
    engine = create_async_engine(
        DATABASE_URL, echo=settings.DEBUG, connect_args={"check_same_thread": False}
    )
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
        from app.models import auth  # noqa
        from app.models import sites  # noqa

        await conn.run_sync(Base.metadata.create_all)

    await _seed_first_admin()
    await _bootstrap_sites()


async def _bootstrap_sites() -> None:
    """Register the lab site and reconcile identifiers (idempotent; see services.sites.bootstrap)."""
    from app.services.sites import bootstrap
    async with async_session_factory() as db:
        await bootstrap(db)


async def _seed_first_admin() -> None:
    """
    Create the first administrator on a fresh installation (idempotent: only when no user exists).

    Password source: GRIDWOLF_ADMIN_PASSWORD_FILE (mounted secret), then GRIDWOLF_ADMIN_PASSWORD, otherwise
    a random one written to GRIDWOLF_BOOTSTRAP_PASSWORD_FILE (mode 0600). The password is never printed or
    logged; only the account name and the file path are.
    """
    import os
    from sqlalchemy import select, func
    from app.models.user import User
    from app.core.security import hash_password

    async with async_session_factory() as session:
        count = (await session.execute(select(func.count()).select_from(User))).scalar_one()
        if count > 0:
            return  # Users already exist — nothing to do

        password = settings.admin_password()
        written = None
        if not password:
            password = secrets.token_urlsafe(18)
            path = settings.BOOTSTRAP_PASSWORD_FILE
            os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(password + "\n")
            os.chmod(path, 0o600)
            written = path

        session.add(User(
            username=settings.ADMIN_USERNAME,
            email=settings.ADMIN_EMAIL,
            hashed_password=hash_password(password),
            full_name="Administrator",
            role="admin",
        ))
        await session.commit()
        logger.info("First administrator account created: username=%s%s", settings.ADMIN_USERNAME,
                    "; generated password stored in %s (mode 0600)" % written if written else "")
