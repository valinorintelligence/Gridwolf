"""
Scanner result parsers for importing security findings into Gridwolf.
Each parser returns a list of dicts with keys: title, properties, severity, status.
"""

from typing import Any


def parse_semgrep(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Parse Semgrep JSON output into Gridwolf object format."""
    results = []
    for finding in data.get("results", []):
        severity_map = {
            "ERROR": "critical",
            "WARNING": "high",
            "INFO": "medium",
        }
        raw_severity = finding.get("extra", {}).get("severity", "INFO")
        results.append({
            "title": finding.get("check_id", "Unknown finding"),
            "severity": severity_map.get(raw_severity, "low"),
            "status": "open",
            "properties": {
                "source": "semgrep",
                "check_id": finding.get("check_id"),
                "path": finding.get("path"),
                "start_line": finding.get("start", {}).get("line"),
                "end_line": finding.get("end", {}).get("line"),
                "message": finding.get("extra", {}).get("message", ""),
                "metadata": finding.get("extra", {}).get("metadata", {}),
            },
        })
    return results


def parse_trivy(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Parse Trivy JSON output into Gridwolf object format."""
    results = []
    for target_result in data.get("Results", []):
        target_name = target_result.get("Target", "unknown")
        for vuln in target_result.get("Vulnerabilities", []):
            severity_map = {
                "CRITICAL": "critical",
                "HIGH": "high",
                "MEDIUM": "medium",
                "LOW": "low",
                "UNKNOWN": "info",
            }
            results.append({
                "title": f"{vuln.get('VulnerabilityID', 'Unknown')} - {vuln.get('PkgName', '')}",
                "severity": severity_map.get(vuln.get("Severity", "UNKNOWN"), "info"),
                "status": "open",
                "properties": {
                    "source": "trivy",
                    "vulnerability_id": vuln.get("VulnerabilityID"),
                    "pkg_name": vuln.get("PkgName"),
                    "installed_version": vuln.get("InstalledVersion"),
                    "fixed_version": vuln.get("FixedVersion"),
                    "target": target_name,
                    "title": vuln.get("Title", ""),
                    "description": vuln.get("Description", ""),
                    "references": vuln.get("References", []),
                },
            })
    return results


def parse_sarif(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Parse SARIF v2.1.0 JSON output into Gridwolf object format."""
    results = []
    for run in data.get("runs", []):
        tool_name = run.get("tool", {}).get("driver", {}).get("name", "unknown")
        rules = {}
        for rule in run.get("tool", {}).get("driver", {}).get("rules", []):
            rules[rule.get("id", "")] = rule

        for result in run.get("results", []):
            rule_id = result.get("ruleId", "unknown")
            level = result.get("level", "note")
            severity_map = {
                "error": "critical",
                "warning": "high",
                "note": "medium",
                "none": "low",
            }

            locations = result.get("locations", [])
            location_info = {}
            if locations:
                phys = locations[0].get("physicalLocation", {})
                location_info = {
                    "path": phys.get("artifactLocation", {}).get("uri", ""),
                    "start_line": phys.get("region", {}).get("startLine"),
                    "end_line": phys.get("region", {}).get("endLine"),
                }

            results.append({
                "title": f"{rule_id}: {result.get('message', {}).get('text', 'No message')}",
                "severity": severity_map.get(level, "medium"),
                "status": "open",
                "properties": {
                    "source": "sarif",
                    "tool": tool_name,
                    "rule_id": rule_id,
                    **location_info,
                    "rule_description": rules.get(rule_id, {})
                    .get("shortDescription", {})
                    .get("text", ""),
                },
            })
    return results


def parse_generic(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Parse a generic JSON format into Gridwolf object format.

    Expected input format:
    {
        "findings": [
            {
                "title": "...",
                "severity": "critical|high|medium|low|info",
                "status": "open|closed|in_progress",
                "properties": { ... }
            }
        ]
    }
    """
    results = []
    findings = data.get("findings", data.get("results", data.get("items", [])))
    if isinstance(findings, list):
        for finding in findings:
            results.append({
                "title": finding.get("title", finding.get("name", "Untitled finding")),
                "severity": finding.get("severity", "medium"),
                "status": finding.get("status", "open"),
                "properties": finding.get("properties", finding.get("metadata", {})),
            })
    return results
