// Compliance Mapping, rewritten. The stock page scored a framework "compliant" whenever no finding of a
// type the engine never emits was present, and returned a fixed 80-95% for every requirement with no
// mapped finding type. Absence of evidence was therefore reported as compliance.
//
// This page makes no compliance claim and computes no score. It lists framework requirement areas and,
// for each, whether the passive detectors produced an indicator that may relate to it. A requirement
// with no indicator is "no indicator observed", never "met"; one that passive traffic cannot speak to
// is "not assessable". The mapping below is a candidate analyst mapping, not a certified crosswalk.
import { h, React, api, Badge, Tile, useStyle, num, useSessions, SessionPicker } from "./ForgeCommon-r1.js";

// finding types the passive engine actually emits
const T = {
  insecure: ["insecure_service"],
  write: ["write_path"],
  zone: ["purdue_violation"],
  exfil: ["beacon", "dns_exfil", "asymmetric_flow"],
};
const NA = [];

const FRAMEWORKS = {
  "IEC 62443-3-3": [
    ["SR 1.1", "Human user identification and authentication", NA],
    ["SR 1.2", "Software process and device identification", NA],
    ["SR 2.1", "Authorization enforcement", T.write],
    ["SR 3.1", "Communication integrity", T.insecure],
    ["SR 4.1", "Information confidentiality", T.insecure],
    ["SR 5.1", "Network segmentation", T.zone],
    ["SR 5.2", "Zone boundary protection", T.zone.concat(T.exfil)],
    ["SR 6.2", "Continuous monitoring", NA],
    ["SR 7.3", "Control system backup", NA],
  ],
  "NIST SP 800-82": [
    ["5.2", "Security architecture", T.zone],
    ["5.3", "Network segmentation", T.zone],
    ["5.4", "Access control", T.write.concat(T.insecure)],
    ["5.5", "Monitoring", NA],
    ["6.2", "Patch management", NA],
    ["6.3", "Incident response", NA],
  ],
  "NERC CIP": [
    ["CIP-005", "Electronic security perimeters", T.zone.concat(T.exfil)],
    ["CIP-007", "System security management", T.insecure],
    ["CIP-010", "Configuration change management", T.write],
    ["CIP-013", "Supply chain risk management", NA],
  ],
};

export default function Compliance() {
  useStyle();
  const [fw, setFw] = React.useState("IEC 62443-3-3");
  const ss = useSessions();
  const [st, setSt] = React.useState({ loading: true, findings: [], error: null });
  React.useEffect(() => {
    if (ss.sessions === null) return;
    if (!ss.sid) { setSt({ loading: false, findings: [], error: null }); return; }
    setSt({ loading: true, findings: [], error: null });
    api.get("/ics/findings/", { params: { session_id: ss.sid, limit: 5000 } }).then(
      (r) => setSt({ loading: false, findings: Array.isArray(r.data) ? r.data : [], error: null }),
      (e) => setSt({ loading: false, findings: [], error: (e && e.message) || "request failed" }));
  }, [ss.sessions, ss.sid]);
  const live = st.findings.filter((f) => f.status !== "resolved" && f.status !== "false_positive");
  const count = (types) => live.filter((f) => types.indexOf(f.finding_type) >= 0).length;
  const rows = FRAMEWORKS[fw].map(([id, name, types]) => {
    if (!types.length) return { id, name, state: "not_assessable", n: null };
    const n = count(types);
    return { id, name, state: n ? "indicator" : "none", n, types };
  });
  const tone = { not_assessable: "mute", indicator: "warn", none: "info" };
  const label = {
    not_assessable: "not assessable from passive traffic",
    indicator: "indicator observed",
    none: "no indicator observed",
  };
  return h("div", { className: "fg" },
    h("div", { className: "fg-row", style: { justifyContent: "space-between" } },
      h("div", null, h("h1", null, "Compliance Mapping"),
        h("p", { className: "fg-sub" }, "Which passive detections may relate to each framework requirement area.")),
      h(SessionPicker, { state: ss })),
    ss.sessions && !ss.sessions.length ? h("div", { className: "fg-empty" }, "No session yet. Import a capture to see indicators.") : null,
    h("div", { className: "fg-note" },
      "No compliance score is calculated and no requirement is reported as met. Compliance depends on policies, configuration, " +
      "patching and procedures that passive network traffic cannot show. \"No indicator observed\" means the detectors found " +
      "nothing in the imported captures; it is not evidence that the requirement is satisfied. Mapping is a candidate analyst " +
      "mapping, not a certified crosswalk."),
    st.error ? h("div", { className: "fg-err" }, "Could not load findings: " + st.error) : null,
    h("div", { className: "fg-grid" },
      h(Tile, { label: "Open indicators", value: st.loading ? "-" : num(live.length), sub: "unresolved findings of all types" }),
      h(Tile, { label: "Requirement areas mapped", value: rows.filter((r) => r.state !== "not_assessable").length + " / " + rows.length, sub: "have at least one passive detector" }),
      h(Tile, { label: "Compliance score", value: "Not computed", sub: "requires non-passive evidence" })),
    h("div", { className: "fg-row" }, Object.keys(FRAMEWORKS).map((k) =>
      h("button", { key: k, onClick: () => setFw(k), "aria-pressed": fw === k, style: fw === k ? { borderColor: "var(--accent)" } : null }, k))),
    h("div", { className: "fg-panel fg-scroll" }, h("table", { className: "fg-table" },
      h("thead", null, h("tr", null, ["Requirement", "Area", "Passive evidence", "Related detections"].map((t) => h("th", { key: t }, t)))),
      h("tbody", null, rows.map((r) => h("tr", { key: r.id },
        h("td", { className: "fg-mono" }, r.id), h("td", null, r.name),
        h("td", null, h(Badge, { state: tone[r.state] === "mute" ? "unknown" : tone[r.state] === "warn" ? "degraded" : "registered", label: label[r.state] })),
        h("td", null, r.state === "not_assessable" ? "-" : r.n + " open (" + r.types.join(", ") + ")")))))));
}
