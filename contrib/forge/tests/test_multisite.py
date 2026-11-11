"""Multi-site RBAC: registry, per-site roles, site selection, alias compatibility, site administration,
sign-in with the FORGE-GW-* groups. Synthetic data, isolated SQLite (shares the harness of test_auth_rbac)."""
import pytest

from test_auth_rbac import (PW, admin, client, ensure_user, issuer, local_login, provision, run,  # noqa: F401
                            seed_world, sites_svc, sso)

LAB = "example-lab"


async def mkuser(a, ah, name, role="viewer"):
    users = (await a.get("/api/v1/admin/users")).json()
    if not any(u["username"] == name for u in users):
        await provision(a, ah, name, role, [])
    return await local_login(name, PW)


async def site(a, ah, sid, name=None):
    r = await a.post("/api/v1/sites", json={"id": sid, "name": name or sid.upper()}, headers=ah)
    assert r.status_code in (201, 409), r.text


async def grant(a, ah, sid, who, role, kind="user"):
    r = await a.post(f"/api/v1/sites/{sid}/assignments", json={"subject_type": kind, "subject": who, "role": role},
                     headers=ah)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_bootstrap_registers_only_example_lab_with_the_legacy_example_lab_alias():
    async def go():
        a, ah = await admin()
        rows = (await a.get("/api/v1/sites")).json()
        lab = [s for s in rows if s["id"] == LAB]
        assert lab and lab[0]["aliases"] == ["legacy-example-lab"] and lab[0]["status"] == "active" and lab[0]["template"] == "lab"
        assert "example-plant" not in {s["id"] for s in rows}            # other sites are registered separately
        assert (await a.post("/api/v1/sites", json={"id": "legacy-example-lab", "name": "x"}, headers=ah)).status_code == 409
        for bad in ("A", "x/y", "all", "../x", "-ab", "a b"):
            assert (await a.post("/api/v1/sites", json={"id": bad, "name": "x"}, headers=ah)).status_code == 422, bad
    run(go)


def test_roles_are_per_site_and_never_widen_across_sites():
    async def go():
        await seed_world()
        a, ah = await admin()
        await site(a, ah, "plant-x")
        c, ch = await mkuser(a, ah, "ms_mixed")
        await grant(a, ah, LAB, "ms_mixed", "security_analyst")
        await grant(a, ah, "plant-x", "ms_mixed", "viewer")
        c, ch = await local_login("ms_mixed", PW)
        s = (await c.get("/api/v1/auth/session")).json()
        roles = {x["id"]: x["roles"] for x in s["site_list"]}
        assert roles == {LAB: ["security_analyst"], "plant-x": ["viewer"]}
        assert s["all_sites"] is False and s["is_platform"] is False
        perms = {x["id"]: set(x["permissions"]) for x in s["site_list"]}
        assert "export" in perms[LAB] and "export" not in perms["plant-x"]
        # a viewer-only site cannot export even though the user is an analyst elsewhere
        assert (await c.get("/api/v1/ics/devices/", params={"site": "plant-x"})).status_code in (200, 404, 422)
        ov = (await c.get("/api/v1/forge/overview")).json()
        assert set(ov["sites"]) == {LAB, "plant-x"}
        # selecting a site narrows; an ungranted selection is refused
        c.cookies.set("gw_site", "plant-x")
        assert list((await c.get("/api/v1/forge/overview")).json()["sites"]) == ["plant-x"]
        assert (await c.get("/api/v1/auth/session")).json()["selected_site"] == "plant-x"
        c.cookies.set("gw_site", "nowhere")
        assert (await c.get("/api/v1/forge/overview")).status_code == 403
        assert (await c.get("/api/v1/auth/session")).status_code == 200          # recovery stays possible
        assert (await c.get("/api/v1/sites/mine")).status_code == 200
        c.cookies.delete("gw_site")
        assert list((await c.get("/api/v1/forge/overview", headers={"X-Gridwolf-Site": LAB})).json()["sites"]) == [LAB]
    run(go)


def test_report_viewer_and_health_viewer_get_only_their_capability():
    async def go():
        await seed_world()
        a, ah = await admin()
        await mkuser(a, ah, "ms_rep")
        await mkuser(a, ah, "ms_health")
        await grant(a, ah, LAB, "ms_rep", "report_viewer")
        await grant(a, ah, LAB, "ms_health", "health_viewer")
        r, _ = await local_login("ms_rep", PW)
        h, _ = await local_login("ms_health", PW)
        for who in (r, h):
            assert (await who.get("/api/v1/ics/devices/")).status_code == 403
            assert (await who.get("/api/v1/ics/sessions/")).status_code == 403
            assert (await who.get("/api/v1/forge/observations")).status_code == 403
            assert (await who.get("/api/v1/forge/intel")).status_code == 403
            assert (await who.get("/api/v1/forge/overview")).status_code == 200
        assert (await r.get("/api/v1/ics/findings/reports/list")).status_code in (200, 404)
        body = (await r.get("/api/v1/forge/overview")).json()
        assert not body.get("sensors")                              # no Sensor or evidence detail through Overview
        assert (await h.get("/api/v1/ics/findings/reports/list")).status_code == 403
    run(go)


def test_site_admin_is_scoped_cannot_grant_site_admin_and_cannot_touch_other_sites():
    async def go():
        a, ah = await admin()
        await site(a, ah, "plant-y")
        await site(a, ah, "plant-z")
        await mkuser(a, ah, "ms_sadm")
        await mkuser(a, ah, "ms_target")
        await grant(a, ah, "plant-y", "ms_sadm", "site_admin")
        s, sh = await local_login("ms_sadm", PW)
        assert (await s.post("/api/v1/sites/plant-y/assignments", headers=sh,
                             json={"subject_type": "user", "subject": "ms_target", "role": "viewer"})).status_code == 201
        assert (await s.post("/api/v1/sites/plant-y/assignments", headers=sh,
                             json={"subject_type": "user", "subject": "ms_target", "role": "site_admin"})).status_code == 403
        assert (await s.post("/api/v1/sites/plant-z/assignments", headers=sh,
                             json={"subject_type": "user", "subject": "ms_target", "role": "viewer"})).status_code == 404
        assert (await s.get("/api/v1/sites/plant-z/access")).status_code == 404
        assert (await s.post("/api/v1/sites", json={"id": "plant-q", "name": "Q"}, headers=sh)).status_code == 403
        assert (await s.post("/api/v1/sites/plant-y/status", json={"status": "disabled"}, headers=sh)).status_code == 403
        rev = (await s.get("/api/v1/sites/plant-y/access")).json()
        assert {x["role"] for x in rev["assignments"]} == {"site_admin", "viewer"}
        # a site administrator cannot remove their own administration
        own = [x["id"] for x in rev["assignments"] if x["role"] == "site_admin"][0]
        assert (await s.delete(f"/api/v1/sites/plant-y/assignments/{own}", headers=sh)).status_code in (403, 422)
        assert (await s.patch("/api/v1/sites/plant-y", json={"description": "edited"}, headers=sh)).status_code == 200
        t, _ = await local_login("ms_target", PW)
        assert [x["id"] for x in (await t.get("/api/v1/sites/mine")).json()["sites"]] == ["plant-y"]
    run(go)


def test_disabled_and_retired_sites_grant_nothing():
    async def go():
        a, ah = await admin()
        await site(a, ah, "plant-d")
        await mkuser(a, ah, "ms_dis")
        await grant(a, ah, "plant-d", "ms_dis", "viewer")
        d, _ = await local_login("ms_dis", PW)
        assert [x["id"] for x in (await d.get("/api/v1/sites/mine")).json()["sites"]] == ["plant-d"]
        assert (await a.post("/api/v1/sites/plant-d/status", json={"status": "disabled"}, headers=ah)).status_code == 200
        assert (await d.get("/api/v1/sites/mine")).json()["sites"] == []
        assert (await a.post("/api/v1/sites/plant-d/status", json={"status": "active"}, headers=ah)).status_code == 200
        assert len((await d.get("/api/v1/sites/mine")).json()["sites"]) == 1
        assert (await a.post("/api/v1/sites/plant-d/status", json={"status": "retired"}, headers=ah)).status_code == 200
        assert (await d.get("/api/v1/sites/mine")).json()["sites"] == []
        assert (await a.post("/api/v1/sites/plant-d/status", json={"status": "active"}, headers=ah)).status_code in (409, 422)
    run(go)


def test_sessions_need_explicit_site_identity_names_never_authorize():
    async def go():
        from app.core.database import async_session_factory
        from app.models.auth import SessionSite
        from app.models.ics import Session
        world, ids = await seed_world()
        a, ah = world["admin"]
        await grant(a, ah, LAB, "viewer_a", "viewer")
        async with async_session_factory() as db:
            named = Session(name=sites_svc.LIVE_SESSION_PREFIX + "legacy-example-lab", description="name only", status="active")
            old = Session(name="historic capture", description="no provenance", status="active")
            db.add_all([named, old])
            await db.commit()
            nid, oid = named.id, old.id
        v, _ = world["viewer_a"]
        listed = {s["id"] for s in (await v.get("/api/v1/ics/sessions/")).json()}
        assert nid not in listed and oid not in listed                  # name alone and missing provenance: restricted
        assert (await v.get(f"/api/v1/ics/sessions/{nid}")).status_code in (403, 404)
        adm = {s["id"] for s in (await a.get("/api/v1/ics/sessions/")).json()}
        assert {nid, oid} <= adm                                          # a platform administrator still sees them
        async with async_session_factory() as db:
            db.add(SessionSite(session_id=nid, site_id=LAB, assigned_by="test"))
            await db.commit()
        listed = {s["id"] for s in (await v.get("/api/v1/ics/sessions/")).json()}
        assert nid in listed                                              # an explicit site row (canonical) grants
    run(go)


def test_team_profiles_apply_only_on_request_and_sources_are_not_auto_enabled():
    async def go():
        a, ah = await admin()
        await site(a, ah, "plant-t", "Plant T")
        before = (await a.get("/api/v1/sites/plant-t/access")).json()
        assert before["assignments"] == [] and "FORGE-Team-Security" in before["team_profiles"]
        r = await a.post("/api/v1/sites/plant-t/team-profiles", headers=ah)
        assert r.status_code == 200 and r.json()["applied"]
        after = {(x["subject"], x["role"]) for x in (await a.get("/api/v1/sites/plant-t/access")).json()["assignments"]}
        assert ("FORGE-Team-Security", "security_analyst") in after and ("FORGE-Team-Engineering", "ot_engineer") in after
        assert not any(role == "site_admin" for _, role in after)         # teams never grant administration
        assert (await a.post("/api/v1/sites/plant-t/team-profiles",
                             headers={**ah})).status_code == 200            # idempotent
        src = await a.post("/api/v1/sites/plant-t/sources", json={"source_type": "sensor", "source_id": "sensor-t1"},
                           headers=ah)
        assert src.status_code == 201 and src.json()["enabled"] is False
        en = await a.patch(f"/api/v1/sites/plant-t/sources/{src.json()['id']}", json={"enabled": True}, headers=ah)
        assert en.status_code == 200 and en.json()["enabled"] is True
        st = (await a.get("/api/v1/sites/plant-t/status")).json()
        assert st
    run(go)


def test_oidc_group_roles_are_per_site_and_unregistered_sites_grant_nothing(issuer):  # noqa: F811
    async def go():
        a, ah = await admin()
        await site(a, ah, "plant-o")
        await ensure_user(a, ah, "sso_ms", "viewer", sub="sub-ms")
        c = client()
        cb, _ = await sso(c, issuer, {"sub": "sub-ms", "preferred_username": "sso_ms", "email": "sso_ms@lab.example",
                                      "groups": [f"FORGE-GW-{LAB}-Analyst", "FORGE-GW-plant-o-ReportViewer",
                                                 "FORGE-GW-not-registered-SiteAdmin"]})
        assert cb.status_code == 302 and cb.headers["location"] == "/"
        s = (await c.get("/api/v1/auth/session")).json()
        assert {x["id"]: x["roles"] for x in s["site_list"]} == {LAB: ["security_analyst"], "plant-o": ["report_viewer"]}
        assert s["is_platform"] is False and "admin" not in s["permissions"]
        assert (await c.get("/api/v1/admin/users")).status_code == 403
        assert (await c.post("/api/v1/sites", json={"id": "plant-hack", "name": "x"},
                             headers={"X-CSRF-Token": s["csrf_token"]})).status_code == 403
        c2 = client()
        await sso(c2, issuer, {"sub": "sub-ms", "preferred_username": "sso_ms", "email": "sso_ms@lab.example",
                               "groups": ["FORGE-GW-PlatformAdmin"]})
        s2 = (await c2.get("/api/v1/auth/session")).json()
        assert s2["is_platform"] is True and s2["role"] == "administrator"
    run(go)


def test_sso_sessions_live_only_as_long_as_their_group_claims_are_fresh(issuer):  # noqa: F811
    async def go():
        a, ah = await admin()
        await ensure_user(a, ah, "sso_age", "viewer", sub="sub-age")
        c = client()
        cb, _ = await sso(c, issuer, {"sub": "sub-age", "preferred_username": "sso_age", "email": "sso_age@lab.example",
                                      "groups": [f"FORGE-GW-{LAB}-Viewer"]})
        assert cb.status_code == 302
        s = (await c.get("/api/v1/auth/session")).json()
        from app.core.config import settings
        assert 0 < s["expires_in"] <= settings.OIDC_CLAIMS_MAX_AGE_MINUTES * 60 < settings.SESSION_ABSOLUTE_MINUTES * 60
        # a group removed in authentik takes effect at the next (silent) sign-in
        c2 = client()
        await sso(c2, issuer, {"sub": "sub-age", "preferred_username": "sso_age", "email": "sso_age@lab.example",
                               "groups": [f"FORGE-GW-{LAB}-ReportViewer"]})
        roles = {x["id"]: x["roles"] for x in (await c2.get("/api/v1/auth/session")).json()["site_list"]}
        assert roles == {LAB: ["report_viewer"]}
    run(go)


def test_ingest_drops_items_of_disabled_sites_and_unenabled_sources_only():
    from app.forge_live.ingest import blocked_by

    async def go():
        a, ah = await admin()
        await site(a, ah, "plant-g", "Plant G")
        src = await a.post("/api/v1/sites/plant-g/sources", json={"source_type": "sensor", "source_id": "g-sensor"},
                           headers=ah)
        assert src.status_code == 201
        from app.core.database import async_session_factory
        from app.forge_live.ingest import SqlStore
        async with async_session_factory() as db:
            gate = await SqlStore(db).gate()
        assert blocked_by(gate, "plant-g", "g-sensor") == "source_disabled"        # associated, not enabled
        assert blocked_by(gate, "plant-g", "other-sensor") is None                 # never associated: registry decides
        assert blocked_by(gate, "legacy-example-lab", "example-sensor01") is None  # the example lab Sensor is unaffected
        en = await a.patch(f"/api/v1/sites/plant-g/sources/{src.json()['id']}", json={"enabled": True}, headers=ah)
        assert en.status_code == 200
        async with async_session_factory() as db:
            gate = await SqlStore(db).gate()
        assert blocked_by(gate, "plant-g", "g-sensor") is None
        assert (await a.post("/api/v1/sites/plant-g/status", json={"status": "retired"}, headers=ah)).status_code == 200
        async with async_session_factory() as db:
            gate = await SqlStore(db).gate()
        assert blocked_by(gate, "plant-g", "g-sensor") == "site_inactive"
        assert blocked_by(None, "plant-g", "g-sensor") is None
    run(go)


def test_revoked_assignment_ends_access_and_overview_lists_only_granted_sites():
    async def go():
        a, ah = await admin()
        await site(a, ah, "plant-r1")
        await site(a, ah, "plant-r2")
        await mkuser(a, ah, "ms_rev")
        g1 = await grant(a, ah, "plant-r1", "ms_rev", "security_analyst")
        await grant(a, ah, "plant-r2", "ms_rev", "report_viewer")
        u, uh = await local_login("ms_rev", PW)
        ov = (await u.get("/api/v1/forge/overview")).json()["sites"]
        assert {"plant-r1", "plant-r2"} <= set(ov) and LAB not in ov
        assert (await u.get("/api/v1/ics/devices/", headers={"X-Gridwolf-Site": "plant-r1"})).status_code == 200
        assert (await u.get("/api/v1/ics/devices/", headers={"X-Gridwolf-Site": "plant-r2"})).status_code == 403
        # revoking the assignment ends access on the next request, with the same session
        assert (await a.delete(f"/api/v1/sites/plant-r1/assignments/{g1}", headers=ah)).status_code in (200, 204)
        assert (await u.get("/api/v1/ics/devices/", headers={"X-Gridwolf-Site": "plant-r1"})).status_code in (403, 404)
        assert set((await u.get("/api/v1/forge/overview")).json()["sites"]) == {"plant-r2"}
        # a platform administrator sees every active site in the aggregation
        assert {"plant-r1", "plant-r2", LAB} <= set((await a.get("/api/v1/forge/overview")).json()["sites"])
    run(go)


def test_sensor_location_is_site_admin_editable_display_only_and_site_scoped():
    async def go():
        await seed_world()
        a, ah = await admin()
        await site(a, ah, "plant-loc")
        await site(a, ah, "plant-oth")
        sa, sah = await mkuser(a, ah, "loc_sa", "viewer")
        await grant(a, ah, "plant-loc", "loc_sa", "site_admin")
        await grant(a, ah, "plant-oth", "loc_sa", "viewer")
        vw, vh = await mkuser(a, ah, "loc_vw", "viewer")
        await grant(a, ah, "plant-loc", "loc_vw", "viewer")
        sa, sah = await local_login("loc_sa", PW)
        vw, vh = await local_login("loc_vw", PW)
        url = "/api/v1/sites/plant-loc/sensors/sensor-l1/location"
        r = await sa.put(url, json={"location": "  Paint   line "}, headers=sah)
        assert r.status_code == 200 and r.json()["location"] == "Paint line", r.text
        # association is independent: no source row, nothing enabled
        assert (await a.get("/api/v1/sites/plant-loc/sources")).json() == []
        # replace, then clear
        assert (await sa.put(url, json={"location": "Fab"}, headers=sah)).json()["location"] == "Fab"
        assert (await sa.put(url, json={"location": ""}, headers=sah)).json()["location"] == ""
        # validation
        assert (await sa.put(url, json={"location": "x" * 121}, headers=sah)).status_code == 422
        assert (await sa.put(url, json={"location": "bad\x07"}, headers=sah)).status_code == 422
        assert (await sa.put("/api/v1/sites/plant-loc/sensors/bad%20id/location", json={"location": "A"},
                             headers=sah)).status_code == 422
        # a Viewer, and a Site Administrator of another site, cannot edit
        assert (await vw.put(url, json={"location": "Hack"}, headers=vh)).status_code == 403
        assert (await sa.put("/api/v1/sites/plant-oth/sensors/sensor-l1/location", json={"location": "Hack"},
                             headers=sah)).status_code in (403, 404)
        # the label is shown on the Sensor list for the site admin, who reads it back
        assert (await sa.put(url, json={"location": "Paint line"}, headers=sah)).status_code == 200
        from app.forge_live import ingest as live
        from app.services.sites import sensor_locations
        from app.core.database import async_session_factory

        async def fake_views(store, now):                 # the registry DDL is Postgres-only; stub the view source
            return [{"site": "plant-loc", "sensor": "sensor-l1", "display_name": "Loc test", "status": "offline",
                     "registered": True}]
        real, live.sensor_views = live.sensor_views, fake_views
        try:
            listed = (await sa.get("/api/v1/forge/sensors", params={"site": "plant-loc"})).json()["sensors"]
            assert [(x["sensor"], x["location"]) for x in listed] == [("sensor-l1", "Paint line")], listed
            assert (await vw.get("/api/v1/forge/sensors", params={"site": "plant-loc"})).status_code == 403
            live_v = (await vw.get("/api/v1/forge/live", params={"site": "plant-loc"})).json()["sensors"]
            assert [x["location"] for x in live_v] == ["Paint line"], live_v
        finally:
            live.sensor_views = real
        async with async_session_factory() as db:
            assert (await sensor_locations(db, "plant-loc")) == {("plant-loc", "sensor-l1"): "Paint line"}
            assert (await sensor_locations(db, "plant-oth")) == {}
    run(go)
