"""Tests for /api/v1/ics/devices/* endpoints."""

from __future__ import annotations

from httpx import AsyncClient


async def test_list_devices_empty_session(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/ics/devices/", params={"session_id": "nonexistent"})
    assert resp.status_code == 200
    assert resp.json() == []


async def test_topology_empty_session(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/ics/devices/topology", params={"session_id": "nonexistent"})
    assert resp.status_code == 200
    body = resp.json()
    assert body.get("nodes") == [] or body.get("nodes") == ()
    assert body.get("edges") == [] or body.get("edges") == ()


async def test_topology_requires_session_id(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/ics/devices/topology")
    assert resp.status_code == 422


async def test_stats_empty_session(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/ics/devices/stats", params={"session_id": "nonexistent"})
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, dict)
    # Whatever the stats shape is, every numeric counter should be 0 for an empty session.
    for value in body.values():
        if isinstance(value, (int, float)):
            assert value == 0


async def test_get_device_by_id_404(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/ics/devices/does-not-exist")
    assert resp.status_code == 404
