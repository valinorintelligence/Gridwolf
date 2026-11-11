// External Tools: live sources (Zeek, Suricata, Wazuh) with measured health, and the tools that are
// import-only. Replaces the stock page whose "Import" buttons and drop area did nothing.
import { h, React, api, Badge, Kv, AsOf, useStyle, usePoll, fmtTime, num, dur } from "./ForgeCommon-r1.js";

const SENSOR_STATE_NOTE = {
  not_reporting: "Sensor is not delivering heartbeats, so tool health cannot be confirmed",
  silent: "tool log has not been written recently", error: "tool reports an error", ok: "tool log is fresh and error-free",
};

function ToolSource({ name, desc, src }) {
  const rows = (src.sensors || []).map((s) => h("tr", { key: s.sensor_uid || s.sensor },
    h("td", null, s.display_name, h("div", { className: "fg-mono fg-dim", style: { fontSize: ".66rem" } }, s.site + "/" + s.sensor + (s.location ? "  \u00b7  " + s.location : ""))),
    h("td", null, h(Badge, { state: s.state, title: SENSOR_STATE_NOTE[s.state] })),
    h("td", null, s.sensor_state !== "reporting" ? h(Badge, { state: s.sensor_state }) : "reporting"),
    h("td", null, s.error ? s.error : s.last_record_ts ? fmtTime(s.last_record_ts) : "none seen"),
    h("td", { className: "fg-n" }, num(s.obs_total)),
    h("td", null, s.last_heartbeat_receipt ? dur(s.heartbeat_age_s) + " ago" : "none")));
  return h("div", { className: "fg-card" },
    h("div", { className: "fg-row", style: { justifyContent: "space-between" } }, h("h2", null, name), h(Badge, { state: src.state })),
    h("p", { className: "fg-sub", style: { fontSize: ".72rem" } }, desc),
    rows.length ? h("div", { className: "fg-scroll", style: { marginTop: ".5rem" } }, h("table", { className: "fg-table" },
      h("thead", null, h("tr", null, ["Sensor", "Tool", "Sensor state", "Last record / error", "Observations", "Heartbeat"]
        .map((t, i) => h("th", { key: t, className: i === 4 ? "fg-n" : undefined }, t)))),
      h("tbody", null, rows)))
      : h("p", { className: "fg-dim", style: { fontSize: ".72rem", marginTop: ".5rem" } }, "No registered Sensor reports this tool."),
    h("p", { className: "fg-dim", style: { fontSize: ".66rem", marginTop: ".5rem" } }, "Measured by: " + src.measured_by));
}

function WazuhSource({ src }) {
  const services = Object.keys(src.services || {}).sort();
  const consumed = src.consumed || {};
  const last = src.last_alert || {};
  const lastAge = src.last_alert_age_s || {};
  return h("div", { className: "fg-card" },
    h("div", { className: "fg-row", style: { justifyContent: "space-between" } }, h("h2", null, "Wazuh"), h(Badge, { state: src.state })),
    h("p", { className: "fg-sub", style: { fontSize: ".72rem" } },
      "Relays Sensor telemetry from the Sensor's Wazuh agent to the Core manager; the Core feed reads the resulting alerts."),
    src.reason ? h("p", { style: { fontSize: ".75rem", marginTop: ".5rem" } }, src.reason) : null,
    (src.problems || []).length ? h("ul", { style: { margin: ".5rem 0 0 1rem", fontSize: ".75rem", color: "var(--fg-warn,#eab308)" } },
      src.problems.map((p) => h("li", { key: p }, p))) : null,
    src.measured_at ? h(Kv, { rows: [
      ["Health measured", fmtTime(src.measured_at) + " (" + dur(src.health_age_s) + " ago)"],
      ["Services", services.length ? services.map((u) => h("span", { key: u, style: { marginRight: ".6rem" } }, u + ": ", h(Badge, { state: src.services[u] }))) : "-"],
      ["Agents", src.agents && src.agents.known === false ? "manager agent list unreadable"
        : src.agents ? num(src.agents.active) + " active of " + num(src.agents.total) + (src.agents.disconnected ? ", " + src.agents.disconnected + " disconnected" : "") : "-"],
      ["Alert log written", src.alerts_file_age_s === null || src.alerts_file_age_s === undefined ? "-" : dur(src.alerts_file_age_s) + " ago"],
      ["Rules consumed", (src.consumed_rules || []).length ? src.consumed_rules.join(", ") : "-"],
      ["Feed last run", src.feed && src.feed.last_run ? fmtTime(src.feed.last_run) + (src.feed.new_items !== null && src.feed.new_items !== undefined ? ", " + src.feed.new_items + " new item(s)" : "") : "-"],
      ["Last consumed alert", Object.keys(last).length ? Object.keys(last).sort().map((k) => k + " " + fmtTime(last[k]) + (lastAge[k] !== null && lastAge[k] !== undefined ? " (" + dur(lastAge[k]) + " ago)" : "")).join("; ") : "-"],
      ["Alerts consumed", Object.keys(consumed).length ? Object.keys(consumed).sort().map((k) => k + ": " + num(consumed[k])).join(", ") : "-"],
    ] }) : null,
    h("p", { className: "fg-dim", style: { fontSize: ".66rem", marginTop: ".5rem" } }, "Measured by: " + src.measured_by));
}

const IMPORT_ONLY = [
  { name: "Nmap / Masscan", note: "Active scan results (XML). Imported as files; tagged separately from passive data. No live connection.", to: "/scans/import" },
  { name: "Siemens SINEMA", note: "Asset inventory export (CSV). Imported as files. No live connection.", to: "/scans/import" },
  { name: "Siemens TIA Portal", note: "Project XML export. Imported as files. No live connection.", to: "/scans/import" },
  { name: "Wireshark / PCAP", note: "Upload PCAP or PCAPNG for offline protocol analysis. Not the live Sensor feed.", to: "/pcap" },
];

function PcapHistory() {
  const [rows, setRows] = React.useState(null);
  React.useEffect(() => {
    api.get("/ics/pcap/list").then((r) => setRows(Array.isArray(r.data) ? r.data : []), () => setRows([]));
  }, []);
  return h("div", { className: "fg-panel" },
    h("div", { className: "fg-head" }, h("h2", null, "PCAP import history"),
      rows && rows.length ? h("span", { className: "fg-dim", style: { fontSize: ".7rem" } }, rows.length + " file(s)") : null),
    rows === null ? h("div", { className: "fg-empty" }, "Loading…")
      : !rows.length ? h("div", { className: "fg-empty" }, "No PCAP files imported yet. ", h("a", { href: "/pcap" }, "Upload a PCAP"))
        : h("div", { className: "fg-scroll" }, h("table", { className: "fg-table" },
          h("thead", null, h("tr", null, ["File", "Date", "Size", "Packets", "Protocols", "Status"].map((t) => h("th", { key: t }, t)))),
          h("tbody", null, rows.map((p) => h("tr", { key: p.pcap_id },
            h("td", { className: "fg-mono" }, p.filename),
            h("td", null, p.created_at ? new Date(p.created_at).toLocaleString() : "-"),
            h("td", null, p.file_size ? (p.file_size / 1048576).toFixed(1) + " MB" : "-"),
            h("td", null, p.packet_count === null || p.packet_count === undefined ? "-" : num(p.packet_count)),
            h("td", null, (p.protocol_summary && Object.keys(p.protocol_summary).slice(0, 4).join(", ")) || "-"),
            h("td", null, p.status)))))));
}

export default function ExternalTools() {
  useStyle();
  const ov = usePoll("/forge/overview", 20000);
  const d = ov.data;
  return h("div", { className: "fg" },
    h("div", null, h("h1", null, "External Tools"),
      h("p", { className: "fg-sub" }, "Live sources feeding Gridwolf, with the health that was actually measured, and tools that are import-only.")),
    d ? h("div", { className: "fg-note" }, d.notice) : null,
    ov.error ? h("div", { className: "fg-err" }, "Could not refresh: " + ov.error + (d ? " — showing the last data received, which may be out of date." : "")) : null,
    h(AsOf, { state: ov, every: 20 }),
    !d && !ov.error ? h("div", { className: "fg-empty" }, "Loading…") : null,
    d ? h(React.Fragment, null,
      h("h2", null, "Connected live sources"),
      h("div", { className: "fg-grid-wide", style: { gridTemplateColumns: "repeat(auto-fill,minmax(520px,1fr))" } },
        h(ToolSource, { name: "Zeek", desc: "Passive network metadata (conn.log) from each Sensor.", src: d.sources.zeek }),
        h(ToolSource, { name: "Suricata", desc: "Passive IDS flow and alert records (EVE JSON) from each Sensor.", src: d.sources.suricata }),
        h(WazuhSource, { src: d.sources.wazuh })),
      h("p", { className: "fg-dim", style: { fontSize: ".7rem" } },
        "Thresholds: Sensor stale after " + dur(d.thresholds.stale_after_s) + ", offline after " + dur(d.thresholds.offline_after_s) +
        "; tool silent after " + dur(d.thresholds.tool_silent_after_s) + "; Wazuh health must refresh within " + dur(d.thresholds.health_fresh_s) + ".")) : null,
    h("h2", null, "Import-only tools"),
    h("div", { className: "fg-grid-wide" }, IMPORT_ONLY.map((t) => h("div", { className: "fg-card", key: t.name },
      h("div", { className: "fg-row", style: { justifyContent: "space-between" } }, h("h2", null, t.name), h(Badge, { state: "unknown", label: "not a live source" })),
      h("p", { className: "fg-sub", style: { fontSize: ".72rem" } }, t.note),
      h("p", { style: { marginTop: ".5rem", fontSize: ".75rem" } }, h("a", { href: t.to }, "Open import"))))),
    h(PcapHistory));
}
