// CVE Matching, rewritten. The stock page listed every finding (write paths, beacons, Telnet ...) as a
// "CVE matched" row with a dash for the CVE id and counted them as "Total CVEs Matched", "Devices
// Affected" and so on. This page reports the real result of the two matchers: curated-CVE matching on
// vendor AND product, and advisory-feed matching, each with the number of devices that could not be
// assessed because passive traffic did not reveal a vendor and model.
import { h, React, api, Badge, Tile, useStyle, num, fmtTime } from "./ForgeCommon-r1.js";

function get(path, set) {
  api.get(path).then((r) => set({ data: r.data, error: null }),
    (e) => set({ data: null, error: ((e && e.response && e.response.data && e.response.data.detail) || (e && e.message) || "request failed") }));
}

export default function CveMatching() {
  useStyle();
  const [sessions, setSessions] = React.useState(null);
  const [sid, setSid] = React.useState("");
  const [cve, setCve] = React.useState({ data: null, error: null });
  const [adv, setAdv] = React.useState({ data: null, error: null });
  const [stats, setStats] = React.useState({ data: null, error: null });
  React.useEffect(() => {
    api.get("/ics/sessions/").then((r) => {
      const list = Array.isArray(r.data) ? r.data : [];
      setSessions(list);
      if (list.length) setSid(list[0].id);
    }, () => setSessions([]));
    get("/ics/advisories/stats", setStats);
  }, []);
  React.useEffect(() => {
    if (!sid) return;
    get("/ics/findings/cve/match-devices?session_id=" + encodeURIComponent(sid), setCve);
    get("/ics/advisories/matched?session_id=" + encodeURIComponent(sid), setAdv);
  }, [sid]);
  const c = cve.data, a = adv.data, s = stats.data;
  const matches = c ? c.matches : [];
  return h("div", { className: "fg" },
    h("div", { className: "fg-row", style: { justifyContent: "space-between" } },
      h("div", null, h("h1", null, "CVE Matching"),
        h("p", { className: "fg-sub" }, "Potential vulnerability matches for devices in a session, and the devices that cannot be assessed.")),
      sessions && sessions.length ? h("label", { className: "fg-row", style: { fontSize: ".75rem" } }, "Session",
        h("select", { value: sid, onChange: (e) => setSid(e.target.value) },
          sessions.map((x) => h("option", { key: x.id, value: x.id }, x.name)))) : null),
    h("div", { className: "fg-note" },
      "A match means the vendor and product reported by a device appear in a CVE or advisory record. Firmware version is not " +
      "compared, so a match is potential and must be confirmed against the device. Passive traffic often does not reveal a vendor " +
      "and model; those devices are counted as not assessable, not as unaffected."),
    sessions && !sessions.length ? h("div", { className: "fg-empty" }, "No session yet. Import a capture to assess its devices.") : null,
    cve.error ? h("div", { className: "fg-err" }, "CVE matching failed: " + cve.error) : null,
    adv.error ? h("div", { className: "fg-err" }, "Advisory matching failed: " + adv.error) : null,
    h("div", { className: "fg-grid" },
      h(Tile, { label: "Devices in session", value: c ? num(c.devices_checked) : "-" }),
      h(Tile, { label: "Assessable", value: c ? num(c.devices_assessable) : "-", sub: "vendor and model known" }),
      h(Tile, { label: "Not assessable", value: c ? num(c.devices_without_product_evidence) : "-", sub: "no vendor and model from traffic" }),
      h(Tile, { label: "Potential CVE matches", value: c ? num(matches.length) + " device(s)" : "-", sub: c ? c.curated_entries + " curated entr" + (c.curated_entries === 1 ? "y" : "ies") + " loaded" : "" }),
      h(Tile, { label: "Advisory matches", value: a ? num(a.count) : "-", sub: s ? (s.populated ? "feed refreshed " + (s.last_refresh ? fmtTime(s.last_refresh) : "never") : "advisory feed has no data") : "" })),
    c && !c.curated_entries ? h("div", { className: "fg-note" },
      "No curated CVE file is loaded on this Gridwolf, so CVE matching returns nothing by design. Load a reviewed file " +
      "(GRIDWOLF_CVE_FILE) where each entry cites a source reference; no built-in table is shipped because unverified entries produce false matches.") : null,
    matches.length ? h("div", { className: "fg-panel fg-scroll" }, h("table", { className: "fg-table" },
      h("thead", null, h("tr", null, ["Device", "Vendor", "CVE", "CVSS", "Basis"].map((t) => h("th", { key: t }, t)))),
      h("tbody", null, matches.flatMap((m) => m.cves.map((v) => h("tr", { key: m.device_ip + v.cve_id },
        h("td", { className: "fg-mono" }, m.device_ip), h("td", null, m.device_vendor || "-"),
        h("td", { className: "fg-mono" }, v.cve_id), h("td", null, v.cvss_score === null || v.cvss_score === undefined ? "unscored" : String(v.cvss_score)),
        h("td", null, h(Badge, { state: "degraded", label: "potential" })))))))) : null,
    a && a.matches && a.matches.length ? h("div", { className: "fg-panel fg-scroll" }, h("table", { className: "fg-table" },
      h("thead", null, h("tr", null, ["Device", "Advisory", "Basis", "Applicability"].map((t) => h("th", { key: t }, t)))),
      h("tbody", null, a.matches.map((m, i) => h("tr", { key: i },
        h("td", { className: "fg-mono" }, m.device_ip || "-"),
        h("td", null, (m.advisory && (m.advisory.title || m.advisory.id)) || "-"), h("td", null, m.match_basis || "-"), h("td", null, m.applicability || "potential")))))) : null);
}
