"""Assessment report generator for passive ICS/SCADA analysis (HTML, PDF when WeasyPrint is installed).

AUDIT-26: the stock generator ignored `report_type` and `sections`, left the protocol table empty,
printed "-%" for unknown confidence, used static boilerplate recommendations and had no statement of
what passive analysis cannot show. This version honours the selected sections, states scope and limits,
derives recommendations only from observed finding types, keeps unknown values as "unknown", and labels
severity with text as well as colour.

`theme` selects a CSS palette ("gridwolf" default, "forge" for the FORGE preview); content is identical.
"""
from __future__ import annotations

import html
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

REPORTS_DIR = Path(os.environ.get("GRIDWOLF_REPORTS_DIR", str(Path(__file__).parent.parent.parent / "reports")))
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
REPORT_SCHEMA = "1"

try:
    from weasyprint import HTML as WeasyHTML

    WEASYPRINT_AVAILABLE = True
except ImportError:
    WEASYPRINT_AVAILABLE = False
    logger.info("WeasyPrint not available. Reports are produced as print-ready HTML.")

REPORT_TYPES = {"full", "executive", "technical", "compliance"}   # "delta" needs a baseline comparison
TYPE_SECTIONS = {
    "executive": ["executive_summary", "recommendations"],
    "full": ["executive_summary", "topology", "devices", "findings", "cves", "recommendations"],
    "technical": ["executive_summary", "topology", "devices", "findings", "cves"],
    "compliance": ["executive_summary", "compliance", "findings"],
}
SECTION_TITLES = {
    "executive_summary": "Executive summary", "topology": "Communication summary", "devices": "Asset inventory",
    "findings": "Findings", "cves": "Potential CVE matches", "compliance": "Compliance status",
    "recommendations": "Recommendations",
}
SEV_ORDER = ["critical", "high", "medium", "low", "info"]
# observed finding type -> recommendation. Only types actually present in the session produce text.
RECOMMENDATION = {
    "write_path": "Confirm that each observed control write or program function was authorised engineering "
                  "activity. Restrict write access to named engineering hosts.",
    "purdue_violation": "Review the cross-level communications and confirm they are permitted by the zone and "
                        "conduit design; enforce the design at the zone boundary.",
    "insecure_service": "Replace or restrict clear-text management services (for example Telnet) and confirm "
                        "which hosts need them.",
    "beacon": "Verify the periodic external communication with the asset owner; passive timing alone does not "
              "establish malicious command-and-control.",
    "dns_exfil": "Review the high-entropy DNS queries with the DNS owner; entropy alone does not establish "
                 "exfiltration.",
    "asymmetric_flow": "Review the one-sided high-volume flow with the asset owner; direction and volume alone "
                       "do not establish data theft.",
    "protocol_anomaly": "Review the protocol exceptions with the device owner; causes include misconfiguration "
                        "as well as probing.",
}
THEMES = {
    "gridwolf": {"ink": "#1a1a2e", "muted": "#4a4a6a", "accent": "#3b82f6", "head_bg": "#1e293b", "head_ink": "#ffffff",
                 "band": "#f8fafc", "rule": "#e2e8f0", "mark": "Gridwolf"},
    "forge": {"ink": "#1F2937", "muted": "#4B5563", "accent": "#005EB8", "head_bg": "#1F2937", "head_ink": "#ffffff",
              "band": "#F3F6FA", "rule": "#D5DDE8", "mark": "FORGE xOT | Gridwolf"},
}
SEV_STYLE = {"critical": ("#8B1A1A", "Critical"), "high": ("#B45309", "High"), "medium": ("#7A5B00", "Medium"),
             "low": ("#1D4E89", "Low"), "info": ("#4B5563", "Info")}


def esc(v: object, empty: str = "unknown") -> str:
    return empty if v is None or v == "" else html.escape(str(v))


def generate_report(session_data: dict, report_type: str = "full", client_name: str = "", assessor_name: str = "",
                    sections: Optional[list[str]] = None, theme: str = "gridwolf") -> dict:
    """Returns {"filepath", "filename", "format": "pdf"|"html", "size"}."""
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in session_data.get("name", "assessment"))[:60]
    body = build_html(session_data, report_type, client_name, assessor_name, sections, theme)
    if WEASYPRINT_AVAILABLE:
        path = REPORTS_DIR / ("gridwolf_%s_%s.pdf" % (safe, stamp))
        try:
            WeasyHTML(string=body).write_pdf(str(path))
            return {"filepath": str(path), "filename": path.name, "format": "pdf", "size": path.stat().st_size}
        except Exception as e:  # noqa: BLE001 - fall back to HTML rather than lose the report
            logger.error("WeasyPrint PDF generation failed: %s", e)
    path = REPORTS_DIR / ("gridwolf_%s_%s.html" % (safe, stamp))
    path.write_text(body, encoding="utf-8")
    return {"filepath": str(path), "filename": path.name, "format": "html", "size": path.stat().st_size}


def _wanted(report_type: str, sections: Optional[list[str]]) -> list[str]:
    base = TYPE_SECTIONS[report_type]
    if not sections or "all" in sections:
        return base
    chosen = set(sections) | {"executive_summary"}
    return [s for s in base if s in chosen]


def build_html(session_data: dict, report_type: str, client_name: str, assessor_name: str,
               sections: Optional[list[str]], theme: str = "gridwolf") -> str:
    if report_type not in REPORT_TYPES:
        raise ValueError("unsupported report type: %s" % report_type)
    t = THEMES.get(theme, THEMES["gridwolf"])
    devices = session_data.get("devices", [])
    conns = session_data.get("connections", [])
    findings = session_data.get("findings", [])
    cves = session_data.get("cve_matches", [])
    want = _wanted(report_type, sections)
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    version = session_data.get("version", "unknown")
    sev_count = {s: len([f for f in findings if (f.get("severity") or "info") == s]) for s in SEV_ORDER}
    unknown_type = len([d for d in devices if (d.get("device_type") or "UNKNOWN").upper() == "UNKNOWN"])
    no_product = len([d for d in devices if not (d.get("vendor") and d.get("model"))])
    period = session_data.get("period") or {}

    def sev_cell(sev):
        colour, label = SEV_STYLE.get(sev, SEV_STYLE["info"])
        return '<span class="sev" style="color:%s;border-color:%s">%s</span>' % (colour, colour, label)

    def table(head, rows, empty):
        if not rows:
            return '<p class="note">%s</p>' % esc(empty)
        return "<table><thead><tr>%s</tr></thead><tbody>%s</tbody></table>" % (
            "".join("<th>%s</th>" % esc(h) for h in head), "".join("<tr>%s</tr>" % r for r in rows))

    out = []
    n = 0

    def section(key, content):
        nonlocal n
        n += 1
        out.append('<section><h2>%d. %s</h2>%s</section>' % (n, SECTION_TITLES[key], content))

    for key in want:
        if key == "executive_summary":
            tiles = "".join('<div class="tile"><div class="v">%s</div><div class="l">%s</div></div>' % (v, l) for v, l in [
                (len(devices), "Devices observed"), (len(conns), "Connections observed"), (len(findings), "Findings"),
                (sev_count["critical"] + sev_count["high"], "Critical or high")])
            if findings:
                tail = "<p>%s.</p>" % ", ".join("%d %s" % (sev_count[s], s) for s in SEV_ORDER if sev_count[s])
            else:
                tail = ("<p>No findings were produced from the analysed captures. This is not an assurance that the "
                        "environment is secure: passive analysis only reports what the captures show.</p>")
            section(key, "<p>This report summarises a passive analysis of imported network captures. Nothing was "
                         "transmitted to the monitored network.</p>" + '<div class="tiles">%s</div>' % tiles + tail)
        elif key == "topology":
            summary = {}
            for c in conns:
                p = c.get("protocol") or "unclassified"
                summary[p] = summary.get(p, 0) + (c.get("packet_count") or 0)
            rows = ["<td>%s</td><td>%s</td>" % (esc(p), "{:,}".format(v)) for p, v in sorted(summary.items(), key=lambda x: -x[1])]
            section(key, "<p>Packets by protocol label (port-based unless the capture confirmed the protocol).</p>" +
                    table(["Protocol", "Packets"], rows, "No connections were observed."))
        elif key == "devices":
            rows = ["<td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td>" % (
                esc(d.get("ip_address")), esc(d.get("hostname")), esc(d.get("vendor")), esc(d.get("device_type")),
                esc(d.get("purdue_level")), esc(", ".join(d.get("protocols") or []), "none observed")) for d in devices]
            section(key, "<p>%d device(s). %d have no established type and %d lack a vendor and model; these are "
                         "shown as unknown, not as unaffected or low risk.</p>" % (len(devices), unknown_type, no_product) +
                    table(["IP address", "Hostname", "Vendor", "Type", "Purdue level", "Protocols"], rows, "No devices observed."))
        elif key == "findings":
            ordered = sorted(findings, key=lambda f: SEV_ORDER.index(f.get("severity")) if f.get("severity") in SEV_ORDER else 9)
            rows = ["<td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td>" % (
                sev_cell(f.get("severity")), esc(f.get("title")), esc(f.get("src_ip")), esc(f.get("dst_ip")),
                esc(f.get("mitre_technique"), "not mapped"),
                ("%s%%" % esc(f.get("confidence")) if f.get("confidence") is not None else "unknown"),
                esc(f.get("status"))) for f in ordered]
            section(key, "<p>Severity is the detector's rating. Confidence (0-100) reflects how strong the passive "
                         "evidence is, not whether an event is malicious. Treat findings as leads to verify.</p>" +
                    table(["Severity", "Finding", "Source", "Target", "ATT&CK for ICS", "Confidence", "Status"], rows,
                          "No findings were produced."))
        elif key == "cves":
            rows = ["<td>%s</td><td>%s</td><td>%s</td><td>%s</td>" % (esc(c.get("device_ip")), esc(c.get("cve_id")),
                                                                    esc(c.get("cvss_score"), "unscored"), "potential")
                    for c in cves]
            curated = session_data.get("curated_cves", 0)
            section(key, "<p>%d of %d device(s) could be assessed (vendor and model known). Matches compare vendor "
                         "and product only; firmware is not compared, so every match is potential. %d curated "
                         "entr%s loaded.</p>" % (len(devices) - no_product, len(devices), curated,
                                                  "y" if curated == 1 else "ies") +
                    table(["Device", "CVE", "CVSS", "Basis"], rows, "No potential matches. Unassessed devices are not cleared."))
        elif key == "compliance":
            section(key, "<p>No compliance score is calculated. Compliance depends on policy, configuration, patching "
                         "and procedure that passive traffic cannot show. Detections that may relate to framework "
                         "requirements are listed under Findings.</p>")
        elif key == "recommendations":
            types = sorted({f.get("finding_type") for f in findings if f.get("finding_type") in RECOMMENDATION})
            items = "".join("<li>%s</li>" % esc(RECOMMENDATION[x]) for x in types)
            section(key, ("<ol>%s</ol>" % items) if items else
                    "<p>No recommendations are generated because no findings were observed. This is not an assurance.</p>")

    scope = ("<section><h2>Scope and limits</h2><ul>"
             "<li>Source: imported packet capture(s); analysis is passive and cannot see devices that did not transmit.</li>"
             "<li>Device identity, vendor and role are inferred from traffic; unknown values stay unknown.</li>"
             "<li>Capture period: %s to %s.</li>"
             "<li>Findings are leads for verification; no finding is a confirmed compromise.</li></ul></section>"
             % (esc(period.get("start")), esc(period.get("end"))))
    css = """
@page { size: A4; margin: 2cm; @bottom-center { content: "%(mark)s - page " counter(page) " of " counter(pages); font-size: 8pt; color: #4B5563; } }
body { font-family: 'Segoe UI', Arial, sans-serif; color: %(ink)s; line-height: 1.5; font-size: 10.5pt; }
.cover { padding: 90px 0 40px; border-top: 8px solid %(accent)s; page-break-after: always; }
.cover h1 { font-size: 26pt; margin: 24px 0 4px; } .cover .sub { color: %(muted)s; font-size: 13pt; }
.cover dl { margin-top: 36px; display: grid; grid-template-columns: 9em 1fr; gap: 4px 12px; font-size: 10pt; }
.cover dt { color: %(muted)s; } .cover dd { margin: 0; }
h2 { border-bottom: 2px solid %(accent)s; padding-bottom: 4px; margin-top: 28px; }
table { width: 100%%; border-collapse: collapse; margin: 12px 0; font-size: 9pt; }
th { background: %(head_bg)s; color: %(head_ink)s; padding: 6px 8px; text-align: left; }
td { padding: 5px 8px; border-bottom: 1px solid %(rule)s; vertical-align: top; overflow-wrap: anywhere; }
tr:nth-child(even) td { background: %(band)s; } thead { display: table-header-group; } tr { page-break-inside: avoid; }
.tiles { display: flex; gap: 10px; margin: 14px 0; } .tile { flex: 1; background: %(band)s; border: 1px solid %(rule)s; padding: 10px; text-align: center; }
.tile .v { font-size: 20pt; font-weight: 700; } .tile .l { font-size: 8.5pt; color: %(muted)s; }
.sev { border: 1px solid; border-radius: 3px; padding: 0 5px; font-weight: 700; font-size: 8.5pt; }
.note { color: %(muted)s; font-style: italic; } .foot { margin-top: 28px; padding-top: 8px; border-top: 1px solid %(rule)s; font-size: 8.5pt; color: %(muted)s; }
""" % t
    cover = ('<div class="cover"><div class="sub">%s</div><h1>ICS/OT Network Security Assessment</h1>'
             '<div class="sub">%s report - passive analysis</div><dl>'
             "<dt>Session</dt><dd>%s</dd><dt>Client</dt><dd>%s</dd><dt>Assessor</dt><dd>%s</dd>"
             "<dt>Capture period</dt><dd>%s to %s</dd><dt>Generated</dt><dd>%s</dd>"
             "<dt>Software</dt><dd>Gridwolf %s, report format %s</dd>%s</dl></div>") % (
        esc(t["mark"]), esc(report_type.title()), esc(session_data.get("name")), esc(client_name, "not stated"),
        esc(assessor_name, "not stated"), esc(period.get("start")), esc(period.get("end")), generated, esc(version),
        REPORT_SCHEMA,
        ("<dt>Classification</dt><dd>%s</dd>" % esc(session_data["classification"]).upper())
        if session_data.get("classification") else "")
    foot = ('<div class="foot">Generated by Gridwolf (passive ICS/OT network discovery and analysis). '
            "Distribution restricted to authorised personnel.</div>")
    return ('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>%s - assessment report</title>'
            '<meta name="generator" content="Gridwolf %s"><style>%s</style></head><body>%s%s%s%s</body></html>') % (
        esc(session_data.get("name")), esc(version), css, cover, "".join(out), scope, foot)
