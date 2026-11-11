// Sign-in page, rewritten for the f4 session model. The stock page only offered a local username and password
// and linked to open self-registration. This page offers FORGE single sign-on (authentik, authorization code
// with PKCE, handled entirely by the backend), shows the reason a sign-in was refused, and offers the local
// form only while the backend reports local login as enabled (it is the recovery path).
// It imports the app's own React, router and auth store from the main bundle.
import { X as toESM, q as reactGetter, n as api, W as useNavigate, t as useAuth } from "./index-BsvjFq8N.js";
import { t as Button } from "./Button-CXZhvBNl.js";
import { t as Input } from "./Input-Bi697b3i.js";

const React = toESM(reactGetter(), 1);
const h = React.createElement;

const MESSAGES = {
  denied: "The identity provider refused the sign-in.",
  unregistered: "Your FORGE identity has no Gridwolf account. Ask an administrator to register it.",
  norole: "Your account has no Gridwolf role. Ask an administrator to add you to a Gridwolf group.",
  mfa_required: "Multi-factor authentication is required to use Gridwolf. Sign in again with a second factor.",
  expired: "Your session ended. Sign in again.",
  provider_error: "The identity provider could not be reached. Try again, or use a local account if it is offered.",
  token_invalid: "The sign-in could not be verified. Try again.",
  exchange_failed: "The sign-in could not be completed. Try again.",
  disabled: "This account is disabled.",
  state: "The sign-in attempt expired or was not started in this browser. Start again.",
};

function safeNext(v) {
  return typeof v === "string" && /^\/(?!\/)[^\\\s]*$/.test(v) && !v.startsWith("/login") ? v : "/";
}

function localError(e) {
  const s = e && e.response && e.response.status;
  if (s === 401) return "Invalid username or password.";
  if (s === 429) return "Too many failed attempts. Wait a few minutes and try again.";
  if (s === 403) return (e.response.data && e.response.data.detail) || "This account cannot sign in here.";
  if (s === 404) return "Local sign-in is disabled. Use single sign-on.";
  return "Sign-in failed. Try again.";
}

export default function Login() {
  const nav = useNavigate();
  const { login } = useAuth();
  const q = new URLSearchParams(window.location.search);
  const code = q.get("error");
  const next = safeNext(q.get("next"));
  const [cfg, setCfg] = React.useState(null);
  const [user, setUser] = React.useState("");
  const [pw, setPw] = React.useState("");
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let live = true;
    if (!code) api.get("/auth/session").then(() => { if (live) nav(next, { replace: true }); }, () => {});
    api.get("/auth/config").then(
      (r) => {
        if (!live) return;
        setCfg(r.data);
        // An SSO session is short (its groups are re-read from authentik): sign in again without a click, at most
        // once a minute so a failing provider cannot loop.
        const last = Number(sessionStorage.getItem("gw-sso-retry") || 0);
        if (code === "expired" && r.data.oidc && localStorage.getItem("gw-sso") === "1" && Date.now() - last > 60000) {
          sessionStorage.setItem("gw-sso-retry", String(Date.now()));
          window.location.assign("/api/v1/auth/oidc/login?next=" + encodeURIComponent(next));
        }
      },
      () => live && setCfg({ oidc: false, local_login: true, unreachable: true }));
    return () => { live = false; };
  }, []);

  const ssoUrl = "/api/v1/auth/oidc/login?next=" + encodeURIComponent(next);
  const submit = async (ev) => {
    ev.preventDefault();
    setErr("");
    setBusy(true);
    try { localStorage.removeItem("gw-sso"); await login(user, pw); nav(next, { replace: true }); }
    catch (e) { setErr(localError(e)); }
    finally { setBusy(false); }
  };

  const notice = code ? (MESSAGES[code] || MESSAGES.denied) : "";
  const both = cfg && cfg.oidc && cfg.local_login;
  const none = cfg && !cfg.oidc && !cfg.local_login;

  return h("div", { className: "w-full max-w-sm space-y-6 mx-auto" },
    notice && h("p", { role: "alert", className: "rounded-lg border border-border-default bg-surface-card p-3 text-xs text-red-400" }, notice),
    !cfg && h("p", { className: "text-center text-xs text-content-tertiary" }, "Loading sign-in options"),
    cfg && cfg.unreachable && h("p", { className: "text-center text-xs text-content-tertiary" },
      "Sign-in options could not be loaded; showing the local form."),
    none && h("p", { role: "alert", className: "rounded-lg border border-border-default bg-surface-card p-3 text-xs text-red-400" },
      "No sign-in method is enabled. An administrator must enable single sign-on or local login."),
    cfg && cfg.oidc && h("div", { className: "rounded-lg border border-border-default bg-surface-card p-6 space-y-3" },
      h(Button, { type: "button", variant: "primary", size: "lg", className: "w-full",
        onClick: () => { localStorage.setItem("gw-sso", "1"); window.location.assign(ssoUrl); } }, "Sign in with FORGE"),
      h("p", { className: "text-center text-xs text-content-tertiary" },
        "Uses your FORGE identity. Access depends on your Gridwolf group membership.")),
    both && h("p", { className: "text-center text-xs text-content-tertiary" }, "or use a local recovery account"),
    cfg && cfg.local_login && h("form", { onSubmit: submit, "aria-label": "Local sign-in",
      className: "space-y-5 rounded-lg border border-border-default bg-surface-card p-6" },
      h("div", { className: "space-y-4" },
        h(Input, { label: "Username", type: "text", placeholder: "Enter username", value: user,
          onChange: (e) => setUser(e.target.value), autoComplete: "username", required: true }),
        h(Input, { label: "Password", type: "password", placeholder: "Enter password", value: pw,
          onChange: (e) => setPw(e.target.value), autoComplete: "current-password", required: true })),
      err && h("p", { role: "alert", className: "text-xs text-red-400" }, err),
      h(Button, { type: "submit", variant: cfg.oidc ? "secondary" : "primary", size: "lg", loading: busy,
        className: "w-full" }, "Sign In")),
    h("p", { className: "text-center text-xs text-content-tertiary" },
      "Accounts are provisioned by an administrator."));
}
