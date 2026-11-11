"""Read-only FORGE live-telemetry API for Gridwolf (installed as app/api/v1/forge_live.py).

Serves the Live Capture and External Tools pages from the data the live pipeline already
stored: Sensor registry and per-Sensor tool health (from Sensor heartbeats verified against the
Wazuh agent binding), the site sessions the ingest materializes, raw per-Sensor evidence and the
Wazuh-side health the Core feed measured on the Core host. It never writes, never captures
packets and never reads secrets. Nothing here is a placeholder: a value that was not measured is
reported as `null`/`unknown`.

The schema is created and migrated by the ingest, not here; before the first ingest run the
endpoints answer 503.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.authz import Principal, filter_sites, require, require_site
from app.models.auth import SessionSite
from app.core.database import get_db
from app.forge_live import ingest as live

router = APIRouter(prefix="/forge", tags=["forge-live"])

NOTICE = ("Sensor telemetry is observed and reported by the Sensors (Zeek, Suricata) and relayed through "
          "Wazuh. The Core does not capture packets. Counts for a connection seen by several Sensors are a "
          "lower bound (maximum across Sensors, never a sum). Protocol labels are port-based unless a "
          "Sensor analyzer confirmed the protocol (protocol_basis).")
WORST = ("error", "not_reporting", "silent", "ok")      # severity order for a rolled-up source
PROBLEM_STATES = ("offline", "stale", "registered")


def source_ids(principal: Principal, site: str) -> list:
    """Identifiers under which telemetry for the canonical `site` is stored: the site id itself plus every
    alias that resolves to it (for example `legacy-example-lab` for `example-lab`). Stored rows keep their original
    identifiers; the API presents the canonical id."""
    return sorted({a for a, c in principal.aliases.items() if c == site} | {site})


def present(principal: Principal, view: dict) -> dict:
    """A store row/view with its site shown as the canonical id (the stored identifier is kept as source_site)."""
    return dict(view, site=principal.canon(view["site"]), source_site=view["site"])


async def with_locations(db, views: list) -> list:
    """Add the administrator-set location label (empty when none) to presented Sensor views."""
    from app.services.sites import sensor_locations
    locs = await sensor_locations(db)
    return [dict(v, location=locs.get((v["site"], v["sensor"]), "")) for v in views]


async def live_session(db, ids):
    """The live-ingest session of a site: the session named for one of its source ids AND explicitly assigned
    to the site (`session_sites`). The name only locates the live session among the site's own sessions; the
    explicit assignment is what authorizes it."""
    from app.models.ics import Session
    q = (select(Session).join(SessionSite, SessionSite.session_id == Session.id)
         .where(SessionSite.site_id.in_(ids), Session.name.in_([live.SESSION_PREFIX + i for i in ids]))
         .order_by(Session.created_at.desc()))
    return (await db.execute(q)).scalars().first()


def iso(dt):
    if dt is None:
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def now_utc():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def age(dt, now):
    return None if dt is None else max(0, int((now - dt.replace(tzinfo=None)).total_seconds()))


def source_rollup(tool, views):
    """Zeek/Suricata health as reported by each registered Sensor's heartbeat."""
    rows, states = [], []
    for v in views:
        if not v["registered"]:
            continue
        t = v["tools"][tool]
        if v["status"] in PROBLEM_STATES:
            state = "not_reporting"                  # the Sensor itself is not delivering heartbeats
        elif t["status"] in ("error", "silent"):
            state = t["status"]
        elif t["status"] == "ok":
            state = "ok"
        else:
            state = "not_reporting"
        states.append(state)
        rows.append({
            "sensor_uid": v["sensor_uid"], "display_name": v["display_name"], "site": v["site"],
            "sensor": v["sensor"], "location": v.get("location", ""), "sensor_state": v["status"], "state": state, "tool_status": t["status"],
            "last_record_ts": t["last_record_ts"], "last_obs_event": t["last_obs_event"],
            "obs_total": t["obs_total"], "error": t["error"], "heartbeat_age_s": v["age_s"],
            "last_heartbeat_receipt": v["last_heartbeat_receipt"]})
    overall = "no_sensors" if not states else next((s for s in WORST if s in states), "unknown")
    return {"state": overall, "measured_by": "Sensor heartbeat (tool log freshness and errors)",
            "sensors": rows}


def wazuh_source(health, now):
    rec, feed = health.get("wazuh"), health.get("feed")
    if rec is None:
        return {"state": "unknown", "measured_by": "Core feed host checks",
                "reason": "the Core feed has not reported Wazuh health yet"}
    detail, measured = rec["detail"], rec["measured_at"]
    health_age = age(measured, now)
    services = detail.get("services") or {}
    agents = detail.get("agents") or {}
    last = detail.get("last_alert") or {}
    problems = []
    if health_age is None or health_age > live.HEALTH_FRESH_S:
        problems.append("health not refreshed for %s s (feed or its timer not running)" % health_age)
        state = "stale"
    else:
        state = "ok"
        down = sorted(u for u, s in services.items() if s != "active")
        if down:
            problems.append("service not active: " + ", ".join("%s=%s" % (u, services[u]) for u in down))
        if agents.get("known") is False:
            problems.append("manager agent list unreadable")
        elif agents.get("active") == 0:
            problems.append("no Wazuh agent is active")
        if (feed or {}).get("detail", {}).get("error"):
            problems.append("feed error: " + str(feed["detail"]["error"])[:160])
        if problems:
            state = "degraded"
    return {
        "state": state, "measured_by": "Core feed host checks (systemctl, agent_control, alert files)",
        "measured_at": iso(measured), "health_age_s": health_age, "problems": problems,
        "services": services, "agents": agents, "alerts_file_age_s": detail.get("alerts_file_age_s"),
        "consumed_rules": detail.get("consumed_rules"), "consumed": detail.get("consumed") or {},
        "last_alert": last, "last_alert_age_s": {
            k: age(datetime.strptime(v, live.FMT), now) for k, v in last.items() if v},
        "feed": {"last_run": ((feed or {}).get("detail") or {}).get("last_run"),
                 "new_items": ((feed or {}).get("detail") or {}).get("new_items"),
                 "error": ((feed or {}).get("detail") or {}).get("error")}}


async def guarded(db, fn):
    try:
        return await fn(live.SqlStore(db))
    except ProgrammingError:
        await db.rollback()
        raise HTTPException(status_code=503, detail="FORGE live schema is not initialised yet")


@router.get("/overview")
async def overview(db: AsyncSession = Depends(get_db),
                   principal: Principal = Depends(require("view", "report_view", "health"))):
    """Per-site summary of the caller's authorized sites. What each site shows depends on the role held AT that
    site: Sensors and their health need `health` or `view`; counts need `view` or `report_view`; the raw
    observation totals need `view`. A Report Viewer therefore sees counts, never Sensor or evidence detail.
    Platform-wide Wazuh health spans sites and is shown to Platform Administrators only."""
    view_s, rep_s, health_s = (principal.sites_with(p) for p in ("view", "report_view", "health"))
    allowed = principal.sites

    async def build(store):
        now = now_utc()
        sensor_s = view_s | health_s
        views = [present(principal, v) for v in await live.sensor_views(store, now)]
        views = [v for v in views if principal.can_see_site(v["source_site"]) and v["site"] in sensor_s]
        views = await with_locations(db, views)
        health = await store.health()
        counts = {}
        res = await db.execute(text(
            "SELECT o.site_id, (o.agent_id = r.agent_id) AS verified, count(*) AS rows_, "
            "max(o.last_seen) AS last_seen FROM forge_observations o LEFT JOIN forge_sensor_registry r "
            "ON r.site_id=o.site_id AND r.sensor_id=o.sensor_id AND r.retired_at IS NULL "
            "GROUP BY o.site_id, verified"))
        for r in res.mappings():
            site = principal.canon(r["site_id"])
            if site not in view_s:
                continue
            c = counts.setdefault(site, {"verified_observations": 0, "unverified_observations": 0,
                                         "last_observed_flow": None})
            c["verified_observations" if r["verified"] else "unverified_observations"] += r["rows_"]
            if r["verified"] and r["last_seen"] and (c["last_observed_flow"] is None
                                                      or iso(r["last_seen"]) > c["last_observed_flow"]):
                c["last_observed_flow"] = iso(r["last_seen"])
        sites = {}
        for site in sorted(set(allowed) | {v["site"] for v in views}):
            if not principal.can_see_site(site):
                continue
            sess = await live_session(db, source_ids(principal, site)) if site in (view_s | rep_s) else None
            vs = [v for v in views if v["site"] == site and v["registered"]]
            by_state = {}
            for v in vs:
                by_state[v["status"]] = by_state.get(v["status"], 0) + 1
            sites[site] = dict({"verified_observations": 0, "unverified_observations": 0,
                                "last_observed_flow": None}, **counts.get(site, {}))
            sites[site].update(site=site, name=principal.site_names.get(site, site), sensors=len(vs),
                               sensors_by_state=by_state, devices=sess.device_count if sess else 0,
                               connections=sess.connection_count if sess else 0,
                               findings=sess.finding_count if sess else 0,
                               session_id=str(sess.id) if sess and site in view_s else None,
                               capabilities={"view": site in view_s, "report_view": site in rep_s,
                                             "health": site in health_s})
        return {
            "now": iso(now), "notice": NOTICE, "sensors": views, "sites": sites,
            "sources": {"zeek": source_rollup("zeek", views), "suricata": source_rollup("suricata", views),
                        "wazuh": wazuh_source(health, now) if principal.can("platform") else {
                            "state": "restricted", "measured_by": "Core feed host checks",
                            "reason": "Platform-wide Wazuh health spans sites and is shown to administrators only"}},
            "thresholds": {"stale_after_s": live.DEFAULT_STALE_S, "offline_after_s": live.OFFLINE_S,
                           "tool_silent_after_s": live.TOOL_SILENT_S, "health_fresh_s": live.HEALTH_FRESH_S}}

    return await guarded(db, build)


@router.get("/live")
async def live_site(site: str = Query(None, max_length=64), db: AsyncSession = Depends(get_db),
                    principal: Principal = Depends(require("view"))):
    from app.models.ics import Connection, Device, Finding, Session

    async def build(store):
        now = now_utc()
        if site:
            site_c = require_site(principal, site)          # malformed or not granted: 403, never 404
        else:
            site_c = principal.scope_site
        known = sorted(set(filter_sites(principal, {r["site_id"] for r in await store.registry()} |
                                        {s["site_id"] for s in await store.all_sensors()})) |
                       {x for x in principal.sites if principal.can_see_site(x)})
        chosen = site_c or (known[0] if known else None)
        if chosen is None:
            # No Sensor or site has ever registered: an empty state, not an error.
            return {"now": iso(now), "site": None, "sites": [], "notice": NOTICE, "session_id": None,
                    "sensors": [], "connections": [], "devices": [], "findings": []}
        if chosen not in known:
            raise HTTPException(status_code=404, detail="unknown site")
        ids = source_ids(principal, chosen)
        views = await with_locations(db, [present(principal, v) for v in await live.sensor_views(store, now)
                                          if v["site"] in ids])
        sess = await live_session(db, ids)
        out = {"now": iso(now), "site": chosen, "site_name": principal.site_names.get(chosen, chosen),
               "sites": known, "site_names": {x: principal.site_names.get(x, x) for x in known},
               "notice": NOTICE, "session_id": None,
               "sensors": views, "connections": [], "devices": [], "findings": []}
        if sess is None:
            return out
        out["session_id"] = str(sess.id)
        for c in (await db.execute(select(Connection).where(Connection.session_id == sess.id)
                                   .order_by(Connection.last_seen.desc()))).scalars():
            p = c.properties or {}
            out["connections"].append({
                "id": str(c.id), "src_ip": c.src_ip, "dst_ip": c.dst_ip, "dst_port": c.dst_port,
                "protocol": c.protocol, "transport": c.transport,
                "protocol_basis": "analyzer-confirmed" if (p.get("intel") or {}).get("protocol_confirmed")
                else "port-based", "intel": p.get("intel"),
                "packets": c.packet_count, "bytes": c.byte_count, "first_seen": iso(c.first_seen),
                "last_seen": iso(c.last_seen), "last_seen_age_s": age(c.last_seen, now),
                "observed_by": p.get("observed_by", []), "correlated": bool(p.get("correlated")),
                "lower_bound": bool(p.get("correlated")), "flows": p.get("flows"), "replied": p.get("replied"),
                "states": p.get("states", {}), "primary": p.get("primary", {}), "sensors": p.get("sensors", {}),
                "refs": p.get("refs", []), "counting": p.get("counting")})
        for d in (await db.execute(select(Device).where(Device.session_id == sess.id)
                                   .order_by(Device.ip_address))).scalars():
            p = d.properties or {}
            out["devices"].append({
                "id": str(d.id), "ip": d.ip_address, "internal": p.get("internal"), "protocols": d.protocols,
                "ports": d.open_ports, "packets": d.packet_count, "first_seen": iso(d.first_seen),
                "last_seen": iso(d.last_seen), "observed_by": p.get("observed_by", []),
                "roles": p.get("roles", [])})
        for f in (await db.execute(select(Finding).where(Finding.session_id == sess.id))).scalars():
            ev = f.evidence or {}
            out["findings"].append({
                "id": str(f.id), "title": f.title, "severity": f.severity, "status": f.status,
                "description": f.description, "src_ip": f.src_ip, "dst_ip": f.dst_ip, "protocol": f.protocol,
                "confidence": f.confidence, "classification": ev.get("classification"),
                "sensors": ev.get("sensors", []), "rule": ev.get("rule"),
                "evidence_basis": ev.get("evidence_basis"), "relationship": ev.get("relationship"),
                "functions": ev.get("functions"),
                "sent_to_wazuh": live.wazuh_worthy(ev.get("classification"), f.severity),
                "evidence": ev})
        return out

    return await guarded(db, build)


@router.get("/sensors")
async def site_sensors(site: str = Query(..., max_length=64), db: AsyncSession = Depends(get_db),
                       principal: Principal = Depends(require("site_admin"))):
    """The Sensors seen at a site, with their administrator-set location, for the Site Administrator's
    location editor. Read-only."""
    site_c = require_site(principal, site)
    if not (principal.is_platform or principal.can_at("site_admin", site_c)):
        raise HTTPException(status_code=403, detail="Site not permitted")

    async def build(store):
        ids = source_ids(principal, site_c)
        views = await with_locations(db, [present(principal, v) for v in await live.sensor_views(store, now_utc())
                                          if v["site"] in ids])
        return [{"sensor": v["sensor"], "display_name": v["display_name"], "status": v["status"],
                 "registered": v["registered"], "location": v["location"]} for v in views]

    return {"site": site_c, "sensors": await guarded(db, build)}


@router.get("/intel")
async def intel(site: str = Query(None, max_length=64), db: AsyncSession = Depends(get_db),
                principal: Principal = Depends(require("view"))):
    """Protocol intelligence for a site: relationships (roles, access, first/last seen, last confirmed
    activity, per-Sensor provenance, classification), what changed, declared expectations and which
    Sensors have produced analyzer evidence. Read-only; computed at request time from verified rows, so
    activity reflects the current state of the observing Sensors."""
    async def build(store):
        now = now_utc()
        site_c = require_site(principal, site) if site else principal.scope_site
        known = sorted(set(filter_sites(principal, {r["site_id"] for r in await store.registry()} |
                                        {s["site_id"] for s in await store.all_sensors()})) |
                       {x for x in principal.sites if principal.can_see_site(x)})
        chosen = site_c or (known[0] if known else None)
        if chosen is None or chosen not in known:
            raise HTTPException(status_code=404, detail="unknown site")
        stored = [i for i in source_ids(principal, chosen)
                  if i in {r["site_id"] for r in await store.registry()} | {x["site_id"] for x in await store.all_sensors()}]
        ids = stored or [chosen]                     # every stored source identity of the site (canonical + aliases)
        bound = live.bindings(await store.registry())
        rows, prows, expects = [], [], []
        for src in ids:
            rows += await live.verified_rows(store, src, bound)
            prows += await live.verified_prows(store, src, bound)
            expects += await store.expectations(src)
        views = [dict(v, site=chosen) if v["site"] in ids else v for v in await live.sensor_views(store, now)]
        out = live.intel_view(chosen, rows, prows, expects, views, now)
        out.update(now=iso(now), sites=known, site=chosen, source_site=ids[0], source_sites=ids)
        return out

    return await guarded(db, build)


@router.get("/observations")
async def observations(site: str = Query(..., max_length=64), sensor: str = Query(None, max_length=64),
                       limit: int = Query(100, ge=1, le=500), db: AsyncSession = Depends(get_db),
                       principal: Principal = Depends(require("view"))):
    """Raw per-Sensor evidence rows with provenance, newest first. `verified` is true only when the
    row's Wazuh agent is the agent the Sensor identity is registered to."""
    site = require_site(principal, site)

    async def build(store):
        bound = live.bindings(await store.registry())
        rows = []
        for src in source_ids(principal, site):
            rows += [dict(r, _src=src) for r in await store.site_obs(src) if sensor in (None, r["sensor_id"])]
        rows.sort(key=lambda r: (r["last_seen"], r["obs_key"]), reverse=True)
        return {"now": iso(now_utc()), "site": site, "total": len(rows), "notice": NOTICE, "observations": [{
            "sensor": r["sensor_id"], "agent_id": r["agent_id"] or None, "tool": r["tool"],
            "verified": bound.get((r["_src"], r["sensor_id"])) == r["agent_id"],
            "orig": r["orig"], "resp": r["resp"], "port": r["resp_p"], "transport": r["transport"],
            "protocol": r["protocol"], "flows": r["flows"], "packets": r["orig_pkts"] + r["resp_pkts"],
            "bytes": r["orig_bytes"] + r["resp_bytes"], "states": dict(live.states_counter(r["states"])),
            "first_seen": iso(r["first_seen"]), "last_seen": iso(r["last_seen"]),
            "emitted_at": iso(r["emitted_at"]), "received_first": iso(r["received_first"]),
            "received_last": iso(r["received_last"]), "wazuh_alert_id": r["wazuh_alert_id"],
            "refs": [x for x in (r["refs"] or "").split(",") if x], "obs_key": r["obs_key"]}
            for r in rows[:limit]]}

    return await guarded(db, build)
