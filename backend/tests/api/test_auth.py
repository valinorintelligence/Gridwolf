"""Auth happy-path + basic failure tests for /api/v1/auth/*."""

from __future__ import annotations

from httpx import AsyncClient


async def test_register_login_me_roundtrip(client: AsyncClient) -> None:
    register = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "alice",
            "email": "alice@test.local",
            "password": "Sup3rSecret",
            "full_name": "Alice Tester",
        },
    )
    assert register.status_code == 201, register.text
    me_data = register.json()
    assert me_data["username"] == "alice"
    assert me_data["role"] == "analyst"  # default per User model
    assert me_data["is_active"] is True

    login = await client.post(
        "/api/v1/auth/login",
        json={"username": "alice", "password": "Sup3rSecret"},
    )
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    assert login.json()["token_type"] == "bearer"

    me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me.status_code == 200
    assert me.json()["username"] == "alice"


async def test_login_wrong_password_rejected(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/auth/register",
        json={
            "username": "bob",
            "email": "bob@test.local",
            "password": "Sup3rSecret",
        },
    )
    bad = await client.post(
        "/api/v1/auth/login",
        json={"username": "bob", "password": "WrongPassword1"},
    )
    assert bad.status_code in (401, 403)


async def test_me_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/auth/me")
    # No bearer token: FastAPI's HTTPBearer returns 403 by default.
    assert resp.status_code in (401, 403)


async def test_weak_password_rejected(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "charlie",
            "email": "charlie@test.local",
            "password": "alllowercase",  # fails uppercase + digit rules
        },
    )
    assert resp.status_code == 422
