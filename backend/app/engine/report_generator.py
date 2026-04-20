"""
PDF Report Generator for ICS/SCADA Security Assessments.

Generates professional PDF reports using HTML templates + WeasyPrint,
with fallback to simple HTML if WeasyPrint is not available.
"""

from __future__ import annotations

import html
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

REPORTS_DIR = Path(__file__).parent.parent.parent / "reports"
REPORTS_DIR.mkdir(exist_ok=True)

try:
    from weasyprint import HTML as WeasyHTML

    WEASYPRINT_AVAILABLE = True
except ImportError:
    WEASYPRINT_AVAILABLE = False
    logger.info("WeasyPrint not available. PDF export will use HTML fallback.")


def generate_report(
    session_data: dict,
    report_type: str = "full",
    client_name: str = "",
    assessor_name: str = "",
    sections: Optional[list[str]] = None,
) -> dict:
    """
    Generate an assessment report.

    Returns: {"filepath": str, "format": "pdf"|"html", "size": int}
    """
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    session_name = session_data.get("name", "assessment").replace(" ", "_")

    # Build HTML content
    html_content = _build_html_report(
        session_data=session_data,
        report_type=report_type,
        client_name=client_name,
        assessor_name=assessor_name,
        sections=sections or ["all"],
    )

    if WEASYPRINT_AVAILABLE:
        filename = f"gridwolf_{session_name}_{timestamp}.pdf"
        filepath = REPORTS_DIR / filename
        try:
            WeasyHTML(string=html_content).write_pdf(str(filepath))
            return {
                "filepath": str(filepath),
                "filename": filename,
                "format": "pdf",
                "size": os.path.getsize(filepath),
            }
        except Exception as e:
            logger.error(f"WeasyPrint PDF generation failed: {e}")

    # Fallback to HTML
    filename = f"gridwolf_{session_name}_{timestamp}.html"
    filepath = REPORTS_DIR / filename
    filepath.write_text(html_content, encoding="utf-8")
    return {
        "filepath": str(filepath),
        "filename": filename,
        "format": "html",
        "size": os.path.getsize(filepath),
    }


def _build_html_report(
    session_data: dict, report_type: str, client_name: str, assessor_name: str, sections: list[str]
) -> str:
    """Build HTML report content."""
    devices = session_data.get("devices", [])
    connections = session_data.get("connections", [])
    findings = session_data.get("findings", [])
    protocol_summary = session_data.get("protocol_summary", {})
    now = datetime.now(timezone.utc).strftime("%B %d, %Y")

    critical_count = len([f for f in findings if f.get("severity") == "critical"])
    high_count = len([f for f in findings if f.get("severity") == "high"])
    medium_count = len([f for f in findings if f.get("severity") == "medium"])

    def esc(v: object) -> str:
        """HTML-escape any value to prevent XSS in generated reports."""
        return html.escape(str(v)) if v is not None else "-"

    # Build findings HTML
    findings_rows = ""
    for f in sorted(
        findings,
        key=lambda x: {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}.get(
            x.get("severity", "info"), 5
        ),
    ):
        sev = f.get("severity", "info")
        sev_color = {
            "critical": "#ef4444",
            "high": "#f97316",
            "medium": "#eab308",
            "low": "#3b82f6",
        }.get(sev, "#6b7280")
        findings_rows += f"""
        <tr>
            <td style="color:{sev_color};font-weight:bold;text-transform:uppercase">{esc(sev)}</td>
            <td>{esc(f.get("title", ""))}</td>
            <td>{esc(f.get("src_ip", "-"))}</td>
            <td>{esc(f.get("dst_ip", "-"))}</td>
            <td>{esc(f.get("protocol", "-"))}</td>
            <td>{esc(f.get("confidence", "-"))}%</td>
        </tr>"""

    # Build devices HTML
    devices_rows = ""
    for d in devices:
        devices_rows += f"""
        <tr>
            <td>{esc(d.get("ip_address", ""))}</td>
            <td>{esc(d.get("hostname", "-"))}</td>
            <td>{esc(d.get("vendor", "-"))}</td>
            <td>{esc(d.get("device_type", "-"))}</td>
            <td>{esc(d.get("purdue_level", "-"))}</td>
            <td>{esc(", ".join(d.get("protocols", [])))}</td>
        </tr>"""

    # NOTE: variable name must NOT shadow the top-level `html` module,
    # otherwise `esc()` above (which calls `html.escape`) resolves `html`
    # to this local and raises NameError at call time.
    html_doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Gridwolf Assessment Report</title>
    <style>
        @page {{ size: A4; margin: 2cm; }}
        body {{ font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; line-height: 1.6; font-size: 11pt; }}
        .cover {{ text-align: center; padding: 120px 40px; page-break-after: always; }}
        .cover h1 {{ font-size: 28pt; color: #1a1a2e; margin-bottom: 8px; }}
        .cover .subtitle {{ font-size: 14pt; color: #4a4a6a; margin-bottom: 40px; }}
        .cover .confidential {{ color: #ef4444; font-weight: bold; border: 2px solid #ef4444; padding: 8px 24px; display: inline-block; margin-top: 40px; }}
        .cover .meta {{ font-size: 10pt; color: #6b7280; margin-top: 20px; }}
        h2 {{ color: #1a1a2e; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; margin-top: 30px; }}
        h3 {{ color: #4a4a6a; }}
        table {{ width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 9pt; }}
        th {{ background: #1e293b; color: white; padding: 8px 10px; text-align: left; }}
        td {{ padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }}
        tr:nth-child(even) {{ background: #f8fafc; }}
        .stat-box {{ display: inline-block; width: 22%; padding: 16px; margin: 1%; background: #f1f5f9; border-radius: 8px; text-align: center; }}
        .stat-box .value {{ font-size: 24pt; font-weight: bold; }}
        .stat-box .label {{ font-size: 9pt; color: #6b7280; }}
        .critical {{ color: #ef4444; }} .high {{ color: #f97316; }} .medium {{ color: #eab308; }}
        .footer {{ text-align: center; font-size: 8pt; color: #9ca3af; margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; }}
    </style>
</head>
<body>
    <div class="cover">
        <h1>🛡 Gridwolf</h1>
        <div class="subtitle">ICS/SCADA Network Security Assessment Report</div>
        <hr style="border:1px solid #e5e7eb;width:60%;margin:20px auto">
        <div class="meta">
            <p><strong>Report Type:</strong> {esc(report_type.replace("_", " ").title())}</p>
            <p><strong>Client:</strong> {esc(client_name) if client_name else "N/A"}</p>
            <p><strong>Assessor:</strong> {esc(assessor_name) if assessor_name else "N/A"}</p>
            <p><strong>Date:</strong> {esc(now)}</p>
            <p><strong>Session:</strong> {esc(session_data.get("name", "N/A"))}</p>
        </div>
        <div class="confidential">CONFIDENTIAL</div>
    </div>

    <h2>1. Executive Summary</h2>
    <p>This report presents findings from a passive network security assessment of the ICS/SCADA environment.
    Gridwolf analyzed network traffic to identify devices, map communications, and detect security risks
    without transmitting any packets to the monitored network.</p>

    <div style="text-align:center;margin:24px 0">
        <div class="stat-box"><div class="value">{
        len(devices)
    }</div><div class="label">Devices Found</div></div>
        <div class="stat-box"><div class="value">{
        len(connections)
    }</div><div class="label">Connections</div></div>
        <div class="stat-box"><div class="value">{
        len(findings)
    }</div><div class="label">Findings</div></div>
        <div class="stat-box"><div class="value critical">{
        critical_count
    }</div><div class="label">Critical</div></div>
    </div>

    <h3>Risk Summary</h3>
    <ul>
        <li><span class="critical"><strong>{
        critical_count
    } Critical</strong></span> findings requiring immediate attention</li>
        <li><span class="high"><strong>{high_count} High</strong></span> severity findings</li>
        <li><span class="medium"><strong>{
        medium_count
    } Medium</strong></span> severity findings</li>
    </ul>

    <h2>2. Discovered Devices</h2>
    <p>{len(devices)} devices identified through passive traffic analysis.</p>
    <table>
        <thead><tr><th>IP Address</th><th>Hostname</th><th>Vendor</th><th>Type</th><th>Purdue</th><th>Protocols</th></tr></thead>
        <tbody>{devices_rows}</tbody>
    </table>

    <h2>3. Protocol Analysis</h2>
    <p>Protocols observed in network traffic:</p>
    <table>
        <thead><tr><th>Protocol</th><th>Packet Count</th></tr></thead>
        <tbody>{
        "".join(
            f"<tr><td>{p}</td><td>{c:,}</td></tr>"
            for p, c in sorted(protocol_summary.items(), key=lambda x: x[1], reverse=True)
        )
    }</tbody>
    </table>

    <h2>4. Security Findings</h2>
    <p>{len(findings)} security findings identified.</p>
    <table>
        <thead><tr><th>Severity</th><th>Finding</th><th>Source</th><th>Target</th><th>Protocol</th><th>Confidence</th></tr></thead>
        <tbody>{findings_rows}</tbody>
    </table>

    <h2>5. Recommendations</h2>
    <ol>
        <li><strong>Network Segmentation:</strong> Enforce Purdue model zone boundaries with firewalls and unidirectional gateways.</li>
        <li><strong>Access Control:</strong> Implement RBAC for all ICS protocol access. Disable default credentials.</li>
        <li><strong>Monitoring:</strong> Deploy continuous passive monitoring with ICS-aware IDS rules.</li>
        <li><strong>Patch Management:</strong> Address critical CVEs on PLCs, RTUs, and HMIs per vendor advisories.</li>
        <li><strong>Authentication:</strong> Enable authentication on Modbus, S7comm, and EtherNet/IP where supported.</li>
    </ol>

    <div class="footer">
        Generated by Gridwolf v0.9.7 — Passive ICS/SCADA Network Discovery &amp; Topology Visualization<br>
        This document is confidential. Distribution restricted to authorized personnel only.
    </div>
</body>
</html>"""

    return html_doc
