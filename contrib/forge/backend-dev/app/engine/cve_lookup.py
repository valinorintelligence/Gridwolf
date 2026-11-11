"""
CVE Lookup Engine: query the NVD API and an operator-curated offline file.

Honesty rules:
- There is NO built-in CVE table. The previous hard-coded "known ICS CVE" list was checked against
  NVD (2026-11-09): three IDs do not exist and most of the rest describe unrelated products (for
  example CVE-2024-3400 is Palo Alto PAN-OS, labelled there as Fortinet FortiOS). It was removed.
- Offline data comes only from an optional curated JSON file (see CURATED_FILE); each entry must
  carry a verifiable source reference.
- A device matches only on vendor AND product. The device TYPE (for example "PLC") is not a
  product. Firmware is not evaluated against affected ranges: a match is "potential".
- A CVE without a CVSS score has an UNKNOWN score and severity, never 0 / "info".
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

# Optional operator-curated offline entries: [{"cve_id","vendor","product","description","cvss_score"|null,
# "affected_versions","references":[...]}]. Missing cvss_score is kept as unknown.
CURATED_FILE = Path(os.environ.get("GRIDWOLF_CVE_FILE", str(CACHE_DIR.parent / "cve_curated.json")))


def _load_curated() -> list[dict]:
    try:
        if not CURATED_FILE.exists():
            return []
        import json

        out = []
        for e in json.loads(CURATED_FILE.read_text(encoding="utf-8")):
            if e.get("cve_id") and e.get("vendor") and e.get("product") and e.get("references"):
                out.append(e)
        return out
    except Exception as exc:
        logger.warning("Curated CVE file unreadable: %s", exc)
        return []


ICS_CVE_DATABASE: list[dict] = _load_curated()

_NVD_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"


class CVELookup:
    """Look up CVEs for discovered devices."""

    def __init__(self, nvd_api_key: Optional[str] = None):
        self.nvd_api_key = nvd_api_key or os.environ.get("NVD_API_KEY")
        self.cache: dict[str, list[dict]] = {}

    def match_device(
        self, vendor: Optional[str], product: Optional[str], firmware: Optional[str] = None
    ) -> list[dict]:
        """Match a device against curated CVEs on vendor AND product. Every match is "potential":
        firmware is recorded but not compared against affected ranges."""
        vendor_l = (vendor or "").strip().lower()
        product_l = (product or "").strip().lower()
        if len(vendor_l) < 3 or len(product_l) < 2:
            return []

        matches = []
        for cve in ICS_CVE_DATABASE:
            cve_vendor = cve["vendor"].lower()
            cve_product = cve["product"].lower()
            if not (vendor_l in cve_vendor or cve_vendor in vendor_l):
                continue
            if not (product_l in cve_product or cve_product in product_l):
                continue
            m = dict(cve)
            m["match_basis"] = "vendor and product"
            m["applicability"] = (
                "potential: device firmware %s not compared with affected versions" % firmware
                if firmware
                else "potential: firmware unknown, applicability not established"
            )
            matches.append(m)
        return matches

    async def search_nvd(self, keyword: str) -> list[dict]:
        return (await self.search_nvd_status(keyword))["cves"]

    async def search_nvd_status(self, keyword: str) -> dict:
        """Search NVD. Returns {cves, source, error}; `source` says where the rows came from and a
        failed NVD call is reported, not silently replaced by unlabeled data."""
        if not HTTPX_AVAILABLE:
            return self._offline_result(keyword, "httpx not installed")
        try:
            headers = {"apiKey": self.nvd_api_key} if self.nvd_api_key else {}
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    _NVD_URL, params={"keywordSearch": keyword, "resultsPerPage": 20}, headers=headers
                )
            if resp.status_code != 200:
                return self._offline_result(keyword, f"NVD returned HTTP {resp.status_code}")
            results = [self._parse_nvd(v.get("cve", {})) for v in resp.json().get("vulnerabilities", [])]
            return {"cves": results, "source": "NVD", "error": None}
        except Exception as e:
            logger.error("NVD API error: %s", e)
            return self._offline_result(keyword, f"{type(e).__name__}: {e}")

    def _offline_result(self, keyword: str, error: str) -> dict:
        return {"cves": self._offline_search(keyword), "source": "offline-curated" if ICS_CVE_DATABASE else "unavailable", "error": error}

    @staticmethod
    def _parse_nvd(cve_data: dict) -> dict:
        metrics = cve_data.get("metrics", {})
        score, version = None, None
        for key, ver in (("cvssMetricV31", "3.1"), ("cvssMetricV40", "4.0"), ("cvssMetricV30", "3.0"), ("cvssMetricV2", "2.0")):
            if metrics.get(key):
                score = metrics[key][0].get("cvssData", {}).get("baseScore")
                version = ver
                break
        desc = next((d.get("value", "") for d in cve_data.get("descriptions", []) if d.get("lang") == "en"), "")
        return {
            "cve_id": cve_data.get("id", ""),
            "description": desc,
            "cvss_score": score,
            "cvss_version": version,
            "severity": CVELookup._cvss_to_severity(score),
            "vendor": None,
            "product": None,
            "published": cve_data.get("published"),
            "references": [r.get("url", "") for r in cve_data.get("references", [])[:3]],
        }

    def _offline_search(self, keyword: str) -> list[dict]:
        keyword_lower = keyword.lower()
        return [
            cve
            for cve in ICS_CVE_DATABASE
            if keyword_lower in cve["vendor"].lower()
            or keyword_lower in cve["product"].lower()
            or keyword_lower in cve.get("description", "").lower()
        ]

    @staticmethod
    def _cvss_to_severity(score: Optional[float]) -> str:
        if score is None:
            return "unknown"
        if score >= 9.0:
            return "critical"
        elif score >= 7.0:
            return "high"
        elif score >= 4.0:
            return "medium"
        elif score > 0:
            return "low"
        return "info"
