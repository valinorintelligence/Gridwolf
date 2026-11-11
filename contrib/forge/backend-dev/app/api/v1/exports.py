"""Structured exports for the Export & STIX page (AUDIT-25).

The stock frontend calls /exports/csv/{assets,connections,findings}, /exports/session, /exports/stix
and /exports/sbom, but the backend had no such routes, so every button failed with a silent 404.

All exports describe one session (the most recent when `session_id` is omitted) and carry the session
id, name and generation time. Values that are not known stay empty/null; nothing is defaulted to zero.
STIX objects carry the observation only: a finding is a passive observation with a confidence value,
not a verified indicator of compromise. No SBOM is produced because passive traffic reveals no
software inventory.
"""
from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.authz import Principal, default_session_id, get_visible_session, require
from app.core.database import get_db
from app.models.ics import Connection, Device, Finding, Session

router = APIRouter(prefix="/exports", tags=["Exports"])

_NS = uuid.UUID("5d6b3f0e-7a52-4c8e-9a41-2b7f1d0c6e11")   # fixed namespace: STIX ids are reproducible
_CSV_FIELDS = {
    "assets": ["ip_address", "mac_address", "hostname", "vendor", "model", "firmware_version", "device_type",
               "purdue_level", "protocols", "open_ports", "confidence", "first_seen", "last_seen", "packet_count"],
    "connections": ["src_ip", "src_port", "dst_ip", "dst_port", "protocol", "transport", "is_ics", "packet_count",
                    "byte_count", "first_seen", "last_seen"],
    "findings": ["severity", "finding_type", "title", "src_ip", "dst_ip", "protocol", "mitre_technique", "cve_id",
                 "cvss_score", "confidence", "status", "created_at", "description"],
}
_MODEL = {"assets": Device, "connections": Connection, "findings": Finding}


def _cell(value) -> str:
    """CSV cell: None stays empty; formula prefixes are neutralised (CSV injection)."""
    if value is None:
        return ""
    if isinstance(value, (list, tuple, dict)):
        value = ";".join(str(v) for v in value) if isinstance(value, (list, tuple)) else str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    text = str(value)
    return "'" + text if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


async def _session(db: AsyncSession, session_id: Optional[str], principal: Principal) -> Session:
    """The requested session if the caller may see it, else the most recent visible one."""
    if session_id:
        return await get_visible_session(db, principal, session_id)
    latest = await default_session_id(db, principal)
    sess = await db.get(Session, latest) if latest else None
    if sess is None:
        raise HTTPException(404, "No analysis session exists yet. Import a capture first.")
    return sess


async def _rows(db: AsyncSession, kind: str, sid: str):
    model = _MODEL[kind]
    return (await db.execute(select(model).where(model.session_id == sid))).scalars().all()


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@router.get("/csv/{kind}")
async def export_csv(kind: str, session_id: Optional[str] = Query(None, max_length=64),
                     db: AsyncSession = Depends(get_db), principal: Principal = Depends(require("export"))):
    if kind not in _CSV_FIELDS:
        raise HTTPException(404, "Unknown export. Use assets, connections or findings.")
    sess = await _session(db, session_id, principal)
    rows = await _rows(db, kind, sess.id)
    out = io.StringIO()
    out.write("# session_id=%s session_name=%s generated=%s\n" % (sess.id, _cell(sess.name), _now()))
    writer = csv.writer(out)
    writer.writerow(_CSV_FIELDS[kind])
    for r in rows:
        writer.writerow([_cell(getattr(r, f, None)) for f in _CSV_FIELDS[kind]])
    return Response(out.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="gridwolf_%s.csv"' % kind})


def _plain(r, fields):
    return {f: (getattr(r, f, None).isoformat() if isinstance(getattr(r, f, None), datetime) else getattr(r, f, None))
            for f in fields}


@router.get("/session")
async def export_session(session_id: Optional[str] = Query(None, max_length=64), db: AsyncSession = Depends(get_db),
                         principal: Principal = Depends(require("export"))):
    sess = await _session(db, session_id, principal)
    body = {"generated": _now(), "generator": "Gridwolf passive analysis",
            "session": {"id": sess.id, "name": sess.name, "status": sess.status,
                        "created_at": sess.created_at.isoformat() if sess.created_at else None},
            "basis": "Derived from imported packet captures; fields not observed are null.",
            "devices": [_plain(r, _CSV_FIELDS["assets"]) for r in await _rows(db, "assets", sess.id)],
            "connections": [_plain(r, _CSV_FIELDS["connections"]) for r in await _rows(db, "connections", sess.id)],
            "findings": [_plain(r, _CSV_FIELDS["findings"] + ["evidence"]) for r in await _rows(db, "findings", sess.id)]}
    return JSONResponse(body, headers={"Content-Disposition": 'attachment; filename="gridwolf_session.json"'})


def _sid(kind: str, key: str) -> str:
    return "%s--%s" % (kind, uuid.uuid5(_NS, key))


@router.get("/stix")
async def export_stix(session_id: Optional[str] = Query(None, max_length=64), db: AsyncSession = Depends(get_db),
                      principal: Principal = Depends(require("export"))):
    """STIX 2.1 bundle of observed addresses and notes. Findings are observations with a confidence value,
    not indicators of compromise, and are labelled as such."""
    sess = await _session(db, session_id, principal)
    ts = _now().replace("Z", ".000Z")
    identity_id = _sid("identity", "gridwolf")
    objects = [{"type": "identity", "spec_version": "2.1", "id": identity_id, "created": ts, "modified": ts,
                "name": "Gridwolf passive analysis", "identity_class": "system"}]
    addrs = {}

    def addr(ip):
        if ip and ip not in addrs:
            addrs[ip] = _sid("ipv%s-addr" % (6 if ":" in ip else 4), ip)
            objects.append({"type": "ipv6-addr" if ":" in ip else "ipv4-addr", "spec_version": "2.1",
                            "id": addrs[ip], "value": ip})
        return addrs.get(ip)

    for d in await _rows(db, "assets", sess.id):
        addr(d.ip_address)
    for f in await _rows(db, "findings", sess.id):
        refs = [r for r in (addr(f.src_ip), addr(f.dst_ip)) if r]
        text = "%s [severity %s, confidence %s%%, status %s]. Passive observation, not a verified indicator." % (
            f.title, f.severity, f.confidence if f.confidence is not None else "unknown", f.status)
        note = {"type": "note", "spec_version": "2.1", "id": _sid("note", f.id), "created": ts, "modified": ts,
                "created_by_ref": identity_id, "content": text,
                "object_refs": refs or [identity_id], "labels": ["passive-observation", f.finding_type]}
        if f.mitre_technique:
            note["external_references"] = [{"source_name": "mitre-ics-attack", "external_id": f.mitre_technique}]
        objects.append(note)
    return JSONResponse({"type": "bundle", "id": _sid("bundle", sess.id + ts), "objects": objects},
                        headers={"Content-Disposition": 'attachment; filename="gridwolf_stix_bundle.json"'})


@router.get("/sbom")
async def export_sbom(principal: Principal = Depends(require("export"))):
    raise HTTPException(501, "SBOM export is not available: passive traffic analysis collects no software "
                             "inventory, so no SBOM can be produced from it.")
