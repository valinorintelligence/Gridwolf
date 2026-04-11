from __future__ import annotations
"""
PCAP Upload & Analysis API endpoints.
"""

import os
import uuid
import asyncio
import logging
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.ics import PcapFile, Session, Device, Connection, Finding, ProtocolAnalysis
from app.engine.pcap_processor import PcapProcessor

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/pcap", tags=["PCAP Analysis"])

UPLOAD_DIR = Path(__file__).parent.parent.parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


@router.post("/upload")
async def upload_pcap(
    file: UploadFile = File(...),
    session_id: str = None,
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
):
    """Upload a PCAP file for analysis."""
    if not file.filename.endswith((".pcap", ".pcapng", ".cap")):
        raise HTTPException(400, "Invalid file type. Supported: .pcap, .pcapng, .cap")

    # Read file content and validate before saving
    content = await file.read()

    if len(content) < 24:
        raise HTTPException(400, f"File is too small ({len(content)} bytes) — not a valid capture file")

    # Validate magic bytes
    magic = content[:4]
    valid_magics = {
        b'\xd4\xc3\xb2\xa1', b'\xa1\xb2\xc3\xd4',  # pcap LE/BE
        b'\x4d\x3c\xb2\xa1', b'\xa1\xb2\x3c\x4d',  # pcap nanosecond
        b'\x0a\x0d\x0d\x0a',                          # pcapng
    }
    if magic not in valid_magics:
        raise HTTPException(
            400,
            f"Not a valid PCAP/PCAPNG file (got header: {magic.hex()}). "
            f"The file may be corrupted. Please re-export from Wireshark.",
        )

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
    else:
        result = await db.execute(select(Session).where(Session.id == session_id))
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(404, f"Session {session_id} not found")

    # Save validated file
    file_id = str(uuid.uuid4())
    filepath = UPLOAD_DIR / f"{file_id}_{file.filename}"

    with open(filepath, "wb") as f:
        f.write(content)

    # Verify the saved file matches what we received
    saved_size = os.path.getsize(filepath)
    if saved_size != len(content):
        logger.error(f"File size mismatch: received {len(content)}, saved {saved_size}")
        raise HTTPException(500, "File save verification failed — disk may be full")

    # Create PCAP record
    pcap_record = PcapFile(
        id=file_id,
        session_id=session_id,
        filename=file.filename,
        filepath=str(filepath),
        file_size=len(content),
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
        "file_size": len(content),
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
            processor = PcapProcessor()
            results = await asyncio.to_thread(processor.process_file, filepath)

            # Update PCAP record
            result = await db.execute(select(PcapFile).where(PcapFile.id == pcap_id))
            pcap = result.scalar_one()
            pcap.packet_count = results["packet_count"]
            pcap.duration_seconds = results["duration_seconds"]
            pcap.protocol_summary = results["protocol_summary"]
            pcap.status = "completed"

            # Store discovered devices
            for dev_data in results["devices"]:
                device = Device(
                    session_id=session_id,
                    ip_address=dev_data["ip_address"],
                    mac_address=dev_data.get("mac_address"),
                    hostname=dev_data.get("hostname"),
                    vendor=dev_data.get("vendor"),
                    device_type=dev_data.get("device_type", "UNKNOWN"),
                    purdue_level=dev_data.get("purdue_level", "UNKNOWN"),
                    protocols=dev_data.get("protocols", []),
                    open_ports=dev_data.get("open_ports", []),
                    confidence=dev_data.get("confidence", 1),
                    packet_count=dev_data.get("packet_count", 0),
                    properties=dev_data.get("properties", {}),
                )
                db.add(device)

            # Store connections
            for conn_data in results["connections"]:
                conn = Connection(
                    session_id=session_id,
                    src_ip=conn_data["src_ip"],
                    dst_ip=conn_data["dst_ip"],
                    src_port=conn_data.get("src_port", 0),
                    dst_port=conn_data.get("dst_port", 0),
                    protocol=conn_data.get("protocol", "other"),
                    transport=conn_data.get("transport", "TCP"),
                    packet_count=conn_data.get("packet_count", 0),
                    byte_count=conn_data.get("byte_count", 0),
                    is_ics=conn_data.get("is_ics", False),
                )
                db.add(conn)

            # Store findings
            for finding_data in results["findings"]:
                finding = Finding(
                    session_id=session_id,
                    finding_type=finding_data.get("finding_type", "custom"),
                    severity=finding_data.get("severity", "info"),
                    title=finding_data.get("title", ""),
                    description=finding_data.get("description", ""),
                    src_ip=finding_data.get("src_ip"),
                    dst_ip=finding_data.get("dst_ip"),
                    protocol=finding_data.get("protocol"),
                    mitre_technique=finding_data.get("mitre_technique"),
                    confidence=finding_data.get("confidence", 50),
                    evidence=finding_data.get("evidence", {}),
                )
                db.add(finding)

            # Update session counts
            result = await db.execute(select(Session).where(Session.id == session_id))
            session = result.scalar_one()
            session.device_count = len(results["devices"])
            session.connection_count = len(results["connections"])
            session.finding_count = len(results["findings"])

            await db.commit()
            logger.info(f"PCAP {pcap_id} processed: {len(results['devices'])} devices, "
                       f"{len(results['connections'])} connections, {len(results['findings'])} findings")

        except Exception as e:
            logger.error(f"PCAP processing failed for {pcap_id}: {e}")
            result = await db.execute(select(PcapFile).where(PcapFile.id == pcap_id))
            pcap = result.scalar_one_or_none()
            if pcap:
                pcap.status = "failed"
                pcap.error_message = str(e)
                await db.commit()


@router.get("/status/{pcap_id}")
async def get_pcap_status(pcap_id: str, db: AsyncSession = Depends(get_db)):
    """Get PCAP processing status."""
    result = await db.execute(select(PcapFile).where(PcapFile.id == pcap_id))
    pcap = result.scalar_one_or_none()
    if not pcap:
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
async def list_pcaps(session_id: str = None, db: AsyncSession = Depends(get_db)):
    """List all PCAP files, optionally filtered by session."""
    query = select(PcapFile).order_by(PcapFile.created_at.desc())
    if session_id:
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
