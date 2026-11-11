"""f4 authentication, RBAC and site-scope tests (synthetic data, isolated SQLite, no network).

Covers: every route has an explicit permission; role x route matrix; cross-site isolation; OIDC (authorization
code + PKCE) against a fake issuer, including rejected tokens and unregistered/unauthorised users; session
lifecycle; CSRF and Origin; WebSocket authentication; bootstrap-password handling.
"""
import asyncio
import base64
import hashlib
import os
import re
import stat
import sys
import tempfile
import time
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import pytest

HERE = Path(__file__).resolve().parent
TMP = tempfile.mkdtemp(prefix="gw-auth-test-")
os.environ.setdefault("GRIDWOLF_DATABASE_URL", os.environ.get("GW_TEST_DATABASE_URL") or f"sqlite+aiosqlite:///{TMP}/t.db")
os.environ.setdefault("GRIDWOLF_SECRET_KEY", "test-only-key")
os.environ.setdefault("GRIDWOLF_ADMIN_PASSWORD", "Test-Admin-Password-1!")
os.environ.setdefault("GRIDWOLF_FEED_CACHE_FILE", f"{TMP}/feed.json")
os.environ.setdefault("GRIDWOLF_UPLOAD_DIR", f"{TMP}/uploads")
os.environ.setdefault("GRIDWOLF_DEBUG", "false")
os.environ.setdefault("GRIDWOLF_COOKIE_SECURE", "false")
sys.path.insert(0, str(HERE))
import pgpool  # noqa: E402,F401
sys.path.insert(0, os.environ.get("GW_BACKEND_DIR", str(HERE.parent / "backend-dev")))

import httpx  # noqa: E402
from fastapi.routing import APIRoute  # noqa: E402
from jose import jwk, jwt  # noqa: E402
from cryptography.hazmat.primitives import serialization  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import rsa  # noqa: E402

from app.core import authz, oidc  # noqa: E402
from app.services import sites as sites_svc  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.main import app  # noqa: E402

BASE = "http://test"
ADMIN_PW = os.environ["GRIDWOLF_ADMIN_PASSWORD"]
PW = "Correct-Horse-Battery-1"
ISSUER = "https://auth.test.example/application/o/gridwolf/"
CLIENT_ID = "gridwolf-test"
REDIRECT = "https://gridwolf.test.example/api/v1/auth/oidc/callback"
SITE_A, SITE_B = "site-a", "site-b"


# ---------------------------------------------------------------------------------------- harness
def run(coro):
    async def wrapper():
        async with app.router.lifespan_context(app):
            return await coro()

    async def one_loop():
        try:
            return await wrapper()
        finally:                      # pooled PostgreSQL connections belong to this event loop
            from app.core.database import engine
            await engine.dispose()
    return asyncio.run(one_loop())


def client(**kw) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=BASE, **kw)


async def local_login(username: str, password: str):
    """Returns (client, csrf headers). The client holds the HttpOnly session cookie."""
    c = client()
    r = await c.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, (username, r.status_code, r.text)
    return c, {"X-CSRF-Token": r.json()["csrf_token"]}


async def admin():
    return await local_login("admin", ADMIN_PW)


async def provision(a, ah, username, role, sites=(), oidc_subject=None, password=PW):
    body = {"username": username, "email": f"{username}@lab.example", "full_name": username.title(),
            "role": role, "sites": list(sites)}
    if password:
        body["password"] = password
    if oidc_subject:
        body["oidc_subject"] = oidc_subject
    r = await a.post("/api/v1/admin/users", json=body, headers=ah)
    assert r.status_code == 201, r.text
    return r.json()


async def seed_world():
    """Two sites with one session each (plus an unassigned and a legacy live-flow session), a user per role."""
    from app.core.database import async_session_factory
    from app.models.auth import SessionSite
    from app.models.ics import Device, Finding, Session

    a, ah = await admin()
    world = {"admin": (a, ah)}
    for sid in (SITE_A, SITE_B):                   # sites must be registered before anyone can hold a role there
        r = await a.post("/api/v1/sites", json={"id": sid, "name": sid.upper()}, headers=ah)
        assert r.status_code in (201, 409), r.text
    for name, role, sites in (("viewer_a", "viewer", [SITE_A]), ("analyst_a", "security_analyst", [SITE_A]),
                              ("eng_a", "ot_engineer", [SITE_A]), ("viewer_b", "viewer", [SITE_B]),
                              ("eng_ab", "ot_engineer", [SITE_A, SITE_B]), ("nosite", "viewer", [])):
        if not any(
                u["username"] == name for u in (await a.get("/api/v1/admin/users")).json()):
            await provision(a, ah, name, role, sites)
        world[name] = await local_login(name, PW)
    ids = {}
    async with async_session_factory() as db:
        from sqlalchemy import text
        from app.forge_live import ingest as live
        for tname, cols, pk in live.TABLES:        # the live schema is created by the ingest (Postgres-only DDL)
            await db.execute(text("CREATE TABLE IF NOT EXISTS %s (%s, PRIMARY KEY (%s))" % (
                tname, ", ".join("%s %s" % kv for kv in cols.items()), ", ".join(pk))))
        for key, name, site in (("sa", "Capture A", SITE_A), ("sb", "Capture B", SITE_B), ("un", "Unassigned", None),
                                ("live_a", sites_svc.LIVE_SESSION_PREFIX + SITE_A, SITE_A)):
            existing = (await db.execute(Session.__table__.select().where(Session.name == name))).first()
            if existing:
                ids[key] = existing.id
                continue
            s = Session(name=name, description="synthetic", status="active")
            db.add(s)
            await db.flush()
            ids[key] = s.id
            if site:
                db.add(SessionSite(session_id=s.id, site_id=site, assigned_by="test"))
            db.add(Device(session_id=s.id, ip_address="10.0.0.%d" % (len(ids) + 1)))
            db.add(Finding(session_id=s.id, finding_type="insecure_protocol", severity="medium", title="t " + name))
        await db.commit()
    return world, ids


# ------------------------------------------------------------------------------------ route sweep
def _perm_of(route: APIRoute):
    stack = list(route.dependant.dependencies)
    found = []
    while stack:
        d = stack.pop()
        perm = getattr(d.call, "gw_permission", None)
        if perm:
            found.append(perm)
        stack.extend(d.dependencies)
    return found


OPEN_PATHS = {"/health", "/version", "/api/v1/health", "/api/v1/auth/login", "/api/v1/auth/config",
              "/api/v1/auth/oidc/login", "/api/v1/auth/oidc/callback"}
SELF_PATHS = {"/api/v1/auth/session", "/api/v1/auth/me", "/api/v1/auth/logout", "/api/v1/sites/mine"}      # any signed-in session


def api_routes():
    for r in app.routes:
        if isinstance(r, APIRoute) and r.path not in OPEN_PATHS and r.path not in ("/docs", "/redoc", "/openapi.json"):
            yield r


def test_every_route_declares_a_permission_or_is_allowlisted():
    missing, count = [], 0
    for r in api_routes():
        count += 1
        if r.path in SELF_PATHS:
            continue
        if not _perm_of(r):
            missing.append((sorted(r.methods), r.path))
    assert count > 60, count
    assert not missing, missing


def test_live_session_prefix_matches_the_ingest_prefix():
    from app.forge_live.ingest import SESSION_PREFIX
    assert sites_svc.LIVE_SESSION_PREFIX == SESSION_PREFIX


def test_permission_table_roles_and_isolation():
    p = authz.PERMISSIONS
    assert set(authz.ROLES) == {"administrator", "site_admin", "ot_engineer", "security_analyst", "viewer",
                                "report_viewer", "health_viewer"}
    assert p["viewer"] == {"view", "report_view"}
    assert p["report_viewer"] == {"report_view"} and p["health_viewer"] == {"health"}
    assert p["security_analyst"] > p["viewer"] and "triage" in p["security_analyst"]
    assert "ingest" in p["ot_engineer"] and "ingest" not in p["security_analyst"]
    assert "site_admin" in p["site_admin"] and "site_admin" not in p["ot_engineer"]
    for role in authz.SITE_ROLES:                    # nothing below the platform role is global
        assert not ({"admin", "platform"} & set(p[role]))
    assert {"admin", "platform"} <= set(p["administrator"])
    assert not ({"view", "export"} & p["report_viewer"]) and not ({"view", "export"} & p["health_viewer"])


DESTRUCTIVE_OR_NETWORK = {("POST", "/api/v1/ics/advisories/refresh"), ("GET", "/api/v1/ics/findings/cve/search")}


def concrete(path: str) -> str:
    return re.sub(r"\{[^}]+\}", "x", path)


def test_role_by_route_matrix():
    async def go():
        world, ids = await seed_world()
        wrong, checked = [], 0
        for role, who in (("viewer", "viewer_a"), ("security_analyst", "analyst_a"), ("ot_engineer", "eng_a"),
                          ("administrator", "admin")):
            c, h = world[who]
            have = authz.PERMISSIONS[role]
            for r in api_routes():
                if r.path in SELF_PATHS:
                    continue
                perms = _perm_of(r)
                need = perms[0]
                needs = need.split("/")
                for method in sorted(r.methods - {"HEAD", "OPTIONS"}):
                    allowed = any(n in have for n in needs)
                    if allowed and (method, r.path) in DESTRUCTIVE_OR_NETWORK:
                        continue
                    if allowed and method in ("DELETE",) or (allowed and r.path.endswith("/revoke-sessions")):
                        continue        # exercised with real ids in dedicated tests
                    resp = await c.request(method, concrete(r.path), headers=h,
                                           json={} if method != "GET" else None)
                    checked += 1
                    denied = resp.status_code == 403 and "Insufficient role" in resp.text
                    if denied == allowed:
                        wrong.append((role, method, r.path, need, resp.status_code))
        assert checked > 150, checked
        assert not wrong, wrong
    run(go)


# -------------------------------------------------------------------------------- site isolation
def test_viewer_sees_only_granted_sites():
    async def go():
        world, ids = await seed_world()
        a, _ = world["viewer_a"]
        listed = {s["id"] for s in (await a.get("/api/v1/ics/sessions/")).json()}
        assert ids["sa"] in listed and ids["live_a"] in listed
        assert not ({ids["sb"], ids["un"]} & listed)
        for url in (f"/api/v1/ics/sessions/{ids['sb']}", f"/api/v1/ics/devices/?session_id={ids['sb']}",
                    f"/api/v1/ics/findings/?session_id={ids['sb']}", f"/api/v1/ics/devices/topology?session_id={ids['sb']}",
                    f"/api/v1/ics/devices/stats?session_id={ids['sb']}", f"/api/v1/ics/findings/stats?session_id={ids['sb']}",
                    f"/api/v1/ics/pcap/list?session_id={ids['sb']}", f"/api/v1/ics/advisories/matched?session_id={ids['sb']}",
                    f"/api/v1/ics/sessions/{ids['un']}"):
            r = await a.get(url)
            assert r.status_code == 404, (url, r.status_code)
        assert (await a.get(f"/api/v1/ics/sessions/{ids['sa']}")).status_code == 200
        assert (await a.get(f"/api/v1/ics/devices/?session_id={ids['sa']}")).status_code == 200
    run(go)


def test_lists_never_mix_sites_and_nosite_user_sees_nothing():
    async def go():
        world, ids = await seed_world()
        for who, expect in (("viewer_a", {SITE_A}), ("viewer_b", {SITE_B}), ("nosite", set())):
            c, _ = world[who]
            resp = await c.get("/api/v1/ics/sessions/")
            if who == "nosite":                       # no role at any site: refused, never a list of other sites
                assert resp.status_code == 403
                continue
            names = {s["name"] for s in resp.json()}
            for other in ("Capture A", "Capture B", "Unassigned"):
                assert (other in names) == (other == "Capture A" and SITE_A in expect or
                                            other == "Capture B" and SITE_B in expect), (who, names)
            devs = await c.get("/api/v1/ics/devices/")
            assert devs.status_code == 200
        c, _ = world["admin"]
        assert {ids["sa"], ids["sb"], ids["un"]} <= {s["id"] for s in (await c.get("/api/v1/ics/sessions/")).json()}
    run(go)


def test_cross_site_write_and_export_paths_are_denied():
    async def go():
        world, ids = await seed_world()
        a, ah = world["analyst_a"]
        assert (await a.get(f"/api/v1/exports/csv/findings?session_id={ids['sb']}")).status_code == 404
        assert (await a.get(f"/api/v1/exports/session?session_id={ids['sb']}")).status_code == 404
        assert (await a.get(f"/api/v1/exports/stix?session_id={ids['sb']}")).status_code == 404
        assert (await a.get(f"/api/v1/exports/csv/findings?session_id={ids['sa']}")).status_code == 200
        r = await a.post("/api/v1/ics/findings/reports/generate", headers=ah,
                         json={"session_id": ids["sb"], "report_type": "technical"})
        assert r.status_code in (404, 422), r.text
        # an out-of-scope session cannot be the target of an upload either
        e, eh = world["eng_a"]
        r = await e.post(f"/api/v1/ics/pcap/upload?session_id={ids['sb']}", headers=eh,
                         files={"file": ("x.pcap", b"\xd4\xc3\xb2\xa1" + b"\0" * 40, "application/octet-stream")})
        assert r.status_code == 404, r.text
        # default export is limited to what the caller may see
        v, _ = world["viewer_b"]
        assert (await v.get("/api/v1/exports/csv/findings")).status_code == 403     # viewers cannot export
    run(go)


def test_session_creation_needs_ingest_and_a_held_site():
    async def go():
        world, ids = await seed_world()
        v, vh = world["viewer_a"]
        assert (await v.post("/api/v1/ics/sessions/", json={"name": "n", "site_id": SITE_A}, headers=vh)).status_code == 403
        e, eh = world["eng_a"]
        assert (await e.post("/api/v1/ics/sessions/", json={"name": "n", "site_id": SITE_B}, headers=eh)).status_code == 403
        assert (await e.post("/api/v1/ics/sessions/", json={"name": "n"}, headers=eh)).status_code in (200, 201)  # sole site
        r = await e.post("/api/v1/ics/sessions/", json={"name": "made by eng_a", "site_id": SITE_A}, headers=eh)
        assert r.status_code in (200, 201), r.text
        sid = r.json()["id"]
        assert sid in {s["id"] for s in (await e.get("/api/v1/ics/sessions/")).json()}
        b, _ = world["viewer_b"]
        assert sid not in {s["id"] for s in (await b.get("/api/v1/ics/sessions/")).json()}
        # only administrators move or delete sessions
        assert (await e.put(f"/api/v1/ics/sessions/{sid}/site", json={"site_id": SITE_B}, headers=eh)).status_code == 403
        assert (await e.delete(f"/api/v1/ics/sessions/{sid}", headers=eh)).status_code == 403
        a, ah = world["admin"]
        assert (await a.put(f"/api/v1/ics/sessions/{sid}/site", json={"site_id": SITE_B}, headers=ah)).status_code == 200
        assert sid not in {s["id"] for s in (await e.get("/api/v1/ics/sessions/")).json()}
        assert (await a.delete(f"/api/v1/ics/sessions/{sid}", headers=ah)).status_code in (200, 204)
    run(go)


def test_ambiguous_site_for_multi_site_engineer_is_rejected():
    async def go():
        world, ids = await seed_world()
        e, eh = world["eng_ab"]
        r = await e.post("/api/v1/ics/sessions/", json={"name": "ambiguous"}, headers=eh)
        assert r.status_code == 422, r.text
        r = await e.post("/api/v1/ics/sessions/", json={"name": "explicit", "site_id": SITE_B}, headers=eh)
        assert r.status_code in (200, 201), r.text
    run(go)


def test_live_telemetry_is_site_scoped_and_platform_health_is_admin_only():
    async def go():
        world, ids = await seed_world()
        v, _ = world["viewer_a"]
        r = await v.get("/api/v1/forge/live", params={"site": SITE_B})
        assert r.status_code == 403
        r = await v.get("/api/v1/forge/live", params={"site": "NOT-A-SITE"})
        assert r.status_code == 403            # an unknown site is indistinguishable from a forbidden one
        assert (await v.get("/api/v1/forge/observations", params={"site": SITE_B})).status_code == 403
        assert (await v.get("/api/v1/forge/intel", params={"site": SITE_B})).status_code == 403
        ov = await v.get("/api/v1/forge/overview")
        assert ov.status_code == 200, ov.text
        body = ov.json()
        assert SITE_B not in str(body.get("sites")) and SITE_B not in str(body.get("sensors"))
        assert body["sources"]["wazuh"]["state"] == "restricted"
        a, _ = world["admin"]
        adm = await a.get("/api/v1/forge/overview")
        assert adm.status_code == 200 and adm.json()["sources"]["wazuh"]["state"] != "restricted"
        n, _ = world["nosite"]
        assert (await n.get("/api/v1/forge/live")).status_code in (200, 403, 404)
    run(go)


# --------------------------------------------------------------------------------- projects (Gate 1)
def _project_ids(resp):
    assert resp.status_code == 200, resp.text
    return {p["id"] for p in resp.json()}


def test_projects_are_site_scoped_end_to_end():
    async def go():
        world, ids = await seed_world()
        base = "/api/v1/ics/sessions"
        e, eh = world["eng_a"]
        r = await e.post(f"{base}/projects", json={"name": "Project A"}, headers=eh)
        assert r.status_code == 200 and r.json()["site_id"] == SITE_A, r.text
        pa = r.json()["id"]
        eab, eabh = world["eng_ab"]
        r = await eab.post(f"{base}/projects", json={"name": "Project B", "site_id": SITE_B}, headers=eabh)
        assert r.status_code == 200 and r.json()["site_id"] == SITE_B, r.text
        pb = r.json()["id"]
        # a multi-site engineer must say which site; an unheld site is refused
        assert (await eab.post(f"{base}/projects", json={"name": "x"}, headers=eabh)).status_code == 422
        assert (await e.post(f"{base}/projects", json={"name": "x", "site_id": SITE_B}, headers=eh)).status_code == 403
        # viewers cannot create
        v, vh = world["viewer_a"]
        assert (await v.post(f"{base}/projects", json={"name": "x"}, headers=vh)).status_code == 403
        # listing: each user sees only the projects of their own sites; multi-site sees both; no-site sees none
        assert pa in _project_ids(await v.get(f"{base}/projects/list"))
        assert pb not in _project_ids(await v.get(f"{base}/projects/list"))
        vb, _ = world["viewer_b"]
        assert pb in _project_ids(await vb.get(f"{base}/projects/list"))
        assert pa not in _project_ids(await vb.get(f"{base}/projects/list"))
        both = _project_ids(await eab.get(f"{base}/projects/list"))
        assert {pa, pb} <= both
        n, _ = world["nosite"]
        assert (await n.get(f"{base}/projects/list")).status_code == 403
        a, ah = world["admin"]
        assert {pa, pb} <= _project_ids(await a.get(f"{base}/projects/list"))
        # a session can join only a project the caller can see and that belongs to the same site
        assert (await e.post(f"{base}/", json={"name": "s", "project_id": pb}, headers=eh)).status_code == 404
        assert (await e.post(f"{base}/", json={"name": "s", "project_id": "no-such-project"}, headers=eh)).status_code == 404
        r = await eab.post(f"{base}/", json={"name": "s", "site_id": SITE_A, "project_id": pb}, headers=eabh)
        assert r.status_code == 422, r.text
        r = await eab.post(f"{base}/", json={"name": "ok-b", "site_id": SITE_B, "project_id": pb}, headers=eabh)
        assert r.status_code in (200, 201), r.text
        sb = r.json()["id"]
        r = await e.post(f"{base}/", json={"name": "ok-a", "project_id": pa}, headers=eh)
        assert r.status_code in (200, 201) and r.json()["site_id"] == SITE_A, r.text
        sa = r.json()["id"]
        # the session list shows the project to its site and hides the project id from nobody who may see it
        listed = {s["id"]: s for s in (await v.get(f"{base}/")).json()}
        assert listed[sa]["project_id"] == pa and sb not in listed
        # an administrator may let an unassigned-site session inherit the project's site
        r = await a.post(f"{base}/", json={"name": "adm", "project_id": pa}, headers=ah)
        assert r.status_code in (200, 201) and r.json()["site_id"] == SITE_A, r.text
        # only administrators change a project's site
        assert (await e.put(f"{base}/projects/{pa}/site", json={"site_id": SITE_B}, headers=eh)).status_code == 403
        assert (await a.put(f"{base}/projects/nope/site", json={"site_id": SITE_B}, headers=ah)).status_code == 404
        assert (await a.put(f"{base}/projects/{pa}/site", json={"site_id": SITE_B}, headers=ah)).status_code == 200
        assert pa not in _project_ids(await v.get(f"{base}/projects/list"))
        assert pa in _project_ids(await vb.get(f"{base}/projects/list"))
        # the filter on the session list reveals nothing outside the caller's own sessions
        assert not (await v.get(f"{base}/", params={"project_id": pb})).json()
    run(go)


def test_legacy_project_without_a_site_is_administrator_only_and_never_leaks_through_sessions():
    async def go():
        world, ids = await seed_world()
        from app.core.database import async_session_factory
        from app.models.ics import Project, Session
        async with async_session_factory() as db:
            legacy = Project(name="Legacy engagement", client_name="legacy-client")
            db.add(legacy)
            await db.flush()
            sess = await db.get(Session, ids["sa"])
            sess.project_id = legacy.id
            await db.commit()
            pid = legacy.id
        base = "/api/v1/ics/sessions"
        v, _ = world["viewer_a"]
        assert pid not in _project_ids(await v.get(f"{base}/projects/list"))
        listed = {s["id"]: s for s in (await v.get(f"{base}/")).json()}
        assert listed[ids["sa"]]["project_id"] is None
        assert (await v.get(f"{base}/{ids['sa']}")).json()["project_id"] is None
        a, ah = world["admin"]
        assert pid in _project_ids(await a.get(f"{base}/projects/list"))
        assert {s["id"]: s for s in (await a.get(f"{base}/")).json()}[ids["sa"]]["project_id"] == pid
        # the administrator assigns it; the site's users then see it
        assert (await a.put(f"{base}/projects/{pid}/site", json={"site_id": SITE_A}, headers=ah)).status_code == 200
        assert pid in _project_ids(await v.get(f"{base}/projects/list"))
        assert (await v.get(f"{base}/{ids['sa']}")).json()["project_id"] == pid
    run(go)


def test_report_and_finding_references_are_denied_across_sites_by_direct_api_calls():
    async def go():
        world, ids = await seed_world()
        from app.core.database import async_session_factory
        from app.models.ics import Finding
        from sqlalchemy import select
        async with async_session_factory() as db:
            fb = (await db.execute(select(Finding).where(Finding.session_id == ids["sb"]))).scalars().first()
            fa = (await db.execute(select(Finding).where(Finding.session_id == ids["sa"]))).scalars().first()
        an, anh = world["analyst_a"]
        r = await an.patch(f"/api/v1/ics/findings/{fb.id}/status", params={"status": "investigating"}, headers=anh)
        assert r.status_code == 404, r.text
        ok = await an.patch(f"/api/v1/ics/findings/{fa.id}/status", params={"status": "investigating"}, headers=anh)
        assert ok.status_code == 200, ok.text
        # a report generated for site B is invisible and not downloadable from site A
        eb, ebh = world["eng_ab"]
        r = await eb.post("/api/v1/ics/findings/reports/generate", headers=ebh,
                          json={"session_id": ids["sb"], "report_type": "technical"})
        assert r.status_code == 200, r.text
        rid = r.json()["report_id"] if "report_id" in r.json() else r.json()["id"]
        assert (await an.get(f"/api/v1/ics/findings/reports/{rid}/download")).status_code == 404
        assert rid not in {x["id"] for x in (await an.get("/api/v1/ics/findings/reports/list")).json()}
        assert (await eb.get(f"/api/v1/ics/findings/reports/{rid}/download")).status_code == 200
        # comparing across a site boundary names neither session
        r = await an.get("/api/v1/ics/sessions/compare", params={"baseline": ids["sa"], "current": ids["sb"]})
        assert r.status_code == 404
    run(go)


# ---------------------------------------------------------------------- service credentials (Gate 2)
SVC = "/api/v1/admin/service-credentials"


async def make_service(world, name, permissions=("view",), sites=(SITE_A,), days=30):
    a, ah = world["admin"]
    r = await a.post(SVC, json={"name": name, "permissions": list(permissions), "sites": list(sites),
                                "lifetime_days": days}, headers=ah)
    assert r.status_code == 201, r.text
    body = r.json()
    return body["token"], body["id"], {"Authorization": "Bearer " + body["token"]}


def test_service_credential_creation_is_admin_only_validated_and_shown_once():
    async def go():
        world, ids = await seed_world()
        a, ah = world["admin"]
        token, cid, _ = await make_service(world, "t-create", ("view", "export"), (SITE_A, SITE_B))
        assert token.startswith("gws_") and len(token) > 40
        listed = (await a.get(SVC)).json()
        row = [c for c in listed if c["id"] == cid][0]
        assert row["state"] == "active" and row["permissions"] == ["export", "view"] and row["sites"] == [SITE_A, SITE_B]
        assert token not in str(listed) and "token" not in row and "token_hash" not in row
        # only the hash is stored
        from app.core.database import async_session_factory
        from app.core.security import token_hash
        from app.models.auth import ServiceCredential
        async with async_session_factory() as db:
            stored = await db.get(ServiceCredential, cid)
            assert stored.token_hash == token_hash(token) and token not in repr(stored.__dict__)
        bad = [({"name": "t-bad1", "permissions": ["view"], "sites": []}, "site"),
               ({"name": "t-bad2", "permissions": ["admin"], "sites": [SITE_A]}, "permissions"),
               ({"name": "t-bad3", "permissions": ["platform", "view"], "sites": [SITE_A]}, "permissions"),
               ({"name": "t-bad4", "permissions": [], "sites": [SITE_A]}, "permissions"),
               ({"name": "t-bad5", "permissions": ["view"], "sites": ["*"]}, "site"),
               ({"name": "t-bad6", "permissions": ["view"], "sites": [SITE_A], "lifetime_days": 91}, ""),
               ({"name": "t-bad7", "permissions": ["view"], "sites": [SITE_A], "lifetime_days": 0}, ""),
               ({"name": "Bad Name!", "permissions": ["view"], "sites": [SITE_A]}, "name"),
               ({"name": "t-create", "permissions": ["view"], "sites": [SITE_A]}, "already exists")]
        for body, word in bad:
            r = await a.post(SVC, json=body, headers=ah)
            assert r.status_code == 422 and word in r.text, (body, r.status_code, r.text)
        for who in ("viewer_a", "analyst_a", "eng_a", "nosite"):
            c, h = world[who]
            assert (await c.get(SVC)).status_code == 403
            assert (await c.post(SVC, json={"name": "t-x", "permissions": ["view"], "sites": [SITE_A]},
                                 headers=h)).status_code == 403
            assert (await c.delete(f"{SVC}/{cid}", headers=h)).status_code == 403
        events = (await a.get("/api/v1/admin/users/events/recent", params={"limit": 200})).json()
        assert any(e["kind"] == "service_credential_created" and "t-create" in e["detail"] for e in events)
        assert token not in str(events)
    run(go)


def test_service_credential_reads_only_its_sites_and_is_not_a_person():
    async def go():
        world, ids = await seed_world()
        token, cid, h = await make_service(world, "t-read", ("view",), (SITE_A,))
        c = client()
        listed = {s["id"] for s in (await c.get("/api/v1/ics/sessions/", headers=h)).json()}
        assert ids["sa"] in listed and not ({ids["sb"], ids["un"]} & listed)
        assert (await c.get(f"/api/v1/ics/sessions/{ids['sa']}", headers=h)).status_code == 200
        for url in (f"/api/v1/ics/sessions/{ids['sb']}", f"/api/v1/ics/sessions/{ids['un']}",
                    f"/api/v1/ics/devices/?session_id={ids['sb']}", f"/api/v1/ics/findings/?session_id={ids['sb']}"):
            assert (await c.get(url, headers=h)).status_code == 404, url
        assert (await c.get("/api/v1/forge/live", params={"site": SITE_B}, headers=h)).status_code == 403
        ov = await c.get("/api/v1/forge/overview", headers=h)
        assert ov.status_code == 200 and ov.json()["sources"]["wazuh"]["state"] == "restricted"
        assert SITE_B not in str(ov.json().get("sites"))
        # not held: export, ingest, triage, report, admin, platform
        assert (await c.get(f"/api/v1/exports/csv/findings?session_id={ids['sa']}", headers=h)).status_code == 403
        assert (await c.post("/api/v1/ics/sessions/", json={"name": "n"}, headers=h)).status_code == 403
        assert (await c.get(SVC, headers=h)).status_code == 403
        assert (await c.get("/api/v1/admin/users", headers=h)).status_code == 403
        # no person-only endpoints
        for path in ("/api/v1/auth/session", "/api/v1/auth/me"):
            assert (await c.get(path, headers=h)).status_code == 403, path
        assert (await c.post("/api/v1/auth/logout", headers=h)).status_code == 403
        # the credential has no CSRF duty and a state-changing call needs no cookie, but still needs the permission
        assert (await c.put(f"/api/v1/ics/sessions/{ids['sa']}/site", json={"site_id": SITE_B}, headers=h)).status_code == 403
        # last use is recorded
        row = [x for x in (await world["admin"][0].get(SVC)).json() if x["id"] == cid][0]
        assert row["last_used_at"] and row["use_count"] >= 1
    run(go)


def test_service_credential_with_ingest_creates_sessions_only_in_its_site():
    async def go():
        world, ids = await seed_world()
        token, cid, h = await make_service(world, "t-ingest", ("view", "ingest"), (SITE_A,))
        c = client()
        r = await c.post("/api/v1/ics/sessions/", json={"name": "by service"}, headers=h)
        assert r.status_code in (200, 201) and r.json()["site_id"] == SITE_A, r.text
        assert (await c.post("/api/v1/ics/sessions/", json={"name": "by service", "site_id": SITE_B},
                             headers=h)).status_code == 403
        up = await c.post(f"/api/v1/ics/pcap/upload?session_id={ids['sb']}", headers=h,
                          files={"file": ("x.pcap", b"\xd4\xc3\xb2\xa1" + b"\0" * 40, "application/octet-stream")})
        assert up.status_code == 404, up.text
        # still not an administrator: no site assignment, deletion or project re-assignment
        sid = r.json()["id"]
        assert (await c.put(f"/api/v1/ics/sessions/{sid}/site", json={"site_id": SITE_B}, headers=h)).status_code == 403
        assert (await c.delete(f"/api/v1/ics/sessions/{sid}", headers=h)).status_code == 403
        a, ah = world["admin"]
        assert (await a.delete(f"/api/v1/ics/sessions/{sid}", headers=ah)).status_code in (200, 204)
    run(go)


def test_service_credential_revocation_expiry_and_bad_tokens_apply_at_once():
    async def go():
        world, ids = await seed_world()
        a, ah = world["admin"]
        token, cid, h = await make_service(world, "t-revoke", ("view",), (SITE_A,))
        c = client()
        assert (await c.get("/api/v1/ics/sessions/", headers=h)).status_code == 200
        r = await a.delete(f"{SVC}/{cid}", headers=ah)
        assert r.status_code == 200 and r.json()["state"] == "revoked"
        assert (await c.get("/api/v1/ics/sessions/", headers=h)).status_code == 401
        events = (await a.get("/api/v1/admin/users/events/recent", params={"limit": 200})).json()
        assert any(e["kind"] == "service_credential_revoked" and "t-revoke" in (e["detail"] or "") for e in events)
        assert any(e["kind"] == "service_auth_failed" and e["detail"] == "revoked" for e in events)
        assert (await a.delete(f"{SVC}/no-such-id", headers=ah)).status_code == 404
        # expiry
        token2, cid2, h2 = await make_service(world, "t-expire", ("view",), (SITE_A,))
        from datetime import timedelta
        from app.core.database import async_session_factory
        from app.models.auth import ServiceCredential
        async with async_session_factory() as db:
            row = await db.get(ServiceCredential, cid2)
            row.expires_at = authz.utcnow() - timedelta(seconds=1)
            await db.commit()
        assert (await c.get("/api/v1/ics/sessions/", headers=h2)).status_code == 401
        assert [x for x in (await a.get(SVC)).json() if x["id"] == cid2][0]["state"] == "expired"
        # malformed, unknown or wrong-scheme credentials, and a valid cookie does not rescue a bad bearer
        for bad in ("Bearer gws_" + "x" * 43, "Bearer " + "gws_" * 80, "Bearer abc.def.ghi", "Bearer ", "Basic Zm9vOmJhcg==",
                    "Token " + token2, "gws_" + "y" * 43):
            assert (await c.get("/api/v1/ics/sessions/", headers={"Authorization": bad})).status_code == 401, bad
        assert (await a.get("/api/v1/ics/sessions/", headers={"Authorization": "Bearer gws_" + "x" * 43})).status_code == 401
        assert (await client().get("/api/v1/ics/sessions/")).status_code == 401
    run(go)


def test_service_permissions_stored_in_the_database_cannot_escalate():
    async def go():
        world, ids = await seed_world()
        token, cid, h = await make_service(world, "t-tamper", ("view",), (SITE_A,))
        from app.core.database import async_session_factory
        from app.models.auth import ServiceCredential
        async with async_session_factory() as db:
            row = await db.get(ServiceCredential, cid)
            row.permissions = ["view", "admin", "platform", "triage", "report"]
            row.sites = [SITE_A, "*", "../x", ""]
            await db.commit()
        c = client()
        assert (await c.get(SVC, headers=h)).status_code == 403
        assert (await c.post("/api/v1/ics/sessions/", json={"name": "n"}, headers=h)).status_code == 403
        ov = await c.get("/api/v1/forge/overview", headers=h)
        assert ov.status_code == 200 and ov.json()["sources"]["wazuh"]["state"] == "restricted"
        assert (await c.get("/api/v1/ics/sessions/", headers=h)).status_code == 200
        listed = {s["id"] for s in (await c.get("/api/v1/ics/sessions/", headers=h)).json()}
        assert ids["sb"] not in listed
    run(go)


def test_service_credential_is_refused_on_every_route_it_may_not_use():
    async def go():
        world, ids = await seed_world()
        token, cid, h = await make_service(world, "t-sweep", ("view", "export", "ingest"), (SITE_A,))
        c = client()
        wrong, checked = [], 0
        for r in api_routes():
            need = "authenticated" if r.path in SELF_PATHS else _perm_of(r)[0]
            if set(need.split("/")) & authz.SERVICE_PERMISSIONS:
                continue
            for method in sorted(r.methods - {"HEAD", "OPTIONS"}):
                resp = await c.request(method, concrete(r.path), headers=h, json={} if method != "GET" else None)
                checked += 1
                if resp.status_code != 403:
                    wrong.append((method, r.path, need, resp.status_code))
        assert checked > 40, checked
        assert not wrong, wrong
    run(go)


# ---------------------------------------------------------------------------- session lifecycle
def test_unauthenticated_and_bearer_requests_are_rejected():
    async def go():
        c = client()
        assert (await c.get("/api/v1/auth/session")).status_code == 401
        assert (await c.get("/api/v1/ics/sessions/", headers={"Authorization": "Bearer abc.def.ghi"})).status_code == 401
        assert (await c.get("/api/v1/ics/sessions/", cookies={"gw_session": "forged-value"})).status_code == 401
        # a JWT minted with the old scheme and the application key is worthless
        forged = jwt.encode({"sub": "admin", "exp": int(time.time()) + 600}, settings.SECRET_KEY, algorithm="HS256")
        assert (await c.get("/api/v1/auth/me", headers={"Authorization": "Bearer " + forged})).status_code == 401
        assert (await c.get("/api/v1/auth/me", cookies={"gw_session": forged})).status_code == 401
    run(go)


def test_login_response_and_cookie_flags():
    async def go():
        c = client()
        r = await c.post("/api/v1/auth/login", json={"username": "admin", "password": ADMIN_PW})
        assert r.status_code == 200
        assert set(r.json()) == {"status", "csrf_token"}
        cookie = r.headers["set-cookie"].lower()
        assert "httponly" in cookie and "samesite=lax" in cookie and "path=/" in cookie
        assert "no-store" in r.headers["cache-control"]
        s = (await c.get("/api/v1/auth/session")).json()
        assert s["role"] == "administrator" and s["all_sites"] is True and "platform" in s["permissions"]
        assert "hashed_password" not in str(s)
        settings.COOKIE_SECURE = True
        try:
            r2 = await client().post("/api/v1/auth/login", json={"username": "admin", "password": ADMIN_PW})
            assert "secure" in r2.headers["set-cookie"].lower()
        finally:
            settings.COOKIE_SECURE = False
    run(go)


def test_login_failure_is_uniform_and_locks_out():
    async def go():
        a, ah = await admin()
        await provision(a, ah, "lockme", "viewer", [SITE_A]) if not any(
            u["username"] == "lockme" for u in (await a.get("/api/v1/admin/users")).json()) else None
        c = client()
        unknown = await c.post("/api/v1/auth/login", json={"username": "no-such-user", "password": "x" * 14})
        wrong = await c.post("/api/v1/auth/login", json={"username": "lockme", "password": "Wrong-password-1"})
        assert unknown.status_code == wrong.status_code == 401
        assert unknown.json() == wrong.json()
        for _ in range(settings.LOCAL_LOGIN_MAX_FAILURES + 1):
            await c.post("/api/v1/auth/login", json={"username": "lockme", "password": "Wrong-password-1"})
        locked = await c.post("/api/v1/auth/login", json={"username": "lockme", "password": PW})
        assert locked.status_code == 429          # even the right password is refused while locked
        ev = (await a.get("/api/v1/admin/users/events/recent")).json()
        assert any(e["kind"] == "login_failed" and e["username"] == "lockme" for e in ev)
        assert PW not in str(ev) and "Wrong-password-1" not in str(ev)
    run(go)


def test_logout_revokes_the_server_side_session():
    async def go():
        a, ah = await admin()
        await provision(a, ah, "leaver", "viewer", [SITE_A]) if not any(
            u["username"] == "leaver" for u in (await a.get("/api/v1/admin/users")).json()) else None
        c, h = await local_login("leaver", PW)
        stolen = c.cookies.get("gw_session")
        assert stolen
        r = await c.post("/api/v1/auth/logout", headers=h)
        assert r.status_code == 200 and r.json()["status"] == "signed_out"
        replay = client(cookies={"gw_session": stolen})
        assert (await replay.get("/api/v1/auth/session")).status_code == 401
    run(go)


def test_idle_and_absolute_expiry_end_the_session():
    async def go():
        from app.core.database import async_session_factory
        from app.models.auth import AuthSession
        from app.core.security import token_hash
        from datetime import timedelta
        for field in ("idle_expires_at", "absolute_expires_at"):
            c, _ = await local_login("admin", ADMIN_PW)
            assert (await c.get("/api/v1/auth/session")).status_code == 200
            async with async_session_factory() as db:
                s = await db.get(AuthSession, token_hash(c.cookies.get("gw_session")))
                setattr(s, field, authz.utcnow() - timedelta(seconds=1))
                await db.commit()
            assert (await c.get("/api/v1/auth/session")).status_code == 401, field
    run(go)


def test_idle_expiry_slides_but_never_passes_the_absolute_limit():
    async def go():
        from app.core.database import async_session_factory
        from app.models.auth import AuthSession
        from app.core.security import token_hash
        from datetime import timedelta
        c, _ = await local_login("admin", ADMIN_PW)
        async with async_session_factory() as db:
            s = await db.get(AuthSession, token_hash(c.cookies.get("gw_session")))
            s.last_seen_at = authz.utcnow() - timedelta(minutes=5)
            s.absolute_expires_at = authz.utcnow() + timedelta(minutes=2)
            await db.commit()
        assert (await c.get("/api/v1/auth/session")).status_code == 200
        async with async_session_factory() as db:
            s = await db.get(AuthSession, token_hash(c.cookies.get("gw_session")))
            assert authz.aware(s.idle_expires_at) <= authz.aware(s.absolute_expires_at)
    run(go)


def test_deactivation_and_role_change_apply_immediately():
    async def go():
        a, ah = await admin()
        u = await provision(a, ah, "demoted", "ot_engineer", [SITE_A]) if not any(
            x["username"] == "demoted" for x in (await a.get("/api/v1/admin/users")).json()) else [
            x for x in (await a.get("/api/v1/admin/users")).json() if x["username"] == "demoted"][0]
        c, h = await local_login("demoted", PW)
        assert (await c.post("/api/v1/ics/sessions/", json={"name": "x", "site_id": SITE_A}, headers=h)).status_code in (200, 201)
        assert (await a.patch(f"/api/v1/admin/users/{u['id']}", json={"role": "viewer"}, headers=ah)).status_code == 200
        # the old session is ended; a new one carries the lower role
        assert (await c.get("/api/v1/auth/session")).status_code == 401
        c, h = await local_login("demoted", PW)
        assert (await c.post("/api/v1/ics/sessions/", json={"name": "x", "site_id": SITE_A}, headers=h)).status_code == 403
        assert (await a.patch(f"/api/v1/admin/users/{u['id']}", json={"is_active": False}, headers=ah)).status_code == 200
        assert (await c.get("/api/v1/auth/session")).status_code == 401
        denied = await client().post("/api/v1/auth/login", json={"username": "demoted", "password": PW})
        assert denied.status_code in (401, 403)
        assert (await a.patch(f"/api/v1/admin/users/{u['id']}", json={"is_active": True}, headers=ah)).status_code == 200
    run(go)


def test_administrator_cannot_lock_themselves_out():
    async def go():
        a, ah = await admin()
        me = (await a.get("/api/v1/auth/session")).json()["user"]["id"]
        assert (await a.patch(f"/api/v1/admin/users/{me}", json={"is_active": False}, headers=ah)).status_code == 422
        assert (await a.patch(f"/api/v1/admin/users/{me}", json={"role": "viewer"}, headers=ah)).status_code == 422
    run(go)


def test_user_admin_endpoints_are_administrator_only():
    async def go():
        world, ids = await seed_world()
        for who in ("viewer_a", "analyst_a", "eng_a"):
            c, h = world[who]
            assert (await c.get("/api/v1/admin/users")).status_code == 403
            assert (await c.post("/api/v1/admin/users", headers=h, json={
                "username": "evil", "email": "evil@lab.example", "role": "administrator"})).status_code == 403
            assert (await c.get("/api/v1/admin/users/events/recent")).status_code == 403
        a, ah = world["admin"]
        r = await a.post("/api/v1/admin/users", headers=ah, json={"username": "bad role", "email": "b@lab.example", "role": "root"})
        assert r.status_code == 422
        r = await a.post("/api/v1/admin/users", headers=ah, json={"username": "badsite", "email": "bs@lab.example",
                                                                    "role": "viewer", "sites": ["../etc"]})
        assert r.status_code == 422
    run(go)


# ----------------------------------------------------------------------------------- CSRF/Origin
def test_state_changing_requests_need_the_csrf_token_and_a_trusted_origin():
    async def go():
        c, h = await local_login("admin", ADMIN_PW)
        body = {"name": "csrf probe", "site_id": SITE_A}
        assert (await c.post("/api/v1/ics/sessions/", json=body)).status_code == 403
        assert (await c.post("/api/v1/ics/sessions/", json=body, headers={"X-CSRF-Token": "wrong"})).status_code == 403
        evil = dict(h, Origin="https://evil.example")
        assert (await c.post("/api/v1/ics/sessions/", json=body, headers=evil)).status_code == 403
        assert (await c.get("/api/v1/auth/session", headers={"Origin": "https://evil.example"})).status_code == 200
        good = dict(h, Origin=settings.CORS_ORIGINS[0])
        assert (await c.post("/api/v1/ics/sessions/", json=body, headers=good)).status_code in (200, 201)
        # one session's token is not valid for another session
        c2, h2 = await local_login("admin", ADMIN_PW)
        assert (await c2.post("/api/v1/ics/sessions/", json=body, headers=h)).status_code == 403
    run(go)


def test_security_headers_and_docs_are_off():
    async def go():
        c = client()
        r = await c.get("/api/v1/auth/config")
        assert r.headers["x-content-type-options"] == "nosniff" and r.headers["x-frame-options"] == "DENY"
        assert "no-store" in r.headers["cache-control"]
        for p in ("/docs", "/redoc", "/openapi.json"):
            assert (await c.get(p)).status_code == 404, p
        assert set(r.json()) == {"oidc", "local_login"}
    run(go)


# ------------------------------------------------------------------------------------- WebSocket
def test_websocket_requires_a_session_and_a_trusted_origin():
    from starlette.testclient import TestClient
    from starlette.websockets import WebSocketDisconnect
    with TestClient(app) as tc:
        with pytest.raises(WebSocketDisconnect):
            with tc.websocket_connect("/ws") as ws:
                ws.receive_text()
        r = tc.post("/api/v1/auth/login", json={"username": "admin", "password": ADMIN_PW})
        assert r.status_code == 200
        with tc.websocket_connect("/ws", headers={"origin": settings.CORS_ORIGINS[0]}) as ws:
            ws.send_json({"type": "ping"})
            assert ws.receive_json() == {"type": "pong"}
            ws.send_json({"type": "echo", "data": "x"})      # no echo channel: nothing comes back
            ws.send_json({"type": "ping"})
            assert ws.receive_json() == {"type": "pong"}
            ws.send_text("not json")
            with pytest.raises(WebSocketDisconnect):
                ws.receive_json()
        with pytest.raises(WebSocketDisconnect):
            with tc.websocket_connect("/ws", headers={"origin": "https://evil.example"}) as ws:
                ws.receive_text()


# ------------------------------------------------------------------------------------------ OIDC
class FakeIssuer:
    def __init__(self):
        self.key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        self.other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        self.kid = "k1"
        self.nonce = None
        self.next_claims = {}
        self.token_status = 200
        self.calls = []

    @staticmethod
    def pem(key):
        return key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                 serialization.NoEncryption()).decode()

    def jwks(self):
        pub = self.key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
        d = jwk.construct(pub.decode(), "RS256").to_dict()
        d.update(kid=self.kid, use="sig", alg="RS256")
        return {"keys": [d]}

    def id_token(self, claims, *, key=None, alg="RS256", kid=None, access_token="at-1"):
        now = int(time.time())
        base = {"iss": ISSUER, "aud": CLIENT_ID, "sub": "sub-1", "iat": now, "exp": now + 300, "nonce": self.nonce,
                "preferred_username": "someone", "email": "someone@lab.example", "groups": [], "amr": ["pwd"]}
        base.update(claims)
        base = {k: v for k, v in base.items() if v is not None or k == "nonce"}
        if alg.startswith("RS") and "at_hash" not in base and access_token:
            digest = hashlib.sha256(access_token.encode()).digest()
            base["at_hash"] = base64.urlsafe_b64encode(digest[: len(digest) // 2]).rstrip(b"=").decode()
        if alg == "none":
            h = base64.urlsafe_b64encode(b'{"alg":"none","typ":"JWT"}').rstrip(b"=").decode()
            b = base64.urlsafe_b64encode(__import__("json").dumps(base).encode()).rstrip(b"=").decode()
            return f"{h}.{b}."
        return jwt.encode(base, key if key is not None else self.pem(self.key), algorithm=alg,
                          headers={"kid": kid or self.kid})

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.calls.append((request.method, request.url.path))
        if request.url.path.endswith("/.well-known/openid-configuration"):
            return httpx.Response(200, json={
                "issuer": ISSUER, "authorization_endpoint": "https://auth.test.example/application/o/authorize/",
                "token_endpoint": "https://auth.test.example/application/o/token/",
                "jwks_uri": "https://auth.test.example/application/o/gridwolf/jwks/",
                "end_session_endpoint": "https://auth.test.example/application/o/gridwolf/end-session/"})
        if request.url.path.endswith("/jwks/"):
            return httpx.Response(200, json=self.jwks())
        if request.url.path.endswith("/token/"):
            if self.token_status != 200:
                return httpx.Response(self.token_status, json={"error": "invalid_grant"})
            return httpx.Response(200, json={"id_token": self.next_token, "access_token": "at-1", "token_type": "Bearer"})
        return httpx.Response(404)


@pytest.fixture
def issuer(monkeypatch):
    fake = FakeIssuer()
    monkeypatch.setattr(oidc, "client_factory", lambda: httpx.AsyncClient(transport=httpx.MockTransport(fake.handler)))
    for k, v in dict(OIDC_ENABLED=True, OIDC_ISSUER=ISSUER, OIDC_CLIENT_ID=CLIENT_ID, OIDC_REDIRECT_URI=REDIRECT,
                     OIDC_REQUIRE_MFA=False).items():
        monkeypatch.setattr(settings, k, v)
    oidc.reset_cache()
    yield fake
    oidc.reset_cache()


async def sso(c: httpx.AsyncClient, fake: FakeIssuer, claims=None, *, next_path=None, mutate=None, tamper_state=None,
              drop_binder=False, **token_kw):
    """Runs the browser leg: /oidc/login -> (provider) -> /oidc/callback. Returns the callback response."""
    r = await c.get("/api/v1/auth/oidc/login", params={"next": next_path} if next_path else None)
    assert r.status_code == 302, r.text
    loc = urlsplit(r.headers["location"])
    q = {k: v[0] for k, v in parse_qs(loc.query).items()}
    assert loc.netloc == "auth.test.example"
    assert q["response_type"] == "code" and q["code_challenge_method"] == "S256" and q["client_id"] == CLIENT_ID
    assert q["redirect_uri"] == REDIRECT and q["scope"].split()[0] == "openid" and len(q["code_challenge"]) >= 43
    assert q["state"] and q["nonce"]
    fake.nonce = q["nonce"]
    fake.next_token = fake.id_token(claims or {}, **token_kw)
    if mutate:
        fake.next_token = mutate(fake.next_token)
    if drop_binder:
        c.cookies.delete("gw_oidc", path="/api/v1/auth/oidc")
    cb = await c.get("/api/v1/auth/oidc/callback", params={"code": "code-1", "state": tamper_state or q["state"]})
    return cb, q


def err(resp):
    assert resp.status_code == 302, resp.text
    loc = resp.headers["location"]
    assert loc.startswith("/login?error="), loc
    assert "gw_session" not in resp.headers.get("set-cookie", "")
    return loc.split("=", 1)[1]


async def ensure_user(a, ah, username, role, sites=(), sub=None):
    users = (await a.get("/api/v1/admin/users")).json()
    if not any(u["username"] == username for u in users):
        await provision(a, ah, username, role, sites, oidc_subject=sub, password=None)


GROUPS_VIEWER = ["FORGE-GW-site-a-Viewer"]


def test_oidc_login_page_config_and_redirect_safety(issuer):
    async def go():
        c = client()
        assert (await c.get("/api/v1/auth/config")).json()["oidc"] is True
        a, ah = await admin()
        await ensure_user(a, ah, "sso_view", "viewer", sub="sub-view")
        for evil in ("//evil.example/x", "https://evil.example", "/\\evil.example", "javascript:alert(1)", "/a b"):
            cb, _ = await sso(client(), issuer, {"sub": "sub-view", "groups": GROUPS_VIEWER, "preferred_username": "sso_view",
                                                  "email": "sso_view@lab.example"}, next_path=evil)
            assert cb.status_code == 302 and cb.headers["location"] == "/", (evil, cb.headers["location"])
        cb, _ = await sso(client(), issuer, {"sub": "sub-view", "groups": GROUPS_VIEWER, "preferred_username": "sso_view",
                                              "email": "sso_view@lab.example"}, next_path="/devices?x=1")
        assert cb.headers["location"] == "/devices?x=1"
    run(go)


def test_oidc_success_maps_role_and_sites_from_groups(issuer, monkeypatch):
    async def go():
        a, ah = await admin()
        await ensure_user(a, ah, "sso_a", "viewer", sub="sub-a")
        c = client()
        cb, _ = await sso(c, issuer, {"sub": "sub-a", "preferred_username": "sso_a", "email": "sso_a@lab.example",
                                      "groups": GROUPS_VIEWER})
        assert cb.status_code == 302 and cb.headers["location"] == "/"
        assert "httponly" in cb.headers["set-cookie"].lower()
        s = (await c.get("/api/v1/auth/session")).json()
        assert s["role"] == "viewer" and s["sites"] == [SITE_A] and s["auth_method"] == "oidc" and s["all_sites"] is False
        assert (await c.get("/api/v1/forge/live", params={"site": SITE_B})).status_code == 403
        out = await c.post("/api/v1/auth/logout", headers={"X-CSRF-Token": s["csrf_token"]})
        assert out.json()["logout_url"] is None                 # the identity-provider session is kept by default
        c2 = client()
        await sso(c2, issuer, {"sub": "sub-a", "preferred_username": "sso_a", "email": "sso_a@lab.example",
                               "groups": GROUPS_VIEWER})
        s2 = (await c2.get("/api/v1/auth/session")).json()
        monkeypatch.setattr(settings, "OIDC_END_SESSION_ON_LOGOUT", True)
        out = await c2.post("/api/v1/auth/logout", headers={"X-CSRF-Token": s2["csrf_token"]})
        assert out.json()["logout_url"].startswith("https://auth.test.example/")
    run(go)


def test_oidc_highest_role_wins_and_administrator_gets_all_sites(issuer):
    async def go():
        a, ah = await admin()
        await ensure_user(a, ah, "sso_multi", "viewer", sub="sub-multi")
        c = client()
        await sso(c, issuer, {"sub": "sub-multi", "preferred_username": "sso_multi", "email": "sso_multi@lab.example",
                              "groups": ["FORGE-GW-site-a-Viewer", "FORGE-GW-PlatformAdmin"]})
        s = (await c.get("/api/v1/auth/session")).json()
        assert s["role"] == "administrator" and s["all_sites"] is True
    run(go)


def test_oidc_group_change_takes_effect_at_next_sign_in_and_revocation_ends_old_session(issuer):
    async def go():
        a, ah = await admin()
        u = await provision(a, ah, "sso_chg", "viewer", [], oidc_subject="sub-chg", password=None) if not any(
            x["username"] == "sso_chg" for x in (await a.get("/api/v1/admin/users")).json()) else [
            x for x in (await a.get("/api/v1/admin/users")).json() if x["username"] == "sso_chg"][0]
        claims = {"sub": "sub-chg", "preferred_username": "sso_chg", "email": "sso_chg@lab.example"}
        c1 = client()
        await sso(c1, issuer, dict(claims, groups=["FORGE-GW-site-a-Viewer"]))
        assert (await c1.get("/api/v1/auth/session")).json()["role"] == "viewer"
        c2 = client()
        await sso(c2, issuer, dict(claims, groups=["FORGE-GW-site-b-Analyst"]))
        s2 = (await c2.get("/api/v1/auth/session")).json()
        assert s2["role"] == "security_analyst" and s2["sites"] == [SITE_B]
        # the older session keeps its snapshot (documented limit) until an administrator revokes it
        assert (await c1.get("/api/v1/auth/session")).json()["role"] == "viewer"
        assert (await a.post(f"/api/v1/admin/users/{u['id']}/revoke-sessions", headers=ah)).json()["revoked"] >= 2
        assert (await c1.get("/api/v1/auth/session")).status_code == 401
        assert (await c2.get("/api/v1/auth/session")).status_code == 401
    run(go)


def test_oidc_unregistered_user_is_denied_and_no_account_is_created(issuer):
    async def go():
        a, ah = await admin()
        before = {u["username"] for u in (await a.get("/api/v1/admin/users")).json()}
        c = client()
        cb, _ = await sso(c, issuer, {"sub": "sub-stranger", "preferred_username": "stranger", "email": "stranger@lab.example",
                                      "groups": ["FORGE-GW-PlatformAdmin"]})
        assert err(cb) == "unregistered"
        assert (await c.get("/api/v1/auth/session")).status_code == 401
        assert {u["username"] for u in (await a.get("/api/v1/admin/users")).json()} == before
    run(go)


def test_oidc_user_without_a_gridwolf_group_gets_no_role(issuer):
    async def go():
        a, ah = await admin()
        await ensure_user(a, ah, "sso_none", "viewer", sub="sub-none")
        cb, _ = await sso(client(), issuer, {"sub": "sub-none", "preferred_username": "sso_none",
                                             "email": "sso_none@lab.example", "groups": ["Some-Other-Group"]})
        assert err(cb) == "norole"
    run(go)


def test_oidc_first_login_binding_requires_both_username_and_email_and_cannot_be_hijacked(issuer):
    async def go():
        a, ah = await admin()
        await ensure_user(a, ah, "sso_bind", "viewer")
        grp = ["FORGE-GW-site-a-Viewer"]
        c = client()
        cb, _ = await sso(c, issuer, {"sub": "sub-x", "preferred_username": "sso_bind", "email": "other@lab.example", "groups": grp})
        assert err(cb) == "unregistered"                          # e-mail differs: no binding
        cb, _ = await sso(client(), issuer, {"sub": "sub-bind", "preferred_username": "sso_bind",
                                             "email": "sso_bind@lab.example", "groups": grp})
        assert cb.status_code == 302 and cb.headers["location"] == "/"       # first login binds (issuer, sub)
        cb, _ = await sso(client(), issuer, {"sub": "sub-attacker", "preferred_username": "sso_bind",
                                             "email": "sso_bind@lab.example", "groups": grp})
        assert err(cb) in ("unregistered", "denied")             # same name+email, different subject: refused
        cb, _ = await sso(client(), issuer, {"sub": "sub-bind", "preferred_username": "renamed_upstream",
                                             "email": "sso_bind@lab.example", "groups": grp})
        assert cb.status_code == 302 and cb.headers["location"] == "/"       # the link, not the name, identifies
    run(go)


def test_oidc_deactivated_account_is_refused(issuer):
    async def go():
        a, ah = await admin()
        await ensure_user(a, ah, "sso_off", "viewer", sub="sub-off")
        uid = [x for x in (await a.get("/api/v1/admin/users")).json() if x["username"] == "sso_off"][0]["id"]
        await a.patch(f"/api/v1/admin/users/{uid}", json={"is_active": False}, headers=ah)
        cb, _ = await sso(client(), issuer, {"sub": "sub-off", "preferred_username": "sso_off",
                                             "email": "sso_off@lab.example", "groups": ["FORGE-GW-site-a-Viewer"]})
        assert err(cb) in ("disabled", "denied", "unregistered")
        await a.patch(f"/api/v1/admin/users/{uid}", json={"is_active": True}, headers=ah)
    run(go)


def test_oidc_mfa_policy(issuer, monkeypatch):
    async def go():
        a, ah = await admin()
        await ensure_user(a, ah, "sso_mfa", "viewer", sub="sub-mfa")
        claims = {"sub": "sub-mfa", "preferred_username": "sso_mfa", "email": "sso_mfa@lab.example",
                  "groups": ["FORGE-GW-site-a-Viewer"]}
        monkeypatch.setattr(settings, "OIDC_REQUIRE_MFA", True)
        assert err((await sso(client(), issuer, dict(claims, amr=["pwd"])))[0]) == "mfa_required"
        c = client()
        cb, _ = await sso(c, issuer, dict(claims, amr=["pwd", "mfa"]))
        assert cb.status_code == 302 and (await c.get("/api/v1/auth/session")).json()["mfa"] is True
    run(go)


@pytest.mark.parametrize("name,claims,kw", [
    ("wrong_audience", {"aud": "someone-else"}, {}),
    ("wrong_issuer", {"iss": "https://evil.example/"}, {}),
    ("expired", {"exp": int(time.time()) - 3600, "iat": int(time.time()) - 7200}, {}),
    ("wrong_nonce", {"nonce": "not-the-nonce"}, {}),
    ("missing_sub", {"sub": None}, {}),
    ("bad_at_hash", {"at_hash": "AAAAAAAAAAAAAAAAAAAAAA"}, {}),
    ("multi_aud_without_azp", {"aud": [CLIENT_ID, "other"]}, {}),
])
def test_oidc_rejects_invalid_id_tokens(issuer, name, claims, kw):
    async def go():
        a, ah = await admin()
        await ensure_user(a, ah, "sso_tok", "viewer", sub="sub-tok")
        base = {"sub": "sub-tok", "preferred_username": "sso_tok", "email": "sso_tok@lab.example",
                "groups": ["FORGE-GW-site-a-Viewer"]}
        base.update(claims)
        if name == "wrong_nonce":
            cb, _ = await sso(client(), issuer, base)
            assert err(cb) == "token_invalid"
            return
        c = client()
        cb, _ = await sso(c, issuer, base, **kw)
        assert err(cb) == "token_invalid", name
        assert (await c.get("/api/v1/auth/session")).status_code == 401
    run(go)


def test_oidc_rejects_forged_signatures_and_unsafe_algorithms(issuer):
    async def go():
        a, ah = await admin()
        await ensure_user(a, ah, "sso_forge", "viewer", sub="sub-forge")
        base = {"sub": "sub-forge", "preferred_username": "sso_forge", "email": "sso_forge@lab.example",
                "groups": ["FORGE-GW-PlatformAdmin"]}
        # signed by a different key
        cb, _ = await sso(client(), issuer, base, key=issuer.pem(issuer.other))
        assert err(cb) == "token_invalid"
        # unknown key id
        cb, _ = await sso(client(), issuer, base, kid="unknown")
        assert err(cb) == "token_invalid"
        # alg=none
        cb, _ = await sso(client(), issuer, base, alg="none")
        assert err(cb) == "token_invalid"
        # HS256 with the public key as the shared secret (algorithm confusion)
        pub = issuer.key.public_key().public_bytes(serialization.Encoding.PEM,
                                                   serialization.PublicFormat.SubjectPublicKeyInfo).decode()
        import hmac, json as _json
        def hs256(tok):
            payload = tok.split(".")[1]
            head = base64.urlsafe_b64encode(_json.dumps({"alg": "HS256", "typ": "JWT", "kid": issuer.kid}).encode()).rstrip(b"=").decode()
            sig = hmac.new(pub.encode(), f"{head}.{payload}".encode(), hashlib.sha256).digest()
            return f"{head}.{payload}." + base64.urlsafe_b64encode(sig).rstrip(b"=").decode()
        cb, _ = await sso(client(), issuer, base, mutate=hs256)
        assert err(cb) == "token_invalid"
        # a payload edited after signing
        def edit(tok):
            h, p, s = tok.split(".")
            data = __import__("json").loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4)))
            data["groups"] = ["FORGE-GW-PlatformAdmin"]
            data["sub"] = "sub-forge"
            p2 = base64.urlsafe_b64encode(__import__("json").dumps(dict(data, email="x@x.example")).encode()).rstrip(b"=").decode()
            return f"{h}.{p2}.{s}"
        cb, _ = await sso(client(), issuer, dict(base, groups=["FORGE-GW-site-a-Viewer"]), mutate=edit)
        assert err(cb) == "token_invalid"
    run(go)


def test_oidc_state_is_single_use_bound_to_the_browser_and_required(issuer):
    async def go():
        a, ah = await admin()
        await ensure_user(a, ah, "sso_state", "viewer", sub="sub-state")
        claims = {"sub": "sub-state", "preferred_username": "sso_state", "email": "sso_state@lab.example",
                  "groups": ["FORGE-GW-site-a-Viewer"]}
        c = client()
        cb, q = await sso(c, issuer, claims)
        assert cb.status_code == 302 and cb.headers["location"] == "/"
        replay = await c.get("/api/v1/auth/oidc/callback", params={"code": "code-1", "state": q["state"]})
        assert err(replay) == "state"                                       # single use
        cb, _ = await sso(client(), issuer, claims, drop_binder=True)
        assert err(cb) == "state"                                           # no browser binding cookie
        cb, _ = await sso(client(), issuer, claims, tamper_state="forged-state-value")
        assert err(cb) == "state"
        none = await client().get("/api/v1/auth/oidc/callback", params={"code": "c"})
        assert err(none) == "state"
        # a different browser cannot complete a flow another browser started
        victim = client()
        r = await victim.get("/api/v1/auth/oidc/login")
        state = parse_qs(urlsplit(r.headers["location"]).query)["state"][0]
        issuer.nonce = parse_qs(urlsplit(r.headers["location"]).query)["nonce"][0]
        issuer.next_token = issuer.id_token(claims)
        attacker = client()
        attacker.cookies.set("gw_oidc", "a-binder-the-attacker-made-up", path="/api/v1/auth/oidc")
        assert err(await attacker.get("/api/v1/auth/oidc/callback", params={"code": "c", "state": state})) == "state"
    run(go)


def test_oidc_expired_transaction_and_provider_errors(issuer):
    async def go():
        from app.core.database import async_session_factory
        from app.models.auth import OidcTransaction
        from datetime import timedelta
        c = client()
        r = await c.get("/api/v1/auth/oidc/login")
        state = parse_qs(urlsplit(r.headers["location"]).query)["state"][0]
        from app.core.security import token_hash
        async with async_session_factory() as db:
            tx = await db.get(OidcTransaction, token_hash(state))
            tx.expires_at = authz.utcnow() - timedelta(seconds=1)
            await db.commit()
        assert err(await c.get("/api/v1/auth/oidc/callback", params={"code": "c", "state": state})) == "state"
        # the provider reports an error / refuses the code
        c2 = client()
        r = await c2.get("/api/v1/auth/oidc/login")
        state = parse_qs(urlsplit(r.headers["location"]).query)["state"][0]
        assert err(await c2.get("/api/v1/auth/oidc/callback", params={"error": "access_denied", "state": state})) == "denied"
        issuer.token_status = 400
        cb, _ = await sso(client(), issuer, {})
        assert err(cb) == "exchange_failed"
        issuer.token_status = 200
    run(go)


def test_oidc_disabled_returns_not_found():
    async def go():
        c = client()
        assert (await c.get("/api/v1/auth/oidc/login")).status_code == 404
        assert (await c.get("/api/v1/auth/oidc/callback", params={"code": "x", "state": "y"})).status_code == 404
    run(go)


def test_oidc_group_mapping_helpers(monkeypatch):
    g = oidc.map_grants({"groups": ["FORGE-GW-example-lab-Viewer", "FORGE-Team-Security", 5, None], "amr": ["pwd", "otp"]})
    assert g.mfa is True and list(g.groups) == ["FORGE-GW-example-lab-Viewer", "FORGE-Team-Security"]
    assert sites_svc.parse_group("not-a-list-of-groups") is None
    P = P_ = sites_svc.parse_group
    assert P("FORGE-GW-PlatformAdmin") == ("platform", None)
    assert P("FORGE-GW-example-lab-SiteAdmin") == ("example-lab", "site_admin")
    assert P("FORGE-GW-example-lab-Analyst") == ("example-lab", "security_analyst")
    assert P("FORGE-GW-example-lab-OTEngineer") == ("example-lab", "ot_engineer")
    assert P("FORGE-GW-example-lab-ReportViewer") == ("example-lab", "report_viewer")
    assert P("FORGE-GW-example-lab-HealthViewer") == ("example-lab", "health_viewer")
    assert P("FORGE-GW-example-lab-Viewer") == ("example-lab", "viewer")
    for bad in ("FORGE-GW-../x-Viewer", "FORGE-GW-example-lab-Root", "FORGE-GW-Viewer", "FORGE-Team-Security", "other"):
        assert P(bad) is None, bad
    verifier, challenge = oidc.pkce_pair()
    assert len(verifier) >= 43 and challenge == base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()


# ----------------------------------------------------------------------------------- bootstrap
def test_first_admin_bootstrap_never_prints_the_generated_password(tmp_path, capsys, monkeypatch, caplog):
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from app.core import database
    from app.core.database import Base
    from app.core.security import verify_password
    from app.models.user import User

    path = tmp_path / "secrets" / "bootstrap-admin-password"

    async def go():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path}/b.db")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        monkeypatch.setattr(database, "async_session_factory", factory)
        monkeypatch.setattr(settings, "ADMIN_PASSWORD", "")
        monkeypatch.setattr(settings, "ADMIN_PASSWORD_FILE", "")
        monkeypatch.setattr(settings, "BOOTSTRAP_PASSWORD_FILE", str(path))
        with caplog.at_level("DEBUG"):
            await database._seed_first_admin()
        async with factory() as db:
            users = (await db.execute(User.__table__.select())).fetchall()
        assert len(users) == 1
        secret = path.read_text().strip()
        assert len(secret) >= 20 and stat.S_IMODE(path.stat().st_mode) == 0o600
        assert verify_password(secret, users[0].hashed_password)
        out = capsys.readouterr()
        assert secret not in out.out + out.err + caplog.text
        await database._seed_first_admin()                 # idempotent
        async with factory() as db:
            assert len((await db.execute(User.__table__.select())).fetchall()) == 1
        await engine.dispose()
    asyncio.run(go())


def test_secret_material_is_not_exposed_by_the_config_or_error_paths():
    async def go():
        c = client()
        for p in ("/api/v1/auth/config", "/version", "/health"):
            text = (await c.get(p)).text
            assert settings.SECRET_KEY not in text and ADMIN_PW not in text
        r = await c.post("/api/v1/auth/login", json={"username": "admin", "password": "x"})
        assert "Traceback" not in r.text and ADMIN_PW not in r.text
    run(go)


# ------------------------------------------------------------------------------------------------ Gate 3: secrets
def test_secret_key_and_database_url_come_from_files_and_a_bad_file_is_fatal(tmp_path, monkeypatch):
    from app.core.config import Settings

    # Synthetic file-secret fixture, never connected to a database. The credential-shaped
    # URL is intentional: this checks secret-file precedence, not deployment credentials.
    key, dburl = tmp_path / "secret-key", tmp_path / "database-url"
    key.write_text("k" * 64 + "\n")
    dburl.write_text("postgresql+asyncpg://gridwolf:from-file@db:5432/gridwolf\n")
    for name in ("SECRET_KEY", "DATABASE_URL", "ADMIN_PASSWORD"):
        monkeypatch.delenv("GRIDWOLF_" + name, raising=False)
    monkeypatch.setenv("GRIDWOLF_SECRET_KEY_FILE", str(key))
    monkeypatch.setenv("GRIDWOLF_DATABASE_URL_FILE", str(dburl))
    s = Settings()
    assert s.SECRET_KEY == "k" * 64 and s.DATABASE_URL.endswith("from-file@db:5432/gridwolf")

    # the file wins over a plain variable, so a stale value in the environment cannot shadow the secret
    monkeypatch.setenv("GRIDWOLF_SECRET_KEY", "stale-from-environment")
    assert Settings().SECRET_KEY == "k" * 64

    # a named file that is missing or empty never degrades to an auto-generated key or the SQLite default
    key.write_text("\n")
    with pytest.raises(SystemExit):
        Settings()
    monkeypatch.setenv("GRIDWOLF_SECRET_KEY_FILE", str(tmp_path / "absent"))
    with pytest.raises(SystemExit):
        Settings()
