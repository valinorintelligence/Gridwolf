"""Tests for /api/v1/ics/sessions/* endpoints."""

from __future__ import annotations

from httpx import AsyncClient


async def test_list_sessions_empty(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/ics/sessions/")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_create_then_list_session(client: AsyncClient) -> None:
    create = await client.post(
        "/api/v1/ics/sessions/",
        json={"name": "test-assessment-1", "description": "smoke test"},
    )
    assert create.status_code == 200, create.text
    body = create.json()
    assert body["name"] == "test-assessment-1"
    assert body["status"] in ("created", "draft", "active", "pending")
    session_id = body["id"]

    listed = await client.get("/api/v1/ics/sessions/")
    assert listed.status_code == 200
    ids = [s["id"] for s in listed.json()]
    assert session_id in ids


async def test_get_session_by_id_404(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/ics/sessions/does-not-exist")
    assert resp.status_code == 404


async def test_delete_unknown_session_404(client: AsyncClient) -> None:
    resp = await client.delete("/api/v1/ics/sessions/does-not-exist")
    assert resp.status_code == 404


async def test_create_session_requires_name(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/ics/sessions/", json={"description": "no name"})
    assert resp.status_code == 422


async def test_list_sessions_respects_limit(client: AsyncClient) -> None:
    for i in range(3):
        await client.post("/api/v1/ics/sessions/", json={"name": f"s-{i}"})
    resp = await client.get("/api/v1/ics/sessions/", params={"limit": 2})
    assert resp.status_code == 200
    assert len(resp.json()) == 2
