"""Multi-Sensor live ICS-flow ingest for Gridwolf (schema 2, with Sensor registry).

Runs INSIDE the Gridwolf backend container, always through the feed:
    docker exec -i forge-gridwolf-backend-1 python -c "$(cat gridwolf_live_ingest.py)"          < items.json
    docker exec -i forge-gridwolf-backend-1 python -c "$(cat gridwolf_live_ingest.py)" status   (JSON)
    docker exec -i forge-gridwolf-backend-1 python -c "$(cat gridwolf_live_ingest.py)" table    (text)
    docker exec -i forge-gridwolf-backend-1 python -c "$(cat gridwolf_live_ingest.py)" registry (JSON action)
    docker exec -i forge-gridwolf-backend-1 python -c "$(cat gridwolf_live_ingest.py)" expect   (JSON action)
stdin (ingest): {"items": [{"kind": "obs"|"status"|"proto", "received_at": "...Z", "alert_id": "...",
                    "agent_id": "001", "agent_name": "...",
                    "data": {the sf_* record shipped by the Sensor}} ...]}
stdin (status, optional): {"agents": [...Wazuh agent list...], "health": {"wazuh": {...}, "feed": {...}}}
stdin (registry): {"action": "list"|"register"|"rename"|"retire"|"adopt", ...}
stdin (expect): {"action": "list"|"add"|"remove"|"adopt", "site_id": ..., ...}  (operator expectations)

Model (adapter-owned tables, created here; Gridwolf's own schema is untouched):
  forge_sensor_registry  the Sensor Registry: an immutable `sensor_uid`, the
                      (site_id, sensor_id) identity slug, a separate mutable display
                      name, and the Wazuh agent id the identity is bound to.
  forge_agents        latest Wazuh agent list measured on Core (manager view).
  forge_health        latest host-measured source health (Wazuh, feed).
  forge_sensors       one row per CLAIM (site_id, sensor_id, agent_id): freshness,
                      last successful ingest, current/last error, counters.
  forge_sensor_tools  one row per claim and source tool (zeek | suricata),
                      tracked independently.
  forge_observations  every individual Sensor observation with provenance: Wazuh
                      agent, event times, producer emit time, Core receipt times,
                      Wazuh alert id, producer batch hash and Zeek uid / Suricata
                      flow id refs.
  forge_proto_obs     OT protocol observations (`proto` items): per Sensor, per
                      (client, server, port, 1-hour bucket), cumulative Modbus
                      request/response/read/write/exception counts, function
                      codes with first-seen, unit ids and (only when the optional
                      detail log exists) register ranges. Source is the Zeek
                      Modbus ANALYZER; nothing here is inferred from a port.
  forge_expectations  operator-declared expected relationships and access
                      (read | read-write); the only basis for `expected`.
  Gridwolf session `FORGE live ICS flows - <site_id>` holds the correlated
  SITE-LEVEL connections, devices and findings, rebuilt from the VERIFIED
  observation rows, so the result never depends on arrival order.

Sensor identity is never trusted from the payload alone. The Wazuh manager sets
`agent.id` on every alert from the authenticated agent connection; the feed
passes it as `agent_id`. A claimed (site, sensor) identity is VERIFIED only when
the registry binds it to that agent. Everything is stored under its claim, but
only verified claims reach the site rollup, the Gridwolf session, the Sensor
status and the Wazuh status events. A claim for a registered identity from a
DIFFERENT agent is a conflict: stored for evidence under its own key (it can
never overwrite the registered Sensor's rows) and excluded.
Sensor states: discovered (claim, not registered), registered (registered, no
verified heartbeat yet), reporting, stale, error, offline.

Rules that keep this correct for many Sensors:
  * Replay de-duplication and observation correlation are different things.
    Replay: an observation is keyed (site, sensor, tool, bucket, endpoints);
    values are cumulative, so an identical or smaller record is ignored and only
    a strictly larger one supersedes (late, repeated or re-fed records change
    nothing). Correlation: two Sensors seeing the same connection keep separate
    observation rows; the site-level connection lists both and counts the MAXIMUM
    of the Sensors, never their sum (a lower bound, because the Sensors may have
    seen the same flows).
  * Assets are never merged across sites: each site has its own Gridwolf session
    and every key includes site_id. Within a site, hosts are identified by IP;
    overlapping address space inside one site needs a network-domain key

Protocol intelligence (derived at read time from verified rows, so it never depends
on arrival order): relationships (client -> server:port) with roles, access, first
seen, last CONFIRMED activity, per-Sensor provenance, confidence and freshness; a
classification (expected | new | unknown | suspicious) and an activity state
(active | quiet | unknown | unknown-source). Silence is never failure. Routine
reads, new relationships and quiet periods are listed as changes, not findings;
only a write on a declared read-only relationship, a program/firmware function or
a burst of exceptions becomes a finding, and only those reach Wazuh (see the
exporter's gate). A relationship with connection metadata only keeps its
port-based label and carries no function codes.
    (deferred, documented).
  * Zeek and Suricata are tracked independently per Sensor; within one Sensor
    Zeek is preferred for totals so the two tools are never added together.
  * Freshness uses Core receipt time of the newest heartbeat (not the Sensor
    clock) plus the delivery lag. Replayed or older heartbeats cannot refresh it.
Findings are adapter-derived from flow metadata (not Gridwolf's packet engine),
labelled `observed` or `potential_indicator`, and never confirmed
vulnerabilities. Analyst-set finding status is preserved.
"""
import asyncio
import hashlib
import ipaddress
import json
import re
import sys
import uuid
from collections import Counter
from datetime import datetime, timezone

PRODUCER_VERSION = "forge-live-ics-adapter-3"
SESSION_PREFIX = "FORGE live ICS flows - "
LEGACY_SESSION = "FORGE Sensor live ICS flows"
ID_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,62}$")
SOURCES = {"zeek-conn": "zeek", "suricata-flow": "suricata"}
PROTO_SOURCES = {"zeek-modbus": ("zeek", "modbus")}     # sf_source -> (tool, protocol); analyzer evidence only
TOOLS = ("zeek", "suricata")
FMT = "%Y-%m-%dT%H:%M:%SZ"
DEFAULT_STALE_S = 900
OFFLINE_S = 3600          # silence beyond this is offline (not merely stale)
AGENT_FRESH_S = 900       # a Wazuh agent snapshot older than this is not used
HEALTH_FRESH_S = 300
TOOL_SILENT_S = 1800
MAX_REFS = 6
AGENT_RE = re.compile(r"^[0-9]{3,8}$")
STATES = ("discovered", "registered", "reporting", "stale", "error", "offline")
EXC_MIN, EXC_RATIO = 5, 0.5   # exception burst: at least this many AND this share of responses
QUIET_AFTER_S = 900           # protocol evidence older than this is no longer "active"
AGING_AFTER_S = 86400         # evidence older than this is stale (confidence is reduced, never discarded)
MAX_RANGES = 8
ACCESS_MODES = ("read", "read-write", "any")
EXPORT_CLASSES = ("policy_deviation", "potential_indicator")   # Wazuh-worthy classifications
EXPORT_SEVERITIES = ("medium", "high", "critical")
COUNT_KEYS = ("req", "rsp", "reads", "writes", "diag", "prog", "other", "exc")
DICT_KEYS = ("fc", "units", "exc_names", "addr_read", "addr_write")
# Modbus function code -> (Zeek name, class). Copy of modbus_adu.FUNCTIONS; a test asserts they agree.
MODBUS_FC = {
    1: ("READ_COILS", "read"), 2: ("READ_DISCRETE_INPUTS", "read"), 3: ("READ_HOLDING_REGISTERS", "read"),
    4: ("READ_INPUT_REGISTERS", "read"), 5: ("WRITE_SINGLE_COIL", "write"), 6: ("WRITE_SINGLE_REGISTER", "write"),
    7: ("READ_EXCEPTION_STATUS", "read"), 8: ("DIAGNOSTICS", "diagnostic"),
    11: ("GET_COMM_EVENT_COUNTER", "read"), 12: ("GET_COMM_EVENT_LOG", "read"),
    15: ("WRITE_MULTIPLE_COILS", "write"), 16: ("WRITE_MULTIPLE_REGISTERS", "write"),
    17: ("REPORT_SLAVE_ID", "read"), 20: ("READ_FILE_RECORD", "read"), 21: ("WRITE_FILE_RECORD", "write"),
    22: ("MASK_WRITE_REGISTER", "write"), 23: ("READ_WRITE_MULTIPLE_REGISTERS", "write"),
    24: ("READ_FIFO_QUEUE", "read"), 43: ("ENCAP_INTERFACE_TRANSPORT", "other"), 91: ("OBJECT_MESSAGING", "other"),
    9: ("PROGRAM_484", "program"), 10: ("POLL_484", "program"), 13: ("PROGRAM_584_984", "program"),
    14: ("POLL_584_984", "program"), 18: ("PROGRAM_884_U84", "program"), 19: ("RESET_COMM_LINK_884_U84", "program"),
    40: ("PROGRAM_CONCEPT", "program"), 41: ("MULTIPLE_FUNCTION_CODES", "other"), 90: ("PROGRAM_UNITY", "program"),
    125: ("FIRMWARE_REPLACEMENT", "program"), 126: ("PROGRAM_584_984_2", "program"),
    127: ("REPORT_LOCAL_ADDRESS", "other"),
}


class Reject(Exception):
    pass


# ---------------------------------------------------------------- pure logic
def priv(addr):
    return ipaddress.ip_address(addr).is_private


def parse_ts(text):
    try:
        return datetime.strptime(text, FMT)
    except (TypeError, ValueError):
        raise Reject("bad timestamp")


def fmt(dt):
    return dt.strftime(FMT) if dt else None


def from_epoch(ts):
    return datetime.fromtimestamp(int(ts), timezone.utc).replace(tzinfo=None)


def parse_received(text, now):
    try:
        return datetime.strptime(text, FMT)
    except (TypeError, ValueError):
        return now


def clip(text, n=200):
    return str(text)[:n] if text else None


def nonneg(value):
    n = int(value)
    if n < 0:
        raise ValueError
    return n


def identity(data):
    site, sensor = data.get("sf_site"), data.get("sf_sensor")
    if not (isinstance(site, str) and ID_RE.match(site) and isinstance(sensor, str) and ID_RE.match(sensor)):
        raise Reject("missing or invalid site/sensor identity")
    return site, sensor


def claim_agent(item):
    """Wazuh agent (id, name) the manager attributed the alert to; required for every item."""
    agent = str(item.get("agent_id") or "")
    if not AGENT_RE.match(agent):
        raise Reject("no verified Wazuh agent id on the alert")
    return agent, clip(item.get("agent_name"), 64)


def obs_key(site, sensor, tool, bucket, orig, resp, port, transport, label):
    raw = "|".join((site, sensor, tool, fmt(bucket), orig, resp, str(port), transport, label))
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def parse_obs(data, item, now):
    site, sensor = identity(data)
    try:
        tool = SOURCES[data["sf_source"]]
        if data.get("sf_tool", tool) != tool:
            raise ValueError
        orig, resp = data["sf_orig"], data["sf_resp"]
        ipaddress.ip_address(orig)
        ipaddress.ip_address(resp)
        bucket = parse_ts(data["sf_bucket"])
        port = int(data["sf_resp_p"])
        transport, label = str(data["sf_proto"]).upper()[:8], str(data["sf_protocol"])[:32]
        row = {
            "site_id": site, "sensor_id": sensor, "agent_id": item["agent_id"], "tool": tool,
            "obs_key": obs_key(site, sensor, tool, bucket, orig, resp, port, transport, label),
            "bucket": bucket, "orig": orig, "resp": resp, "resp_p": port, "transport": transport,
            "protocol": label, "flows": nonneg(data["sf_flows"]),
            "orig_pkts": nonneg(data["sf_orig_pkts"]), "resp_pkts": nonneg(data["sf_resp_pkts"]),
            "orig_bytes": nonneg(data["sf_orig_bytes"]), "resp_bytes": nonneg(data["sf_resp_bytes"]),
            "states": clip(data.get("sf_states"), 400) or "", "first_seen": parse_ts(data["sf_first_seen"]),
            "last_seen": parse_ts(data["sf_last_seen"]), "refs": clip(data.get("sf_refs"), 200) or "",
            "batch_id": clip(data["sf_batch"], 64),
            "emitted_at": parse_ts(data["sf_emitted_at"]) if data.get("sf_emitted_at") else None,
            "wazuh_alert_id": clip(item.get("alert_id"), 64),
        }
        if not 0 < port < 65536 or row["flows"] < 1 or row["last_seen"] < row["first_seen"]:
            raise ValueError
    except Reject:
        raise
    except (KeyError, ValueError, TypeError):
        raise Reject("malformed observation")
    return row


def proto_key(site, sensor, tool, bucket, orig, resp, port, protocol):
    raw = "|".join(("proto", site, sensor, tool, fmt(bucket), orig, resp, str(port), protocol))
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def wazuh_worthy(classification, severity):
    """Only evidence-backed, appropriately classified findings of at least medium severity become Wazuh
    events. gridwolf_findings_export.exportable() applies the same predicate."""
    return classification in EXPORT_CLASSES and severity in EXPORT_SEVERITIES


def parse_proto(data, item, now):
    """Protocol-evidence record (analyzer output, not connection metadata). Strict: class counts must
    add up to the request count and function counts to the request count, or the record is rejected."""
    site, sensor = identity(data)
    try:
        tool, protocol = PROTO_SOURCES[data["sf_source"]]
        if data.get("sf_tool", tool) != tool or data.get("sf_protocol") != protocol \
                or data.get("sf_evidence") != "analyzer":
            raise ValueError
        orig, resp = data["sf_orig"], data["sf_resp"]
        ipaddress.ip_address(orig)
        ipaddress.ip_address(resp)
        bucket = parse_ts(data["sf_bucket"])
        port = int(data["sf_resp_p"])
        n = {k: nonneg(data["sf_" + k]) for k in COUNT_KEYS}
        fc = states_counter(data.get("sf_fc"))
        row = {
            "site_id": site, "sensor_id": sensor, "agent_id": item["agent_id"], "tool": tool,
            "obs_key": proto_key(site, sensor, tool, bucket, orig, resp, port, protocol),
            "bucket": bucket, "orig": orig, "resp": resp, "resp_p": port, "protocol": protocol,
            "evidence": "analyzer", "fc": clip(data.get("sf_fc"), 400) or "",
            "fc_first": clip(data.get("sf_fc_first"), 400) or "", "units": clip(data.get("sf_units"), 200) or "",
            "exc_names": clip(data.get("sf_exc_names"), 300) or "",
            "addr_read": clip(data.get("sf_addr_read"), 400) or "",
            "addr_write": clip(data.get("sf_addr_write"), 400) or "",
            "first_seen": parse_ts(data["sf_first_seen"]), "last_seen": parse_ts(data["sf_last_seen"]),
            "refs": clip(data.get("sf_refs"), 200) or "", "batch_id": clip(data["sf_batch"], 64),
            "emitted_at": parse_ts(data["sf_emitted_at"]) if data.get("sf_emitted_at") else None,
            "wazuh_alert_id": clip(item.get("alert_id"), 64),
        }
        row.update(n)
        classes = n["reads"] + n["writes"] + n["diag"] + n["prog"] + n["other"]
        if not 0 < port < 65536 or n["req"] + n["rsp"] < 1 or row["last_seen"] < row["first_seen"] \
                or classes != n["req"] or sum(fc.values()) != n["req"] or n["exc"] > n["rsp"] \
                or any(not 0 <= int(k) <= 127 for k in fc):
            raise ValueError
    except Reject:
        raise
    except (KeyError, ValueError, TypeError):
        raise Reject("malformed protocol evidence")
    return row


def states_counter(text):
    out = Counter()
    for part in (text or "").split(","):
        if "=" in part:
            k, v = part.rsplit("=", 1)
            try:
                out[k] += int(v)
            except ValueError:
                pass
    return out


def new_agg():
    return {"flows": 0, "orig_pkts": 0, "resp_pkts": 0, "orig_bytes": 0, "resp_bytes": 0, "first": None,
            "last": None, "states": Counter(), "refs": [], "alerts": [], "rows": 0}


def merge_row(a, r):
    for k in ("flows", "orig_pkts", "resp_pkts", "orig_bytes", "resp_bytes"):
        a[k] += r[k]
    a["first"] = r["first_seen"] if a["first"] is None else min(a["first"], r["first_seen"])
    a["last"] = r["last_seen"] if a["last"] is None else max(a["last"], r["last_seen"])
    a["states"].update(states_counter(r["states"]))
    for ref in (r["refs"] or "").split(","):
        if ref and ref not in a["refs"] and len(a["refs"]) < MAX_REFS:
            a["refs"].append(ref)
    if r.get("wazuh_alert_id") and r["wazuh_alert_id"] not in a["alerts"] and len(a["alerts"]) < MAX_REFS:
        a["alerts"].append(r["wazuh_alert_id"])
    a["rows"] += 1


def primary_tool(tools):
    return next((t for t in TOOLS if t in tools and tools[t]["flows"]), None)


def rollup(site, rows, prows=(), expects=()):
    """Site-level connections, devices, relationships and findings from one site's verified observation
    rows (`rows`: flow metadata) and protocol-evidence rows (`prows`: analyzer output) plus the site's
    active expectations. Pure and deterministic: no clock input (activity is computed at read time)."""
    cells = {}
    for r in rows:
        key = (r["orig"], r["resp"], r["resp_p"], r["protocol"], r["transport"])
        a = cells.setdefault(key, {}).setdefault(r["sensor_id"], {}).setdefault(r["tool"], new_agg())
        merge_row(a, r)
    conns = {}
    for key, sens in sorted(cells.items()):
        prim = {sid: primary_tool(tools) for sid, tools in sens.items()}
        best = min(sens, key=lambda s: (-(sens[s][prim[s]]["flows"] if prim[s] else 0), s))
        b = sens[best][prim[best]]
        everything = [a for tools in sens.values() for a in tools.values()]
        per_sensor = {
            sid: {t: {"flows": a["flows"], "packets": a["orig_pkts"] + a["resp_pkts"],
                      "bytes": a["orig_bytes"] + a["resp_bytes"], "first_seen": fmt(a["first"]),
                      "last_seen": fmt(a["last"]), "states": dict(a["states"])}
                  for t, a in tools.items()}
            for sid, tools in sens.items()}
        conns[key] = {
            "src": key[0], "dst": key[1], "port": key[2], "protocol": key[3], "transport": key[4],
            "first": min(a["first"] for a in everything), "last": max(a["last"] for a in everything),
            "flows": b["flows"], "packets": b["orig_pkts"] + b["resp_pkts"],
            "bytes": b["orig_bytes"] + b["resp_bytes"], "states": dict(b["states"]),
            "replied": any(a["resp_pkts"] > 0 for a in everything),
            "observed_by": sorted(sens), "correlated": len(sens) > 1,
            "refs": b["refs"], "alerts": sorted({x for a in everything for x in a["alerts"]})[:MAX_REFS],
            "props": {
                "site_id": site, "observed_by": sorted(sens), "correlated": len(sens) > 1,
                "counting": "per Sensor: Zeek if present else Suricata; site value = maximum across "
                            "Sensors (lower bound), never a sum",
                "primary": {sid: t for sid, t in prim.items()}, "sensors": per_sensor,
                "flows": b["flows"], "states": dict(b["states"]),
                "replied": any(a["resp_pkts"] > 0 for a in everything), "refs": b["refs"],
            },
        }
    rels, roles = relationships(site, conns, prows, expects)
    for rel in rels.values():
        flow = rel["flow"]
        if flow is not None:
            flow["props"]["intel"] = {
                "protocol": rel["protocol"], "protocol_confirmed": rel["evidence"] == "protocol",
                "evidence_basis": rel["evidence_basis"], "access": rel["access"],
                "classification": rel["classification"], "last_confirmed": fmt(rel["last_confirmed"])}
    links = list(conns.values()) + [
        {"src": r["client"], "dst": r["server"], "port": r["port"], "protocol": r["protocol"],
         "first": r["first"], "last": r["last"], "packets": 0, "observed_by": r["observed_by"]}
        for r in rels.values() if r["flow"] is None]
    devs = {}
    for c in links:
        for ip, role in ((c["src"], "orig"), (c["dst"], "resp")):
            d = devs.setdefault(ip, {"protocols": set(), "ports": set(), "packets": 0, "first": c["first"],
                                     "last": c["last"], "observed_by": set()})
            d["protocols"].add(c["protocol"])
            if role == "resp":
                d["ports"].add(c["port"])
            d["packets"] += c["packets"]
            d["first"], d["last"] = min(d["first"], c["first"]), max(d["last"], c["last"])
            d["observed_by"].update(c["observed_by"])
    for ip, d in devs.items():
        d["protocols"], d["ports"], d["observed_by"] = sorted(d["protocols"]), sorted(d["ports"]), sorted(d["observed_by"])
        d["internal"] = priv(ip)
        d["roles"] = roles.get(ip, [])
    findings = derive_findings(site, conns)
    findings.update(derive_proto_findings(site, rels))
    return {"connections": conns, "devices": devs, "relationships": rels, "findings": findings}


def dedupe_key(*parts):
    return hashlib.sha256("|".join(str(p) for p in parts).encode()).hexdigest()[:32]


def derive_findings(site, conns):
    groups = {}
    for c in conns.values():
        if priv(c["src"]) and not priv(c["dst"]):
            groups.setdefault(("ics-port-egress-v1", c["src"], c["protocol"]), []).append(c)
        elif priv(c["src"]) and priv(c["dst"]):
            groups.setdefault(("ics-port-internal-v1", c["src"], c["protocol"]), []).append(c)
    out = {}
    for (rule, host, proto), items in sorted(groups.items()):
        peers = sorted({i["dst"] for i in items})
        flows = sum(i["flows"] for i in items)
        replied = any(i["replied"] for i in items)
        ports = sorted({i["port"] for i in items})
        sensors = sorted({s for i in items for s in i["observed_by"]})
        states = Counter()
        for i in items:
            states.update(i["states"])
        egress = rule == "ics-port-egress-v1"
        severity = ("high" if replied else "medium") if egress else "info"
        where = "site %s, Sensor(s) %s" % (site, ", ".join(sensors))
        if egress:
            title = "Internal host %s initiated %s connections to %d external address(es)" % (host, proto, len(peers))
            cls, conf = "potential_indicator", (55 if replied else 40)
            text = ("Live Sensor telemetry (%s) recorded %d flow(s) from private host %s to external addresses "
                    "on the %s port(s) %s. Replied: %s. Observed fact: connection attempts. Interpretation "
                    "(not confirmed): outbound OT-protocol exposure, scanning, misconfiguration or compromise; "
                    "the cause is unknown." % (where, flows, host, proto, ports, replied))
        else:
            title = "Observed %s traffic from %s to %d internal address(es)" % (proto, host, len(peers))
            cls, conf = "observed", 60
            text = ("Live Sensor telemetry (%s) recorded %d internal flow(s) on %s port(s) %s. Observation "
                    "only; the protocol label is port-based." % (where, flows, proto, ports))
        key = dedupe_key(rule, site, host, proto, "live")
        out[key] = {
            "rule": rule, "host": host, "peers": peers, "protocol": proto, "title": title, "text": text,
            "severity": severity, "confidence": conf, "egress": egress,
            "evidence": {
                "dedupe_key": key, "classification": cls, "derivation_rule": rule,
                "producer_version": PRODUCER_VERSION, "source": "zeek-suricata-live", "site_id": site,
                "sensors": sensors, "correlated": any(i["correlated"] for i in items),
                "first_seen": fmt(min(i["first"] for i in items)), "last_seen": fmt(max(i["last"] for i in items)),
                "flows": flows, "peer_count": len(peers), "peer_sample": peers[:5], "conn_states": dict(states),
                "evidence_refs": [r for i in items for r in i["refs"]][:MAX_REFS],
                "wazuh_alert_ids": sorted({x for i in items for x in i["alerts"]})[:MAX_REFS],
                "collection_scope": "Sensor Zeek conn.log and Suricata EVE flow events (live)",
            },
        }
    return out


# ------------------------------------------------------- protocol intelligence
# A relationship is one (client, server, port) pair at one site. Client/server come from the TCP
# originator and responder as seen by the analyzer or conn.log; HMI/PLC naming is never inferred from
# a protocol. Protocol-level facts (functions, read/write, units, addresses, exceptions) exist only
# when analyzer evidence (`prows`) exists; connection metadata alone never yields them.
def fc_info(code):
    return MODBUS_FC.get(int(code), ("unknown-%d" % int(code), "other"))


def pairs_text(counter):
    return ",".join("%s=%d" % kv for kv in sorted(counter.items(), key=lambda kv: str(kv[0])))


def new_pagg():
    a = {k: 0 for k in COUNT_KEYS}
    a.update({k: Counter() for k in DICT_KEYS})
    a.update(fc_first={}, first=None, last=None, first_exc=None, refs=[], alerts=[], rows=0)
    return a


def merge_prow(a, r):
    for k in COUNT_KEYS:
        a[k] += r[k]
    for k in DICT_KEYS:
        a[k].update(states_counter(r[k]))
    for code, ts in states_counter(r["fc_first"]).items():
        a["fc_first"][code] = min(a["fc_first"].get(code, ts), ts)
    a["first"] = r["first_seen"] if a["first"] is None else min(a["first"], r["first_seen"])
    a["last"] = r["last_seen"] if a["last"] is None else max(a["last"], r["last_seen"])
    if r["exc"] and (a["first_exc"] is None or r["first_seen"] < a["first_exc"]):
        a["first_exc"] = r["first_seen"]
    for ref in (r["refs"] or "").split(","):
        if ref and ref not in a["refs"] and len(a["refs"]) < MAX_REFS:
            a["refs"].append(ref)
    if r.get("wazuh_alert_id") and r["wazuh_alert_id"] not in a["alerts"] and len(a["alerts"]) < MAX_REFS:
        a["alerts"].append(r["wazuh_alert_id"])
    a["rows"] += 1


def zero_ops():
    ops = {k: 0 for k in COUNT_KEYS}
    ops.update({k: Counter() for k in DICT_KEYS})
    ops["fc_first"] = {}
    return ops


def site_ops(per_sensor):
    """Site value of every counter = MAXIMUM across Sensors (a lower bound; Sensors may see the same
    traffic), never a sum."""
    ops = zero_ops()
    for a in per_sensor.values():
        for k in COUNT_KEYS:
            ops[k] = max(ops[k], a[k])
        for k in DICT_KEYS:
            for key, v in a[k].items():
                ops[k][key] = max(ops[k][key], v)
        for code, ts in a["fc_first"].items():
            ops["fc_first"][code] = min(ops["fc_first"].get(code, ts), ts)
    return ops


def classify(rel, exp, baseline):
    """(classification, reasons, notes). `suspicious` only on protocol evidence that contradicts an
    expectation or is inherently high-risk; routine observations never become findings."""
    ops, reasons, notes = rel["ops"], [], []
    if rel["evidence"] == "protocol":
        prog = sorted(int(c) for c in ops["fc"] if fc_info(c)[1] == "program")
        writes = sorted(int(c) for c in ops["fc"] if fc_info(c)[1] == "write")
        if prog:
            reasons.append("program/firmware function(s) %s observed" % ", ".join("FC%d" % c for c in prog))
        if writes and exp and exp["access"] == "read":
            reasons.append("write function(s) %s observed; the expectation declares read-only access" %
                           ", ".join("FC%d" % c for c in writes))
        elif writes and not exp:
            notes.append("write function(s) %s observed; no expectation declares the intended access" %
                         ", ".join("FC%d" % c for c in writes))
        if ops["exc"] >= EXC_MIN and ops["exc"] >= EXC_RATIO * ops["rsp"]:
            reasons.append("%d of %d responses were Modbus exceptions" % (ops["exc"], ops["rsp"]))
    if reasons:
        return "suspicious", reasons, notes
    if exp:
        return "expected", ["declared in expectation %s" % exp["expectation_id"]], notes
    if baseline is not None and rel["first"] > baseline:
        return "new", ["first observed after the site baseline (%s)" % fmt(baseline)], notes
    return "unknown", ["no expectation declared for this relationship" if baseline is not None
                       else "no baseline has been set for this site"], notes


CONF = ("low", "medium", "high")


def relationships(site, conns, prows, expects):
    """({key: relationship}, {ip: [role entries]}) for one site. Pure."""
    cells = {}
    for r in prows:
        a = cells.setdefault((r["orig"], r["resp"], r["resp_p"]), {}).setdefault(r["sensor_id"], new_pagg())
        merge_prow(a, r)
    flows = {}
    for k in sorted(conns):
        c = conns[k]
        key = (c["src"], c["dst"], c["port"])
        if key not in flows or c["transport"] == "TCP":
            flows[key] = c
    baseline = min((e["created_at"] for e in expects), default=None)
    exp_by = {(e["client"], e["server"], e["port"]): e for e in expects}
    rels, roles = {}, {}
    for key in sorted(set(cells) | set(flows)):
        client, server, port = key
        per, flow = cells.get(key, {}), flows.get(key)
        proto = bool(per)
        ops = site_ops(per) if proto else zero_ops()
        firsts = [a["first"] for a in per.values()] + ([flow["first"]] if flow else [])
        lasts = [a["last"] for a in per.values()] + ([flow["last"]] if flow else [])
        exp = exp_by.get(key)
        rel = {
            "key": "%s>%s:%d" % (client, server, port), "site": site, "client": client, "server": server,
            "port": port, "transport": flow["transport"] if flow else "TCP",
            "protocol": "modbus" if proto else (flow["protocol"] if flow else "unknown"),
            "port_label": flow["protocol"] if flow else None,
            "evidence": "protocol" if proto else "flow",
            "evidence_basis": ("Zeek Modbus analyzer (parsed protocol messages)" if proto else
                               "connection metadata only; the protocol label is port-based"),
            "direction_basis": ("TCP originator per the analyzer; a capture that starts mid-stream can invert it"
                                if proto else "TCP originator per conn.log/EVE"),
            "first": min(firsts), "last": max(lasts),
            "proto_first": min((a["first"] for a in per.values()), default=None),
            "last_confirmed": max((a["last"] for a in per.values()), default=None),
            "first_exception": min((a["first_exc"] for a in per.values() if a["first_exc"]), default=None),
            "flow": flow, "ops": ops, "per_sensor": per,
            "observed_by": sorted(set(per) | set(flow["observed_by"] if flow else [])),
            "proto_by": sorted(per),
            "refs": [x for a in per.values() for x in a["refs"]][:MAX_REFS],
            "alerts": sorted({x for a in per.values() for x in a["alerts"]})[:MAX_REFS],
            "expectation": exp,
        }
        rel["access"] = ("read-write" if ops["writes"] or ops["prog"] else
                         "read-only" if ops["req"] else "unknown")
        rel["classification"], rel["reasons"], rel["notes"] = classify(rel, exp, baseline)
        rels[rel["key"]] = rel
        for ip, role in ((client, "client"), (server, "server")):
            if not proto:
                level, basis = 0, "%s port label only; no protocol messages seen" % role
            elif role == "client":
                level = 2 if ops["req"] and ops["rsp"] else 1
                basis = "originated TCP and sent Modbus requests (analyzer)"
            else:
                level = 2 if ops["rsp"] else 1
                basis = "answered Modbus requests (analyzer)" if ops["rsp"] else \
                    "received Modbus requests; no responses observed"
            ent = roles.setdefault(ip, {}).setdefault((rel["protocol"], role), {
                "protocol": rel["protocol"], "role": role, "relationships": 0, "level": 0, "basis": basis})
            ent["relationships"] += 1
            if level > ent["level"]:
                ent["level"], ent["basis"] = level, basis
    out = {}
    for ip, ents in roles.items():
        out[ip] = [dict({k: v for k, v in e.items() if k != "level"}, confidence=CONF[e["level"]])
                   for _, e in sorted(ents.items())]
    return rels, out


def proto_evidence(site, rel, rule, cls):
    ops, exp = rel["ops"], rel["expectation"]
    key = dedupe_key(rule, site, rel["client"], rel["server"], rel["port"], "live")
    return key, {
        "dedupe_key": key, "classification": cls, "derivation_rule": rule, "producer_version": PRODUCER_VERSION,
        "source": "zeek-modbus-analyzer", "site_id": site, "sensors": rel["proto_by"],
        "correlated": len(rel["proto_by"]) > 1, "relationship": rel["key"],
        "evidence_basis": "zeek-modbus-analyzer", "first_seen": fmt(rel["proto_first"]),
        "last_seen": fmt(rel["last_confirmed"]), "functions": pairs_text(ops["fc"]),
        "units": pairs_text(ops["units"]), "exceptions": pairs_text(ops["exc_names"]),
        "addr_read": pairs_text(ops["addr_read"]), "addr_write": pairs_text(ops["addr_write"]),
        "expectation": exp["expectation_id"] if exp else None, "evidence_refs": rel["refs"],
        "zeek_uids": rel["refs"], "wazuh_alert_ids": rel["alerts"],
        "collection_scope": "Zeek Modbus analyzer output (modbus.log) from the Sensor(s), live",
    }


def derive_proto_findings(site, rels):
    """Evidence-backed findings only. Routine reads, new relationships and quiet periods are NOT findings
    (the analyst page lists them as changes)."""
    out = {}
    for rel in sorted(rels.values(), key=lambda r: r["key"]):
        if rel["evidence"] != "protocol":
            continue
        ops, exp = rel["ops"], rel["expectation"]
        where = "site %s, Sensor(s) %s, %s -> %s:%d" % (site, ", ".join(rel["proto_by"]), rel["client"],
                                                       rel["server"], rel["port"])
        facts = "Observed by the Zeek Modbus analyzer (parsed protocol messages): %d request(s), %d response(s); " \
                "functions %s." % (ops["req"], ops["rsp"], pairs_text(ops["fc"]) or "none")
        specs = []
        writes = sorted(int(c) for c in ops["fc"] if fc_info(c)[1] == "write")
        prog = sorted(int(c) for c in ops["fc"] if fc_info(c)[1] == "program")
        if writes and exp and exp["access"] == "read":
            specs.append(("modbus-write-readonly-v1", "high", "policy_deviation", 90, "write_path",
                          "Modbus write (%s) on read-only relationship %s -> %s:%d" % (
                              ", ".join("FC%d" % c for c in writes), rel["client"], rel["server"], rel["port"]),
                          "%s Expectation %s declares read-only access, but write function(s) were requested by the "
                          "TCP originator. The expectation is an operator declaration; the cause (maintenance, "
                          "misconfiguration, unauthorized change) is unknown." % (facts, exp["expectation_id"])))
        if prog:
            specs.append(("modbus-program-function-v1", "high", "potential_indicator", 70, "write_path",
                          "Modbus program/firmware function (%s) requested %s -> %s:%d" % (
                              ", ".join("FC%d" % c for c in prog), rel["client"], rel["server"], rel["port"]),
                          "%s Program, poll or firmware function codes are used for device programming or "
                          "maintenance. Interpretation (not confirmed): engineering activity or misuse; the "
                          "cause is unknown." % facts))
        if ops["exc"] >= EXC_MIN and ops["exc"] >= EXC_RATIO * ops["rsp"]:
            specs.append(("modbus-exceptions-v1", "medium", "potential_indicator", 60, "protocol_anomaly",
                          "Repeated Modbus exceptions %s -> %s:%d (%d of %d responses)" % (
                              rel["client"], rel["server"], rel["port"], ops["exc"], ops["rsp"]),
                          "%s Exceptions: %s. Interpretation (not confirmed): unsupported function, invalid "
                          "addresses, a probing client or a misconfiguration." % (facts, pairs_text(ops["exc_names"]))))
        for rule, severity, cls, conf, ftype, title, text in specs:
            key, ev = proto_evidence(site, rel, rule, cls)
            out[key] = {"rule": rule, "host": rel["client"], "peers": [rel["server"]], "protocol": "modbus",
                        "title": title, "text": "Live Sensor telemetry (%s). %s" % (where, text),
                        "severity": severity, "confidence": conf, "egress": False, "ftype": ftype, "evidence": ev}
    return out


def change_events(rels):
    """What changed, newest first. Every item carries the relationship, Sensors, evidence level and a
    classification (expected | new | unknown | suspicious). `routine` marks items that need no attention."""
    ev = []

    def add(at, typ, rel, title, cls, routine, detail=None):
        ev.append({"at": at, "type": typ, "relationship": rel["key"], "client": rel["client"],
                   "server": rel["server"], "port": rel["port"], "title": title, "classification": cls,
                   "routine": routine, "sensors": rel["proto_by"] or rel["observed_by"],
                   "evidence": rel["evidence"], "detail": detail})

    for rel in rels.values():
        cls, exp = rel["classification"], rel["expectation"]
        label = "%s -> %s:%d (%s)" % (rel["client"], rel["server"], rel["port"], rel["protocol"])
        add(rel["first"], "relationship_new", rel, "Relationship first observed: %s" % label, cls,
            cls == "expected", "; ".join(rel["reasons"]))
        for code, ts in sorted(rel["ops"]["fc_first"].items(), key=lambda kv: (kv[1], int(kv[0]))):
            name, kind = fc_info(code)
            if kind == "read":
                continue
            if kind == "program" or (kind == "write" and exp and exp["access"] == "read"):
                fcls = "suspicious"
            elif kind == "write" and exp:
                fcls = "expected"
            else:
                fcls = "unknown"
            add(from_epoch(ts), "operation_first_seen", rel,
                "First %s function FC%d %s on %s" % (kind, int(code), name, label), fcls, fcls == "expected",
                "count so far %d" % rel["ops"]["fc"].get(code, 0))
        if rel["first_exception"]:
            burst = rel["ops"]["exc"] >= EXC_MIN and rel["ops"]["exc"] >= EXC_RATIO * rel["ops"]["rsp"]
            add(rel["first_exception"], "exception_first_seen", rel,
                "Modbus exception(s) on %s: %s" % (label, pairs_text(rel["ops"]["exc_names"])),
                "suspicious" if burst else "unknown", not burst, "time is the start of the first bucket with an exception")
    ev.sort(key=lambda e: (e["at"], e["relationship"], e["type"]), reverse=True)
    return ev


def relationship_activity(rel, sensor_states, now):
    """Activity at read time. Absence of new evidence is never failure: it is `quiet` only while an observing
    Sensor is reporting AND protocol evidence exists; connection records are written when a flow ends, so a
    flow-only relationship can never be called quiet; otherwise `unknown-source`."""
    t = rel["last_confirmed"] or rel["last"]
    age = max(0, int((now - t).total_seconds()))
    if age <= QUIET_AFTER_S:
        state, why = "active", "protocol evidence within %d s" % QUIET_AFTER_S if rel["last_confirmed"] else \
            "a flow record within %d s" % QUIET_AFTER_S
    elif rel["evidence"] != "protocol":
        state, why = "unknown", ("connection records are written when a flow ends; no recent record does not show "
                                 "the connection is inactive")
    elif any(sensor_states.get(s) == "reporting" for s in rel["proto_by"]):
        state, why = "quiet", "no Modbus messages seen for %d s while an observing Sensor is reporting" % age
    else:
        state, why = "unknown-source", "no recent evidence and no observing Sensor is currently reporting"
    fresh = "fresh" if age <= QUIET_AFTER_S else ("aging" if age <= AGING_AFTER_S else "stale")
    ops = rel["ops"]
    level = (2 if ops["req"] and ops["rsp"] else 1) if rel["evidence"] == "protocol" else 0
    if len(rel["proto_by"]) > 1:
        level = min(2, level + 1)
    if fresh == "stale":
        level = max(0, level - 1)
    return {"activity": state, "activity_reason": why, "evidence_age_s": age, "freshness": fresh,
            "confidence": CONF[level]}


def rel_view(rel, sensor_states, now):
    ops, exp = rel["ops"], rel["expectation"]
    fcs = [{"code": int(c), "name": fc_info(c)[0], "class": fc_info(c)[1], "count": n,
            "first_seen": fmt(from_epoch(rel["ops"]["fc_first"][c])) if c in ops["fc_first"] else None}
           for c, n in sorted(ops["fc"].items(), key=lambda kv: int(kv[0]))]
    per = {sid: {"tool": "zeek", "requests": a["req"], "responses": a["rsp"], "reads": a["reads"],
                 "writes": a["writes"], "exceptions": a["exc"], "first_seen": fmt(a["first"]),
                 "last_seen": fmt(a["last"])} for sid, a in rel["per_sensor"].items()}
    out = {
        "key": rel["key"], "site": rel["site"], "client": rel["client"], "server": rel["server"],
        "port": rel["port"], "transport": rel["transport"], "protocol": rel["protocol"],
        "port_label": rel["port_label"], "evidence": rel["evidence"], "protocol_confirmed": rel["evidence"] == "protocol",
        "evidence_basis": rel["evidence_basis"], "direction_basis": rel["direction_basis"],
        "first_seen": fmt(rel["first"]), "last_seen": fmt(rel["last"]),
        "last_confirmed": fmt(rel["last_confirmed"]), "access": rel["access"],
        "classification": rel["classification"], "reasons": rel["reasons"], "notes": rel["notes"],
        "observed_by": rel["observed_by"], "protocol_sensors": rel["proto_by"],
        "corroborated": len(rel["proto_by"]) > 1 or len(rel["observed_by"]) > 1, "per_sensor": per,
        "counting": "site value = maximum across Sensors (lower bound), never a sum",
        "requests": ops["req"], "responses": ops["rsp"], "reads": ops["reads"], "writes": ops["writes"],
        "diagnostics": ops["diag"], "program": ops["prog"], "other": ops["other"], "exceptions": ops["exc"],
        "functions": fcs, "units": dict(ops["units"]), "exception_names": dict(ops["exc_names"]),
        "addresses_read": dict(ops["addr_read"]), "addresses_write": dict(ops["addr_write"]),
        "address_evidence": "available" if (ops["addr_read"] or ops["addr_write"]) else
                            "not collected (needs the Zeek detail log)",
        "expectation": ({"id": exp["expectation_id"], "access": exp["access"], "note": exp["note"],
                         "created_at": fmt(exp["created_at"])} if exp else None),
        "refs": rel["refs"], "alerts": rel["alerts"],
    }
    out.update(relationship_activity(rel, sensor_states, now))
    return out


def intel_view(site, rows, prows, expects, views, now):
    """JSON-ready protocol intelligence for one site at `now`. `rows`/`prows` must be verified rows."""
    ru = rollup(site, rows, prows, expects)
    states = {v["sensor"]: v["status"] for v in views if v["site"] == site and v["registered"]}
    rels = [rel_view(r, states, now) for _, r in sorted(ru["relationships"].items())]
    changes = [{"at": fmt(e["at"]), "type": e["type"], "relationship": e["relationship"], "client": e["client"],
                "server": e["server"], "port": e["port"], "title": e["title"],
                "classification": e["classification"], "routine": e["routine"], "sensors": e["sensors"],
                "evidence": e["evidence"], "detail": e["detail"]}
               for e in change_events(ru["relationships"])][:200]
    for r in rels:
        if r["activity"] == "quiet" and r["expectation"]:
            changes.insert(0, {
                "at": r["last_confirmed"], "type": "quiet", "relationship": r["key"], "client": r["client"],
                "server": r["server"], "port": r["port"], "classification": "unknown", "routine": False,
                "title": "No recent Modbus messages on an expected relationship %s -> %s:%d" % (
                    r["client"], r["server"], r["port"]), "sensors": r["protocol_sensors"], "evidence": "protocol",
                "detail": "%s (not classified failed or decommissioned)" % r["activity_reason"]})
    seen = {(r["client"], r["server"], r["port"]) for r in rels}
    exps = [{"id": e["expectation_id"], "client": e["client"], "server": e["server"], "port": e["port"],
             "protocol": e["protocol"], "access": e["access"], "note": e["note"],
             "created_at": fmt(e["created_at"]), "created_by": e["created_by"],
             "observed": (e["client"], e["server"], e["port"]) in seen} for e in expects]
    analyzer = {}
    for v in views:
        if v["site"] == site and v["registered"]:
            mine = [r for r in prows if r["sensor_id"] == v["sensor"]]
            analyzer[v["sensor"]] = {"rows": len(mine), "last_seen": fmt(max((r["last_seen"] for r in mine),
                                                                              default=None)), "sensor_state": v["status"]}
    return {"site": site, "relationships": rels, "changes": changes, "expectations": exps,
            "analyzer_evidence": analyzer,
            "baseline": fmt(min((e["created_at"] for e in expects), default=None)),
            "roles": ru["devices"] and {ip: d["roles"] for ip, d in ru["devices"].items()},
            "thresholds": {"quiet_after_s": QUIET_AFTER_S, "stale_evidence_after_s": AGING_AFTER_S,
                           "exception_min": EXC_MIN, "exception_ratio": EXC_RATIO},
            "notice": "Protocol facts (function codes, reads/writes, units, addresses, exceptions) come only from "
                      "analyzer evidence. Relationships without it show connection metadata and a port-based label."}


def new_sensor(site, sid, agent, agent_name, received):
    return {"site_id": site, "sensor_id": sid, "agent_id": agent, "agent_name": agent_name,
            "first_receipt": received, "hb_receipt": None, "hb_emitted": None,
            "hb_lag_s": None, "producer": None, "current_error": None, "last_error": None, "last_error_at": None,
            "last_ingest_ok": None, "last_obs_ingest": None, "last_event_time": None,
            "stale_after_s": DEFAULT_STALE_S, "batches_total": 0, "replayed_total": 0, "superseded_total": 0,
            "rejected_total": 0}


def new_tool(site, sid, agent, tool):
    return {"site_id": site, "sensor_id": sid, "agent_id": agent, "tool": tool, "last_record_ts": None,
            "last_receipt": None, "current_error": None, "last_error_at": None, "last_obs_event": None,
            "obs_total": 0}


def later(a, b):
    return b if a is None else (a if b is None else max(a, b))


async def apply_obs(store, sensor, data, item, received, now):
    row = parse_obs(data, item, now)
    row["received_first"] = row["received_last"] = received
    row["ingested_at"] = now
    old = await store.get_obs(row["site_id"], row["sensor_id"], row["agent_id"], row["obs_key"])
    if old is None:
        outcome = "new"
    elif old["batch_id"] == row["batch_id"]:
        sensor["replayed_total"] += 1
        return "replay"
    elif row["flows"] > old["flows"]:
        outcome = "updated"
        row["received_first"] = old["received_first"]
        row["first_seen"] = min(old["first_seen"], row["first_seen"])
        row["last_seen"] = max(old["last_seen"], row["last_seen"])
    else:
        sensor["superseded_total"] += 1
        return "superseded"
    await store.put_obs(row)
    sensor["batches_total"] += 1
    sensor["last_ingest_ok"] = now
    sensor["last_obs_ingest"] = now
    sensor["last_event_time"] = later(sensor["last_event_time"], row["last_seen"])
    tr = await store.get_tool(row["site_id"], row["sensor_id"], row["agent_id"], row["tool"]) or new_tool(
        row["site_id"], row["sensor_id"], row["agent_id"], row["tool"])
    tr["last_obs_event"] = later(tr["last_obs_event"], row["last_seen"])
    tr["obs_total"] += 1
    await store.put_tool(tr)
    return outcome


async def apply_proto(store, sensor, data, item, received, now):
    """Protocol-evidence record. Same replay rules as flow observations: values are cumulative, a strictly
    larger record (more messages) supersedes, the same batch is a replay, anything else is superseded."""
    row = parse_proto(data, item, now)
    row["received_first"] = row["received_last"] = received
    row["ingested_at"] = now
    old = await store.get_pobs(row["site_id"], row["sensor_id"], row["agent_id"], row["obs_key"])
    if old is None:
        outcome = "new"
    elif old["batch_id"] == row["batch_id"]:
        sensor["replayed_total"] += 1
        return "replay"
    elif row["req"] + row["rsp"] > old["req"] + old["rsp"]:
        outcome = "updated"
        row["received_first"] = old["received_first"]
        row["first_seen"] = min(old["first_seen"], row["first_seen"])
        row["last_seen"] = max(old["last_seen"], row["last_seen"])
    else:
        sensor["superseded_total"] += 1
        return "superseded"
    await store.put_pobs(row)
    sensor["batches_total"] += 1
    sensor["last_ingest_ok"] = now
    sensor["last_obs_ingest"] = now
    sensor["last_event_time"] = later(sensor["last_event_time"], row["last_seen"])
    tr = await store.get_tool(row["site_id"], row["sensor_id"], row["agent_id"], row["tool"]) or new_tool(
        row["site_id"], row["sensor_id"], row["agent_id"], row["tool"])
    tr["last_obs_event"] = later(tr["last_obs_event"], row["last_seen"])
    tr["obs_total"] += 1
    await store.put_tool(tr)
    return outcome


async def apply_status(store, sensor, data, received, now):
    emitted = parse_ts(data.get("sf_emitted_at"))
    prev = sensor["hb_emitted"]
    if prev is not None and emitted <= prev:
        if emitted == prev:
            sensor["replayed_total"] += 1
            return "replay"
        sensor["superseded_total"] += 1
        return "older"
    err = clip(data.get("sf_error"))
    sensor.update(hb_emitted=emitted, hb_receipt=received, hb_lag_s=(received - emitted).total_seconds(),
                  producer=clip(data.get("sf_producer"), 64), current_error=err, last_ingest_ok=now)
    if err:
        sensor["last_error"], sensor["last_error_at"] = err, received
    for t in TOOLS:
        tr = await store.get_tool(sensor["site_id"], sensor["sensor_id"], sensor["agent_id"], t) or new_tool(
            sensor["site_id"], sensor["sensor_id"], sensor["agent_id"], t)
        text = data.get("sf_%s_last_record" % t)
        if text:
            tr["last_record_ts"] = later(tr["last_record_ts"], parse_ts(text))
        tr["current_error"] = clip(data.get("sf_%s_error" % t))
        if tr["current_error"]:
            tr["last_error_at"] = received
        tr["last_receipt"] = received
        await store.put_tool(tr)
    return "new"


def bindings(registry):
    """{(site, sensor): agent_id} for active registry entries."""
    return {(r["site_id"], r["sensor_id"]): r["agent_id"] for r in registry}


async def verified_rows(store, site, bound):
    """Observation rows of a site whose claim is bound to its Wazuh agent in the registry."""
    return [r for r in await store.site_obs(site) if bound.get((site, r["sensor_id"])) == r["agent_id"]]


async def verified_prows(store, site, bound):
    """Protocol-evidence rows of a site whose claim is bound to its Wazuh agent in the registry."""
    return [r for r in await store.site_pobs(site) if bound.get((site, r["sensor_id"])) == r["agent_id"]]


async def rematerialize(store, site, bound, clear=False):
    rows = await verified_rows(store, site, bound)
    prows = await verified_prows(store, site, bound)
    if not (rows or prows or clear):
        return None
    return await store.materialize(site, rollup(site, rows, prows, await store.expectations(site)))


def blocked_by(gate, site, sid):
    """Why ingest must drop an item from Sensor `sid` claiming `site`, or None. `gate` is the site registry view
    from `SqlStore.gate()`: {"aliases": {source id: canonical}, "inactive": {canonical sites that are disabled or
    retired}, "disabled": {(canonical site, source id) that are associated with the site but not enabled}}.
    A source that was never associated is not blocked here: the Sensor registry still decides what is verified."""
    if not gate:
        return None
    canon = gate["aliases"].get(site, site)
    if canon in gate["inactive"]:
        return "site_inactive"
    if (canon, sid) in gate["disabled"] or (canon, "%s/%s" % (site, sid)) in gate["disabled"]:
        return "source_disabled"
    return None


async def apply_items(store, items, now):
    stats, touched = Counter(), set()
    bound = bindings(await store.registry())
    gate = await store.gate() if hasattr(store, "gate") else None
    for item in items:
        try:
            data = item["data"]
            site, sid = identity(data)
            agent, agent_name = claim_agent(item)
        except (Reject, KeyError, TypeError, AttributeError):
            stats["rejected"] += 1
            continue
        why = blocked_by(gate, site, sid)
        if why:
            stats[why] += 1          # not stored, not counted as a Sensor report: the site owner has switched it off
            continue
        received = parse_received(item.get("received_at"), now)
        sensor = await store.get_sensor(site, sid, agent) or new_sensor(site, sid, agent, agent_name, received)
        sensor["first_receipt"] = min(sensor["first_receipt"], received)
        sensor["agent_name"] = agent_name or sensor.get("agent_name")
        item = dict(item, agent_id=agent)
        kind = item.get("kind")
        try:
            if kind == "obs":
                outcome = await apply_obs(store, sensor, data, item, received, now)
            elif kind == "proto":
                outcome = await apply_proto(store, sensor, data, item, received, now)
            elif kind == "status":
                outcome = await apply_status(store, sensor, data, received, now)
            else:
                raise Reject("unknown item kind")
        except Reject as exc:
            sensor["rejected_total"] += 1
            sensor["last_error"], sensor["last_error_at"] = "ingest: %s" % exc, now
            await store.put_sensor(sensor)
            stats["rejected"] += 1
            continue
        await store.put_sensor(sensor)
        stats["%s_%s" % (kind, outcome)] += 1
        if bound.get((site, sid)) != agent:
            stats["unverified"] += 1       # stored under its own claim, excluded from every site result
        elif kind in ("obs", "proto") and outcome in ("new", "updated"):
            touched.add(site)
    sites = {}
    for site in sorted(touched):
        sites[site] = await rematerialize(store, site, bound)
    return {"items": len(items), "stats": dict(stats), "sites": sites}


def tool_status(tr, sensor):
    if tr is None:
        return "unknown"
    if tr["current_error"]:
        return "error"
    if tr["last_record_ts"] is not None and sensor["hb_emitted"] is not None and \
            (sensor["hb_emitted"] - tr["last_record_ts"]).total_seconds() > TOOL_SILENT_S:
        return "silent"
    return "ok" if tr["last_receipt"] else "unknown"


def agent_state(agent_id, agents, now):
    """Wazuh manager's view of the bound agent: (connected|disconnected|unknown, text)."""
    row = agents.get(agent_id)
    if row is None or row["measured_at"] is None or (now - row["measured_at"]).total_seconds() > AGENT_FRESH_S:
        return "unknown", None
    return ("connected" if str(row["status"]).lower().startswith("active") else "disconnected"), row["status"]


def claim_state(sensor, tools, registered, agent, now):
    """Sensor state from the verified claim row (or None) and the Wazuh agent view."""
    if not registered:
        return "discovered"
    hb = sensor["hb_receipt"] if sensor else None
    age = (now - hb).total_seconds() if hb else None
    limit = (sensor or {}).get("stale_after_s") or DEFAULT_STALE_S
    tstat = {t: tool_status(tools.get(t), sensor) for t in TOOLS} if sensor else {}
    if agent == "disconnected" or (age is not None and age > OFFLINE_S):
        return "offline"
    if hb is None:
        return "registered"
    if age > limit or (sensor["hb_lag_s"] is not None and sensor["hb_lag_s"] > limit):
        return "stale"
    if sensor["current_error"] or "error" in tstat.values():
        return "error"
    return "reporting"


EMPTY_CLAIM = {"hb_receipt": None, "hb_emitted": None, "hb_lag_s": None, "producer": None, "current_error": None,
               "last_error": None, "last_error_at": None, "last_event_time": None, "last_ingest_ok": None,
               "last_obs_ingest": None, "stale_after_s": DEFAULT_STALE_S, "batches_total": 0,
               "replayed_total": 0, "superseded_total": 0, "rejected_total": 0}


def sensor_view(sensor, tools, now, reg=None, agents=None, bound_agent=None):
    """One Sensor view. `sensor` is the claim row (None for a registered Sensor with no report yet);
    `reg` is its registry entry when registered (the claim is then verified)."""
    row = sensor or EMPTY_CLAIM
    verified = bool(reg)
    site = reg["site_id"] if reg else sensor["site_id"]
    sid = reg["sensor_id"] if reg else sensor["sensor_id"]
    agent_id = reg["agent_id"] if reg else sensor["agent_id"]
    astate, atext = agent_state(agent_id, agents or {}, now)
    state = claim_state(sensor, tools, verified, astate, now)
    hb = row["hb_receipt"]
    age = (now - hb).total_seconds() if hb else None
    tstat = {t: (tool_status(tools.get(t), sensor) if sensor else "unknown") for t in TOOLS}
    conflict = None
    if not verified and bound_agent and bound_agent != agent_id:
        conflict = "identity is registered to Wazuh agent %s; this claim from agent %s is excluded" % (
            bound_agent, agent_id)
    reason = conflict or ("not registered: observations are stored but excluded from site results"
                          if not verified else None)
    if verified:
        reason = {
            "offline": ("the Wazuh manager reports agent %s as %s" % (agent_id, atext) if astate == "disconnected"
                        else "no heartbeat received for over %d s" % OFFLINE_S),
            "registered": "registered; no heartbeat received from the bound agent yet",
            "stale": "heartbeat older than %d s or delivered late" % (row["stale_after_s"] or DEFAULT_STALE_S),
            "error": row["current_error"] or "a tool reports an error",
        }.get(state)
    return {
        "site": site, "sensor": sid, "status": state, "registered": verified, "conflict": conflict,
        "sensor_uid": reg["sensor_uid"] if reg else None,
        "display_name": (reg["display_name"] or sid) if reg else sid,
        "registered_at": fmt(reg["registered_at"]) if reg else None,
        "registered_by": reg["registered_by"] if reg else None,
        "agent_id": agent_id, "agent_name": reg["agent_name"] if reg else sensor.get("agent_name"),
        "agent_status": astate, "agent_status_text": atext, "reason": reason,
        "age_s": None if age is None else int(age),
        "stale_after_s": row["stale_after_s"] or DEFAULT_STALE_S, "offline_after_s": OFFLINE_S,
        "last_heartbeat_receipt": fmt(hb), "delivery_lag_s": row["hb_lag_s"],
        "last_event_time": fmt(row["last_event_time"]), "last_ingest_ok": fmt(row["last_ingest_ok"]),
        "last_obs_ingest": fmt(row["last_obs_ingest"]), "current_error": row["current_error"],
        "last_error": row["last_error"], "last_error_at": fmt(row["last_error_at"]),
        "producer": row["producer"], "batches_total": row["batches_total"],
        "replayed_total": row["replayed_total"], "superseded_total": row["superseded_total"],
        "rejected_total": row["rejected_total"],
        "tools": {t: {"status": tstat[t], "last_record_ts": fmt((tools.get(t) or {}).get("last_record_ts")),
                      "error": (tools.get(t) or {}).get("current_error"),
                      "last_obs_event": fmt((tools.get(t) or {}).get("last_obs_event")),
                      "obs_total": (tools.get(t) or {}).get("obs_total", 0)} for t in TOOLS},
    }


async def agents_by_id(store):
    return {a["agent_id"]: a for a in await store.agents()}


async def sensor_views(store, now):
    """Registered Sensors first (verified claim row or none), then unregistered claims (discovered)."""
    tools = {}
    for tr in await store.all_tools():
        tools.setdefault((tr["site_id"], tr["sensor_id"], tr["agent_id"]), {})[tr["tool"]] = tr
    agents = await agents_by_id(store)
    registry = await store.registry()
    claims = {(s["site_id"], s["sensor_id"], s["agent_id"]): s for s in await store.all_sensors()}
    views, used = [], set()
    for reg in sorted(registry, key=lambda r: (r["site_id"], r["sensor_id"])):
        key = (reg["site_id"], reg["sensor_id"], reg["agent_id"])
        used.add(key)
        views.append(sensor_view(claims.get(key), tools.get(key, {}), now, reg=reg, agents=agents))
    bound = bindings(registry)
    for key, s in sorted(claims.items()):
        if key not in used:
            views.append(sensor_view(s, tools.get(key, {}), now, agents=agents,
                                     bound_agent=bound.get((s["site_id"], s["sensor_id"]))))
    return views


def table(views):
    head = "%-10s %-16s %-10s %-6s %-9s %-20s %-20s %s" % (
        "SITE", "SENSOR", "STATE", "AGENT", "AGE(s)", "LAST EVENT", "LAST INGEST OK", "ZEEK/SURICATA  NOTE")
    lines = [head]
    for v in views:
        lines.append("%-10s %-16s %-10s %-6s %-9s %-20s %-20s %s/%s  %s" % (
            v["site"], v["sensor"], v["status"], v["agent_id"], v["age_s"], v["last_event_time"],
            v["last_ingest_ok"], v["tools"]["zeek"]["status"], v["tools"]["suricata"]["status"],
            v["conflict"] or v["current_error"] or v["last_error"] or "-"))
    return "\n".join(lines)


# ------------------------------------------------------------------- registry
def valid_display(text, fallback):
    text = (text or "").strip()
    if not text:
        return fallback
    if len(text) > 64 or not text.isprintable():
        raise Reject("display name must be printable text of at most 64 characters")
    return text


async def register_sensor(store, site, sid, agent_id, display_name, actor, now):
    """Bind a Sensor identity to a verified Wazuh enrollment. Idempotent for the same binding."""
    if not (ID_RE.match(str(site)) and ID_RE.match(str(sid))):
        raise Reject("invalid site or sensor identity")
    if not AGENT_RE.match(str(agent_id)) or int(agent_id) == 0:
        raise Reject("invalid Wazuh agent id (000 is the manager itself)")
    agent = (await agents_by_id(store)).get(agent_id)
    if agent is None:
        raise Reject("Wazuh agent %s is not in the manager's agent list; refresh the agent list first" % agent_id)
    current = next((r for r in await store.registry() if (r["site_id"], r["sensor_id"]) == (site, sid)), None)
    if current:
        if current["agent_id"] == agent_id:
            return dict(current, created=False)
        raise Reject("%s/%s is already registered to agent %s; retire it first to rebind" % (
            site, sid, current["agent_id"]))
    other = next((r for r in await store.registry() if r["agent_id"] == agent_id), None)
    if other:
        raise Reject("agent %s is already registered as %s/%s" % (agent_id, other["site_id"], other["sensor_id"]))
    entry = {"sensor_uid": "fsn-" + uuid.uuid4().hex[:12], "site_id": site, "sensor_id": sid,
             "display_name": valid_display(display_name, sid), "agent_id": agent_id, "agent_name": agent["name"],
             "registered_at": now, "registered_by": clip(actor, 64) or "unknown", "retired_at": None,
             "retired_reason": None,
             "provenance": "agent %s (%s) from the Wazuh manager agent list, bound by an operator" % (
                 agent_id, agent["name"])}
    await store.put_registry(entry)
    return dict(entry, created=True)


async def adopt_legacy(store, site, sid, agent_id, alert_agents):
    """Move pre-registry rows (agent_id '') under the registered agent, but only rows whose Wazuh
    alert is independently shown (by the manager's alert log) to come from that agent."""
    if (await agents_by_id(store)).get(agent_id) is None or \
            bindings(await store.registry()).get((site, sid)) != agent_id:
        raise Reject("adopt requires a registered, bound identity")
    out = Counter()
    for r in [r for r in await store.site_obs(site) if r["sensor_id"] == sid and r["agent_id"] == ""]:
        if alert_agents.get(r["wazuh_alert_id"]) != agent_id:
            out["not_verified"] += 1
        elif await store.get_obs(site, sid, agent_id, r["obs_key"]):
            out["conflict"] += 1
        else:
            await store.move_legacy_obs(r, agent_id)
            out["adopted"] += 1
    if out["adopted"]:
        legacy = await store.get_sensor(site, sid, "")
        if legacy and not await store.get_sensor(site, sid, agent_id):
            await store.move_legacy_sensor(site, sid, agent_id)
            out["sensor_adopted"] = 1
    return dict(out)


async def registry_action(store, req, now):
    action = req.get("action")
    if action == "list":
        return {"registry": [dict(r, registered_at=fmt(r["registered_at"]), retired_at=None) for r in
                             await store.registry()],
                "agents": [dict(a, measured_at=fmt(a["measured_at"])) for a in await store.agents()]}
    site, sid = req.get("site_id"), req.get("sensor_id")
    if action == "register":
        entry = await register_sensor(store, site, sid, str(req.get("agent_id")), req.get("display_name"),
                                      req.get("actor"), now)
        site_result = await rematerialize(store, site, bindings(await store.registry()))
        return {"registered": dict(entry, registered_at=fmt(entry["registered_at"]), retired_at=None),
                "site_rematerialized": site_result}
    reg = next((r for r in await store.registry() if (r["site_id"], r["sensor_id"]) == (site, sid)), None)
    if reg is None:
        raise Reject("no active registry entry for %s/%s" % (site, sid))
    if action == "legacy_alerts":
        return {"alert_ids": sorted({r["wazuh_alert_id"] for r in await store.site_obs(site)
                                     if r["sensor_id"] == sid and r["agent_id"] == "" and r["wazuh_alert_id"]})}
    if action == "rename":
        reg["display_name"] = valid_display(req.get("display_name"), sid)
        await store.put_registry(reg)
        return {"renamed": sid, "display_name": reg["display_name"], "sensor_uid": reg["sensor_uid"]}
    if action == "retire":
        reg["retired_at"], reg["retired_reason"] = now, clip(req.get("reason"), 200) or "retired by operator"
        await store.put_registry(reg)
        await rematerialize(store, site, bindings(await store.registry()), clear=True)
        return {"retired": sid, "sensor_uid": reg["sensor_uid"],
                "note": "history kept; observations under the old binding stay in the database"}
    if action == "adopt":
        result = await adopt_legacy(store, site, sid, reg["agent_id"], req.get("alert_agents") or {})
        if result.get("adopted"):
            await rematerialize(store, site, bindings(await store.registry()))
        return {"adopt": result}
    raise Reject("unknown registry action")


# ---------------------------------------------------------------- expectations
def expectation_row(e):
    return dict(e, created_at=fmt(e["created_at"]), retired_at=fmt(e.get("retired_at")))


async def expect_action(store, req, now):
    """Operator-declared expectations: which (client, server, port) relationships are intended and with
    what access (read | read-write | any). They drive `expected`/`new`/`suspicious`; they never alter
    evidence. `adopt` baselines what is currently observed (never a relationship with program functions)."""
    action = req.get("action")
    if action == "list":
        rows = await store.all_expectations()
        return {"expectations": [expectation_row(e) for e in rows if req.get("site_id") in (None, e["site_id"])]}
    site = req.get("site_id")
    if not ID_RE.match(str(site)):
        raise Reject("invalid site")
    actor = clip(req.get("actor"), 64) or "unknown"
    current = await store.expectations(site)
    bound = bindings(await store.registry())
    if action == "add":
        try:
            client, server = req["client"], req["server"]
            ipaddress.ip_address(client)
            ipaddress.ip_address(server)
            port = int(req["port"])
        except (KeyError, ValueError, TypeError):
            raise Reject("client, server (IP addresses) and port are required")
        if not 0 < port < 65536 or req.get("access") not in ACCESS_MODES:
            raise Reject("port must be 1-65535 and access one of %s" % ", ".join(ACCESS_MODES))
        same = next((e for e in current if (e["client"], e["server"], e["port"]) == (client, server, port)), None)
        if same:
            if same["access"] == req["access"]:
                return {"added": expectation_row(same), "created": False}
            raise Reject("already declared with access %s as %s; remove it first" % (
                same["access"], same["expectation_id"]))
        entry = {"expectation_id": "exp-" + uuid.uuid4().hex[:10], "site_id": site, "client": client,
                 "server": server, "port": port, "protocol": clip(req.get("protocol") or "modbus", 32),
                 "access": req["access"], "note": clip(req.get("note"), 200), "created_by": actor,
                 "created_at": now, "retired_at": None}
        await store.put_expectation(entry)
        await rematerialize(store, site, bound)
        return {"added": expectation_row(entry), "created": True}
    if action == "remove":
        entry = next((e for e in current if e["expectation_id"] == req.get("expectation_id")), None)
        if entry is None:
            raise Reject("no active expectation %s at %s" % (req.get("expectation_id"), site))
        entry["retired_at"] = now
        await store.put_expectation(entry)
        await rematerialize(store, site, bound, clear=True)
        return {"removed": expectation_row(entry), "note": "history kept"}
    if action == "adopt":
        ru = rollup(site, await verified_rows(store, site, bound), await verified_prows(store, site, bound), current)
        out = Counter()
        for rel in ru["relationships"].values():
            if rel["expectation"] is not None:
                out["already_declared"] += 1
            elif rel["ops"]["prog"]:
                out["skipped_program_functions"] += 1
            else:
                access = ("any" if rel["evidence"] != "protocol" else
                          "read-write" if rel["ops"]["writes"] else "read")
                await store.put_expectation({
                    "expectation_id": "exp-" + uuid.uuid4().hex[:10], "site_id": site, "client": rel["client"],
                    "server": rel["server"], "port": rel["port"], "protocol": rel["protocol"], "access": access,
                    "note": "baselined from observed traffic", "created_by": actor, "created_at": now,
                    "retired_at": None})
                out["adopted_" + access.replace("-", "_")] += 1
        if any(k.startswith("adopted") for k in out):
            await rematerialize(store, site, bound)
        return {"adopt": dict(out), "baseline": fmt(now),
                "note": "observed relationships are declared expected with the access seen so far"}
    raise Reject("unknown expect action")


# ------------------------------------------------------------------- SQL store
SENSOR_COLS = {
    "site_id": "text", "sensor_id": "text", "agent_id": "text", "agent_name": "text",
    "first_receipt": "timestamp", "hb_receipt": "timestamp",
    "hb_emitted": "timestamp", "hb_lag_s": "double precision", "producer": "text", "current_error": "text",
    "last_error": "text", "last_error_at": "timestamp", "last_ingest_ok": "timestamp",
    "last_obs_ingest": "timestamp", "last_event_time": "timestamp", "stale_after_s": "integer",
    "batches_total": "bigint", "replayed_total": "bigint", "superseded_total": "bigint",
    "rejected_total": "bigint"}
TOOL_COLS = {
    "site_id": "text", "sensor_id": "text", "agent_id": "text", "tool": "text", "last_record_ts": "timestamp",
    "last_receipt": "timestamp", "current_error": "text", "last_error_at": "timestamp",
    "last_obs_event": "timestamp", "obs_total": "bigint"}
OBS_COLS = {
    "site_id": "text", "sensor_id": "text", "agent_id": "text", "tool": "text", "obs_key": "text",
    "bucket": "timestamp",
    "orig": "text", "resp": "text", "resp_p": "integer", "transport": "text", "protocol": "text",
    "flows": "bigint", "orig_pkts": "bigint", "resp_pkts": "bigint", "orig_bytes": "bigint",
    "resp_bytes": "bigint", "states": "text", "first_seen": "timestamp", "last_seen": "timestamp",
    "refs": "text", "batch_id": "text", "wazuh_alert_id": "text", "emitted_at": "timestamp",
    "received_first": "timestamp", "received_last": "timestamp", "ingested_at": "timestamp"}
PROTO_COLS = {
    "site_id": "text", "sensor_id": "text", "agent_id": "text", "tool": "text", "obs_key": "text",
    "bucket": "timestamp", "orig": "text", "resp": "text", "resp_p": "integer", "protocol": "text",
    "evidence": "text", "req": "bigint", "rsp": "bigint", "reads": "bigint", "writes": "bigint",
    "diag": "bigint", "prog": "bigint", "other": "bigint", "exc": "bigint", "fc": "text", "fc_first": "text",
    "units": "text", "exc_names": "text", "addr_read": "text", "addr_write": "text",
    "first_seen": "timestamp", "last_seen": "timestamp", "refs": "text", "batch_id": "text",
    "wazuh_alert_id": "text", "emitted_at": "timestamp", "received_first": "timestamp",
    "received_last": "timestamp", "ingested_at": "timestamp"}
EXPECT_COLS = {
    "expectation_id": "text", "site_id": "text", "client": "text", "server": "text", "port": "integer",
    "protocol": "text", "access": "text", "note": "text", "created_by": "text", "created_at": "timestamp",
    "retired_at": "timestamp"}
REGISTRY_COLS = {
    "sensor_uid": "text", "site_id": "text", "sensor_id": "text", "display_name": "text", "agent_id": "text",
    "agent_name": "text", "registered_at": "timestamp", "registered_by": "text", "retired_at": "timestamp",
    "retired_reason": "text", "provenance": "text"}
AGENT_COLS = {"agent_id": "text", "name": "text", "ip": "text", "status": "text", "measured_at": "timestamp"}
HEALTH_COLS = {"source": "text", "measured_at": "timestamp", "detail": "text"}
SENSOR_PK = ("site_id", "sensor_id", "agent_id")
TOOL_PK = ("site_id", "sensor_id", "agent_id", "tool")
OBS_PK = ("site_id", "sensor_id", "agent_id", "obs_key")
TABLES = (
    ("forge_sensors", SENSOR_COLS, SENSOR_PK),
    ("forge_sensor_tools", TOOL_COLS, TOOL_PK),
    ("forge_observations", OBS_COLS, OBS_PK),
    ("forge_proto_obs", PROTO_COLS, OBS_PK),
    ("forge_expectations", EXPECT_COLS, ("expectation_id",)),
    ("forge_sensor_registry", REGISTRY_COLS, ("sensor_uid",)),
    ("forge_agents", AGENT_COLS, ("agent_id",)),
    ("forge_health", HEALTH_COLS, ("source",)),
)
# Schema-2 tables created before the registry were keyed without the Wazuh agent: add the column
# (existing rows get agent '' = unverified legacy until adopted) and widen the primary key once.
MIGRATE = (("forge_sensors", SENSOR_PK), ("forge_sensor_tools", TOOL_PK), ("forge_observations", OBS_PK))


class SqlStore:
    def __init__(self, db):
        from sqlalchemy import text
        self.db, self.text = db, text

    async def ensure_schema(self):
        for name, cols, pk in TABLES:
            body = ", ".join("%s %s" % kv for kv in cols.items())
            await self.db.execute(self.text("CREATE TABLE IF NOT EXISTS %s (%s, PRIMARY KEY (%s))" % (
                name, body, ", ".join(pk))))
        for name, pk in MIGRATE:
            have = (await self.db.execute(self.text(
                "SELECT 1 FROM information_schema.columns WHERE table_name=:t AND column_name='agent_id'"),
                {"t": name})).first()
            if have is None:
                await self.db.execute(self.text("ALTER TABLE %s ADD COLUMN agent_id text NOT NULL DEFAULT ''" % name))
                if name == "forge_sensors":
                    await self.db.execute(self.text("ALTER TABLE forge_sensors ADD COLUMN agent_name text"))
                await self.db.execute(self.text("ALTER TABLE %s DROP CONSTRAINT %s_pkey" % (name, name)))
                await self.db.execute(self.text("ALTER TABLE %s ADD PRIMARY KEY (%s)" % (name, ", ".join(pk))))
        await self.db.execute(self.text(
            "CREATE INDEX IF NOT EXISTS forge_observations_site ON forge_observations (site_id)"))
        await self.db.execute(self.text(
            "CREATE INDEX IF NOT EXISTS forge_proto_obs_site ON forge_proto_obs (site_id)"))
        await self.db.execute(self.text(
            "CREATE UNIQUE INDEX IF NOT EXISTS forge_registry_identity ON forge_sensor_registry "
            "(site_id, sensor_id) WHERE retired_at IS NULL"))
        await self.db.execute(self.text(
            "CREATE UNIQUE INDEX IF NOT EXISTS forge_registry_agent ON forge_sensor_registry "
            "(agent_id) WHERE retired_at IS NULL"))

    async def _get(self, table, pk, key):
        cond = " AND ".join("%s=:%s" % (k, k) for k in pk)
        res = await self.db.execute(self.text("SELECT * FROM %s WHERE %s" % (table, cond)), dict(zip(pk, key)))
        row = res.mappings().first()
        return dict(row) if row else None

    async def _put(self, table, cols, pk, row):
        names = list(cols)
        upd = ", ".join("%s=EXCLUDED.%s" % (n, n) for n in names if n not in pk)
        sql = "INSERT INTO %s (%s) VALUES (%s) ON CONFLICT (%s) DO UPDATE SET %s" % (
            table, ", ".join(names), ", ".join(":" + n for n in names), ", ".join(pk), upd)
        await self.db.execute(self.text(sql), {n: row.get(n) for n in names})

    async def _all(self, table, where="", params=None):
        res = await self.db.execute(self.text("SELECT * FROM %s %s" % (table, where)), params or {})
        return [dict(r) for r in res.mappings()]

    async def get_sensor(self, site, sid, agent):
        return await self._get("forge_sensors", SENSOR_PK, (site, sid, agent))

    async def put_sensor(self, row):
        await self._put("forge_sensors", SENSOR_COLS, SENSOR_PK, row)

    async def get_tool(self, site, sid, agent, tool):
        return await self._get("forge_sensor_tools", TOOL_PK, (site, sid, agent, tool))

    async def put_tool(self, row):
        await self._put("forge_sensor_tools", TOOL_COLS, TOOL_PK, row)

    async def get_obs(self, site, sid, agent, key):
        return await self._get("forge_observations", OBS_PK, (site, sid, agent, key))

    async def put_obs(self, row):
        await self._put("forge_observations", OBS_COLS, OBS_PK, row)


    async def get_pobs(self, site, sid, agent, key):
        return await self._get("forge_proto_obs", OBS_PK, (site, sid, agent, key))

    async def put_pobs(self, row):
        await self._put("forge_proto_obs", PROTO_COLS, OBS_PK, row)

    async def site_pobs(self, site):
        return await self._all("forge_proto_obs", "WHERE site_id=:s", {"s": site})

    async def expectations(self, site):
        return await self._all("forge_expectations", "WHERE site_id=:s AND retired_at IS NULL", {"s": site})

    async def all_expectations(self):
        return await self._all("forge_expectations", "WHERE retired_at IS NULL")

    async def put_expectation(self, row):
        await self._put("forge_expectations", EXPECT_COLS, ("expectation_id",), row)
    async def site_obs(self, site):
        return await self._all("forge_observations", "WHERE site_id=:s", {"s": site})

    async def all_sensors(self):
        return await self._all("forge_sensors")

    async def all_tools(self):
        return await self._all("forge_sensor_tools")

    async def registry(self):
        return await self._all("forge_sensor_registry", "WHERE retired_at IS NULL")

    async def put_registry(self, row):
        await self._put("forge_sensor_registry", REGISTRY_COLS, ("sensor_uid",), row)

    async def agents(self):
        return await self._all("forge_agents")

    async def put_agents(self, rows, now):
        for a in rows:
            await self._put("forge_agents", AGENT_COLS, ("agent_id",), dict(a, measured_at=now))

    async def put_health(self, source, detail, now):
        await self._put("forge_health", HEALTH_COLS, ("source",),
                        {"source": source, "measured_at": now, "detail": json.dumps(detail)})

    async def health(self):
        out = {}
        for r in await self._all("forge_health"):
            out[r["source"]] = {"measured_at": r["measured_at"], "detail": json.loads(r["detail"] or "{}")}
        return out

    async def move_legacy_obs(self, row, agent):
        await self.db.execute(self.text(
            "UPDATE forge_observations SET agent_id=:a WHERE site_id=:s AND sensor_id=:i AND agent_id='' "
            "AND obs_key=:k"), {"a": agent, "s": row["site_id"], "i": row["sensor_id"], "k": row["obs_key"]})
        await self.db.execute(self.text(
            "UPDATE forge_sensor_tools SET agent_id=:a WHERE site_id=:s AND sensor_id=:i AND agent_id='' "
            "AND NOT EXISTS (SELECT 1 FROM forge_sensor_tools t WHERE t.site_id=:s AND t.sensor_id=:i "
            "AND t.agent_id=:a AND t.tool=forge_sensor_tools.tool)"),
            {"a": agent, "s": row["site_id"], "i": row["sensor_id"]})

    async def move_legacy_sensor(self, site, sid, agent):
        await self.db.execute(self.text(
            "UPDATE forge_sensors SET agent_id=:a WHERE site_id=:s AND sensor_id=:i AND agent_id=''"),
            {"a": agent, "s": site, "i": sid})

    async def gate(self):
        """Site registry view used to drop items from disabled/retired sites and from associated-but-not-enabled
        sources (see `blocked_by`). Tolerates a database without the site registry (nothing is blocked)."""
        from sqlalchemy import select
        from app.models.sites import Site, SiteAlias, SiteSource
        db = self.db
        try:
            aliases = {a.alias: a.site_id for a in (await db.execute(select(SiteAlias))).scalars()}
            inactive = {s.id for s in (await db.execute(select(Site))).scalars() if s.status != "active"}
            disabled = {(s.site_id, s.source_id) for s in (await db.execute(select(SiteSource))).scalars()
                        if s.source_type == "sensor" and not s.enabled}
        except Exception:
            await db.rollback()
            return None
        return {"aliases": aliases, "inactive": inactive, "disabled": disabled}

    async def assign_site(self, sess, source_site):
        """Give the live session its explicit site identity: the canonical id of the registered site (or alias)
        the Sensor's source id resolves to. A source id that is not registered stays unassigned, so its session
        is visible to Platform Administrators only; nothing is enabled or granted by ingesting."""
        from app.models.auth import SessionSite
        from app.models.sites import Site, SiteAlias
        db = self.db
        alias = await db.get(SiteAlias, source_site)
        site = await db.get(Site, alias.site_id if alias else source_site)
        if site is None or site.status == "retired":
            return
        row = await db.get(SessionSite, sess.id)
        if row is None:
            db.add(SessionSite(session_id=sess.id, site_id=site.id, assigned_by="forge-live-ingest"))
        elif row.site_id != site.id and row.site_id == source_site:
            row.site_id = site.id          # an earlier source-id assignment moves to the canonical site

    async def materialize(self, site, ru):
        """Write the site-level rollup into the site's Gridwolf session (idempotent)."""
        from sqlalchemy import select
        from app.models.ics import Connection, Device, Finding, Session
        db = self.db
        name = SESSION_PREFIX + site
        sess = (await db.execute(select(Session).where(Session.name == name))).scalar_one_or_none()
        if sess is None:
            sess = Session(name=name, status="active", description=(
                "Site %s. Source: live Zeek conn.log and Suricata EVE flow metadata from the site's FORGE "
                "Sensors, relayed through Wazuh. Minimized industrial-port flow aggregates only; not "
                "PCAP-derived, no payload analysis. Protocol labels are port-based. Per-Sensor observations "
                "are in forge_observations; this session holds the correlated site-level result." % site))
            db.add(sess)
            await db.flush()
        sid = sess.id
        await self.assign_site(sess, site)
        have = {}
        for c in (await db.execute(select(Connection).where(Connection.session_id == sid))).scalars():
            have[(c.src_ip, c.dst_ip, c.dst_port, c.protocol, c.transport)] = c
        for key, c in ru["connections"].items():
            row = have.get(key)
            if row is None:
                row = Connection(session_id=sid, src_ip=c["src"], dst_ip=c["dst"], src_port=0, dst_port=c["port"],
                                 protocol=c["protocol"], transport=c["transport"], is_ics=True,
                                 packet_count=0, byte_count=0, first_seen=c["first"], last_seen=c["last"])
                db.add(row)
            row.packet_count, row.byte_count = c["packets"], c["bytes"]
            row.first_seen, row.last_seen = c["first"], c["last"]
            row.properties = json.loads(json.dumps(c["props"]))
        for key, row in have.items():          # no longer in the verified rollup (e.g. Sensor retired)
            if key not in ru["connections"]:
                await db.delete(row)
        devs = {d.ip_address: d for d in (await db.execute(
            select(Device).where(Device.session_id == sid))).scalars()}
        for ip, row in devs.items():
            if ip not in ru["devices"]:
                await db.delete(row)
        for ip, d in ru["devices"].items():
            row = devs.get(ip)
            if row is None:
                row = Device(session_id=sid, ip_address=ip, device_type="UNKNOWN", purdue_level="UNKNOWN",
                             confidence=1)
                db.add(row)
            row.protocols, row.open_ports = d["protocols"], d["ports"]
            row.first_seen, row.last_seen, row.packet_count = d["first"], d["last"], d["packets"]
            row.properties = {"source": "zeek-suricata-live", "site_id": site, "internal": d["internal"],
                              "observed_by": d["observed_by"], "roles": d.get("roles", [])}
        existing = {}
        for f in (await db.execute(select(Finding).where(Finding.session_id == sid))).scalars():
            existing[(f.evidence or {}).get("dedupe_key")] = f
        for key, f in ru["findings"].items():
            row = existing.pop(key, None)
            dst = f["peers"][0] if len(f["peers"]) == 1 else None
            ftype = f.get("ftype") or ("protocol_anomaly" if f["egress"] else "custom")
            if row is None:
                db.add(Finding(session_id=sid, finding_type=ftype,
                               title=f["title"], description=f["text"], severity=f["severity"], src_ip=f["host"],
                               dst_ip=dst, protocol=f["protocol"], confidence=f["confidence"],
                               evidence=f["evidence"], status="open"))
            else:  # analyst-set status is preserved
                row.title, row.description, row.severity = f["title"], f["text"], f["severity"]
                row.confidence, row.evidence, row.dst_ip = f["confidence"], f["evidence"], dst
        sess.device_count, sess.connection_count = len(ru["devices"]), len(ru["connections"])
        sess.finding_count = len(ru["findings"]) + len(existing)
        return {"session_id": str(sid), "devices": len(ru["devices"]), "connections": len(ru["connections"]),
                "findings": len(ru["findings"])}


async def main(mode):
    from app.core.database import async_session_factory
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    async with async_session_factory() as db:
        store = SqlStore(db)
        await store.ensure_schema()
        if mode == "ingest":
            items = json.load(sys.stdin).get("items", [])
            print(json.dumps(await apply_items(store, items, now)))
        elif mode == "registry":
            try:
                print(json.dumps(await registry_action(store, json.load(sys.stdin), now)))
            except Reject as exc:
                await db.rollback()
                print(json.dumps({"error": str(exc)}))
                sys.exit(3)
        elif mode == "expect":
            try:
                print(json.dumps(await expect_action(store, json.load(sys.stdin), now)))
            except Reject as exc:
                await db.rollback()
                print(json.dumps({"error": str(exc)}))
                sys.exit(3)
        else:
            raw = sys.stdin.read() if mode == "status" else ""
            push = json.loads(raw) if raw.strip() else {}
            if push.get("agents") is not None:
                await store.put_agents(push["agents"], now)
            for source, detail in (push.get("health") or {}).items():
                await store.put_health(source, detail, now)
            views = await sensor_views(store, now)
            print(table(views) if mode == "table" else json.dumps({"now": fmt(now), "sensors": views}))
        await db.commit()


if __name__ == "__main__":
    _mode = sys.argv[1] if len(sys.argv) > 1 else "ingest"
    if _mode not in ("ingest", "status", "table", "registry", "expect"):
        sys.exit("usage: [ingest|status|table|registry|expect]")
    asyncio.run(main(_mode))
