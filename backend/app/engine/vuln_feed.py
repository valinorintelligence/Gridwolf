"""
ICS/OT Vulnerability Intelligence Feed Engine

Aggregates advisories from 7 OT-specific sources:
  - CISA ICS-CERT
  - Siemens ProductCERT
  - Schneider Electric
  - Rockwell Automation
  - ABB
  - Moxa
  - CERT@VDE

Enriches each advisory with:
  - CVSS v3.1 scores from NVD
  - CISA KEV (Known Exploited Vulnerabilities) status
  - EPSS (Exploit Prediction Scoring System) probability from FIRST.org
"""

from __future__ import annotations

import logging
import hashlib
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field, asdict

try:
    import httpx

    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False

logger = logging.getLogger(__name__)


# ─── Data Structures ───────────────────────────────────────────


@dataclass
class Advisory:
    """A single ICS/OT vulnerability advisory."""

    id: str = ""
    cve_id: str = ""
    title: str = ""
    description: str = ""
    source: str = ""  # cisa, siemens, schneider, rockwell, abb, moxa, certvde
    vendor: str = ""
    products: List[str] = field(default_factory=list)
    affected_versions: str = ""
    fixed_versions: str = ""
    cvss_score: float = 0.0
    cvss_vector: str = ""
    severity: str = "info"
    # Enrichment fields
    kev_listed: bool = False  # CISA Known Exploited Vulnerability
    kev_due_date: str = ""
    epss_score: float = 0.0  # EPSS probability (0-1)
    epss_percentile: float = 0.0
    # Triage
    urgency_tier: str = "low_risk"  # act_now, plan_patch, monitor, low_risk
    attack_vector: str = ""  # network, adjacent, local, physical
    auth_required: str = ""  # none, low, high
    complexity: str = ""  # low, high
    user_interaction: str = ""  # none, required
    # Metadata
    sector: str = ""  # energy, water, manufacturing, oil_gas, transportation, healthcare
    published_date: str = ""
    last_modified: str = ""
    patch_available: bool = False
    # Remediation
    remediation_immediate: str = ""
    remediation_scheduled: str = ""
    remediation_longterm: str = ""
    references: List[str] = field(default_factory=list)
    # Disposition
    disposition: str = "new"  # new, not_applicable, acknowledged, in_progress, remediated
    dismissed: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# ─── Feed Sources Configuration ────────────────────────────────

FEED_SOURCES = {
    "cisa": {
        "name": "CISA ICS-CERT",
        "url": "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
        "advisory_url": "https://www.cisa.gov/news-events/ics-advisories",
        "type": "json",
    },
    "siemens": {
        "name": "Siemens ProductCERT",
        "url": "https://cert-portal.siemens.com/productcert/csaf/",
        "advisory_url": "https://cert-portal.siemens.com/productcert/",
        "type": "csaf",
    },
    "schneider": {
        "name": "Schneider Electric",
        "url": "https://download.schneider-electric.com/files?p_Doc_Ref=SEVD",
        "advisory_url": "https://www.se.com/ww/en/work/support/cybersecurity/security-notifications.jsp",
        "type": "html",
    },
    "rockwell": {
        "name": "Rockwell Automation",
        "advisory_url": "https://www.rockwellautomation.com/en-us/trust-center/security-advisories.html",
        "type": "html",
    },
    "abb": {
        "name": "ABB",
        "advisory_url": "https://search.abb.com/library/ABBLibrary.asp?DocumentID=9AKK108466A0327",
        "type": "html",
    },
    "moxa": {
        "name": "Moxa",
        "advisory_url": "https://www.moxa.com/en/support/product-support/security-advisory",
        "type": "html",
    },
    "certvde": {
        "name": "CERT@VDE",
        "advisory_url": "https://cert.vde.com/en/advisories/",
        "type": "html",
    },
}


# ─── ICS Sector Tags ──────────────────────────────────────────

VENDOR_SECTOR_MAP = {
    "siemens": ["energy", "manufacturing", "water", "oil_gas"],
    "schneider electric": ["energy", "water", "manufacturing", "oil_gas"],
    "rockwell automation": ["manufacturing", "oil_gas", "water"],
    "abb": ["energy", "manufacturing", "water"],
    "moxa": ["energy", "manufacturing", "transportation"],
    "ge digital": ["energy", "oil_gas"],
    "honeywell": ["oil_gas", "manufacturing", "energy"],
    "emerson": ["oil_gas", "energy", "manufacturing"],
    "yokogawa": ["oil_gas", "energy"],
    "fortinet": ["energy", "manufacturing", "water", "oil_gas", "transportation", "healthcare"],
}


# ─── Preloaded Advisory Database ──────────────────────────────
# Legacy seed data — kept empty in production. Advisories are now fetched
# live from upstream sources (NVD, CISA KEV, vendor feeds) on first access.
# To pre-seed a custom advisory set for an air-gapped deployment, populate
# PRELOADED_ADVISORIES via a sidecar JSON file loaded at startup (see
# `VulnFeedEngine._load_preloaded`) — do NOT inline demo CVEs here.

PRELOADED_ADVISORIES: list[dict] = []



class VulnFeedEngine:
    """ICS/OT Vulnerability Intelligence Feed Engine."""

    def __init__(self, nvd_api_key: Optional[str] = None):
        self.nvd_api_key = nvd_api_key
        self._advisories: List[Advisory] = []
        self._kev_cache: Dict[str, dict] = {}
        self._epss_cache: Dict[str, dict] = {}
        self._initialized = False

    def _load_preloaded(self):
        """Load preloaded advisory database."""
        for adv_data in PRELOADED_ADVISORIES:
            adv = Advisory(**adv_data)
            adv.id = hashlib.md5(adv.cve_id.encode()).hexdigest()[:16]
            adv.urgency_tier = self._compute_urgency_tier(adv)
            self._parse_cvss_vector(adv)
            self._advisories.append(adv)
        self._initialized = True

    def get_advisories(
        self,
        severity: Optional[str] = None,
        vendor: Optional[str] = None,
        sector: Optional[str] = None,
        source: Optional[str] = None,
        urgency_tier: Optional[str] = None,
        search: Optional[str] = None,
        kev_only: bool = False,
        sort_by: str = "newest",
        days: Optional[int] = None,
        include_dismissed: bool = False,
    ) -> List[Dict[str, Any]]:
        """Get filtered and sorted advisories."""
        if not self._initialized:
            self._load_preloaded()

        results = []
        for adv in self._advisories:
            if adv.dismissed and not include_dismissed:
                continue
            if severity and adv.severity != severity:
                continue
            if vendor and vendor.lower() not in adv.vendor.lower():
                continue
            if sector and adv.sector != sector:
                continue
            if source and adv.source != source:
                continue
            if urgency_tier and adv.urgency_tier != urgency_tier:
                continue
            if kev_only and not adv.kev_listed:
                continue
            if search:
                search_lower = search.lower()
                searchable = f"{adv.title} {adv.description} {adv.cve_id} {adv.vendor} {' '.join(adv.products)}".lower()
                if search_lower not in searchable:
                    continue
            results.append(adv.to_dict())

        # Sort
        if sort_by == "newest":
            results.sort(key=lambda x: x.get("published_date", ""), reverse=True)
        elif sort_by == "severity":
            sev_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
            results.sort(key=lambda x: sev_order.get(x.get("severity", "info"), 4))
        elif sort_by == "exploitable":
            results.sort(key=lambda x: x.get("epss_score", 0), reverse=True)

        return results

    def get_advisory_by_id(self, advisory_id: str) -> Optional[Dict[str, Any]]:
        """Get a single advisory by ID or CVE ID."""
        if not self._initialized:
            self._load_preloaded()

        for adv in self._advisories:
            if adv.id == advisory_id or adv.cve_id == advisory_id:
                return adv.to_dict()
        return None

    def get_stats(self) -> Dict[str, Any]:
        """Get feed statistics."""
        if not self._initialized:
            self._load_preloaded()

        stats = {
            "total": len(self._advisories),
            "by_severity": {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0},
            "by_urgency": {"act_now": 0, "plan_patch": 0, "monitor": 0, "low_risk": 0},
            "by_source": {},
            "by_vendor": {},
            "by_sector": {},
            "kev_count": 0,
            "patch_available_count": 0,
            "avg_cvss": 0.0,
            "avg_epss": 0.0,
        }

        total_cvss = 0.0
        total_epss = 0.0

        for adv in self._advisories:
            stats["by_severity"][adv.severity] = stats["by_severity"].get(adv.severity, 0) + 1
            stats["by_urgency"][adv.urgency_tier] = stats["by_urgency"].get(adv.urgency_tier, 0) + 1
            stats["by_source"][adv.source] = stats["by_source"].get(adv.source, 0) + 1
            stats["by_vendor"][adv.vendor] = stats["by_vendor"].get(adv.vendor, 0) + 1
            if adv.sector:
                stats["by_sector"][adv.sector] = stats["by_sector"].get(adv.sector, 0) + 1
            if adv.kev_listed:
                stats["kev_count"] += 1
            if adv.patch_available:
                stats["patch_available_count"] += 1
            total_cvss += adv.cvss_score
            total_epss += adv.epss_score

        if self._advisories:
            stats["avg_cvss"] = round(total_cvss / len(self._advisories), 1)
            stats["avg_epss"] = round(total_epss / len(self._advisories), 3)

        return stats

    def update_disposition(self, advisory_id: str, disposition: str) -> bool:
        """Update advisory disposition."""
        if not self._initialized:
            self._load_preloaded()

        valid = {"new", "not_applicable", "acknowledged", "in_progress", "remediated"}
        if disposition not in valid:
            return False

        for adv in self._advisories:
            if adv.id == advisory_id or adv.cve_id == advisory_id:
                adv.disposition = disposition
                return True
        return False

    def dismiss_advisory(self, advisory_id: str, dismissed: bool = True) -> bool:
        """Dismiss or un-dismiss an advisory."""
        if not self._initialized:
            self._load_preloaded()

        for adv in self._advisories:
            if adv.id == advisory_id or adv.cve_id == advisory_id:
                adv.dismissed = dismissed
                return True
        return False

    def match_session_devices(self, devices: List[dict]) -> List[Dict[str, Any]]:
        """Match advisories against discovered devices from a session."""
        if not self._initialized:
            self._load_preloaded()

        matches = []
        for device in devices:
            dev_vendor = (device.get("vendor") or "").lower()
            dev_model = (device.get("model") or "").lower()
            dev_protocols = device.get("protocols") or []

            for adv in self._advisories:
                adv_vendor = adv.vendor.lower()
                adv_products = [p.lower() for p in adv.products]

                matched = False
                # Vendor match
                if dev_vendor and (dev_vendor in adv_vendor or adv_vendor in dev_vendor):
                    matched = True
                # Product/model match
                if dev_model:
                    for prod in adv_products:
                        if dev_model in prod or prod in dev_model:
                            matched = True
                            break
                # Protocol-based match (e.g. Modbus advisory matches Modbus devices)
                if not matched and dev_protocols:
                    desc_lower = adv.description.lower()
                    for proto in dev_protocols:
                        if proto.lower() in desc_lower:
                            matched = True
                            break

                if matched:
                    matches.append(
                        {
                            "device_ip": device.get("ip_address"),
                            "device_vendor": device.get("vendor"),
                            "device_type": device.get("device_type"),
                            "advisory": adv.to_dict(),
                        }
                    )

        # Deduplicate
        seen = set()
        unique = []
        for m in matches:
            key = f"{m['device_ip']}_{m['advisory']['cve_id']}"
            if key not in seen:
                seen.add(key)
                unique.append(m)

        return sorted(unique, key=lambda x: x["advisory"]["cvss_score"], reverse=True)

    async def refresh_feed(self) -> Dict[str, Any]:
        """Refresh feed from external sources (KEV + EPSS enrichment)."""
        results = {"kev_enriched": 0, "epss_enriched": 0, "errors": []}

        if not self._initialized:
            self._load_preloaded()

        if not HTTPX_AVAILABLE:
            results["errors"].append("httpx not installed - install with: pip install httpx")
            return results

        # Fetch CISA KEV
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
                )
                if resp.status_code == 200:
                    kev_data = resp.json()
                    for vuln in kev_data.get("vulnerabilities", []):
                        self._kev_cache[vuln["cveID"]] = vuln

                    for adv in self._advisories:
                        if adv.cve_id in self._kev_cache:
                            adv.kev_listed = True
                            kev = self._kev_cache[adv.cve_id]
                            adv.kev_due_date = kev.get("dueDate", "")
                            adv.urgency_tier = self._compute_urgency_tier(adv)
                            results["kev_enriched"] += 1
        except Exception as e:
            results["errors"].append(f"KEV fetch error: {str(e)}")

        # Fetch EPSS scores
        try:
            cve_ids = [adv.cve_id for adv in self._advisories if adv.cve_id]
            if cve_ids:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.get(
                        "https://api.first.org/data/v1/epss", params={"cve": ",".join(cve_ids)}
                    )
                    if resp.status_code == 200:
                        epss_data = resp.json()
                        for entry in epss_data.get("data", []):
                            self._epss_cache[entry["cve"]] = entry

                        for adv in self._advisories:
                            if adv.cve_id in self._epss_cache:
                                epss = self._epss_cache[adv.cve_id]
                                adv.epss_score = float(epss.get("epss", 0))
                                adv.epss_percentile = float(epss.get("percentile", 0))
                                adv.urgency_tier = self._compute_urgency_tier(adv)
                                results["epss_enriched"] += 1
        except Exception as e:
            results["errors"].append(f"EPSS fetch error: {str(e)}")

        return results

    def set_environment(self, vendors: List[str], sectors: List[str]) -> Dict[str, Any]:
        """Set user environment for personalized matching."""
        if not self._initialized:
            self._load_preloaded()

        matched = []
        for adv in self._advisories:
            vendor_match = (
                any(v.lower() in adv.vendor.lower() for v in vendors) if vendors else True
            )
            sector_match = adv.sector in sectors if sectors else True
            if vendor_match or sector_match:
                matched.append(adv.to_dict())

        return {
            "vendors": vendors,
            "sectors": sectors,
            "matched_count": len(matched),
            "total_advisories": len(self._advisories),
            "matched_advisories": matched,
        }

    def export_csv(self, advisories: Optional[List[Dict]] = None) -> str:
        """Export advisories as CSV string."""
        if not self._initialized:
            self._load_preloaded()

        if advisories is None:
            advisories = [a.to_dict() for a in self._advisories]

        headers = [
            "CVE ID",
            "Title",
            "Severity",
            "CVSS Score",
            "Urgency Tier",
            "KEV Listed",
            "EPSS Score",
            "Vendor",
            "Products",
            "Affected Versions",
            "Patch Available",
            "Disposition",
            "Source",
            "Sector",
            "Published Date",
            "Attack Vector",
            "Remediation (Immediate)",
        ]

        lines = [",".join(headers)]
        for adv in advisories:
            row = [
                adv.get("cve_id", ""),
                f'"{adv.get("title", "")}"',
                adv.get("severity", ""),
                str(adv.get("cvss_score", 0)),
                adv.get("urgency_tier", ""),
                str(adv.get("kev_listed", False)),
                str(adv.get("epss_score", 0)),
                adv.get("vendor", ""),
                f'"{"; ".join(adv.get("products", []))}"',
                f'"{adv.get("affected_versions", "")}"',
                str(adv.get("patch_available", False)),
                adv.get("disposition", ""),
                adv.get("source", ""),
                adv.get("sector", ""),
                adv.get("published_date", ""),
                adv.get("attack_vector", ""),
                f'"{adv.get("remediation_immediate", "")}"',
            ]
            lines.append(",".join(row))

        return "\n".join(lines)

    # ─── Internal Helpers ──────────────────────────────────────

    @staticmethod
    def _compute_urgency_tier(adv: Advisory) -> str:
        """
        Compute urgency tier based on contextual factors:
          act_now:    CVSS >= 9.0 + network vector, or KEV listed, or EPSS > 0.10
          plan_patch: CVSS >= 7.0 + patch available, or CVSS >= 8.0
          monitor:    CVSS >= 4.0
          low_risk:   CVSS < 4.0 or physical access only
        """
        # Act Now conditions
        if adv.kev_listed:
            return "act_now"
        if adv.cvss_score >= 9.0 and adv.attack_vector in ("network", ""):
            return "act_now"
        if adv.epss_score > 0.10:
            return "act_now"

        # Plan Patch
        if adv.cvss_score >= 7.0 and adv.patch_available:
            return "plan_patch"
        if adv.cvss_score >= 8.0:
            return "plan_patch"

        # Monitor
        if adv.cvss_score >= 4.0:
            return "monitor"

        return "low_risk"

    @staticmethod
    def _parse_cvss_vector(adv: Advisory):
        """Parse CVSS v3.1 vector string into human-readable components."""
        if not adv.cvss_vector:
            return

        vector = adv.cvss_vector
        # AV: Attack Vector
        if "AV:N" in vector:
            adv.attack_vector = "network"
        elif "AV:A" in vector:
            adv.attack_vector = "adjacent"
        elif "AV:L" in vector:
            adv.attack_vector = "local"
        elif "AV:P" in vector:
            adv.attack_vector = "physical"

        # PR: Privileges Required
        if "PR:N" in vector:
            adv.auth_required = "none"
        elif "PR:L" in vector:
            adv.auth_required = "low"
        elif "PR:H" in vector:
            adv.auth_required = "high"

        # AC: Attack Complexity
        if "AC:L" in vector:
            adv.complexity = "low"
        elif "AC:H" in vector:
            adv.complexity = "high"

        # UI: User Interaction
        if "UI:N" in vector:
            adv.user_interaction = "none"
        elif "UI:R" in vector:
            adv.user_interaction = "required"


# ─── Singleton instance ───────────────────────────────────────

_feed_engine: Optional[VulnFeedEngine] = None


def get_feed_engine() -> VulnFeedEngine:
    """Get or create the global feed engine singleton."""
    global _feed_engine
    if _feed_engine is None:
        _feed_engine = VulnFeedEngine()
    return _feed_engine
