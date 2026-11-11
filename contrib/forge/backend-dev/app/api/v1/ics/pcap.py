"""
PCAP Upload & Analysis API endpoints.
"""

from __future__ import annotations

import os
import uuid
import asyncio
import logging
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.authz import (Principal, apply_scope, assign_session_site, get_visible_session, require,
                            resolve_new_session_site)
from app.core.database import get_db
from app.models.ics import PcapFile, Session, Device, Connection, Finding
from app.engine.pcap_processor import PcapProcessor

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/pcap", tags=["PCAP Analysis"])

UPLOAD_DIR = Path(__file__).parent.parent.parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_UPLOAD_BYTES = 500 * 1024 * 1024  # matches the frontend proxy limit

MAX_STORED_EVENTS = 20000  # per PCAP; the rest is counted, not stored


def _dt(value):
    """ISO-8601 string to timezone-aware UTC datetime; a value without an offset is taken as UTC (None stays None)."""
    from datetime import datetime, timezone

    if not value:
        return None
    try:
        d = datetime.fromisoformat(value)
    except (TypeError, ValueError):
        return None
    return d.astimezone(timezone.utc) if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _union(a, b):
    out = list(a or [])
    out += [x for x in (b or []) if x not in out]
    return out


async def _merge_results(db, pcap, session_id: str, results: dict):
    """Merge one PCAP's results into the session. Devices are unique per (session, IP), connections
    per flow and findings per (type, title, src, dst): a second PCAP updates them instead of
    failing on the unique index or duplicating rows. Session counts are recomputed, not incremented."""
    from sqlalchemy import func
    from app.models.ics import ProtocolAnalysis

    # Devices
    existing = {d.ip_address: d for d in (await db.execute(select(Device).where(Device.session_id == session_id))).scalars()}
    for dd in results["devices"]:
        dev = existing.get(dd["ip_address"])
        props = dict(dd.get("properties", {}))
        if dev is None:
            dev = Device(
                session_id=session_id,
                ip_address=dd["ip_address"],
                mac_address=dd.get("mac_address"),
                hostname=dd.get("hostname"),
                vendor=dd.get("vendor"),
                device_type=dd.get("device_type", "UNKNOWN"),
                purdue_level=dd.get("purdue_level", "UNKNOWN"),
                protocols=dd.get("protocols", []),
                open_ports=dd.get("open_ports", []),
                confidence=dd.get("confidence", 1),
                packet_count=dd.get("packet_count", 0),
                first_seen=_dt(dd.get("first_seen")),
                last_seen=_dt(dd.get("last_seen")),
                properties=props,
            )
            db.add(dev)
            existing[dd["ip_address"]] = dev
            continue
        dev.mac_address = dev.mac_address or dd.get("mac_address")
        dev.hostname = dev.hostname or dd.get("hostname")
        dev.vendor = dev.vendor or dd.get("vendor")
        dev.protocols = _union(dev.protocols, dd.get("protocols"))
        dev.open_ports = _union(dev.open_ports, dd.get("open_ports"))
        dev.packet_count = (dev.packet_count or 0) + dd.get("packet_count", 0)
        f, l = _dt(dd.get("first_seen")), _dt(dd.get("last_seen"))
        if f and (not dev.first_seen or f < dev.first_seen):
            dev.first_seen = f
        if l and (not dev.last_seen or l > dev.last_seen):
            dev.last_seen = l
        merged = dict(dev.properties or {})
        new_type, new_level = dd.get("device_type", "UNKNOWN"), dd.get("purdue_level", "UNKNOWN")
        if dev.device_type in (None, "UNKNOWN"):
            dev.device_type = new_type
            if new_level != "UNKNOWN" and dev.purdue_level in (None, "UNKNOWN"):
                dev.purdue_level = new_level
            merged.update({k: v for k, v in props.items() if k not in merged})
        elif new_type not in ("UNKNOWN", dev.device_type):
            merged.setdefault("conflicting_classifications", []).append(
                {"device_type": new_type, "purdue_level": new_level, "pcap": pcap.filename}
            )
        dev.properties = merged
        dev.confidence = max(dev.confidence or 1, dd.get("confidence", 1))

    # Connections
    flows = {
        (c.src_ip, c.dst_ip, c.src_port, c.dst_port, c.protocol, c.transport): c
        for c in (await db.execute(select(Connection).where(Connection.session_id == session_id))).scalars()
    }
    for cd in results["connections"]:
        key = (cd["src_ip"], cd["dst_ip"], cd.get("src_port", 0), cd.get("dst_port", 0), cd.get("protocol", "other"), cd.get("transport", "TCP"))
        conn = flows.get(key)
        if conn is None:
            conn = Connection(
                session_id=session_id, src_ip=key[0], dst_ip=key[1], src_port=key[2], dst_port=key[3],
                protocol=key[4], transport=key[5], packet_count=cd.get("packet_count", 0),
                byte_count=cd.get("byte_count", 0), is_ics=cd.get("is_ics", False),
                first_seen=_dt(cd.get("first_seen")), last_seen=_dt(cd.get("last_seen")),
            )
            db.add(conn)
            flows[key] = conn
        else:
            conn.packet_count = (conn.packet_count or 0) + cd.get("packet_count", 0)
            conn.byte_count = (conn.byte_count or 0) + cd.get("byte_count", 0)
            f, l = _dt(cd.get("first_seen")), _dt(cd.get("last_seen"))
            if f and (not conn.first_seen or f < conn.first_seen):
                conn.first_seen = f
            if l and (not conn.last_seen or l > conn.last_seen):
                conn.last_seen = l

    # Findings
    known = {
        (f.finding_type, f.title, f.src_ip, f.dst_ip)
        for f in (await db.execute(select(Finding).where(Finding.session_id == session_id))).scalars()
    }
    for fd in results["findings"]:
        key = (fd.get("finding_type", "custom"), fd.get("title", ""), fd.get("src_ip"), fd.get("dst_ip"))
        if key in known:
            continue
        known.add(key)
        db.add(Finding(
            session_id=session_id, finding_type=key[0], severity=fd.get("severity", "info"), title=key[1],
            description=fd.get("description", ""), src_ip=key[2], dst_ip=key[3], protocol=fd.get("protocol"),
            mitre_technique=fd.get("mitre_technique"), confidence=fd.get("confidence", 50),
            evidence={**fd.get("evidence", {}), "source_pcap": pcap.filename},
        ))

    # Parsed protocol events (capped): the data behind protocol/function-code analysis
    events = results.get("protocol_events", [])
    for ev in events[:MAX_STORED_EVENTS]:
        db.add(ProtocolAnalysis(
            session_id=session_id, protocol=ev.get("protocol", ""), src_ip=ev.get("src_ip"), dst_ip=ev.get("dst_ip"),
            function_code=ev.get("function_code"), function_name=ev.get("function_name"),
            register_address=ev.get("register_address"), register_count=ev.get("register_count"),
            is_write=bool(ev.get("is_write")), is_critical=bool(ev.get("is_critical")),
            details={**(ev.get("details") or {}), "direction": ev.get("direction"), "role": ev.get("role"),
                     "is_exception": ev.get("is_exception"), "exception_name": ev.get("exception_name"),
                     "source_pcap": pcap.filename, "events_in_pcap": len(events)},
            timestamp=_dt(ev.get("timestamp")),
        ))

    await db.flush()
    session = (await db.execute(select(Session).where(Session.id == session_id))).scalar_one_or_none()
    if session:
        for attr, model in (("device_count", Device), ("connection_count", Connection), ("finding_count", Finding)):
            n = (await db.execute(select(func.count()).select_from(model).where(model.session_id == session_id))).scalar_one()
            setattr(session, attr, n)


@router.post("/upload")
async def upload_pcap(
    file: UploadFile = File(...),
    session_id: str = None,
    site_id: str = None,
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require("ingest")),
):
    """Upload a PCAP file for analysis into a session the caller may write (or a new one in a site it holds)."""
    # Authorise before anything is written to disk.
    if session_id:
        await get_visible_session(db, principal, session_id)
        target_site = None
    else:
        target_site = await resolve_new_session_site(db, principal, site_id)
    if not file.filename.endswith((".pcap", ".pcapng", ".cap")):
        raise HTTPException(400, "Invalid file type. Supported: .pcap, .pcapng, .cap")

    # Sanitize filename to prevent path traversal (strip all directory components)
    safe_filename = Path(file.filename).name
    if not safe_filename:
        raise HTTPException(400, "Invalid filename")

    # Stream to disk (a capture can be hundreds of MB); validate the header from the first chunk.
    file_id = str(uuid.uuid4())
    filepath = UPLOAD_DIR / f"{file_id}_{safe_filename}"
    size = 0
    head = b""
    try:
        with open(filepath, "wb") as f:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                if not head:
                    head = chunk[:4]
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(413, f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB upload limit")
                f.write(chunk)
        if size < 24:
            raise HTTPException(400, f"File is too small ({size} bytes) — not a valid capture file")
        valid_magics = {
            b"\xd4\xc3\xb2\xa1",
            b"\xa1\xb2\xc3\xd4",  # pcap LE/BE
            b"\x4d\x3c\xb2\xa1",
            b"\xa1\xb2\x3c\x4d",  # pcap nanosecond
            b"\x0a\x0d\x0d\x0a",  # pcapng
        }
        if head not in valid_magics:
            raise HTTPException(
                400,
                f"Not a valid PCAP/PCAPNG file (got header: {head.hex()}). "
                f"The file may be corrupted. Please re-export from Wireshark.",
            )
    except Exception:
        filepath.unlink(missing_ok=True)
        raise

    # Create session if not provided
    if not session_id:
        session = Session(
            name=f"Analysis - {file.filename}",
            description=f"Auto-created session for {file.filename}",
            status="active",
        )
        db.add(session)
        await db.flush()
        session_id = session.id
        await assign_session_site(db, session_id, target_site, principal.user_id)

    # Create PCAP record
    pcap_record = PcapFile(
        id=file_id,
        session_id=session_id,
        filename=safe_filename,
        filepath=str(filepath),
        file_size=size,
        status="processing",
    )
    db.add(pcap_record)
    await db.commit()

    # Process in background
    if background_tasks:
        background_tasks.add_task(_process_pcap_task, file_id, str(filepath), session_id)

    return {
        "pcap_id": file_id,
        "session_id": session_id,
        "filename": file.filename,
        "file_size": size,
        "status": "processing",
        "message": "PCAP uploaded and processing started",
    }


async def _process_pcap_task(pcap_id: str, filepath: str, session_id: str):
    """Background task to process PCAP file."""
    from app.core.database import async_session_factory

    async with async_session_factory() as db:
        try:
            # Process PCAP — run in thread pool to avoid blocking the
            # async event loop (Scapy parsing is synchronous / CPU-bound).
            # 10-minute hard timeout prevents hung threads on corrupted files.
            processor = PcapProcessor()
            try:
                results = await asyncio.wait_for(
                    asyncio.to_thread(processor.process_file, filepath),
                    timeout=600,
                )
            except asyncio.TimeoutError:
                raise RuntimeError("PCAP processing timed out after 10 minutes")

            # Update PCAP record
            result = await db.execute(select(PcapFile).where(PcapFile.id == pcap_id))
            pcap = result.scalar_one_or_none()
            if not pcap:
                logger.error(f"PCAP record {pcap_id} not found after processing — skipping update")
                return
            pcap.packet_count = results["packet_count"]
            pcap.duration_seconds = results["duration_seconds"]
            pcap.protocol_summary = results["protocol_summary"]
            pcap.start_time = _dt(results.get("start_time"))
            pcap.end_time = _dt(results.get("end_time"))
            pcap.status = "completed"

            await _merge_results(db, pcap, session_id, results)

            await db.commit()
            logger.info(
                f"PCAP {pcap_id} processed: {len(results['devices'])} devices, "
                f"{len(results['connections'])} connections, {len(results['findings'])} findings"
            )

        except Exception as e:
            logger.exception(f"PCAP processing failed for {pcap_id}: {e}")
            result = await db.execute(select(PcapFile).where(PcapFile.id == pcap_id))
            pcap = result.scalar_one_or_none()
            if pcap:
                pcap.status = "failed"
                # Detail goes to the server log; the stored message must not carry paths or library errors.
                pcap.error_message = str(e) if isinstance(e, RuntimeError) else "PCAP processing failed; see the server log"
                await db.commit()


@router.get("/status/{pcap_id}")
async def get_pcap_status(pcap_id: str, db: AsyncSession = Depends(get_db),
                          principal: Principal = Depends(require("view"))):
    """Get PCAP processing status."""
    result = await db.execute(select(PcapFile).where(PcapFile.id == pcap_id))
    pcap = result.scalar_one_or_none()
    if not pcap:
        raise HTTPException(404, "PCAP not found")
    try:
        await get_visible_session(db, principal, pcap.session_id)
    except HTTPException:
        raise HTTPException(404, "PCAP not found")

    return {
        "pcap_id": pcap.id,
        "filename": pcap.filename,
        "status": pcap.status,
        "packet_count": pcap.packet_count,
        "duration_seconds": pcap.duration_seconds,
        "protocol_summary": pcap.protocol_summary,
        "error_message": pcap.error_message,
    }


@router.get("/list")
async def list_pcaps(session_id: str = None, db: AsyncSession = Depends(get_db),
                     principal: Principal = Depends(require("view"))):
    """List PCAP files in the caller's sites, optionally filtered by session."""
    query = apply_scope(select(PcapFile), PcapFile.session_id, principal).order_by(PcapFile.created_at.desc())
    if session_id:
        await get_visible_session(db, principal, session_id)
        query = query.where(PcapFile.session_id == session_id)
    result = await db.execute(query)
    pcaps = result.scalars().all()
    return [
        {
            "pcap_id": p.id,
            "session_id": p.session_id,
            "filename": p.filename,
            "file_size": p.file_size,
            "status": p.status,
            "packet_count": p.packet_count,
            "protocol_summary": p.protocol_summary,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in pcaps
    ]
