"""Tests for /api/v1/ics/findings/* endpoints."""

from __future__ import annotations

from httpx import AsyncClient


async def test_list_findings_empty(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/ics/findings/")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_findings_filter_by_session(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/ics/findings/", params={"session_id": "nope"})
    assert resp.status_code == 200
    assert resp.json() == []


async def test_findings_stats_empty(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/ics/findings/stats")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, dict)
    # All severity / status buckets should be 0 with no findings.
    for value in body.values():
        if isinstance(value, (int, float)):
            assert value == 0


async def test_patch_status_unknown_finding_404(client: AsyncClient) -> None:
    resp = await client.patch(
        "/api/v1/ics/findings/does-not-exist/status",
        params={"status": "resolved"},
    )
    assert resp.status_code == 404


async def test_patch_status_rejects_bad_status(client: AsyncClient) -> None:
    resp = await client.patch(
        "/api/v1/ics/findings/anything/status",
        params={"status": "not-a-real-status"},
    )
    # Either 422 (validation) or 404 (route reaches DB miss first).
    assert resp.status_code in (404, 422)


async def test_list_findings_respects_limit_bounds(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/ics/findings/", params={"limit": 999999})
    assert resp.status_code == 422  # ge=1, le=5000 per signature


async def test_reports_list_empty(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/ics/findings/reports/list")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, (list, dict))
