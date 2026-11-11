// Live Capture: what the FORGE Sensors actually observed, with Sensor identity, state and freshness.
// Replaces the stock Gridwolf page whose Start/Stop controls drove a capture the Core does not do.
import { h, React, api, Badge, Tile, Kv, AsOf, useStyle, usePoll, fmtTime, num, dur, bytes } from "./ForgeCommon-r1.js";

const SEV = { critical: "error", high: "error", medium: "degraded", low: "registered", info: "registered" };

function SensorCard({ s }) {
  const tool = (t) => {
    const v = s.tools[t];
    return h("div", { className: "fg-row", style: { gap: ".4rem", marginTop: ".3rem" }, key: t },
      h("span", { style: { width: "4.2rem", textTransform: "capitalize" } }, t),
      h(Badge, { state: v.status }),
      h("span", { className: "fg-dim", style: { fontSize: ".7rem" } },
        v.error ? v.error : v.last_record_ts ? "last record " + fmtTime(v.last_record_ts) : "no record seen"));
  };
  const state = s.conflict ? "conflict" : s.status;
  const agent = s.agent_id
    ? s.agent_id + (s.agent_name ? " (" + s.agent_name + ")" : "") + (s.agent_status_text ? ", " + s.agent_status_text : ", status unknown")
    : "-";
  return h("div", { className: "fg-card" },
    h("div", { className: "fg-row", style: { justifyContent: "space-between" } },
      h("h2", null, s.display_name, s.location ? h("span", { className: "fg-dim", style: { fontSize: ".75rem", fontWeight: 400 } }, "  \u00b7  " + s.location) : null),
      h(Badge, { state, title: s.reason || undefined })),
    s.reason ? h("p", { className: "fg-sub", style: { fontSize: ".72rem" } }, s.reason) : null,
    h(Kv, { rows: [
      ["Sensor id", h("span", { className: "fg-mono" }, s.site + "/" + s.sensor)],
      ["Registry id", s.sensor_uid ? h("span", { className: "fg-mono" }, s.sensor_uid) : "not registered"],
      ["Wazuh agent", agent],
      ["Heartbeat", s.last_heartbeat_receipt ? fmtTime(s.last_heartbeat_receipt) + " (" + dur(s.age_s) + " ago)" : "none received"],
      ["Delivery lag", s.delivery_lag_s === null || s.delivery_lag_s === undefined ? "-" : dur(Math.round(s.delivery_lag_s))],
      ["Last observed flow", fmtTime(s.last_event_time)],
      ["Last ingest", fmtTime(s.last_ingest_ok)],
      ["Batches / replays", num(s.batches_total) + " / " + num(s.replayed_total)],
      ["Rejected", num(s.rejected_total)],
    ] }),
    h("div", { style: { marginTop: ".5rem" } }, tool("zeek"), tool("suricata")),
    s.registered && s.registered_at ? h("p", { className: "fg-dim", style: { fontSize: ".68rem", marginTop: ".5rem" } },
      "Registered " + fmtTime(s.registered_at) + (s.registered_by ? " by " + s.registered_by : "")) : null);
}

function EvidenceRows({ c }) {
  const rows = [];
  Object.keys(c.sensors || {}).sort().forEach((sensor) => {
    Object.keys(c.sensors[sensor]).sort().forEach((tool) => {
      const e = c.sensors[sensor][tool];
      const primary = (c.primary || {})[sensor] === tool;
      rows.push(h("tr", { key: sensor + tool },
        h("td", { className: "fg-mono" }, sensor),
        h("td", null, tool + (primary ? " (counted)" : "")),
        h("td", { className: "fg-n" }, num(e.flows)),
        h("td", { className: "fg-n" }, num(e.packets)),
        h("td", { className: "fg-n" }, bytes(e.bytes)),
        h("td", null, fmtTime(e.first_seen)),
        h("td", null, fmtTime(e.last_seen)),
        h("td", { className: "fg-mono" }, Object.keys(e.states || {}).map((k) => k + "=" + e.states[k]).join(" ") || "-")));
    });
  });
  return h("tr", { className: "fg-detail" }, h("td", { colSpan: 9 },
    h("div", { className: "fg-scroll" }, h("table", { className: "fg-table" },
      h("thead", null, h("tr", null, ["Sensor", "Tool", "Flows", "Packets", "Bytes", "First seen", "Last seen", "Conn. states"]
        .map((t, i) => h("th", { key: t, className: i >= 2 && i <= 4 ? "fg-n" : undefined }, t)))),
      h("tbody", null, rows))),
    h("p", { className: "fg-dim", style: { fontSize: ".68rem", marginTop: ".4rem" } },
      (c.counting || "") + (c.refs && c.refs.length ? " Evidence refs: " + c.refs.join(", ") + "." : ""))));
}

function Connections({ conns }) {
  const [open, setOpen] = React.useState(null);
  if (!conns.length) return h("div", { className: "fg-empty" }, "No verified connections observed yet.");
  const out = [];
  conns.forEach((c) => {
    const key = c.id;
    const lb = c.lower_bound ? "≥ " : "";
    out.push(h("tr", { key, className: "fg-click", onClick: () => setOpen(open === key ? null : key) },
      h("td", { className: "fg-mono" }, (open === key ? "▾ " : "▸ ") + c.src_ip + " → " + c.dst_ip + ":" + c.dst_port),
      h("td", null, (c.protocol_basis === "analyzer-confirmed" && c.intel ? c.intel.protocol : c.protocol) + " / " + c.transport + " ",
        c.protocol_basis === "analyzer-confirmed"
          ? h(Badge, { state: "ok", label: "analyzer-confirmed", title: "Protocol messages were parsed by the Sensor's analyzer; the port number was not used." })
          : h("span", { className: "fg-dim", style: { fontSize: ".68rem" }, title: "Connection metadata only: the label is a guess from the port number." }, "port-based")),
      h("td", { className: "fg-n" }, lb + num(c.flows)),
      h("td", { className: "fg-n" }, lb + num(c.packets)),
      h("td", { className: "fg-n" }, lb + bytes(c.bytes)),
      h("td", null, fmtTime(c.first_seen)),
      h("td", null, fmtTime(c.last_seen)),
      h("td", null, dur(c.last_seen_age_s) + " ago"),
      h("td", null, (c.observed_by || []).join(", "), c.lower_bound
        ? h("span", { style: { marginLeft: ".4rem" } }, h(Badge, { state: "degraded", label: "lower bound",
          title: "Several Sensors saw this connection. The value shown is the maximum of the per-Sensor counts, not a sum." }))
        : null)));
    if (open === key) out.push(h(EvidenceRows, { c, key: key + "-d" }));
  });
  return h("div", { className: "fg-scroll" }, h("table", { className: "fg-table" },
    h("thead", null, h("tr", null, ["Connection", "Protocol / evidence", "Flows", "Packets", "Bytes", "First seen", "Last seen", "Age", "Observed by"]
      .map((t, i) => h("th", { key: t, className: i >= 2 && i <= 4 ? "fg-n" : undefined }, t)))),
    h("tbody", null, out)));
}

function Devices({ devices }) {
  if (!devices.length) return h("div", { className: "fg-empty" }, "No devices derived from observations yet.");
  return h("div", { className: "fg-scroll" }, h("table", { className: "fg-table" },
    h("thead", null, h("tr", null, ["Address", "Scope", "Role (evidence)", "Protocols", "Listening ports seen", "Packets (lower bound)", "Last seen", "Observed by"]
      .map((t, i) => h("th", { key: t, className: i === 5 ? "fg-n" : undefined }, t)))),
    h("tbody", null, devices.map((d) => h("tr", { key: d.id },
      h("td", { className: "fg-mono" }, d.ip),
      h("td", null, d.internal === null || d.internal === undefined ? "-" : d.internal ? "internal" : "external"),
      h("td", null, (d.roles || []).length ? d.roles.map((r) => h("div", { key: r.protocol + r.role, title: r.basis },
        r.role + " (" + r.protocol + ", " + r.confidence + " confidence)")) : "-"),
      h("td", null, (d.protocols || []).join(", ") || "-"),
      h("td", { className: "fg-mono" }, (d.ports || []).join(", ") || "-"),
      h("td", { className: "fg-n" }, num(d.packets)),
      h("td", null, fmtTime(d.last_seen)),
      h("td", null, (d.observed_by || []).join(", ")))))));
}

function Findings({ findings }) {
  if (!findings.length) return h("div", { className: "fg-empty" }, "No findings derived from the verified observations.");
  return h("div", { className: "fg-scroll" }, h("table", { className: "fg-table" },
    h("thead", null, h("tr", null, ["Severity", "Finding", "Classification", "Evidence", "Sensors", "Status", "Sent to Wazuh"].map((t) => h("th", { key: t }, t)))),
    h("tbody", null, findings.map((f) => h("tr", { key: f.id },
      h("td", null, h(Badge, { state: SEV[f.severity] || "unknown", label: f.severity })),
      h("td", null, h("div", null, f.title), h("div", { className: "fg-dim", style: { fontSize: ".68rem", marginTop: ".2rem" } }, f.description)),
      h("td", null, f.classification || "-"),
      h("td", null, f.evidence_basis === "zeek-modbus-analyzer" ? "protocol analyzer" : "connection metadata",
        f.functions ? h("div", { className: "fg-mono fg-dim", style: { fontSize: ".68rem" } }, "functions " + f.functions) : null),
      h("td", null, (f.sensors || []).join(", ") || "-"),
      h("td", null, f.status),
      h("td", { title: "Only evidence-backed policy deviations and potential indicators of medium severity or higher are exported to Wazuh. Observations stay in Gridwolf." },
        f.sent_to_wazuh ? "yes" : "no (kept in Gridwolf)"))))));
}

function RawObservations({ site }) {
  const st = usePoll("/forge/observations?site=" + encodeURIComponent(site) + "&limit=100", 20000);
  if (st.error && !st.data) return h("div", { className: "fg-err" }, st.error);
  if (!st.data) return h("div", { className: "fg-empty" }, "Loading evidence…");
  const rows = st.data.observations;
  if (!rows.length) return h("div", { className: "fg-empty" }, "No observation rows stored for this site.");
  return h("div", null,
    h("p", { className: "fg-dim", style: { fontSize: ".7rem", padding: ".4rem .9rem" } },
      "Showing " + rows.length + " of " + st.data.total + " per-Sensor evidence rows, newest first. Verified means the Wazuh agent that delivered the row is the agent the Sensor is registered to."),
    h("div", { className: "fg-scroll" }, h("table", { className: "fg-table" },
      h("thead", null, h("tr", null, ["Sensor / agent", "Tool", "Flow", "Flows", "Packets", "Last seen", "Emitted", "Received", "Wazuh alert", "Verified"].map((t) => h("th", { key: t }, t)))),
      h("tbody", null, rows.map((o) => h("tr", { key: o.obs_key + o.agent_id },
        h("td", { className: "fg-mono" }, o.sensor + " / " + (o.agent_id || "none")),
        h("td", null, o.tool),
        h("td", { className: "fg-mono" }, o.orig + " → " + o.resp + ":" + o.port + " " + o.protocol),
        h("td", { className: "fg-n" }, num(o.flows)),
        h("td", { className: "fg-n" }, num(o.packets)),
        h("td", null, fmtTime(o.last_seen)),
        h("td", null, fmtTime(o.emitted_at)),
        h("td", null, fmtTime(o.received_last)),
        h("td", { className: "fg-mono" }, o.wazuh_alert_id || "-"),
        h("td", null, h(Badge, { state: o.verified ? "ok" : "not_registered", label: o.verified ? "verified" : "unverified" }))))))));
}

const CLASS_HELP = {
  expected: "Matches an operator-declared expectation.",
  new: "First observed after the site baseline was set.",
  unknown: "No expectation or baseline applies, so no judgement is made.",
  suspicious: "Protocol evidence contradicts an expectation or is inherently high-risk. Cause not established.",
};
const ACTIVITY_LABEL = { active: "active", quiet: "quiet", unknown: "unknown", "unknown-source": "unknown-source" };
const flowOf = (x) => x.client + " → " + x.server + ":" + x.port;
const evidenceLabel = (e) => (e === "protocol" ? "protocol analyzer" : "connection metadata only");

function ClassBadge({ c }) {
  return h(Badge, { state: c, title: CLASS_HELP[c] });
}

function Changes({ intel }) {
  const [routine, setRoutine] = React.useState(false);
  const hidden = intel.changes.filter((c) => c.routine).length;
  const rows = intel.changes.filter((c) => routine || !c.routine);
  return h("div", { className: "fg-panel" },
    h("div", { className: "fg-head" }, h("h2", null, "What changed"),
      h("span", { className: "fg-row", style: { gap: ".5rem" } },
        h("span", { className: "fg-dim", style: { fontSize: ".7rem" } },
          "Routine observations are not alerts" + (hidden && !routine ? "; " + hidden + " routine item(s) hidden" : "")),
        hidden || routine ? h("button", { onClick: () => setRoutine(!routine) }, routine ? "Hide routine" : "Show routine") : null)),
    rows.length ? h("div", { className: "fg-scroll" }, h("table", { className: "fg-table" },
      h("thead", null, h("tr", null, ["When (UTC)", "Change", "Class", "Evidence", "Sensors"].map((t) => h("th", { key: t }, t)))),
      h("tbody", null, rows.map((c, i) => h("tr", { key: c.type + c.relationship + c.at + i, style: c.routine ? { opacity: 0.65 } : undefined },
        h("td", null, fmtTime(c.at)),
        h("td", null, h("div", null, c.title),
          c.detail ? h("div", { className: "fg-dim", style: { fontSize: ".68rem", marginTop: ".2rem" } }, c.detail) : null),
        h("td", null, h(ClassBadge, { c: c.classification })),
        h("td", null, evidenceLabel(c.evidence)),
        h("td", null, (c.sensors || []).join(", ") || "-"))))))
      : h("div", { className: "fg-empty" }, intel.changes.length
        ? "Nothing needs attention. " + hidden + " routine item(s) are hidden."
        : "No relationship changes recorded for this site yet."));
}

function RelationshipDetail({ r }) {
  const fc = r.functions.length ? h("table", { className: "fg-table" },
    h("thead", null, h("tr", null, ["Function", "Class", "Count", "First seen"].map((t) => h("th", { key: t }, t)))),
    h("tbody", null, r.functions.map((f) => h("tr", { key: f.code },
      h("td", { className: "fg-mono" }, "FC" + f.code + " " + f.name), h("td", null, f.class),
      h("td", { className: "fg-n" }, num(f.count)), h("td", null, fmtTime(f.first_seen))))))
    : h("p", { className: "fg-dim" }, "No Modbus function codes: this relationship is connection metadata only. Function codes are never inferred from connection metadata.");
  const pairs = (o) => Object.keys(o || {}).sort().map((k) => k + "=" + o[k]).join(", ") || "-";
  const sensors = Object.keys(r.per_sensor || {}).sort().map((s) => {
    const p = r.per_sensor[s];
    return h("div", { key: s, className: "fg-mono", style: { fontSize: ".7rem" } },
      s + ": " + p.requests + " req, " + p.responses + " rsp, " + p.reads + " read, " + p.writes + " write, " +
      p.exceptions + " exc; " + fmtTime(p.first_seen) + " to " + fmtTime(p.last_seen));
  });
  return h("tr", { className: "fg-detail" }, h("td", { colSpan: 8 },
    h("div", { style: { display: "grid", gap: ".6rem" } },
      fc,
      h(Kv, { rows: [
        ["Unit ids", pairs(r.units)],
        ["Register addresses read", r.address_evidence === "available" ? pairs(r.addresses_read) : r.address_evidence],
        ["Register addresses written", r.address_evidence === "available" ? pairs(r.addresses_write) : r.address_evidence],
        ["Exceptions", pairs(r.exception_names)],
        ["Evidence basis", r.evidence_basis],
        ["Direction basis", r.direction_basis],
        ["Classification reason", (r.reasons || []).join("; ") || "-"],
        ["Notes", (r.notes || []).join("; ") || "-"],
        ["Activity", r.activity_reason],
        ["Expectation", r.expectation ? r.expectation.id + " (" + r.expectation.access + (r.expectation.note ? ", " + r.expectation.note : "") + ")" : "none declared"],
        ["Counting", r.counting],
        ["Evidence refs", (r.refs || []).join(", ") || "-"],
      ] }),
      sensors.length ? h("div", null, h("div", { className: "fg-dim", style: { fontSize: ".68rem" } }, "Per-Sensor provenance"), sensors) : null)));
}

function Relationships({ intel }) {
  const [open, setOpen] = React.useState(null);
  if (!intel.relationships.length) return h("div", { className: "fg-empty" }, "No client-server relationships observed yet.");
  const out = [];
  intel.relationships.forEach((r) => {
    out.push(h("tr", { key: r.key, className: "fg-click", onClick: () => setOpen(open === r.key ? null : r.key) },
      h("td", { className: "fg-mono" }, (open === r.key ? "▾ " : "▸ ") + flowOf(r)),
      h("td", null, r.protocol_confirmed ? r.protocol : (r.port_label || r.protocol) + " ",
        r.protocol_confirmed ? h(Badge, { state: "ok", label: "analyzer-confirmed", title: r.evidence_basis })
          : h("span", { className: "fg-dim", style: { fontSize: ".68rem" }, title: r.evidence_basis }, "port-based")),
      h("td", null, r.protocol_confirmed ? r.access : "not known (no protocol evidence)"),
      h("td", null, h(ClassBadge, { c: r.classification })),
      h("td", null, h(Badge, { state: r.activity, label: ACTIVITY_LABEL[r.activity] || r.activity, title: r.activity_reason })),
      h("td", null, r.last_confirmed ? fmtTime(r.last_confirmed) : h("span", { className: "fg-dim" }, "never confirmed by protocol")),
      h("td", null, r.confidence + " / " + r.freshness),
      h("td", null, (r.observed_by || []).join(", "),
        r.corroborated ? h("span", { style: { marginLeft: ".4rem" } }, h(Badge, { state: "info", label: "corroborated",
          title: "More than one Sensor saw this relationship. Counts are the maximum across Sensors, not a sum." })) : null)));
    if (open === r.key) out.push(h(RelationshipDetail, { r, key: r.key + "-d" }));
  });
  return h("div", { className: "fg-scroll" }, h("table", { className: "fg-table" },
    h("thead", null, h("tr", null, ["Relationship (client → server)", "Protocol", "Access", "Class", "Activity", "Last confirmed (UTC)", "Confidence / freshness", "Observed by"]
      .map((t) => h("th", { key: t }, t)))),
    h("tbody", null, out)));
}

function Expectations({ intel }) {
  const rows = intel.expectations;
  return h("div", { className: "fg-panel" },
    h("div", { className: "fg-head" }, h("h2", null, "Expected relationships"),
      h("span", { className: "fg-dim", style: { fontSize: ".7rem" } },
        intel.baseline ? "Baseline set " + fmtTime(intel.baseline) : "No baseline set")),
    rows.length ? h("div", { className: "fg-scroll" }, h("table", { className: "fg-table" },
      h("thead", null, h("tr", null, ["Relationship", "Declared access", "Seen", "Note", "Declared"].map((t) => h("th", { key: t }, t)))),
      h("tbody", null, rows.map((e) => h("tr", { key: e.id },
        h("td", { className: "fg-mono" }, flowOf(e)), h("td", null, e.access),
        h("td", null, e.observed ? h(Badge, { state: "ok", label: "observed" }) : h(Badge, { state: "unknown", label: "never observed" })),
        h("td", null, e.note || "-"), h("td", null, fmtTime(e.created_at) + (e.created_by ? " by " + e.created_by : "")))))))
      : h("div", { className: "fg-empty" }, "No expectations declared. Without them relationships are shown as unknown and nothing is judged normal."),
    h("p", { className: "fg-dim", style: { fontSize: ".68rem", padding: ".4rem .9rem" } },
      "Expectations are operator declarations and are changed from the Core command line (gridwolf_live_feed.py expect), not from this page."));
}

function Intel({ st }) {
  if (st.error && !st.data) return h("div", { className: "fg-err" }, "Protocol intelligence unavailable: " + st.error);
  if (!st.data) return h("div", { className: "fg-empty" }, "Loading protocol intelligence…");
  const intel = st.data;
  return h(React.Fragment, null,
    h("div", { className: "fg-note" }, intel.notice),
    st.error ? h("div", { className: "fg-err" }, "Could not refresh protocol intelligence: " + st.error) : null,
    h(Changes, { intel }),
    h("div", { className: "fg-panel" },
      h("div", { className: "fg-head" }, h("h2", null, "Relationships"),
        h("span", { className: "fg-dim", style: { fontSize: ".7rem" } }, "Click a row for protocol evidence and per-Sensor provenance")),
      h(Relationships, { intel })),
    h(Expectations, { intel }));
}

export default function LiveCapture() {
  useStyle();
  const [site, setSite] = React.useState(null);
  const [showEvidence, setShowEvidence] = React.useState(false);
  const live = usePoll("/forge/live" + (site ? "?site=" + encodeURIComponent(site) : ""), 20000);
  const d = live.data;
  const intelSt = usePoll(d && d.site ? "/forge/intel?site=" + encodeURIComponent(d.site) : null, 20000);
  const sensors = d ? d.sensors : [];
  const registered = sensors.filter((s) => s.registered);
  const reporting = registered.filter((s) => s.status === "reporting").length;
  const unregistered = sensors.filter((s) => !s.registered).length;
  const ages = d ? d.connections.map((c) => c.last_seen_age_s).filter((n) => n !== null) : [];
  const newest = ages.length ? Math.min.apply(null, ages) : null;
  const lowerBound = d ? d.connections.some((c) => c.lower_bound) : false;
  const packets = d ? d.connections.reduce((n, c) => n + (c.packets || 0), 0) : 0;

  return h("div", { className: "fg" },
    h("div", { className: "fg-row", style: { justifyContent: "space-between" } },
      h("div", null, h("h1", null, "Live Capture"),
        h("p", { className: "fg-sub" }, "Passive observations reported by FORGE Sensors (Zeek and Suricata), relayed through Wazuh.")),
      d && d.sites.length > 1 ? h("label", { className: "fg-row", style: { fontSize: ".75rem" } }, "Site",
        h("select", { value: d.site, onChange: (e) => setSite(e.target.value) },
          d.sites.map((s) => h("option", { key: s, value: s }, s)))) : null),
    h("div", { className: "fg-note" }, d ? d.notice : "Sensor telemetry is reported by Sensors; the Core does not capture packets."),
    live.error ? h("div", { className: "fg-err" }, "Could not refresh: " + live.error + (d ? " — showing the last data received, which may be out of date." : "")) : null,
    h(AsOf, { state: live, every: 20 }),
    !d && !live.error ? h("div", { className: "fg-empty" }, "Loading…") : null,
    d && !d.site ? h("div", { className: "fg-card fg-empty" },
      "No Sensor has registered or reported to this Core yet. Nothing is shown here until a registered Sensor delivers heartbeats.")
      : d ? h(React.Fragment, null,
      h("div", { className: "fg-grid" },
        h(Tile, { label: "Sensors reporting", value: reporting + " / " + registered.length,
          sub: unregistered ? unregistered + " unregistered claim(s) excluded" : "registered Sensors" }),
        h(Tile, { label: "Connections", value: num(d.connections.length), sub: lowerBound ? "counts include lower bounds" : "verified Sensors only" }),
        h(Tile, { label: "Devices", value: num(d.devices.length), sub: "derived from observed flows" }),
        h(Tile, { label: "Findings", value: num(d.findings.length), sub: "derived, labelled by classification" }),
        h(Tile, { label: "Packets observed", value: (lowerBound ? "≥ " : "") + num(packets), sub: "sum over connections" }),
        h(Tile, { label: "Newest observed flow", value: newest === null ? "none" : dur(newest) + " ago", sub: "flow end as logged by the tool" })),
      h("div", null, h("h2", { style: { marginBottom: ".5rem" } }, "Sensors"),
        sensors.length ? h("div", { className: "fg-grid-wide" }, sensors.map((s) => h(SensorCard, { s, key: s.site + s.sensor + s.agent_id })))
          : h("div", { className: "fg-card fg-empty" }, "No Sensor has reported for this site.")),
      h(Intel, { st: intelSt }),
      h("div", { className: "fg-panel" },
        h("div", { className: "fg-head" }, h("h2", null, "Connections"),
          h("span", { className: "fg-dim", style: { fontSize: ".7rem" } }, "Click a row for per-Sensor, per-tool evidence")),
        h(Connections, { conns: d.connections })),
      h("div", { className: "fg-panel" }, h("div", { className: "fg-head" }, h("h2", null, "Devices")), h(Devices, { devices: d.devices })),
      h("div", { className: "fg-panel" }, h("div", { className: "fg-head" }, h("h2", null, "Findings")), h(Findings, { findings: d.findings })),
      h("div", { className: "fg-panel" },
        h("div", { className: "fg-head" }, h("h2", null, "Raw per-Sensor evidence"),
          h("button", { onClick: () => setShowEvidence(!showEvidence) }, showEvidence ? "Hide" : "Show")),
        showEvidence ? h(RawObservations, { site: d.site }) : null)) : null);
}
