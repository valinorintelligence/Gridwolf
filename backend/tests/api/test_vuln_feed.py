"""Regression tests for vuln_feed /matched endpoint.

Locks in the scrub from commit 3a835f1: when /matched is called without a
session_id, the response must contain zero fabricated devices.
"""

from __future__ import annotations

from httpx import AsyncClient


async def test_matched_without_session_returns_empty(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    resp = await client.get("/api/v1/ics/advisories/matched", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body == {"count": 0, "matches": []}


async def test_matched_without_session_never_returns_demo_ips(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    """Hard guard against the 5 historic demo IPs ever creeping back in."""
    resp = await client.get("/api/v1/ics/advisories/matched", headers=auth_headers)
    body_text = resp.text
    for forbidden in ("10.1.1.10", "10.1.1.20", "10.1.1.30", "10.1.2.1", "10.1.0.1"):
        assert forbidden not in body_text, f"demo IP {forbidden} leaked into response"
