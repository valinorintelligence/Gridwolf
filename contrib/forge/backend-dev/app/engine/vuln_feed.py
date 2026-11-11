"""
ICS/OT Vulnerability Intelligence Feed Engine

Implemented ingestion (the only sources that are actually fetched):
  - CISA Known Exploited Vulnerabilities (KEV) catalogue: advisories are created for entries whose
    vendor is an OT/ICS vendor (OT_VENDOR_KEYWORDS). KEV carries no CVSS: score stays UNKNOWN.
  - EPSS probability from FIRST.org for the CVEs held.

NOT implemented (listed in FEED_SOURCES with `implemented: False`): CISA ICS advisories (CSAF), Siemens,
Schneider, Rockwell, ABB, Moxa and CERT@VDE feeds. Nothing is fetched from them and the UI must not imply
coverage of those vendors' advisories.

Unknown stays unknown: a missing CVSS/EPSS value is None, never 0, and is not turned into a severity or
urgency claim.
"""

from __future__ import annotations

import csv
import io
import json
import logging
import hashlib
import os
import tempfile
from datetime import datetime, timezone, timedelta
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
    cvss_score: Optional[float] = None  # None = not scored by any ingested source
    cvss_vector: str = ""
    severity: str = "unknown"
    # Enrichment fields
    kev_listed: bool = False  # CISA Known Exploited Vulnerability
    kev_due_date: str = ""
    epss_score: Optional[float] = None  # EPSS probability (0-1); None = not fetched
    epss_percentile: Optional[float] = None
    # Triage
    urgency_tier: str = "unscored"  # act_now, plan_patch, monitor, low_risk, unscored
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
        "name": "CISA KEV (Known Exploited Vulnerabilities)",
        "implemented": True,
        "url": "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
        "advisory_url": "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
        "type": "json",
    },
    "siemens": {
        "name": "Siemens ProductCERT",
        "implemented": False,
        "url": "https://cert-portal.siemens.com/productcert/csaf/",
        "advisory_url": "https://cert-portal.siemens.com/productcert/",
        "type": "csaf",
    },
    "schneider": {
        "name": "Schneider Electric",
        "implemented": False,
        "url": "https://download.schneider-electric.com/files?p_Doc_Ref=SEVD",
        "advisory_url": "https://www.se.com/ww/en/work/support/cybersecurity/security-notifications.jsp",
        "type": "html",
    },
    "rockwell": {
        "name": "Rockwell Automation",
        "implemented": False,
        "advisory_url": "https://www.rockwellautomation.com/en-us/trust-center/security-advisories.html",
        "type": "html",
    },
    "abb": {
        "name": "ABB",
        "implemented": False,
        "advisory_url": "https://search.abb.com/library/ABBLibrary.asp?DocumentID=9AKK108466A0327",
        "type": "html",
    },
    "moxa": {
        "name": "Moxa",
        "implemented": False,
        "advisory_url": "https://www.moxa.com/en/support/product-support/security-advisory",
        "type": "html",
    },
    "certvde": {
        "name": "CERT@VDE",
        "implemented": False,
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
# Kept empty: advisories come from refresh_feed() (CISA KEV) and the persistent cache. Do not inline
# demo CVEs here. Air-gapped deployments can pre-seed by populating this list from a reviewed sidecar.

PRELOADED_ADVISORIES: list[dict] = []


# ─── OT vendor heuristic ───────────────────────────────────────
# KEV is a general catalogue. An entry is treated as OT/ICS-relevant when its vendor name matches this
# list. This is a vendor-name heuristic, NOT a product classification: it will include IT products from
# those vendors and exclude OT products from vendors not listed.

import re

OT_VENDOR_RE = re.compile(
    r"\b(siemens|schneider|rockwell|allen-bradley|abb|moxa|honeywell|emerson|yokogawa|mitsubishi|omron|"
    r"phoenix contact|wago|beckhoff|advantech|hitachi energy|ge digital|general electric|fuji electric|"
    r"delta electronics|inductive automation|codesys|aveva|wonderware|schweitzer|red lion|hms networks|"
    r"hirschmann|belden|westermo|ewon|ovarro|bosch rexroth|festo|pilz|johnson controls|tridium|iconics|"
    r"b&r|sielco|moxa|digi international|lantronix|sierra wireless|teltonika)\b",
    re.IGNORECASE,
)

EPSS_BATCH = 80
SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4, "unknown": 5}
DISPOSITIONS = {"new", "not_applicable", "acknowledged", "in_progress", "remediated"}
_ADV_FIELDS = set(Advisory.__dataclass_fields__)


def severity_from_cvss(score: Optional[float]) -> str:
    """CVSS v3 qualitative rating. A missing score is 'unknown', never 'info'."""
    if score is None:
        return "unknown"
    if score >= 9.0:
        return "critical"
    if score >= 7.0:
        return "high"
    if score >= 4.0:
        return "medium"
    if score > 0.0:
        return "low"
    return "info"


def _utcnow() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class VulnFeedEngine:
    """ICS/OT Vulnerability Intelligence Feed Engine (CISA KEV + EPSS are the implemented sources)."""

    def __init__(self, nvd_api_key: Optional[str] = None, cache_file: Optional[str] = None):
        self.nvd_api_key = nvd_api_key
        self._advisories: List[Advisory] = []
        self._kev_cache: Dict[str, dict] = {}
        self._epss_cache: Dict[str, dict] = {}
        self._initialized = False
        self._cache_file = cache_file
        self.last_refresh: Optional[str] = None
        self.source_status: Dict[str, Dict[str, Any]] = {}
        self.persisted = False

    # ─── Persistence ───────────────────────────────────────────

    def _cache_path(self) -> Optional[str]:
        if self._cache_file is not None:
            return self._cache_file or None
        try:
            from app.core.config import settings

            return settings.FEED_CACHE_FILE or None
        except Exception:
            return None

    def _load_preloaded(self):
        """Seed from PRELOADED_ADVISORIES (kept empty) and restore the persistent cache."""
        self._initialized = True
        for adv_data in PRELOADED_ADVISORIES:
            adv = Advisory(**adv_data)
            adv.id = hashlib.md5(adv.cve_id.encode()).hexdigest()[:16]
            self._finalize(adv)
            self._advisories.append(adv)
        path = self._cache_path()
        if not path or not os.path.exists(path):
            return
        try:
            with open(path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
            by_cve = {a.cve_id: a for a in self._advisories}
            for raw in data.get("advisories", []):
                adv = Advisory(**{k: v for k, v in raw.items() if k in _ADV_FIELDS})
                if adv.cve_id in by_cve:
                    self._advisories.remove(by_cve[adv.cve_id])
                self._advisories.append(adv)
            self.last_refresh = data.get("last_refresh")
            self.source_status = data.get("source_status", {})
            self.persisted = True
        except Exception as e:  # a corrupt cache must not take the feed down
            logger.warning("Advisory cache %s unreadable (%s); starting empty", path, e)

    def _save(self):
        path = self._cache_path()
        if not path:
            return
        try:
            os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
            fd, tmp = tempfile.mkstemp(dir=os.path.dirname(os.path.abspath(path)), prefix=".feed-")
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                json.dump(
                    {
                        "version": 1,
                        "last_refresh": self.last_refresh,
                        "source_status": self.source_status,
                        "advisories": [a.to_dict() for a in self._advisories],
                    },
                    fh,
                )
            os.chmod(tmp, 0o600)
            os.replace(tmp, path)
            self.persisted = True
        except Exception as e:
            logger.warning("Advisory cache not persisted (%s): dispositions will not survive a restart", e)

    def _finalize(self, adv: Advisory):
        self._parse_cvss_vector(adv)
        adv.severity = severity_from_cvss(adv.cvss_score)
        adv.urgency_tier = self._compute_urgency_tier(adv)

    # ─── Queries ───────────────────────────────────────────────

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

        cutoff = None
        if days is not None and days > 0:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")

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
            if cutoff and (not adv.published_date or adv.published_date[:10] < cutoff):
                continue  # an advisory with no date cannot be shown as recent
            if search:
                search_lower = search.lower()
                searchable = f"{adv.title} {adv.description} {adv.cve_id} {adv.vendor} {' '.join(adv.products)}".lower()
                if search_lower not in searchable:
                    continue
            results.append(adv.to_dict())

        if sort_by == "newest":
            results.sort(key=lambda x: x.get("published_date", ""), reverse=True)
        elif sort_by == "severity":
            results.sort(key=lambda x: SEVERITY_ORDER.get(x.get("severity", "unknown"), 5))
        elif sort_by == "exploitable":
            results.sort(key=lambda x: (x.get("epss_score") is not None, x.get("epss_score") or 0), reverse=True)

        return results

    def get_advisory_by_id(self, advisory_id: str) -> Optional[Dict[str, Any]]:
        if not self._initialized:
            self._load_preloaded()
        for adv in self._advisories:
            if adv.id == advisory_id or adv.cve_id == advisory_id:
                return adv.to_dict()
        return None

    def get_stats(self) -> Dict[str, Any]:
        """Feed statistics. Averages are over scored advisories only; None when nothing is scored."""
        if not self._initialized:
            self._load_preloaded()

        stats: Dict[str, Any] = {
            "total": len(self._advisories),
            "by_severity": {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0, "unknown": 0},
            "by_urgency": {"act_now": 0, "plan_patch": 0, "monitor": 0, "low_risk": 0, "unscored": 0},
            "by_source": {},
            "by_vendor": {},
            "by_sector": {},
            "kev_count": 0,
            "patch_available_count": 0,
            "avg_cvss": None,
            "avg_epss": None,
            "scored_count": 0,
            "epss_count": 0,
            "populated": bool(self._advisories),
            "last_refresh": self.last_refresh,
            "persisted": self.persisted,
            "source_status": self.source_status,
            "sources_not_implemented": [k for k, v in FEED_SOURCES.items() if not v.get("implemented")],
        }
        cvss, epss = [], []
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
            if adv.cvss_score is not None:
                cvss.append(adv.cvss_score)
            if adv.epss_score is not None:
                epss.append(adv.epss_score)
        stats["scored_count"], stats["epss_count"] = len(cvss), len(epss)
        if cvss:
            stats["avg_cvss"] = round(sum(cvss) / len(cvss), 1)
        if epss:
            stats["avg_epss"] = round(sum(epss) / len(epss), 3)
        return stats

    def update_disposition(self, advisory_id: str, disposition: str) -> bool:
        if not self._initialized:
            self._load_preloaded()
        if disposition not in DISPOSITIONS:
            return False
        for adv in self._advisories:
            if adv.id == advisory_id or adv.cve_id == advisory_id:
                adv.disposition = disposition
                self._save()
                return True
        return False

    def dismiss_advisory(self, advisory_id: str, dismissed: bool = True) -> bool:
        if not self._initialized:
            self._load_preloaded()
        for adv in self._advisories:
            if adv.id == advisory_id or adv.cve_id == advisory_id:
                adv.dismissed = dismissed
                self._save()
                return True
        return False

    def match_session_devices(self, devices: List[dict]) -> List[Dict[str, Any]]:
        """Match advisories to devices on vendor evidence, and product when the device model is known.

        A protocol name appearing in an advisory description is NOT a match. Without a device model
        the result is labelled vendor-level only: passive data rarely identifies product or firmware."""
        if not self._initialized:
            self._load_preloaded()

        matches, seen = [], set()
        for device in devices:
            dev_vendor = (device.get("vendor") or "").strip().lower()
            dev_model = (device.get("model") or "").strip().lower()
            if len(dev_vendor) < 3:
                continue
            for adv in self._advisories:
                adv_vendor = adv.vendor.lower()
                if not adv_vendor or not (dev_vendor in adv_vendor or adv_vendor in dev_vendor):
                    continue
                if dev_model:
                    if not any(dev_model in p.lower() or p.lower() in dev_model for p in adv.products):
                        continue
                    basis = "vendor and product"
                    applicability = "potential: firmware/version not evidenced"
                else:
                    basis = "vendor only"
                    applicability = "vendor-level only: product and firmware not evidenced by passive data"
                key = (device.get("ip_address"), adv.cve_id)
                if key in seen:
                    continue
                seen.add(key)
                matches.append(
                    {
                        "device_ip": device.get("ip_address"),
                        "device_vendor": device.get("vendor"),
                        "device_type": device.get("device_type"),
                        "match_basis": basis,
                        "applicability": applicability,
                        "advisory": adv.to_dict(),
                    }
                )
        return sorted(
            matches,
            key=lambda m: (m["match_basis"] == "vendor and product", m["advisory"]["cvss_score"] is not None, m["advisory"]["cvss_score"] or 0),
            reverse=True,
        )

    # ─── Ingestion ─────────────────────────────────────────────

    def _kev_to_advisory(self, v: dict) -> Advisory:
        vendor = v.get("vendorProject", "")
        sector = ""
        for key, sectors in VENDOR_SECTOR_MAP.items():
            if key in vendor.lower():
                sector = sectors[0]
                break
        cve = v.get("cveID", "")
        adv = Advisory(
            id=hashlib.md5(cve.encode()).hexdigest()[:16],
            cve_id=cve,
            title=v.get("vulnerabilityName") or cve,
            description=v.get("shortDescription", ""),
            source="cisa",
            vendor=vendor,
            products=[v["product"]] if v.get("product") else [],
            kev_listed=True,
            kev_due_date=v.get("dueDate", ""),
            published_date=v.get("dateAdded", ""),
            sector=sector,
            remediation_immediate=v.get("requiredAction", ""),
            references=[f"https://nvd.nist.gov/vuln/detail/{cve}"],
        )
        self._finalize(adv)
        return adv

    def ingest_kev(self, kev_data: dict) -> Dict[str, int]:
        """Create advisories for OT-vendor KEV entries and mark KEV status on existing ones."""
        added = enriched = 0
        by_cve = {a.cve_id: a for a in self._advisories}
        vulns = kev_data.get("vulnerabilities", [])
        for vuln in vulns:
            cve = vuln.get("cveID")
            if not cve:
                continue
            self._kev_cache[cve] = vuln
            existing = by_cve.get(cve)
            if existing:
                existing.kev_listed = True
                existing.kev_due_date = vuln.get("dueDate", "")
                existing.urgency_tier = self._compute_urgency_tier(existing)
                enriched += 1
            elif OT_VENDOR_RE.search(vuln.get("vendorProject", "")):
                adv = self._kev_to_advisory(vuln)
                self._advisories.append(adv)
                by_cve[cve] = adv
                added += 1
        return {"catalog_entries": len(vulns), "ot_advisories_added": added, "kev_enriched": enriched}

    async def refresh_feed(self) -> Dict[str, Any]:
        """Fetch CISA KEV (creating OT-vendor advisories) and EPSS. Failures keep existing data."""
        results: Dict[str, Any] = {"kev_enriched": 0, "epss_enriched": 0, "errors": []}

        if not self._initialized:
            self._load_preloaded()

        if not HTTPX_AVAILABLE:
            results["errors"].append("httpx not installed - install with: pip install httpx")
            return results

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(FEED_SOURCES["cisa"]["url"])
            if resp.status_code != 200:
                raise RuntimeError(f"HTTP {resp.status_code}")
            counts = self.ingest_kev(resp.json())
            results.update(counts)
            self.source_status["cisa_kev"] = {"status": "ok", "fetched_at": _utcnow(), **counts}
        except Exception as e:
            results["errors"].append(f"KEV fetch error: {type(e).__name__}: {e}")
            self.source_status["cisa_kev"] = {"status": "error", "attempted_at": _utcnow(), "error": f"{type(e).__name__}: {e}"}

        cve_ids = [a.cve_id for a in self._advisories if a.cve_id]
        if cve_ids:
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    for i in range(0, len(cve_ids), EPSS_BATCH):
                        resp = await client.get(
                            "https://api.first.org/data/v1/epss", params={"cve": ",".join(cve_ids[i : i + EPSS_BATCH])}
                        )
                        if resp.status_code != 200:
                            raise RuntimeError(f"HTTP {resp.status_code}")
                        for entry in resp.json().get("data", []):
                            self._epss_cache[entry["cve"]] = entry
                for adv in self._advisories:
                    epss = self._epss_cache.get(adv.cve_id)
                    if epss:
                        adv.epss_score = float(epss.get("epss", 0))
                        adv.epss_percentile = float(epss.get("percentile", 0))
                        adv.urgency_tier = self._compute_urgency_tier(adv)
                        results["epss_enriched"] += 1
                self.source_status["epss"] = {"status": "ok", "fetched_at": _utcnow(), "enriched": results["epss_enriched"]}
            except Exception as e:
                results["errors"].append(f"EPSS fetch error: {type(e).__name__}: {e}")
                self.source_status["epss"] = {"status": "error", "attempted_at": _utcnow(), "error": f"{type(e).__name__}: {e}"}

        for key, val in FEED_SOURCES.items():
            if not val.get("implemented"):
                self.source_status[key] = {"status": "not_implemented"}

        if any(v.get("status") == "ok" for v in self.source_status.values()):
            self.last_refresh = _utcnow()
        self._save()
        results["total_advisories"] = len(self._advisories)
        results["source_status"] = self.source_status
        return results

    def set_environment(self, vendors: List[str], sectors: List[str]) -> Dict[str, Any]:
        """Advisories whose vendor or sector is in the supplied lists (empty lists match nothing)."""
        if not self._initialized:
            self._load_preloaded()

        vendors_l = [v.lower() for v in vendors if v.strip()]
        matched = [
            a.to_dict()
            for a in self._advisories
            if any(v in a.vendor.lower() for v in vendors_l) or (sectors and a.sector in sectors)
        ]
        return {
            "vendors": vendors,
            "sectors": sectors,
            "matched_count": len(matched),
            "total_advisories": len(self._advisories),
            "matched_advisories": matched,
        }

    def export_csv(self, advisories: Optional[List[Dict]] = None) -> str:
        """CSV export. Unknown CVSS/EPSS are blank; cells that could execute as spreadsheet formulas
        are prefixed with a quote."""
        if not self._initialized:
            self._load_preloaded()
        if advisories is None:
            advisories = [a.to_dict() for a in self._advisories]

        def cell(v) -> str:
            s = "" if v is None else str(v)
            return "'" + s if s[:1] in ("=", "+", "-", "@", "\t", "\r") else s

        buf = io.StringIO()
        w = csv.writer(buf, lineterminator="\n")
        w.writerow(
            ["CVE ID", "Title", "Severity", "CVSS Score", "Urgency Tier", "KEV Listed", "EPSS Score", "Vendor", "Products",
             "Affected Versions", "Patch Available", "Disposition", "Source", "Sector", "Published Date", "Attack Vector",
             "Remediation (Immediate)"]
        )
        for a in advisories:
            w.writerow(
                [cell(x) for x in (
                    a.get("cve_id"), a.get("title"), a.get("severity"), a.get("cvss_score"), a.get("urgency_tier"),
                    a.get("kev_listed"), a.get("epss_score"), a.get("vendor"), "; ".join(a.get("products", [])),
                    a.get("affected_versions"), a.get("patch_available"), a.get("disposition"), a.get("source"),
                    a.get("sector"), a.get("published_date"), a.get("attack_vector"), a.get("remediation_immediate"),
                )]
            )
        return buf.getvalue()

    # ─── Internal Helpers ──────────────────────────────────────

    @staticmethod
    def _compute_urgency_tier(adv: Advisory) -> str:
        """
          act_now:    KEV listed, or EPSS > 0.10, or CVSS >= 9.0 with a network (or unknown) vector
          plan_patch: CVSS >= 7.0 with a patch available, or CVSS >= 8.0
          monitor:    CVSS >= 4.0
          low_risk:   CVSS < 4.0
          unscored:   no CVSS and no exploitation evidence (unknown is not low risk)
        """
        if adv.kev_listed:
            return "act_now"
        if adv.epss_score is not None and adv.epss_score > 0.10:
            return "act_now"
        if adv.cvss_score is None:
            return "unscored"
        if adv.cvss_score >= 9.0 and adv.attack_vector in ("network", ""):
            return "act_now"
        if adv.cvss_score >= 7.0 and adv.patch_available:
            return "plan_patch"
        if adv.cvss_score >= 8.0:
            return "plan_patch"
        if adv.cvss_score >= 4.0:
            return "monitor"
        return "low_risk"

    @staticmethod
    def _parse_cvss_vector(adv: Advisory):
        """Parse CVSS v3.1 vector string into human-readable components."""
        if not adv.cvss_vector:
            return

        vector = adv.cvss_vector
        if "AV:N" in vector:
            adv.attack_vector = "network"
        elif "AV:A" in vector:
            adv.attack_vector = "adjacent"
        elif "AV:L" in vector:
            adv.attack_vector = "local"
        elif "AV:P" in vector:
            adv.attack_vector = "physical"

        if "PR:N" in vector:
            adv.auth_required = "none"
        elif "PR:L" in vector:
            adv.auth_required = "low"
        elif "PR:H" in vector:
            adv.auth_required = "high"

        if "AC:L" in vector:
            adv.complexity = "low"
        elif "AC:H" in vector:
            adv.complexity = "high"

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
