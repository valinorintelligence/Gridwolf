// FORGE live-telemetry UI helpers shared by Live Capture and External Tools.
// Hand-written ES module loaded next to the Gridwolf build (no JSX, no extra dependencies).
// It imports the app's own React and API client from the main bundle.
import { X as toESM, q as reactGetter, n as api } from "./index-BsvjFq8N.js";

export const React = toESM(reactGetter(), 1);
export const h = React.createElement;
export { api };

const CSS = `
.fg{--fg-ok:#10b981;--fg-warn:#eab308;--fg-bad:#ef4444;--fg-info:#3b82f6;--fg-mute:#6b7280;padding:1.5rem;display:flex;flex-direction:column;gap:1rem;color:var(--content-primary)}
.fg h1{font-size:1.5rem;font-weight:700;margin:0}
.fg h2{font-size:.95rem;font-weight:600;margin:0}
.fg p{margin:0}
.fg-sub{color:var(--content-secondary);font-size:.85rem;margin-top:.25rem}
.fg-note{border:1px solid var(--border);background:var(--bg-secondary);border-radius:.5rem;padding:.6rem .8rem;font-size:.75rem;color:var(--content-secondary)}
.fg-err{border:1px solid var(--fg-bad);color:var(--fg-bad);border-radius:.5rem;padding:.6rem .8rem;font-size:.8rem}
.fg-row{display:flex;gap:.75rem;align-items:center;flex-wrap:wrap}
.fg-grid{display:grid;gap:.75rem;grid-template-columns:repeat(auto-fill,minmax(210px,1fr))}
.fg-grid-wide{display:grid;gap:.75rem;grid-template-columns:repeat(auto-fill,minmax(340px,1fr))}
.fg-card{border:1px solid var(--border);background:var(--surface-card);border-radius:.6rem;padding:.8rem .9rem;min-width:0}
.fg-tile .fg-v{font-size:1.4rem;font-weight:700;line-height:1.2}
.fg-tile .fg-l{font-size:.7rem;color:var(--content-tertiary);text-transform:uppercase;letter-spacing:.04em}
.fg-tile .fg-s{font-size:.7rem;color:var(--content-secondary);margin-top:.15rem}
.fg-badge{display:inline-block;border-radius:999px;padding:.05rem .5rem;font-size:.68rem;font-weight:600;border:1px solid currentColor;white-space:nowrap}
.fg-b-ok{color:var(--fg-ok)}.fg-b-warn{color:var(--fg-warn)}.fg-b-bad{color:var(--fg-bad)}.fg-b-info{color:var(--fg-info)}.fg-b-mute{color:var(--fg-mute)}
.fg-kv{display:grid;grid-template-columns:max-content 1fr;gap:.15rem .7rem;font-size:.75rem;margin-top:.5rem}
.fg-kv dt{color:var(--content-tertiary)}.fg-kv dd{margin:0;color:var(--content-secondary);overflow-wrap:anywhere}
.fg-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.fg-table{width:100%;border-collapse:collapse;font-size:.75rem}
.fg-table th{text-align:left;color:var(--content-tertiary);font-weight:500;padding:.4rem .6rem;border-bottom:1px solid var(--border);white-space:nowrap}
.fg-table td{padding:.4rem .6rem;border-bottom:1px solid var(--border);color:var(--content-secondary);vertical-align:top}
.fg-table td.fg-n,.fg-table th.fg-n{text-align:right}
.fg-table tr.fg-click{cursor:pointer}.fg-table tr.fg-click:hover{background:var(--surface-hover)}
.fg-table tr.fg-detail td{background:var(--bg-secondary)}
.fg-scroll{overflow-x:auto}
.fg-head{display:flex;justify-content:space-between;align-items:center;padding:.6rem .9rem;border-bottom:1px solid var(--border);gap:.5rem;flex-wrap:wrap}
.fg-panel{border:1px solid var(--border);background:var(--surface-card);border-radius:.6rem;overflow:hidden}
.fg-empty{padding:1.5rem;text-align:center;font-size:.8rem;color:var(--content-secondary)}
.fg select,.fg button{background:var(--bg-secondary);color:var(--content-primary);border:1px solid var(--border);border-radius:.4rem;padding:.25rem .6rem;font-size:.75rem}
.fg button:hover{border-color:var(--border-hover)}
.fg a{color:var(--accent);text-decoration:none}.fg a:hover{text-decoration:underline}
.fg-dim{color:var(--content-tertiary)}
`;

export function useStyle() {
  React.useEffect(() => {
    if (!document.getElementById("fg-style")) {
      const el = document.createElement("style");
      el.id = "fg-style";
      el.textContent = CSS;
      document.head.appendChild(el);
    }
  }, []);
}

// Poll an API path; keeps the last good data and reports the failure instead of showing blanks.
export function usePoll(path, ms) {
  const [state, set] = React.useState({ data: null, error: null, fetchedAt: null, loading: true });
  React.useEffect(() => {
    if (!path) return undefined;
    let dead = false;
    const run = () =>
      api.get(path).then(
        (res) => !dead && set({ data: res.data, error: null, fetchedAt: Date.now(), loading: false }),
        (err) => {
          if (dead) return;
          const detail = err && err.response && err.response.data && err.response.data.detail;
          set((prev) => ({ ...prev, loading: false,
            error: (detail ? String(detail) : (err && err.message) || "request failed") +
              (err && err.response ? " (HTTP " + err.response.status + ")" : "") }));
        });
    run();
    const t = setInterval(run, ms);
    return () => { dead = true; clearInterval(t); };
  }, [path, ms]);
  return state;
}

export function useTick(ms) {
  const [, set] = React.useState(0);
  React.useEffect(() => { const t = setInterval(() => set((n) => n + 1), ms); return () => clearInterval(t); }, [ms]);
}

export const fmtTime = (iso) => (iso ? iso.replace("T", " ").replace("Z", "") + "Z" : "-");
export const num = (n) => (n === null || n === undefined ? "-" : Number(n).toLocaleString());

export function dur(s) {
  if (s === null || s === undefined) return "-";
  if (s < 90) return s + " s";
  if (s < 5400) return Math.round(s / 60) + " min";
  if (s < 172800) return (s / 3600).toFixed(1) + " h";
  return Math.round(s / 86400) + " d";
}

export function bytes(n) {
  if (n === null || n === undefined) return "-";
  if (n < 1024) return n + " B";
  if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
  return (n / 1048576).toFixed(1) + " MB";
}

const TONE = {
  reporting: "ok", ok: "ok", connected: "ok", active: "ok", fresh: "ok",
  registered: "info", discovered: "info", unknown: "mute", no_sensors: "mute", not_registered: "mute",
  stale: "warn", degraded: "warn", silent: "warn", error: "bad", offline: "bad", conflict: "bad",
  not_reporting: "bad", disconnected: "bad", failed: "bad",
  expected: "ok", new: "info", suspicious: "bad", quiet: "warn", "unknown-source": "mute",
};

export function Badge(props) {
  const state = props.state || "unknown";
  return h("span", { className: "fg-badge fg-b-" + (TONE[state] || "mute"), title: props.title }, props.label || state);
}

export function Tile(props) {
  return h("div", { className: "fg-card fg-tile" },
    h("div", { className: "fg-l" }, props.label),
    h("div", { className: "fg-v" }, props.value),
    props.sub ? h("div", { className: "fg-s" }, props.sub) : null);
}

export function Kv(props) {
  const out = [];
  props.rows.forEach(([k, v]) => { out.push(h("dt", { key: "k" + k }, k), h("dd", { key: "v" + k }, v)); });
  return h("dl", { className: "fg-kv" }, out);
}

// "Data as of" line: the server clock of the response and how long ago it was fetched.
export function AsOf(props) {
  useTick(1000);
  const { data, fetchedAt, error } = props.state;
  const ago = fetchedAt ? Math.round((Date.now() - fetchedAt) / 1000) : null;
  return h("div", { className: "fg-row fg-dim", style: { fontSize: ".72rem" } },
    h("span", null, data ? "Data as of " + fmtTime(data.now) + " (server)" : "Waiting for data"),
    ago !== null ? h("span", null, "fetched " + ago + " s ago, refreshes every " + props.every + " s") : null);
}

// Analysis sessions (most recent first) and the selected one; the first session is selected by default.
export function useSessions() {
  const [sessions, setSessions] = React.useState(null);
  const [sid, setSid] = React.useState("");
  React.useEffect(() => {
    api.get("/ics/sessions/").then((r) => {
      const list = Array.isArray(r.data) ? r.data : [];
      setSessions(list);
      if (list.length) setSid(list[0].id);
    }, () => setSessions([]));
  }, []);
  return { sessions, sid, setSid };
}

export function SessionPicker(props) {
  const s = props.state;
  if (!s.sessions || !s.sessions.length) return null;
  return h("label", { className: "fg-row", style: { fontSize: ".75rem" } }, "Session",
    h("select", { value: s.sid, onChange: (e) => s.setSid(e.target.value), "aria-label": "Analysis session" },
      s.sessions.map((x) => h("option", { key: x.id, value: x.id }, x.name))));
}
