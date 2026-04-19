"""
ICS/OT Vulnerability Intelligence Feed API

Endpoints:
  GET    /advisories/              List advisories (filtered, sorted, paginated)
  GET    /advisories/stats         Feed statistics
  GET    /advisories/{id}          Advisory detail with remediation
  POST   /advisories/refresh       Trigger feed refresh (KEV + EPSS enrichment)
  PATCH  /advisories/{id}/disposition  Update advisory disposition
  POST   /advisories/{id}/dismiss  Dismiss/un-dismiss an advisory
  GET    /advisories/matched       Auto-match advisories to session devices
  POST   /advisories/environment   Set vendor/sector environment
  GET    /advisories/export/csv    Export advisories as CSV
  GET    /advisories/sources       List available feed sources
"""

from __future__ import annotations

import logging
from typing import Optional, List
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from app.engine.vuln_feed import get_feed_engine, FEED_SOURCES
from app.core.database import async_session_factory

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/advisories", tags=["Vulnerability Feed"])


# ─── Pydantic Schemas ──────────────────────────────────────────


class DispositionUpdate(BaseModel):
    disposition: str  # new, not_applicable, acknowledged, in_progress, remediated


class DismissUpdate(BaseModel):
    dismissed: bool = True


class EnvironmentConfig(BaseModel):
    vendors: List[str] = []
    sectors: List[str] = []


# ─── Endpoints ─────────────────────────────────────────────────


@router.get("/")
async def list_advisories(
    severity: Optional[str] = Query(
        None, description="Filter by severity: critical, high, medium, low"
    ),
    vendor: Optional[str] = Query(None, description="Filter by vendor name"),
    sector: Optional[str] = Query(
        None,
        description="Filter by sector: energy, water, manufacturing, oil_gas, transportation, healthcare",
    ),
    source: Optional[str] = Query(
        None, description="Filter by source: cisa, siemens, schneider, rockwell, abb, moxa, certvde"
    ),
    urgency: Optional[str] = Query(
        None, description="Filter by urgency tier: act_now, plan_patch, monitor, low_risk"
    ),
    search: Optional[str] = Query(
        None, description="Full-text search across title, description, CVE ID"
    ),
    kev_only: bool = Query(False, description="Show only CISA KEV-listed advisories"),
    sort: str = Query("newest", description="Sort by: newest, severity, exploitable"),
    days: Optional[int] = Query(None, description="Filter to last N days"),
    include_dismissed: bool = Query(False, description="Include dismissed advisories"),
):
    """List vulnerability advisories with filtering and sorting."""
    engine = get_feed_engine()
    advisories = engine.get_advisories(
        severity=severity,
        vendor=vendor,
        sector=sector,
        source=source,
        urgency_tier=urgency,
        search=search,
        kev_only=kev_only,
        sort_by=sort,
        days=days,
        include_dismissed=include_dismissed,
    )
    return {"count": len(advisories), "advisories": advisories}


@router.get("/stats")
async def advisory_stats():
    """Get vulnerability feed statistics."""
    engine = get_feed_engine()
    return engine.get_stats()


@router.get("/sources")
async def list_sources():
    """List available feed sources."""
    sources = []
    for key, val in FEED_SOURCES.items():
        sources.append(
            {
                "id": key,
                "name": val["name"],
                "advisory_url": val.get("advisory_url", ""),
                "type": val.get("type", ""),
            }
        )
    return {"sources": sources}


@router.get("/export/csv")
async def export_csv(
    severity: Optional[str] = Query(None),
    vendor: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    urgency: Optional[str] = Query(None),
    kev_only: bool = Query(False),
):
    """Export advisories as CSV download."""
    engine = get_feed_engine()
    advisories = engine.get_advisories(
        severity=severity,
        vendor=vendor,
        sector=sector,
        urgency_tier=urgency,
        kev_only=kev_only,
    )
    csv_content = engine.export_csv(advisories)
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=gridwolf_advisories.csv"},
    )


@router.post("/refresh")
async def refresh_feed():
    """Refresh feed from external sources (KEV + EPSS enrichment)."""
    engine = get_feed_engine()
    results = await engine.refresh_feed()
    return results


@router.post("/environment")
async def set_environment(config: EnvironmentConfig):
    """Set vendor/sector environment for personalized matching."""
    engine = get_feed_engine()
    return engine.set_environment(config.vendors, config.sectors)


@router.get("/matched")
async def match_session_devices(
    session_id: Optional[str] = Query(None, description="Session ID to match devices from"),
):
    """Auto-match advisories against discovered devices from a PCAP session."""
    engine = get_feed_engine()

    if session_id:
        # Pull real devices from database
        try:
            from app.models.ics import Device
            from sqlalchemy import select

            async with async_session_factory() as session:
                result = await session.execute(
                    select(Device).where(Device.session_id == session_id)
                )
                db_devices = result.scalars().all()
                devices = [
                    {
                        "ip_address": d.ip_address,
                        "vendor": d.vendor,
                        "model": d.model,
                        "device_type": d.device_type,
                        "protocols": d.protocols or [],
                    }
                    for d in db_devices
                ]
        except Exception as e:
            logger.error(f"Error loading session devices: {e}")
            devices = []
    else:
        # Demo: return matches against sample devices
        devices = [
            {
                "ip_address": "10.1.1.10",
                "vendor": "Siemens",
                "model": "S7-1500",
                "device_type": "PLC",
                "protocols": ["s7comm"],
            },
            {
                "ip_address": "10.1.1.20",
                "vendor": "Schneider Electric",
                "model": "Modicon M340",
                "device_type": "PLC",
                "protocols": ["modbus"],
            },
            {
                "ip_address": "10.1.1.30",
                "vendor": "Rockwell Automation",
                "model": "ControlLogix 1756",
                "device_type": "PLC",
                "protocols": ["enip"],
            },
            {
                "ip_address": "10.1.2.1",
                "vendor": "Moxa",
                "model": "EDR-G9010",
                "device_type": "ROUTER",
                "protocols": [],
            },
            {
                "ip_address": "10.1.0.1",
                "vendor": "Fortinet",
                "model": "FortiGate",
                "device_type": "FIREWALL",
                "protocols": [],
            },
        ]

    matches = engine.match_session_devices(devices)
    return {"count": len(matches), "matches": matches}


@router.get("/{advisory_id}")
async def get_advisory(advisory_id: str):
    """Get advisory details with full remediation guidance."""
    engine = get_feed_engine()
    adv = engine.get_advisory_by_id(advisory_id)
    if not adv:
        raise HTTPException(status_code=404, detail="Advisory not found")
    return adv


@router.patch("/{advisory_id}/disposition")
async def update_disposition(advisory_id: str, body: DispositionUpdate):
    """Update advisory disposition (workflow state)."""
    engine = get_feed_engine()
    ok = engine.update_disposition(advisory_id, body.disposition)
    if not ok:
        raise HTTPException(status_code=404, detail="Advisory not found or invalid disposition")
    return {"status": "updated", "advisory_id": advisory_id, "disposition": body.disposition}


@router.post("/{advisory_id}/dismiss")
async def dismiss_advisory(advisory_id: str, body: DismissUpdate):
    """Dismiss or un-dismiss an advisory."""
    engine = get_feed_engine()
    ok = engine.dismiss_advisory(advisory_id, body.dismissed)
    if not ok:
        raise HTTPException(status_code=404, detail="Advisory not found")
    return {"status": "dismissed" if body.dismissed else "restored", "advisory_id": advisory_id}
