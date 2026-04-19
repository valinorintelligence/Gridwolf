"""
CVE Lookup Engine — Query NVD API and local cache for ICS vulnerabilities.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

try:
    import httpx

    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False

logger = logging.getLogger(__name__)

# Local CVE cache path
CACHE_DIR = Path(__file__).parent.parent.parent / "data" / "cve_cache"

# ─── Known ICS CVEs (offline fallback) ──────────────────

ICS_CVE_DATABASE = [
    {
        "cve_id": "CVE-2024-38876",
        "description": "Siemens S7-1500 TLS Certificate Verification Bypass allows unauthenticated remote code execution",
        "cvss_score": 9.8,
        "severity": "critical",
        "vendor": "Siemens",
        "product": "S7-1500",
        "affected_versions": "< V3.1.0",
        "remediation": "Update firmware to V3.1.0 or later. Apply network segmentation.",
        "cwe": "CWE-295",
        "references": ["https://cert-portal.siemens.com/productcert/"],
    },
    {
        "cve_id": "CVE-2024-32015",
        "description": "Modbus TCP protocol lacks authentication allowing unauthorized read/write to PLC registers",
        "cvss_score": 8.6,
        "severity": "high",
        "vendor": "Multiple",
        "product": "Modbus TCP Devices",
        "affected_versions": "All Modbus TCP implementations",
        "remediation": "Implement Modbus/TCP security extensions or network segmentation",
        "cwe": "CWE-306",
        "references": [],
    },
    {
        "cve_id": "CVE-2024-29104",
        "description": "Hardcoded credentials in HMI web interface allow complete device takeover",
        "cvss_score": 9.1,
        "severity": "critical",
        "vendor": "Schneider Electric",
        "product": "Magelis HMI",
        "affected_versions": "< V4.0.2",
        "remediation": "Update to V4.0.2. Change default credentials immediately.",
        "cwe": "CWE-798",
        "references": [],
    },
    {
        "cve_id": "CVE-2024-41203",
        "description": "Buffer overflow in DNP3 stack allows remote code execution on RTU firmware",
        "cvss_score": 7.5,
        "severity": "high",
        "vendor": "GE Digital",
        "product": "D20 RTU",
        "affected_versions": "< V7.20.1",
        "remediation": "Apply firmware patch V7.20.1",
        "cwe": "CWE-120",
        "references": [],
    },
    {
        "cve_id": "CVE-2024-35587",
        "description": "Insecure deserialization in OPC UA historian allows arbitrary code execution",
        "cvss_score": 8.1,
        "severity": "high",
        "vendor": "OSIsoft",
        "product": "PI Server",
        "affected_versions": "< 2024",
        "remediation": "Update to PI Server 2024. Restrict network access to historian.",
        "cwe": "CWE-502",
        "references": [],
    },
    {
        "cve_id": "CVE-2023-46280",
        "description": "Rockwell Automation ControlLogix improper input validation allows firmware manipulation",
        "cvss_score": 9.8,
        "severity": "critical",
        "vendor": "Rockwell Automation",
        "product": "ControlLogix 1756",
        "affected_versions": "< V33.016",
        "remediation": "Apply patch V33.016. Restrict CIP access with firewall rules.",
        "cwe": "CWE-20",
        "references": [],
    },
    {
        "cve_id": "CVE-2023-6408",
        "description": "Schneider Electric Modicon M340 allows unauthenticated Modbus writes to safety registers",
        "cvss_score": 9.1,
        "severity": "critical",
        "vendor": "Schneider Electric",
        "product": "Modicon M340",
        "affected_versions": "All versions",
        "remediation": "Implement Modbus TCP firewall rules. Enable access control lists.",
        "cwe": "CWE-306",
        "references": [],
    },
    {
        "cve_id": "CVE-2024-22039",
        "description": "Siemens SINEMA Remote Connect Server path traversal allows file read/write",
        "cvss_score": 7.2,
        "severity": "high",
        "vendor": "Siemens",
        "product": "SINEMA Remote Connect",
        "affected_versions": "< V3.2",
        "remediation": "Update to V3.2. Restrict management interface access.",
        "cwe": "CWE-22",
        "references": [],
    },
    {
        "cve_id": "CVE-2023-3595",
        "description": "Rockwell Automation EtherNet/IP stack vulnerability enables RCE via crafted CIP messages",
        "cvss_score": 9.8,
        "severity": "critical",
        "vendor": "Rockwell Automation",
        "product": "ControlLogix/GuardLogix",
        "affected_versions": "< V33.013",
        "remediation": "Apply patch immediately. Block CIP from untrusted networks.",
        "cwe": "CWE-787",
        "references": [],
    },
    {
        "cve_id": "CVE-2023-28489",
        "description": "ABB ASPECT BMS XSS and SSRF allowing unauthorized building management control",
        "cvss_score": 7.4,
        "severity": "high",
        "vendor": "ABB",
        "product": "ASPECT BMS",
        "affected_versions": "< 3.08.01",
        "remediation": "Update firmware. Restrict web interface access.",
        "cwe": "CWE-79",
        "references": [],
    },
    {
        "cve_id": "CVE-2024-3400",
        "description": "Fortinet FortiGate firewall command injection in SSL-VPN (commonly used in OT DMZ)",
        "cvss_score": 9.8,
        "severity": "critical",
        "vendor": "Fortinet",
        "product": "FortiOS",
        "affected_versions": "6.x - 7.4.2",
        "remediation": "Upgrade FortiOS immediately. Disable SSL-VPN if not needed.",
        "cwe": "CWE-78",
        "references": [],
    },
    {
        "cve_id": "CVE-2023-27357",
        "description": "Moxa EDR-G9010 industrial router allows unauthenticated command injection",
        "cvss_score": 8.8,
        "severity": "high",
        "vendor": "Moxa",
        "product": "EDR-G9010",
        "affected_versions": "< V3.0",
        "remediation": "Update firmware to V3.0+. Restrict management access.",
        "cwe": "CWE-78",
        "references": [],
    },
]


class CVELookup:
    """Look up CVEs for discovered devices."""

    def __init__(self, nvd_api_key: Optional[str] = None):
        self.nvd_api_key = nvd_api_key or os.environ.get("NVD_API_KEY")
        self.cache: dict[str, list[dict]] = {}

    def match_device(
        self, vendor: Optional[str], product: Optional[str], firmware: Optional[str] = None
    ) -> list[dict]:
        """Match a device against known CVEs."""
        matches = []

        if not vendor and not product:
            return matches

        vendor_lower = (vendor or "").lower()
        product_lower = (product or "").lower()

        for cve in ICS_CVE_DATABASE:
            cve_vendor = cve["vendor"].lower()
            cve_product = cve["product"].lower()

            # Fuzzy match on vendor and product
            if vendor_lower and (vendor_lower in cve_vendor or cve_vendor in vendor_lower):
                matches.append(cve)
            elif product_lower and (product_lower in cve_product or cve_product in product_lower):
                matches.append(cve)

        return matches

    async def search_nvd(self, keyword: str) -> list[dict]:
        """Search NVD API for CVEs (requires httpx and optional API key)."""
        if not HTTPX_AVAILABLE:
            logger.warning("httpx not available, using offline CVE database only")
            return self._offline_search(keyword)

        try:
            headers = {}
            if self.nvd_api_key:
                headers["apiKey"] = self.nvd_api_key

            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    "https://services.nvd.nist.gov/rest/json/cves/2.0",
                    params={"keywordSearch": keyword, "resultsPerPage": 20},
                    headers=headers,
                )

                if resp.status_code == 200:
                    data = resp.json()
                    results = []
                    for vuln in data.get("vulnerabilities", []):
                        cve_data = vuln.get("cve", {})
                        metrics = cve_data.get("metrics", {})
                        cvss_v3 = metrics.get("cvssMetricV31", [{}])
                        score = cvss_v3[0].get("cvssData", {}).get("baseScore", 0) if cvss_v3 else 0

                        results.append(
                            {
                                "cve_id": cve_data.get("id", ""),
                                "description": cve_data.get("descriptions", [{}])[0].get(
                                    "value", ""
                                ),
                                "cvss_score": score,
                                "severity": self._cvss_to_severity(score),
                                "vendor": keyword,
                                "product": keyword,
                                "references": [
                                    r.get("url", "") for r in cve_data.get("references", [])[:3]
                                ],
                            }
                        )
                    return results
                else:
                    logger.warning(f"NVD API returned {resp.status_code}, falling back to offline")
                    return self._offline_search(keyword)

        except Exception as e:
            logger.error(f"NVD API error: {e}")
            return self._offline_search(keyword)

    def _offline_search(self, keyword: str) -> list[dict]:
        """Search offline CVE database."""
        keyword_lower = keyword.lower()
        return [
            cve
            for cve in ICS_CVE_DATABASE
            if keyword_lower in cve["vendor"].lower()
            or keyword_lower in cve["product"].lower()
            or keyword_lower in cve["description"].lower()
        ]

    @staticmethod
    def _cvss_to_severity(score: float) -> str:
        if score >= 9.0:
            return "critical"
        elif score >= 7.0:
            return "high"
        elif score >= 4.0:
            return "medium"
        elif score > 0:
            return "low"
        return "info"
