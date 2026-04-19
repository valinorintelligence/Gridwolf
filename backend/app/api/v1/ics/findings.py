"""Security Findings, CVE Lookup, and Report Generation API endpoints."""

from __future__ import annotations

import os
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, field_validator
from typing import Optional, Literal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.ics import Finding, Device, Connection, Session, Report
from app.engine.cve_lookup import CVELookup
from app.engine.report_generator import generate_report

router = APIRouter(prefix="/findings", tags=["Findings & Reports"])
cve_engine = CVELookup()


@router.get("/")
async def list_findings(
    session_id: str = None,
    severity: str = None,
    finding_type: str = None,
    status: str = None,
    limit: int = Query(default=500, ge=1, le=5000),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List security findings with filters."""
    query = select(Finding).order_by(Finding.created_at.desc())
    if session_id:
        query = query.where(Finding.session_id == session_id)
    if severity:
        query = query.where(Finding.severity == severity)
    if finding_type:
        query = query.where(Finding.finding_type == finding_type)
    if status:
        query = query.where(Finding.status == status)

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    findings = result.scalars().all()

    return [
        {
            "id": f.id,
            "session_id": f.session_id,
            "finding_type": f.finding_type,
            "severity": f.severity,
            "title": f.title,
            "description": f.description,
            "src_ip": f.src_ip,
            "dst_ip": f.dst_ip,
            "protocol": f.protocol,
            "mitre_technique": f.mitre_technique,
            "cve_id": f.cve_id,
            "cvss_score": f.cvss_score,
            "confidence": f.confidence,
            "remediation": f.remediation,
            "status": f.status,
            "evidence": f.evidence,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        }
        for f in findings
    ]


@router.get("/stats")
async def finding_stats(session_id: str = None, db: AsyncSession = Depends(get_db)):
    """Get finding statistics."""
    query = select(Finding)
    if session_id:
        query = query.where(Finding.session_id == session_id)

    result = await db.execute(query)
    findings = result.scalars().all()

    severity_counts = {}
    type_counts = {}
    for f in findings:
        severity_counts[f.severity] = severity_counts.get(f.severity, 0) + 1
        type_counts[f.finding_type] = type_counts.get(f.finding_type, 0) + 1

    return {
        "total": len(findings),
        "by_severity": severity_counts,
        "by_type": type_counts,
        "open": len([f for f in findings if f.status == "open"]),
        "investigating": len([f for f in findings if f.status == "investigating"]),
        "resolved": len([f for f in findings if f.status == "resolved"]),
    }


@router.patch("/{finding_id}/status")
async def update_finding_status(
    finding_id: str,
    status: str = Query(..., regex="^(open|investigating|resolved|false_positive)$"),
    db: AsyncSession = Depends(get_db),
):
    """Update finding status."""
    result = await db.execute(select(Finding).where(Finding.id == finding_id))
    finding = result.scalar_one_or_none()
    if not finding:
        raise HTTPException(404, "Finding not found")
    finding.status = status
    await db.commit()
    return {"id": finding.id, "status": finding.status}


# ─── CVE Lookup ─────────────────────────────────────────


@router.get("/cve/search")
async def search_cves(keyword: str = Query(..., min_length=2)):
    """Search for CVEs by keyword (vendor, product, etc.)."""
    results = await cve_engine.search_nvd(keyword)
    return {"keyword": keyword, "count": len(results), "cves": results}


@router.get("/cve/match-devices")
async def match_device_cves(session_id: str, db: AsyncSession = Depends(get_db)):
    """Match all devices in a session against known CVEs."""
    result = await db.execute(select(Device).where(Device.session_id == session_id))
    devices = result.scalars().all()

    matches = []
    for dev in devices:
        device_cves = cve_engine.match_device(
            dev.vendor, dev.model or dev.device_type, dev.firmware_version
        )
        if device_cves:
            matches.append(
                {
                    "device_ip": dev.ip_address,
                    "device_vendor": dev.vendor,
                    "device_type": dev.device_type,
                    "cves": device_cves,
                }
            )

    return {"session_id": session_id, "devices_checked": len(devices), "matches": matches}


# ─── Report Generation ──────────────────────────────────


class ReportRequest(BaseModel):
    session_id: str
    report_type: Literal["full", "executive", "technical", "compliance", "delta"] = "full"
    client_name: Optional[str] = ""
    assessor_name: Optional[str] = ""
    sections: Optional[list[str]] = None

    @field_validator("sections")
    @classmethod
    def validate_sections(cls, v):
        if v is None:
            return v
        valid = {
            "all",
            "executive_summary",
            "devices",
            "topology",
            "findings",
            "cves",
            "compliance",
            "recommendations",
        }
        invalid = [s for s in v if s not in valid]
        if invalid:
            raise ValueError(f"Invalid sections: {invalid}. Valid: {sorted(valid)}")
        return v


@router.post("/reports/generate")
async def generate_assessment_report(req: ReportRequest, db: AsyncSession = Depends(get_db)):
    """Generate a PDF/HTML assessment report."""
    # Get session data
    result = await db.execute(select(Session).where(Session.id == req.session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")

    # Get devices
    dev_result = await db.execute(select(Device).where(Device.session_id == req.session_id))
    devices = dev_result.scalars().all()

    # Get connections
    conn_result = await db.execute(
        select(Connection).where(Connection.session_id == req.session_id)
    )
    connections = conn_result.scalars().all()

    # Get findings
    find_result = await db.execute(select(Finding).where(Finding.session_id == req.session_id))
    findings = find_result.scalars().all()

    # Build session data dict
    session_data = {
        "name": session.name,
        "devices": [
            {
                "ip_address": d.ip_address,
                "hostname": d.hostname,
                "vendor": d.vendor,
                "device_type": d.device_type,
                "purdue_level": d.purdue_level,
                "protocols": d.protocols or [],
            }
            for d in devices
        ],
        "connections": [
            {
                "src_ip": c.src_ip,
                "dst_ip": c.dst_ip,
                "protocol": c.protocol,
                "packet_count": c.packet_count,
            }
            for c in connections
        ],
        "findings": [
            {
                "severity": f.severity,
                "title": f.title,
                "src_ip": f.src_ip,
                "dst_ip": f.dst_ip,
                "protocol": f.protocol,
                "confidence": f.confidence,
            }
            for f in findings
        ],
        "protocol_summary": {},
    }

    # Generate report
    report_result = generate_report(
        session_data=session_data,
        report_type=req.report_type,
        client_name=req.client_name,
        assessor_name=req.assessor_name,
        sections=req.sections,
    )

    # Save report record
    report_record = Report(
        session_id=req.session_id,
        name=f"{req.report_type.title()} Report - {session.name}",
        report_type=req.report_type,
        format=report_result["format"],
        filepath=report_result["filepath"],
        file_size=report_result["size"],
        client_name=req.client_name,
        assessor_name=req.assessor_name,
        sections=req.sections or ["all"],
        status="completed",
    )
    db.add(report_record)
    await db.commit()

    return {
        "report_id": report_record.id,
        "filename": report_result["filename"],
        "format": report_result["format"],
        "size": report_result["size"],
        "download_url": f"/api/v1/ics/findings/reports/{report_record.id}/download",
    }


@router.get("/reports/{report_id}/download")
async def download_report(report_id: str, db: AsyncSession = Depends(get_db)):
    """Download a generated report."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(404, "Report not found")
    if not os.path.exists(report.filepath):
        raise HTTPException(404, "Report file not found on disk")

    media_type = "application/pdf" if report.format == "pdf" else "text/html"
    return FileResponse(
        report.filepath, media_type=media_type, filename=os.path.basename(report.filepath)
    )


@router.get("/reports/list")
async def list_reports(session_id: str = None, db: AsyncSession = Depends(get_db)):
    """List generated reports."""
    query = select(Report).order_by(Report.created_at.desc())
    if session_id:
        query = query.where(Report.session_id == session_id)
    result = await db.execute(query)
    reports = result.scalars().all()

    return [
        {
            "id": r.id,
            "name": r.name,
            "report_type": r.report_type,
            "format": r.format,
            "file_size": r.file_size,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "download_url": f"/api/v1/ics/findings/reports/{r.id}/download",
        }
        for r in reports
    ]
