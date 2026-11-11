// FORGE site UI. Hand-written ES module loaded next to the Gridwolf build (no JSX). Authorization is enforced by the
// backend; these pages only offer what the server reports and show the server's refusal when an action is not allowed.
//
// SINGLE-SITE MODE (current scope, 2026-11-10): one installation = one site. The navigation exposes only
//   - Sensors        (`Sensors`): Sensor id, name, editable free-text location, reporting status, association note;
//   - Site Settings  (`SiteSettings`): the one site's users/groups/roles and name/description;
//   - Site Overview  (`Overview`): the one site's summary card.
// The multi-site workflows below (`SiteSelector`, `Sites` list, `CreateSite`, `Sources` binding, lifecycle) are DEFERRED to
// the FORGE Scalability roadmap: they stay in this file and in the backend API, unrouted, and are re-enabled by building
// with FORGE_MULTI_SITE=1 (see build_frontend.py). Nothing is deleted from the database.
import { h, React, api, Badge, Tile, Kv, useStyle, fmtTime, num } from "./ForgeCommon-r1.js";

const ROLES = [
  ["site_admin", "Site Administrator"], ["ot_engineer", "OT Engineer"], ["security_analyst", "Security Analyst"],
  ["viewer", "Viewer"], ["report_viewer", "Report Viewer"], ["health_viewer", "Platform Health Viewer"],
];
const ROLE_LABEL = Object.fromEntries(ROLES.concat([["administrator", "Platform Administrator"]]));
const ALL = { "X-Gridwolf-Site": "all" };

const getCookie = (n) => {
  const m = document.cookie.split("; ").find((c) => c.startsWith(n + "="));
  return m ? decodeURIComponent(m.slice(n.length + 1)) : "";
};
export function selectSite(id) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  if (!id || id === "all") document.cookie = "gw_site=; Max-Age=0; Path=/; SameSite=Lax" + secure;
  else document.cookie = "gw_site=" + encodeURIComponent(id) + "; Path=/; SameSite=Lax; Max-Age=31536000" + secure;
}
const problem = (e) => String((e && e.response && e.response.data && e.response.data.detail) || (e && e.message) || "The request was refused.");

const gwPost = (p, b) => api.post(p, b, { headers: ALL });
const gwPatch = (p, b) => api.patch(p, b, { headers: ALL });
const gwDelete = (p) => api.delete(p, { headers: ALL });

function useGet(path, headers, every) {
  const [st, set] = React.useState({ data: null, error: null, loading: true });
  const [n, bump] = React.useState(0);
  React.useEffect(() => {
    if (!path) return undefined;
    let dead = false;
    const run = () => api.get(path, { headers: ALL }).then(
      (r) => !dead && set({ data: r.data, error: null, loading: false }),
      (e) => !dead && set((p) => ({ data: p.data, error: problem(e), loading: false })));
    run();
    const t = every ? setInterval(run, every) : null;
    return () => { dead = true; if (t) clearInterval(t); };
  }, [path, n]);
  return [st, () => bump((x) => x + 1)];
}

// ---- persistent site selector (header) -------------------------------------------------------------------
export function SiteSelector() {
  const [st, refetch] = useGet("/sites/mine");
  React.useEffect(() => {                                          // Sites administration announces create/retire/edit
    window.addEventListener("gw-sites-changed", refetch);
    return () => window.removeEventListener("gw-sites-changed", refetch);
  }, []);
  if (!st.data) return null;
  const sites = st.data.sites || [];
  const cur = getCookie("gw_site");
  const value = sites.some((s) => s.id === cur) ? cur : "all";
  if (cur && value === "all") selectSite("all");                  // a stale selection is dropped, never sent
  const style = { background: "var(--bg-secondary)", color: "var(--content-primary)", border: "1px solid var(--border)",
    borderRadius: ".4rem", padding: ".25rem .5rem", fontSize: ".75rem", maxWidth: "16rem" };
  return h("label", { style: { display: "flex", alignItems: "center", gap: ".4rem", fontSize: ".7rem",
    color: "var(--content-tertiary)" } }, "Site",
  h("select", { value, style, "aria-label": "Site", title: "Site shown on every page",
    onChange: (e) => { selectSite(e.target.value); window.location.reload(); } },
  h("option", { value: "all" }, "Overview \u2014 All Authorized Sites"),
  sites.map((s) => h("option", { key: s.id, value: s.id }, s.name))));
}

// ---- Overview ----------------------------------------------------------------------------------------------
function SiteCard({ s, roles }) {
  const caps = s.capabilities || {};
  const rows = [["Site id", h("span", { className: "fg-mono" }, s.site)],
    ["Your role", (roles || []).map((r) => ROLE_LABEL[r] || r).join(", ") || "-"]];
  if (caps.view || caps.report_view) rows.push(["Assets", num(s.devices)], ["Connections", num(s.connections)], ["Findings", num(s.findings)]);
  if (caps.view) rows.push(["Observations (verified)", num(s.verified_observations)], ["Last observed flow", fmtTime(s.last_observed_flow)]);
  if (caps.view || caps.health) rows.push(["Sensors", num(s.sensors) + (s.sensors_by_state && Object.keys(s.sensors_by_state).length
    ? " (" + Object.entries(s.sensors_by_state).map(([k, v]) => v + " " + k).join(", ") + ")" : "")]);
  return h("div", { className: "fg-card" },
    h("div", { className: "fg-row", style: { justifyContent: "space-between" } }, h("h2", null, s.name),
      h("button", { type: "button", onClick: () => { selectSite(s.site); window.location.assign(caps.view ? "/live-capture" : "/sites-overview"); } },
        "Open site")),
    h(Kv, { rows }),
    !caps.view ? h("p", { className: "fg-dim", style: { fontSize: ".7rem", marginTop: ".5rem" } },
      caps.report_view ? "Report Viewer: counts and reports only." : "Health Viewer: Sensor health only.") : null);
}

export function Overview() {
  useStyle();
  const [ov] = useGet("/forge/overview", ALL, 30000);
  const [me] = useGet("/sites/mine", ALL);
  const roles = {};
  ((me.data && me.data.sites) || []).forEach((s) => { roles[s.id] = s.roles; });
  const d = ov.data;
  const sites = d ? Object.values(d.sites || {}) : [];
  const wz = d && d.sources && d.sources.wazuh;
  const single = sites.length === 1;
  return h("div", { className: "fg" },
    h("div", null, h("h1", null, single ? "Overview \u2014 " + sites[0].name : "Overview \u2014 All Authorized Sites"),
      h("p", { className: "fg-sub" }, single ? "Counts and Sensor state for this site, limited to what your role allows."
        : "Only the sites and detail your roles allow. Select a site in the header to scope every page to it.")),
    d && d.notice ? h("div", { className: "fg-note" }, d.notice) : null,
    ov.error ? h("div", { className: "fg-err" }, ov.error) : null,
    !d && !ov.error ? h("div", { className: "fg-empty" }, "Loading...") : null,
    d && !sites.length ? h("div", { className: "fg-empty" }, "No site is assigned to this account.") : null,
    h("div", { className: "fg-grid-wide" }, sites.map((s) => h(SiteCard, { key: s.site, s, roles: roles[s.site] }))),
    wz ? h("div", { className: "fg-card" }, h("h2", null, "Platform health (Wazuh)"),
      h("div", { className: "fg-row", style: { marginTop: ".4rem" } }, h(Badge, { state: wz.state === "restricted" ? "unknown" : wz.state }),
        h("span", { className: "fg-dim", style: { fontSize: ".75rem" } }, wz.reason || wz.measured_by || ""))) : null);
}

// ---- Site administration --------------------------------------------------------------------------------
function Field(props) {
  return h("label", { style: { display: "flex", flexDirection: "column", gap: ".15rem", fontSize: ".7rem", color: "var(--content-tertiary)" } },
    props.label, props.children);
}
const inp = { background: "var(--bg-secondary)", color: "var(--content-primary)", border: "1px solid var(--border)", borderRadius: ".4rem",
  padding: ".3rem .5rem", fontSize: ".8rem" };

function CreateSite({ templates, done }) {
  const [f, set] = React.useState({ id: "", name: "", description: "", template: "site", aliases: "" });
  const [err, setErr] = React.useState("");
  const submit = (e) => {
    e.preventDefault();
    gwPost("/sites", { id: f.id.trim().toLowerCase(), name: f.name, description: f.description, template: f.template,
      aliases: f.aliases.split(",").map((x) => x.trim()).filter(Boolean) })
      .then(() => { set({ id: "", name: "", description: "", template: "site", aliases: "" }); setErr(""); done(); }, (x) => setErr(problem(x)));
  };
  const on = (k) => (e) => set({ ...f, [k]: e.target.value });
  return h("form", { className: "fg-card", onSubmit: submit },
    h("h2", null, "Add a site"),
    h("p", { className: "fg-sub", style: { fontSize: ".72rem" } },
      "Creating a site grants nobody access, enables no Sensor and opens no network. Production is registered here when it is ready."),
    h("div", { className: "fg-row", style: { marginTop: ".5rem", alignItems: "flex-end" } },
      h(Field, { label: "Site id (lowercase)" }, h("input", { style: inp, value: f.id, onChange: on("id"), required: true, pattern: "[a-z0-9][a-z0-9\\-]{1,40}[a-z0-9]", title: "Lowercase letters, digits and hyphens (3-42 characters)" })),
      h(Field, { label: "Name" }, h("input", { style: inp, value: f.name, onChange: on("name"), required: true, maxLength: 120 })),
      h(Field, { label: "Description" }, h("input", { style: { ...inp, minWidth: "14rem" }, value: f.description, onChange: on("description"), maxLength: 500 })),
      h(Field, { label: "Template" }, h("select", { style: inp, value: f.template, onChange: on("template") },
        Object.entries(templates || { site: { label: "Operational site" } }).map(([k, v]) => h("option", { key: k, value: k }, v.label)))),
      h(Field, { label: "Source aliases (optional)" }, h("input", { style: inp, value: f.aliases, onChange: on("aliases"), placeholder: "comma separated" })),
      h("button", { type: "submit" }, "Create site")),
    err ? h("div", { className: "fg-err", style: { marginTop: ".5rem" } }, err) : null);
}

function Assignments({ site, platform, reload }) {
  const [acc, refresh] = useGet("/sites/" + site + "/access");
  const [f, set] = React.useState({ subject_type: "user", subject: "", role: "viewer" });
  const [err, setErr] = React.useState("");
  const add = (e) => {
    e.preventDefault();
    gwPost("/sites/" + site + "/assignments", f).then(() => { set({ ...f, subject: "" }); setErr(""); refresh(); reload(); }, (x) => setErr(problem(x)));
  };
  const del = (id) => gwDelete("/sites/" + site + "/assignments/" + id).then(() => { refresh(); reload(); }, (x) => setErr(problem(x)));
  const a = acc.data;
  if (acc.error && !a) return h("div", { className: "fg-err" }, acc.error);
  if (!a) return h("div", { className: "fg-empty" }, "Loading...");
  const roles = platform ? ROLES : ROLES.filter((r) => r[0] !== "site_admin");
  return h("div", { style: { display: "flex", flexDirection: "column", gap: ".75rem" } },
    h("div", { className: "fg-panel fg-scroll" }, h("table", { className: "fg-table" },
      h("thead", null, h("tr", null, ["Who", "Type", "Role", "Added by", ""].map((x) => h("th", { key: x }, x)))),
      h("tbody", null, a.assignments.length ? a.assignments.map((r) => h("tr", { key: r.id },
        h("td", { className: "fg-mono" }, r.subject), h("td", null, r.subject_type), h("td", null, r.role_label), h("td", null, r.created_by || "-"),
        h("td", null, h("button", { type: "button", onClick: () => window.confirm("Remove this assignment?") && del(r.id) }, "Remove"))))
        : h("tr", null, h("td", { colSpan: 5, className: "fg-empty" }, "No assignments. Nobody holds a role here through the registry."))))),
    h("form", { className: "fg-row", onSubmit: add, style: { alignItems: "flex-end" } },
      h(Field, { label: "Assign" }, h("select", { style: inp, value: f.subject_type, onChange: (e) => set({ ...f, subject_type: e.target.value }) },
        h("option", { value: "user" }, "User (username)"), h("option", { value: "group" }, "authentik group"))),
      h(Field, { label: f.subject_type === "user" ? "Username" : "Group name" },
        h("input", { style: { ...inp, minWidth: "15rem" }, value: f.subject, required: true, onChange: (e) => set({ ...f, subject: e.target.value }) })),
      h(Field, { label: "Role" }, h("select", { style: inp, value: f.role, onChange: (e) => set({ ...f, role: e.target.value }) },
        roles.map(([k, v]) => h("option", { key: k, value: k }, v)))),
      h("button", { type: "submit" }, "Assign")),
    err ? h("div", { className: "fg-err" }, err) : null,
    h("div", { className: "fg-note" },
      h("div", null, "authentik groups that grant a role here without an assignment: "),
      h("div", { className: "fg-mono", style: { marginTop: ".3rem" } }, Object.entries(a.convention_groups).map(([k, v]) => h("div", { key: k }, v + "  \u2192  " + k))),
      h("div", { style: { marginTop: ".4rem" } }, "Platform: " + a.platform_group + ". Local platform administrators: " + (a.local_platform_administrators.join(", ") || "none") + ".")),
    h("div", { className: "fg-note" }, "Suggested team profiles (granted only when a Platform Administrator applies them): " +
      Object.entries(a.team_profiles).map(([k, v]) => k + " \u2192 " + v).join("; ")));
}

const LOCATION_HINTS = ["MDF", "Paint Line", "Fabrication", "Assembly", "Packaging", "Warehouse", "Utilities", "Server Room", "Network Cabinet"];

function LocRow({ site, r, saved, note }) {
  const [v, setV] = React.useState(r.location || "");
  const [msg, setMsg] = React.useState("");
  React.useEffect(() => { setV(r.location || ""); }, [r.location]);
  const save = (e) => {
    e.preventDefault();
    api.put("/sites/" + site + "/sensors/" + encodeURIComponent(r.sensor) + "/location", { location: v }, { headers: ALL })
      .then((x) => { setV(x.data.location); setMsg(x.data.location ? "Saved." : "Cleared."); saved(); }, (x) => setMsg(problem(x)));
  };
  return h("tr", null,
    h("td", { className: "fg-mono" }, r.sensor), h("td", null, r.display_name || "-"),
    h("td", null, r.status ? h(Badge, { state: r.status === "ok" ? "active" : "unknown", label: r.status }) : "not seen"),
    h("td", null, h("form", { className: "fg-row", onSubmit: save },
      h("input", { style: { ...inp, minWidth: "13rem" }, value: v, maxLength: 120, list: "fg-loc-hints", "aria-label": "Location of " + r.sensor,
        placeholder: "for example Paint line", onChange: (e) => { setV(e.target.value); setMsg(""); } }),
      h("button", { type: "submit", disabled: v.trim() === (r.location || "") }, "Save"),
      msg ? h("span", { className: "fg-dim", style: { fontSize: ".7rem" } }, msg) : null)),
    note === undefined ? null : h("td", null, note || "-"));
}

function SensorLocations({ site, sources, notes }) {
  const [st, refresh] = useGet("/forge/sensors?site=" + encodeURIComponent(site));
  const seen = (st.data && st.data.sensors) || [];
  const known = new Set(seen.map((s) => s.sensor));
  const rows = seen.concat((sources || []).filter((r) => r.type === "sensor" && !known.has(r.source_id))
    .map((r) => ({ sensor: r.source_id, display_name: "", status: "", location: "" })));
  return h("div", { className: "fg-panel fg-scroll" },
    h("datalist", { id: "fg-loc-hints" }, LOCATION_HINTS.map((x) => h("option", { key: x, value: x }))),
    h("table", { className: "fg-table" },
      h("thead", null, h("tr", null, ["Sensor", "Name", "Status", "Location (where it is installed)"].concat(notes ? ["Note"] : []).map((x) => h("th", { key: x }, x)))),
      h("tbody", null, rows.length ? rows.map((r) => h(LocRow, { key: r.sensor, site, r, saved: refresh, note: notes ? (notes[r.sensor] || "") : undefined }))
        : h("tr", null, h("td", { colSpan: notes ? 5 : 4, className: "fg-empty" }, st.error || (st.loading ? "Loading..." : "No Sensor has reported for this site and none is associated."))))));
}

function Sources({ site, reload }) {
  const [rows, refresh] = useGet("/sites/" + site + "/sources");
  const [f, set] = React.useState({ source_type: "sensor", source_id: "", note: "" });
  const [err, setErr] = React.useState("");
  const done = () => { refresh(); reload(); setErr(""); };
  const add = (e) => { e.preventDefault(); gwPost("/sites/" + site + "/sources", f).then(() => { set({ ...f, source_id: "", note: "" }); done(); }, (x) => setErr(problem(x))); };
  const toggle = (r) => gwPatch("/sites/" + site + "/sources/" + r.id, { enabled: !r.enabled }).then(done, (x) => setErr(problem(x)));
  const del = (r) => gwDelete("/sites/" + site + "/sources/" + r.id).then(done, (x) => setErr(problem(x)));
  const list = rows.data || [];
  return h("div", { style: { display: "flex", flexDirection: "column", gap: ".75rem" } },
    h("div", { className: "fg-note" }, "Associating a Sensor or data source records the approval. It is never enabled automatically and changes nothing on the Sensor or the network."),
    h("div", { className: "fg-panel fg-scroll" }, h("table", { className: "fg-table" },
      h("thead", null, h("tr", null, ["Type", "Source id", "State", "Approved by", "Note", ""].map((x) => h("th", { key: x }, x)))),
      h("tbody", null, list.length ? list.map((r) => h("tr", { key: r.id },
        h("td", null, r.type), h("td", { className: "fg-mono" }, r.source_id), h("td", null, h(Badge, { state: r.enabled ? "active" : "unknown", label: r.enabled ? "enabled" : "associated, not enabled" })),
        h("td", null, r.approved_by || "-"), h("td", null, r.note || ""),
        h("td", null, h("button", { type: "button", onClick: () => toggle(r) }, r.enabled ? "Disable" : "Enable"), " ",
          h("button", { type: "button", onClick: () => window.confirm("Remove this association?") && del(r) }, "Remove"))))
        : h("tr", null, h("td", { colSpan: 6, className: "fg-empty" }, "No Sensor or data source is associated with this site."))))),
    h("h3", { style: { margin: ".25rem 0 0" } }, "Sensor locations"),
    h("div", { className: "fg-note" }, "A free-text label (for example Paint line or Fab) shown next to the Sensor on the Overview, Live Capture and External Tools pages. It is display-only and does not enable or change anything."),
    h(SensorLocations, { site, sources: list }),
    h("form", { className: "fg-row", onSubmit: add, style: { alignItems: "flex-end" } },
      h(Field, { label: "Type" }, h("select", { style: inp, value: f.source_type, onChange: (e) => set({ ...f, source_type: e.target.value }) },
        h("option", { value: "sensor" }, "Sensor"), h("option", { value: "datasource" }, "Data source"))),
      h(Field, { label: "Source id" }, h("input", { style: { ...inp, minWidth: "14rem" }, value: f.source_id, required: true, onChange: (e) => set({ ...f, source_id: e.target.value }) })),
      h(Field, { label: "Note" }, h("input", { style: { ...inp, minWidth: "14rem" }, value: f.note, maxLength: 255, onChange: (e) => set({ ...f, note: e.target.value }) })),
      h("button", { type: "submit" }, "Associate")),
    err ? h("div", { className: "fg-err" }, err) : null);
}

function Detail({ s, platform, reload, close, single }) {
  const [tab, setTab] = React.useState("access");
  const [stat] = useGet("/sites/" + s.id + "/status");
  const [name, setName] = React.useState(s.name);
  const [desc, setDesc] = React.useState(s.description || "");
  const [msg, setMsg] = React.useState("");
  React.useEffect(() => { setName(s.name); setDesc(s.description || ""); setMsg(""); }, [s.id, s.name, s.description]);
  const save = (e) => { e.preventDefault(); gwPatch("/sites/" + s.id, { name, description: desc }).then(() => { setMsg("Saved."); reload(); }, (x) => setMsg(problem(x))); };
  const lifecycle = (status) => {
    const word = { disabled: "Disable (access ends; data is kept)", active: "Re-enable", retired: "Retire (final; cannot be undone)" }[status];
    if (window.confirm(word + " site " + s.name + "?")) gwPost("/sites/" + s.id + "/status", { status }).then(reload, (x) => window.alert(problem(x)));
  };
  const teams = () => gwPost("/sites/" + s.id + "/team-profiles").then((r) => setMsg("Team profiles recorded: " + (r.data.applied || []).length + " assignment(s) reviewed."), (x) => setMsg(problem(x)));
  const tabs = single ? [["access", "Users, groups and roles"], ["edit", "Details"]]
    : [["access", "Users, groups and roles"], ["sources", "Sensors and data sources"], ["edit", "Details"]].concat(platform ? [["life", "Lifecycle"]] : []);
  const t = stat.data;
  return h("div", { className: "fg-panel" },
    h("div", { className: "fg-head" }, h("div", null, h("h2", null, s.name + " "), h("span", { className: "fg-mono fg-dim", style: { fontSize: ".72rem" } }, s.id + (s.aliases.length ? "  (source identity: " + s.aliases.join(", ") + ")" : ""))),
      close ? h("button", { type: "button", onClick: close }, "Close") : null),
    h("div", { style: { padding: ".75rem .9rem", display: "flex", flexDirection: "column", gap: ".75rem" } },
      t ? h("div", { className: "fg-grid" }, h(Tile, { label: "Status", value: h(Badge, { state: s.status === "active" ? "active" : s.status === "disabled" ? "stale" : "unknown", label: s.status }) }),
        h(Tile, { label: "Sessions", value: num(t.sessions), sub: t.last_session_at ? "last " + fmtTime(t.last_session_at) : "none" }),
        h(Tile, { label: "Assets / findings", value: num(t.devices) + " / " + num(t.findings) }),
        h(Tile, { label: "Sensors associated", value: num(t.sensors_associated), sub: num(t.sources_enabled) + " source(s) enabled" }),
        h(Tile, { label: "Assignments", value: num(t.assignments) })) : stat.error ? h("div", { className: "fg-err" }, stat.error) : null,
      h("div", { className: "fg-row" }, tabs.map(([k, v]) => h("button", { key: k, type: "button", onClick: () => setTab(k), "aria-pressed": tab === k, style: tab === k ? { borderColor: "var(--accent)" } : undefined }, v))),
      tab === "access" ? h(Assignments, { site: s.id, platform, reload }) : null,
      tab === "sources" ? h(Sources, { site: s.id, reload }) : null,
      tab === "edit" ? h("form", { onSubmit: save, className: "fg-row", style: { alignItems: "flex-end" } },
        h(Field, { label: "Name" }, h("input", { style: inp, value: name, onChange: (e) => setName(e.target.value), maxLength: 120, required: true })),
        h(Field, { label: "Description" }, h("input", { style: { ...inp, minWidth: "20rem" }, value: desc, onChange: (e) => setDesc(e.target.value), maxLength: 500 })),
        h("button", { type: "submit", disabled: s.status === "retired" }, "Save")) : null,
      tab === "life" ? h("div", { className: "fg-row" },
        s.status === "active" ? h("button", { type: "button", onClick: () => lifecycle("disabled") }, "Disable site") : null,
        s.status === "disabled" ? h("button", { type: "button", onClick: () => lifecycle("active") }, "Re-enable site") : null,
        s.status !== "retired" ? h("button", { type: "button", onClick: () => lifecycle("retired") }, "Retire site") : null,
        s.status !== "retired" ? h("button", { type: "button", onClick: teams }, "Apply team profiles") : null) : null,
      msg ? h("div", { className: "fg-note" }, msg) : null));
}

export function Sites() {
  useStyle();
  const [me] = useGet("/sites/mine", ALL);
  const [list, reloadList] = useGet("/sites", ALL);
  const reload = () => { reloadList(); window.dispatchEvent(new Event("gw-sites-changed")); };
  const [tpl] = useGet("/sites/templates", ALL);
  const [sel, setSel] = React.useState(null);
  const platform = !!(me.data && me.data.all_sites);
  const rows = list.data || [];
  const cur = rows.find((r) => r.id === sel);
  return h("div", { className: "fg" },
    h("div", null, h("h1", null, "Sites"), h("p", { className: "fg-sub" }, platform
      ? "Platform Administrator: every site, its users and groups, Sensors and lifecycle."
      : "Site Administrator: the sites you administer.")),
    list.error ? h("div", { className: "fg-err" }, list.error) : null,
    h("div", { className: "fg-panel fg-scroll" }, h("table", { className: "fg-table" },
      h("thead", null, h("tr", null, ["Site", "Id", "Status", "Template", "Source identity", ""].map((x) => h("th", { key: x }, x)))),
      h("tbody", null, rows.map((r) => h("tr", { key: r.id, className: "fg-click", onClick: () => setSel(r.id) },
        h("td", null, r.name), h("td", { className: "fg-mono" }, r.id),
        h("td", null, h(Badge, { state: r.status === "active" ? "active" : r.status === "disabled" ? "stale" : "unknown", label: r.status })),
        h("td", null, r.template), h("td", { className: "fg-mono" }, r.aliases.join(", ") || "-"),
        h("td", null, h("button", { type: "button", onClick: (e) => { e.stopPropagation(); setSel(r.id); } }, "Manage"))))))),
    cur ? h(Detail, { s: cur, platform, reload, close: () => setSel(null) }) : null,
    platform ? h(CreateSite, { templates: tpl.data, done: reload }) : null);
}

// ---- Single-site pages (current scope) -------------------------------------------------------------------
// The installation's one site: the active site in the registry (the stored selection cookie, if any, is honoured
// only when it names an active site). No selector is shown.
function useThisSite() {
  const [list, reloadList] = useGet("/sites", ALL);
  const rows = (list.data || []).filter((r) => r.status !== "retired");
  const cur = getCookie("gw_site");
  const site = rows.find((r) => r.id === cur) || rows.find((r) => r.status === "active") || rows[0] || null;
  return [site, list, reloadList];
}

export function Sensors() {
  useStyle();
  const [site, list] = useThisSite();
  const [src] = useGet(site ? "/sites/" + site.id + "/sources" : null, ALL);
  const notes = {};
  (src.data || []).forEach((r) => { if (r.type === "sensor") notes[r.source_id] = r.note || ""; });
  return h("div", { className: "fg" },
    h("div", null, h("h1", null, "Sensors" + (site ? " \u2014 " + site.name : "")),
      h("p", { className: "fg-sub" }, "Each Sensor with its reporting status and where it is installed. Edit the location here (Site Administrator).")),
    list.error ? h("div", { className: "fg-err" }, list.error) : null,
    h("div", { className: "fg-note" }, "Location is a free-text label (up to 120 characters, for example MDF, Paint Line, Fabrication, Assembly, Server Room or Network Cabinet). " +
      "It is shown next to the Sensor on Live Capture and External Tools. It is display-only: changing it does not change the Sensor's identity, its association, its collection settings or whether it is enabled."),
    site ? h(SensorLocations, { site: site.id, sources: src.data || [], notes })
      : list.loading ? h("div", { className: "fg-empty" }, "Loading...") : h("div", { className: "fg-empty" }, "No site is available to this account."));
}

export function SiteSettings() {
  useStyle();
  const [site, list, reloadList] = useThisSite();
  const [me] = useGet("/sites/mine", ALL);
  const platform = !!(me.data && me.data.all_sites);
  return h("div", { className: "fg" },
    h("div", null, h("h1", null, "Site Settings" + (site ? " \u2014 " + site.name : "")),
      h("p", { className: "fg-sub" }, "Who can use this installation (users, authentik groups and roles) and the site name. Sensors and their locations are on the Sensors page.")),
    list.error ? h("div", { className: "fg-err" }, list.error) : null,
    site ? h(Detail, { s: site, platform, reload: reloadList, single: true })
      : list.loading ? h("div", { className: "fg-empty" }, "Loading...") : h("div", { className: "fg-empty" }, "No site is available to this account."));
}

// Old bookmarks to the deferred multi-site Sites page land on the Sensors page.
export function SitesRedirect() {
  React.useEffect(() => { window.location.replace("/sensors"); }, []);
  return null;
}
