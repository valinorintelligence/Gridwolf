// Baseline Drift, rewritten. The stock page listed every device in the database (both sessions mixed, so
// devices appeared twice), printed an invented drift percentage and said a comparison endpoint did not exist.
// This page calls /ics/sessions/compare and reports counts and rows of what differs between two captures. No
// percentage or score is calculated: a difference between captures is not by itself a change in the site.
import { h, React, api, Tile, useStyle, num } from "./ForgeCommon-r1.js";

const SEV = { critical: "Critical", high: "High", medium: "Medium", low: "Low", info: "Info" };

function Table(props) {
  if (!props.rows.length) return h("div", { className: "fg-empty" }, props.empty);
  return h("div", { className: "fg-scroll" }, h("table", { className: "fg-table" },
    h("thead", null, h("tr", null, props.head.map((t) => h("th", { key: t }, t)))),
    h("tbody", null, props.rows.map((r, i) => h("tr", { key: i }, r.map((c, j) => h("td", { key: j }, c)))))));
}

function Panel(props) {
  return h("div", { className: "fg-panel" },
    h("div", { className: "fg-head" }, h("h2", null, props.title)), props.children);
}

export default function BaselineDrift() {
  useStyle();
  const [sessions, setSessions] = React.useState(null);
  const [a, setA] = React.useState("");
  const [b, setB] = React.useState("");
  const [res, setRes] = React.useState({ data: null, error: null, loading: false });
  React.useEffect(() => {
    api.get("/ics/sessions/").then((r) => {
      const list = Array.isArray(r.data) ? r.data : [];
      setSessions(list);
      if (list.length > 1) { setA(list[1].id); setB(list[0].id); }
    }, () => setSessions([]));
  }, []);
  const run = () => {
    if (!a || !b) return;
    setRes({ data: null, error: null, loading: true });
    api.get("/ics/sessions/compare", { params: { baseline: a, current: b } }).then(
      (r) => setRes({ data: r.data, error: null, loading: false }),
      (e) => setRes({ data: null, error: (e && e.response && e.response.data && e.response.data.detail) || (e && e.message) || "request failed", loading: false }));
  };
  React.useEffect(run, [a, b]);
  const d = res.data;
  const opts = (sessions || []).map((x) => h("option", { key: x.id, value: x.id }, x.name));
  return h("div", { className: "fg" },
    h("div", null, h("h1", null, "Baseline Drift"),
      h("p", { className: "fg-sub" }, "What differs between two imported captures: devices, communication pairs and findings.")),
    sessions && sessions.length < 2 ? h("div", { className: "fg-empty" },
      "At least two sessions are needed to compare. Import a second capture into a new session.") : null,
    sessions && sessions.length > 1 ? h("div", { className: "fg-row" },
      h("label", { className: "fg-row", style: { fontSize: ".75rem" } }, "Baseline (earlier)",
        h("select", { value: a, onChange: (e) => setA(e.target.value), "aria-label": "Baseline session" }, opts)),
      h("label", { className: "fg-row", style: { fontSize: ".75rem" } }, "Current (later)",
        h("select", { value: b, onChange: (e) => setB(e.target.value), "aria-label": "Current session" }, opts)),
      h("button", { onClick: run }, "Compare")) : null,
    res.error ? h("div", { className: "fg-err" }, "Comparison failed: " + res.error) : null,
    res.loading ? h("div", { className: "fg-note" }, "Comparing...") : null,
    d ? h(React.Fragment, null,
      h("div", { className: "fg-note" }, d.note + " No drift score is calculated."),
      h("div", { className: "fg-grid" },
        h(Tile, { label: "Devices added", value: num(d.devices.added.length) }),
        h(Tile, { label: "Devices not seen", value: num(d.devices.removed.length), sub: "absent from current capture" }),
        h(Tile, { label: "Devices changed", value: num(d.devices.changed.length) }),
        h(Tile, { label: "New communication pairs", value: num(d.connections.added.length) }),
        h(Tile, { label: "Pairs not seen", value: num(d.connections.removed.length) }),
        h(Tile, { label: "New findings", value: num(d.findings.new.length) }),
        h(Tile, { label: "Findings not observed", value: num(d.findings.not_observed.length), sub: "not the same as resolved" })),
      h(Panel, { title: "Devices added" }, h(Table, { head: ["IP address", "Vendor", "Type", "Purdue", "Protocols"], empty: "None.",
        rows: d.devices.added.map((x) => [x.ip_address, x.vendor || "unknown", x.device_type || "unknown", x.purdue_level || "unknown", (x.protocols || []).join(", ") || "none observed"]) })),
      h(Panel, { title: "Devices not seen in the current capture" }, h(Table, { head: ["IP address", "Vendor", "Type", "Purdue", "Protocols"], empty: "None.",
        rows: d.devices.removed.map((x) => [x.ip_address, x.vendor || "unknown", x.device_type || "unknown", x.purdue_level || "unknown", (x.protocols || []).join(", ") || "none observed"]) })),
      h(Panel, { title: "Devices changed" }, h(Table, { head: ["IP address", "Field", "Before", "After"], empty: "None.",
        rows: d.devices.changed.flatMap((x) => x.changes.map((c) => [x.ip_address, c.field, Array.isArray(c.before) ? c.before.join(", ") || "none" : (c.before || "unknown"), Array.isArray(c.after) ? c.after.join(", ") || "none" : (c.after || "unknown")])) })),
      h(Panel, { title: "Communication pairs added" }, h(Table, { head: ["Source", "Destination", "Protocol"], empty: "None.",
        rows: d.connections.added.map((x) => [x.src_ip, x.dst_ip, x.protocol]) })),
      h(Panel, { title: "Findings new in the current capture" }, h(Table, { head: ["Severity", "Finding", "Status"], empty: "None.",
        rows: d.findings.new.map((x) => [SEV[x.severity] || x.severity, x.title, x.status]) })),
      h(Panel, { title: "Findings not observed in the current capture" }, h(Table, { head: ["Severity", "Finding", "Status"], empty: "None.",
        rows: d.findings.not_observed.map((x) => [SEV[x.severity] || x.severity, x.title, x.status]) }))) : null);
}
