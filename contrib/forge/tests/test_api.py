"""API regression tests for the Gridwolf dev fork: authentication, registration gate, multi-PCAP
merge, advisory feed honesty and CVE matching (synthetic data, isolated SQLite, no network).
"""
import asyncio
import json
import os
import sys
import tempfile
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
TMP = tempfile.mkdtemp(prefix="gw-api-test-")
os.environ.update(
    GRIDWOLF_DATABASE_URL=os.environ.get("GW_TEST_DATABASE_URL") or f"sqlite+aiosqlite:///{TMP}/t.db",
    GRIDWOLF_SECRET_KEY="test-only-key",
    GRIDWOLF_ADMIN_PASSWORD="Test-Admin-Password-1!",
    GRIDWOLF_FEED_CACHE_FILE=f"{TMP}/feed.json",
    GRIDWOLF_UPLOAD_DIR=f"{TMP}/uploads",
    GRIDWOLF_DEBUG="false",
    GRIDWOLF_COOKIE_SECURE="false",          # httpx talks plain http to the ASGI app
)
sys.path.insert(0, str(HERE))
sys.path.insert(0, os.environ.get("GW_BACKEND_DIR", str(HERE.parent / "backend-dev")))

import pgpool  # noqa: E402,F401
import httpx  # noqa: E402
import synth  # noqa: E402
from app.main import app  # noqa: E402

BASE = "http://test"


def run(coro):
    async def wrapper():
        async with app.router.lifespan_context(app):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=BASE) as c:
                return await coro(c)

    async def one_loop():
        try:
            return await wrapper()
        finally:                      # pooled PostgreSQL connections belong to this event loop
            from app.core.database import engine
            await engine.dispose()

    return asyncio.run(one_loop())


async def login(c):
    r = await c.post("/api/v1/auth/login", json={"username": "admin", "password": "Test-Admin-Password-1!"})
    assert r.status_code == 200, r.text
    assert "access_token" not in r.json()      # sessions are HttpOnly cookies, not bearer tokens
    return {"X-CSRF-Token": r.json()["csrf_token"]}   # the cookie jar stays on the client


PROTECTED = [
    "/api/v1/ics/findings/stats", "/api/v1/ics/devices/stats", "/api/v1/ics/devices/", "/api/v1/ics/sessions/",
    "/api/v1/ics/pcap/list", "/api/v1/ics/advisories/stats", "/api/v1/ics/findings/cve/search?keyword=siemens",
    "/api/v1/forge/overview", "/api/v1/forge/live", "/api/v1/dashboard/stats",
]


def test_ics_and_forge_routes_require_token():  # AUDIT-12 all ICS/forge routes were open
    async def go(c):
        for p in PROTECTED:
            r = await c.get(p)
            assert r.status_code in (401, 403), (p, r.status_code)
        for method, p in (("POST", "/api/v1/ics/pcap/upload"), ("POST", "/api/v1/ics/advisories/refresh"),
                          ("DELETE", "/api/v1/ics/sessions/x"), ("PATCH", "/api/v1/ics/findings/x/status"),
                          ("POST", "/api/v1/ics/findings/reports/generate")):
            r = await c.request(method, p)
            assert r.status_code in (401, 403), (method, p, r.status_code)

    run(go)


def test_self_registration_disabled_by_default():  # AUDIT-13 open /auth/register minted tokens
    async def go(c):
        r = await c.post("/api/v1/auth/register", json={"username": "intruder", "email": "i@example.com",
                                                        "password": "Abcdef12345!", "full_name": "x"})
        assert r.status_code in (404, 405), r.text      # the route no longer exists
        r = await c.post("/api/v1/auth/login", json={"username": "intruder", "password": "Abcdef12345!"})
        assert r.status_code == 401

    run(go)


def test_login_and_authenticated_read():
    async def go(c):
        h = await login(c)
        assert (await c.get("/api/v1/auth/me", headers=h)).json()["username"] == "admin"
        assert (await c.get("/api/v1/ics/devices/stats", headers=h)).status_code == 200
        assert (await c.get("/api/v1/ics/pcap/list", headers=h)).status_code == 200

    run(go)


def test_second_pcap_merges_into_same_session():  # AUDIT-14 unique (session, ip) index failed the task
    pcap = Path(TMP) / "synthetic-ot.pcap"
    synth.build(str(pcap))
    data = pcap.read_bytes()

    async def go(c):
        h = await login(c)
        ids = []
        sid = None
        for _ in range(2):
            r = await c.post("/api/v1/ics/pcap/upload" + (f"?session_id={sid}" if sid else ""),
                             files={"file": ("synthetic-ot.pcap", data, "application/vnd.tcpdump.pcap")}, headers=h)
            assert r.status_code == 200, r.text
            sid = r.json()["session_id"]
            ids.append(r.json()["pcap_id"])
            for _ in range(60):
                st = (await c.get(f"/api/v1/ics/pcap/status/{ids[-1]}", headers=h)).json()
                if st["status"] in ("completed", "failed"):
                    break
                await asyncio.sleep(0.5)
            assert st["status"] == "completed", st
        devs = (await c.get(f"/api/v1/ics/devices/?session_id={sid}", headers=h)).json()
        devs = devs["devices"] if isinstance(devs, dict) else devs
        ips = [d["ip_address"] for d in devs]
        assert len(ips) == len(set(ips)) == 6
        ses = [s for s in (await c.get("/api/v1/ics/sessions/", headers=h)).json() if s["id"] == sid][0]
        assert ses["device_count"] == 6  # recomputed, not 12
        finds = (await c.get(f"/api/v1/ics/findings/?session_id={sid}", headers=h)).json()
        finds = finds["findings"] if isinstance(finds, dict) else finds
        titles = [(f["finding_type"], f["title"]) for f in finds]
        assert len(titles) == len(set(titles))  # re-upload does not duplicate findings
        assert ses["finding_count"] == len(finds)
        plc = [d for d in devs if d["ip_address"] == "10.10.1.20"][0]
        assert plc["device_type"] == "PLC"

    run(go)


def test_invalid_upload_rejected_without_session():
    async def go(c):
        h = await login(c)
        before = len((await c.get("/api/v1/ics/sessions/", headers=h)).json())
        r = await c.post("/api/v1/ics/pcap/upload", files={"file": ("bad.pcap", b"not a capture" * 10, "x")}, headers=h)
        assert r.status_code == 400
        assert len((await c.get("/api/v1/ics/sessions/", headers=h)).json()) == before

    run(go)


# ── Advisory feed / CVE (engine level, no network) ───────────

def kev(cve, vendor, product, **kw):
    return {"cveID": cve, "vendorProject": vendor, "product": product, "vulnerabilityName": f"{vendor} {product} flaw",
            "shortDescription": "desc", "dateAdded": "2024-05-01", "dueDate": "2024-05-22", "requiredAction": "Apply updates.", **kw}


def test_kev_ingest_creates_only_ot_vendor_advisories_and_keeps_unknown_unknown(tmp_path):  # AUDIT-15 feed never populated
    from app.engine.vuln_feed import VulnFeedEngine

    e = VulnFeedEngine(cache_file=str(tmp_path / "c.json"))
    counts = e.ingest_kev({"vulnerabilities": [kev("CVE-2024-0001", "Siemens", "SIMATIC S7-1500"),
                                               kev("CVE-2024-0002", "Palo Alto Networks", "PAN-OS"),
                                               kev("CVE-2024-0003", "Rockwell Automation", "ControlLogix")]})
    assert counts["ot_advisories_added"] == 2 and counts["catalog_entries"] == 3
    a = e.get_advisory_by_id("CVE-2024-0001")
    assert a["cvss_score"] is None and a["severity"] == "unknown" and a["epss_score"] is None
    assert a["kev_listed"] and a["urgency_tier"] == "act_now"  # exploitation evidence, not a score
    s = e.get_stats()
    assert s["avg_cvss"] is None and s["scored_count"] == 0 and s["by_severity"]["unknown"] == 2


def test_unscored_without_kev_is_not_low_risk():
    from app.engine.vuln_feed import Advisory, VulnFeedEngine

    assert VulnFeedEngine._compute_urgency_tier(Advisory(cve_id="CVE-X")) == "unscored"


def test_disposition_and_refresh_status_survive_restart(tmp_path):  # AUDIT-16 state lost on restart
    from app.engine.vuln_feed import VulnFeedEngine

    f = str(tmp_path / "c.json")
    e = VulnFeedEngine(cache_file=f)
    e.ingest_kev({"vulnerabilities": [kev("CVE-2024-0001", "Siemens", "S7-1500")]})
    e.last_refresh = "2026-01-01T00:00:00Z"
    assert e.update_disposition("CVE-2024-0001", "acknowledged")
    e2 = VulnFeedEngine(cache_file=f)
    assert e2.get_advisory_by_id("CVE-2024-0001")["disposition"] == "acknowledged"
    assert e2.get_stats()["last_refresh"] == "2026-01-01T00:00:00Z" and e2.get_stats()["populated"]
    assert (os.stat(f).st_mode & 0o777) == 0o600


def test_device_match_requires_vendor_and_labels_basis(tmp_path):  # AUDIT-17 protocol-in-description false positives
    from app.engine.vuln_feed import VulnFeedEngine

    e = VulnFeedEngine(cache_file="")
    e.ingest_kev({"vulnerabilities": [kev("CVE-2024-0001", "Siemens", "SIMATIC S7-1500",
                                          shortDescription="Modbus TCP handling flaw")]})
    devs = [{"ip_address": "10.0.0.1", "vendor": "Siemens", "model": None, "protocols": []},
            {"ip_address": "10.0.0.2", "vendor": "Schneider", "model": None, "protocols": ["modbus"]},
            {"ip_address": "10.0.0.3", "vendor": "Siemens", "model": "LOGO", "protocols": []}]
    m = e.match_session_devices(devs)
    assert [x["device_ip"] for x in m] == ["10.0.0.1"]  # protocol name in description is not a match; wrong product excluded
    assert m[0]["match_basis"] == "vendor only" and "not evidenced" in m[0]["applicability"]


def test_csv_export_escapes_and_blanks_unknown(tmp_path):
    from app.engine.vuln_feed import VulnFeedEngine

    e = VulnFeedEngine(cache_file="")
    e.ingest_kev({"vulnerabilities": [kev("CVE-2024-0001", "Siemens", "S7", vulnerabilityName='=HYPERLINK("x"),"quoted"')]})
    out = e.export_csv()
    assert "'=HYPERLINK" in out and ",,unknown" not in out.splitlines()[0]
    row = out.splitlines()[1]
    assert ",unknown,," in row  # severity unknown, CVSS blank (not 0)


def test_days_filter_excludes_undated_and_old():
    from app.engine.vuln_feed import VulnFeedEngine

    e = VulnFeedEngine(cache_file="")
    e.ingest_kev({"vulnerabilities": [kev("CVE-2020-0001", "Siemens", "A", dateAdded="2020-01-01"),
                                      kev("CVE-2020-0002", "Siemens", "B", dateAdded="")]})
    assert e.get_advisories(days=30) == [] and len(e.get_advisories()) == 2


def test_cve_matching_needs_vendor_and_product_and_unknown_score_stays_unknown():  # AUDIT-18 / AUDIT-19
    from app.engine import cve_lookup as cl

    cl.ICS_CVE_DATABASE[:] = [{"cve_id": "CVE-0000-0001", "vendor": "Siemens", "product": "S7-1500",
                               "description": "d", "references": ["https://example.invalid/x"]}]
    L = cl.CVELookup()
    assert L.match_device("Siemens", None) == []            # vendor only: not a product match
    assert L.match_device("Siemens", "PLC") == []           # a device type is not a product
    assert L.match_device("Rockwell", "S7-1500") == []      # product string alone is not enough
    m = L.match_device("Siemens", "S7-1500")
    assert len(m) == 1 and "firmware unknown" in m[0]["applicability"]
    assert cl.CVELookup._cvss_to_severity(None) == "unknown"
    assert cl.CVELookup._parse_nvd({"id": "CVE-1", "descriptions": [{"lang": "en", "value": "d"}]})["cvss_score"] is None
    cl.ICS_CVE_DATABASE.clear()


def test_no_builtin_cve_table():  # AUDIT-18 12 hard-coded entries were not verifiable against NVD
    import importlib.util
    from app.engine import cve_lookup as cl

    # fresh copy of the module: other tests mutate the shared table, which made this check order-dependent
    spec = importlib.util.spec_from_file_location("cve_lookup_fresh", cl.__file__)
    fresh = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(fresh)
    assert fresh.ICS_CVE_DATABASE == [] or all(e.get("references") for e in fresh.ICS_CVE_DATABASE)
    assert "CVE-2024-32015" not in json.dumps(fresh.ICS_CVE_DATABASE)


async def _upload_synth(c, h):
    pcap = Path(TMP) / "synthetic-ot-exp.pcap"
    synth.build(str(pcap))
    r = await c.post("/api/v1/ics/pcap/upload", files={"file": ("synthetic-ot.pcap", pcap.read_bytes(),
                     "application/vnd.tcpdump.pcap")}, headers=h)
    assert r.status_code == 200, r.text
    for _ in range(60):
        st = (await c.get("/api/v1/ics/pcap/status/%s" % r.json()["pcap_id"], headers=h)).json()
        if st["status"] in ("completed", "failed"):
            break
        await asyncio.sleep(0.5)
    assert st["status"] == "completed", st
    return r.json()["session_id"]


def test_export_routes_exist_and_are_honest():  # AUDIT-25 Export Hub called routes that did not exist
    async def go(c):
        for p in ("/api/v1/exports/csv/assets", "/api/v1/exports/session", "/api/v1/exports/stix", "/api/v1/exports/sbom"):
            assert (await c.get(p)).status_code in (401, 403), p          # authenticated only
        h = await login(c)
        assert (await c.get("/api/v1/exports/session?session_id=nope", headers=h)).status_code == 404
        sid = await _upload_synth(c, h)
        for kind, header in (("assets", "ip_address"), ("connections", "src_ip"), ("findings", "severity")):
            r = await c.get("/api/v1/exports/csv/" + kind, headers=h)
            assert r.status_code == 200 and "text/csv" in r.headers["content-type"]
            lines = r.text.splitlines()
            assert lines[0].startswith("# session_id=" + sid) and lines[1].startswith(header)
            assert len(lines) > 2
        assert (await c.get("/api/v1/exports/csv/nope", headers=h)).status_code == 404
        body = (await c.get("/api/v1/exports/session", headers=h)).json()
        assert body["session"]["id"] == sid and len(body["devices"]) == 6 and body["findings"]
        stix = (await c.get("/api/v1/exports/stix", headers=h)).json()
        assert stix["type"] == "bundle" and stix["id"].startswith("bundle--")
        ids = [o["id"] for o in stix["objects"]]
        assert len(ids) == len(set(ids))
        notes = [o for o in stix["objects"] if o["type"] == "note"]
        assert notes and all("not a verified indicator" in n["content"] for n in notes)
        refs = {o["id"] for o in stix["objects"]}
        assert all(r in refs for n in notes for r in n["object_refs"])
        r = await c.get("/api/v1/exports/sbom", headers=h)
        assert r.status_code == 501 and "no software inventory" in r.json()["detail"]

    run(go)


def test_report_honours_type_sections_and_keeps_unknown_unknown():  # AUDIT-26
    async def go(c):
        h = await login(c)
        sid = await _upload_synth(c, h)

        async def gen(**kw):
            r = await c.post("/api/v1/ics/findings/reports/generate", json=dict(session_id=sid, **kw), headers=h)
            assert r.status_code == 200, r.text
            d = await c.get(r.json()["download_url"].replace("/api/v1", "/api/v1"), headers=h)
            assert d.status_code == 200
            return r.json(), d.text

        meta, full = await gen(report_type="full")
        assert meta["format"] in ("pdf", "html")
        _, ex = await gen(report_type="executive")
        assert "Asset inventory" in full and "Asset inventory" not in ex and "Recommendations" in ex
        _, tech = await gen(report_type="technical", sections=["devices"])
        assert "Asset inventory" in tech and "Findings</h2>" not in tech
        assert "Scope and limits" in full and "Gridwolf " in full
        assert "-%" not in full and "None" not in full
        r = await c.post("/api/v1/ics/findings/reports/generate", json=dict(session_id=sid, report_type="delta"), headers=h)
        assert r.status_code == 422
        r = await c.post("/api/v1/ics/findings/reports/generate", json=dict(session_id=sid, report_type="full", classification="internal"), headers=h)
        assert "INTERNAL" in (await c.get(r.json()["download_url"], headers=h)).text
        rows = (await c.get("/api/v1/ics/findings/reports/list", headers=h)).json()   # fields the Reports table renders (AUDIT-30)
        assert rows and all(x["status"] == "ready" and x["date"] and x["size"] and x["type"] for x in rows)

    run(go)


def test_report_escapes_and_unknown_confidence():  # AUDIT-26
    from app.engine.report_generator import build_html
    page = build_html({"name": "<script>x</script>", "devices": [], "connections": [{"protocol": "<b>x</b>", "packet_count": 3}],
                       "findings": [{"severity": "high", "title": "<img src=x onerror=1>", "confidence": None,
                                     "finding_type": "write_path"}]}, "full", "<i>c</i>", "", None)
    assert "<script>" not in page and "<img" not in page and "<b>x" not in page and "<i>c" not in page
    assert "unknown" in page and "-%" not in page
    assert "Confirm that each observed control write" in page          # recommendation only for an observed type
    assert "Replace or restrict clear-text" not in page


def test_report_classification_only_when_given():  # AUDIT-26
    from app.engine.report_generator import build_html
    base = {"name": "s", "devices": [], "connections": [], "findings": []}
    assert "Classification" not in build_html(dict(base), "executive", "", "", None)
    page = build_html(dict(base, classification="internal"), "executive", "", "", None)
    assert "<dt>Classification</dt><dd>INTERNAL</dd>" in page


def test_session_compare_reports_real_differences_and_no_score():  # AUDIT-29
    async def go(c):
        assert (await c.get("/api/v1/ics/sessions/compare?baseline=a&current=b")).status_code in (401, 403)
        h = await login(c)
        s1 = await _upload_synth(c, h)
        # reduced capture: only the Modbus client and the first PLC
        from scapy.all import rdpcap, wrpcap
        full = Path(TMP) / "cmp-full.pcap"
        synth.build(str(full))
        pk = [x for x in rdpcap(str(full)) if x.haslayer("IP") and {x["IP"].src, x["IP"].dst} <= {"10.10.2.10", "10.10.1.20"}]
        small = Path(TMP) / "cmp-small.pcap"
        wrpcap(str(small), pk)
        r = await c.post("/api/v1/ics/pcap/upload", files={"file": ("cmp-small.pcap", small.read_bytes(), "application/vnd.tcpdump.pcap")}, headers=h)
        s2 = r.json()["session_id"]
        for _ in range(60):
            if (await c.get("/api/v1/ics/pcap/status/%s" % r.json()["pcap_id"], headers=h)).json()["status"] in ("completed", "failed"):
                break
            await asyncio.sleep(0.5)
        d = (await c.get("/api/v1/ics/sessions/compare", params={"baseline": s2, "current": s1}, headers=h)).json()
        assert {x["ip_address"] for x in d["devices"]["added"]} == {"10.10.1.21", "10.10.2.50", "10.10.3.5", "198.51.100.7"}
        assert d["devices"]["removed"] == [] and d["devices"]["unchanged"] + len(d["devices"]["changed"]) == 2
        rev = (await c.get("/api/v1/ics/sessions/compare", params={"baseline": s1, "current": s2}, headers=h)).json()
        assert {x["ip_address"] for x in rev["devices"]["removed"]} == {x["ip_address"] for x in d["devices"]["added"]}
        assert "drift" not in json.dumps(d).lower().replace("baseline drift", "")
        assert "not necessarily" in d["note"] or "may simply" in d["note"]
        assert (await c.get("/api/v1/ics/sessions/compare", params={"baseline": s1, "current": s1}, headers=h)).status_code == 422
        assert (await c.get("/api/v1/ics/sessions/compare", params={"baseline": s1, "current": "nope"}, headers=h)).status_code == 404

    run(go)


OPEN_PATHS = {"/health", "/version", "/api/v1/health", "/api/v1/auth/login", "/api/v1/auth/config",
              "/api/v1/auth/oidc/login", "/api/v1/auth/oidc/callback"}


def test_every_declared_route_requires_a_token_except_the_allowlist():  # AUDIT-27
    """Sweeps app.openapi(): any method on any path that is not explicitly open must return 401/403 without a token."""
    async def go(c):
        spec = app.openapi()
        checked, open_found = 0, []
        for path, ops in spec["paths"].items():
            if path in OPEN_PATHS or path in ("/docs", "/redoc", "/openapi.json"):
                continue
            url = path
            for seg in ("{session_id}", "{id}"):
                url = url.replace(seg, "x")
            import re as _re
            url = _re.sub(r"\{[^}]+\}", "x", url)
            for method in ops:
                if method.lower() not in ("get", "post", "put", "patch", "delete"):
                    continue
                r = await c.request(method.upper(), url, json={} if method.lower() != "get" else None)
                checked += 1
                if r.status_code not in (401, 403):
                    open_found.append((method.upper(), path, r.status_code))
        assert checked > 40, checked
        assert not open_found, open_found

    run(go)


def test_ics_timestamps_carry_an_explicit_utc_offset():  # AUDIT-33 browsers read offset-less ISO strings as local time
    async def go(c):
        h = await login(c)
        sid = await _upload_synth(c, h)
        ss = (await c.get("/api/v1/ics/sessions/", headers=h)).json()
        devs = (await c.get("/api/v1/ics/devices/", params={"session_id": sid}, headers=h)).json()
        devs = devs.get("devices", devs) if isinstance(devs, dict) else devs
        for value in [ss[0]["created_at"]] + [d["first_seen"] for d in devs if d.get("first_seen")]:
            assert value.endswith("+00:00") or value.endswith("Z"), value

    run(go)
