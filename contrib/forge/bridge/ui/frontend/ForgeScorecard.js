// Security Scorecard, rewritten as an evidence summary. The stock page computed a 0-100 "score" from
// finding counts with invented weights (a site with no findings scored 100, one with a missing severity
// bucket rendered NaN) and showed a fixed "Identity & Access" value no data supported. A single posture
// number implied an assessment passive analysis cannot make, so this page reports what was observed and
// what is unknown, and computes no score.
import { h, React, api, Tile, useStyle, num, useSessions, SessionPicker } from "./ForgeCommon-r1.js";

const SEV = ["critical", "high", "medium", "low", "info"];

function useGet(path) {
  const [st, set] = React.useState({ data: null, error: null });
  React.useEffect(() => {
    if (!path) { set({ data: null, error: null }); return; }
    api.get(path).then((r) => set({ data: r.data, error: null }),
      (e) => set({ data: null, error: (e && e.message) || "request failed" }));
  }, [path]);
  return st;
}

export default function Scorecard() {
  useStyle();
  const ss = useSessions();
  const q = ss.sid ? "?session_id=" + encodeURIComponent(ss.sid) : null;
  const f = useGet(q && "/ics/findings/stats" + q);
  const d = useGet(q && "/ics/devices/stats" + q);
  const a = useGet("/ics/advisories/stats");
  const fd = f.data, dd = d.data, ad = a.data;
  const types = dd ? dd.by_type || {} : {};
  const unknownTypes = (types.UNKNOWN || 0) + (types.unknown || 0);
  const sev = fd ? fd.by_severity || {} : {};
  return h("div", { className: "fg" },
    h("div", { className: "fg-row", style: { justifyContent: "space-between" } },
      h("div", null, h("h1", null, "Security Scorecard"),
        h("p", { className: "fg-sub" }, "Evidence summary. Counts of what was observed, and what is not known.")),
      h(SessionPicker, { state: ss })),
    ss.sessions && !ss.sessions.length ? h("div", { className: "fg-empty" }, "No session yet. Import a capture to see counts.") : null,
    h("div", { className: "fg-note" },
      "No overall score is calculated. A score built only from finding counts would rate a site with nothing imported as perfect " +
      "and would ignore everything passive traffic cannot show. Figures below are counts from imported captures and are not a " +
      "measure of overall security posture."),
    f.error || d.error ? h("div", { className: "fg-err" }, "Some data could not be loaded: " + (f.error || d.error)) : null,
    h("h2", null, "Observed"),
    h("div", { className: "fg-grid" },
      h(Tile, { label: "Devices observed", value: dd ? num(dd.total_devices) : "-", sub: "distinct IP addresses in imported captures" }),
      h(Tile, { label: "Device type unknown", value: dd ? num(unknownTypes) : "-", sub: "identity not established from traffic" }),
      h(Tile, { label: "Findings", value: fd ? num(fd.total) : "-", sub: fd ? num(fd.open_count) + " open" : "" }),
      SEV.filter((s) => sev[s]).map((s) => h(Tile, { key: s, label: s + " findings", value: num(sev[s]) }))),
    h("h2", null, "Not assessed"),
    h("div", { className: "fg-grid" },
      h(Tile, { label: "Vulnerability posture", value: "Not assessed",
        sub: ad && ad.scored_count ? ad.scored_count + " advisories scored; device matching needs vendor and model" :
          "advisory feed " + (ad && ad.populated ? "populated; device matching needs vendor and model" : "has no data") }),
      h(Tile, { label: "Compliance", value: "Not assessed", sub: "see Compliance Mapping" }),
      h(Tile, { label: "Identity and access", value: "Not assessed", sub: "not observable passively" }),
      h(Tile, { label: "Patch and firmware status", value: "Not assessed", sub: "firmware not read from traffic" })));
}
