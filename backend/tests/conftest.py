from __future__ import annotations

import os
from collections.abc import AsyncGenerator

import pytest_asyncio

# Set env BEFORE importing app — config reads these at module load.
os.environ.setdefault("GRIDWOLF_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("GRIDWOLF_SECRET_KEY", "test-secret-key-not-for-production-use-only")
os.environ.setdefault("GRIDWOLF_ADMIN_USERNAME", "admin")
os.environ.setdefault("GRIDWOLF_ADMIN_EMAIL", "admin@test.local")
os.environ.setdefault("GRIDWOLF_ADMIN_PASSWORD", "TestAdmin123")

from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.core.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest_asyncio.fixture(scope="function")
async def _db_schema() -> AsyncGenerator[None, None]:
    """Create a fresh schema for every test, drop after."""
    async with engine.begin() as conn:
        from app.models import admin, ics, ontology, user  # noqa: F401

        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def client(_db_schema: None) -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP client bound to the ASGI app, no network."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def admin_token(client: AsyncClient) -> str:
    """Register + log in an admin user and return the access token."""
    register_body = {
        "username": "tester_admin",
        "email": "tester_admin@test.local",
        "password": "TestAdmin123",
        "full_name": "Test Admin",
    }
    await client.post("/api/v1/auth/register", json=register_body)
    login = await client.post(
        "/api/v1/auth/login",
        json={"username": register_body["username"], "password": register_body["password"]},
    )
    assert login.status_code == 200, login.text
    return login.json()["access_token"]


@pytest_asyncio.fixture
async def auth_headers(admin_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {admin_token}"}
