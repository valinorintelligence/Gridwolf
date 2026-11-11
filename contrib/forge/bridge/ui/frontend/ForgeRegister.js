// Self-registration is removed in f4: accounts are provisioned by an administrator (Users page, or the CLI
// on the Core host). This route stays so old links explain themselves instead of 404ing.
import { X as toESM, q as reactGetter, U as Link } from "./index-BsvjFq8N.js";

const React = toESM(reactGetter(), 1);
const h = React.createElement;

export default function Register() {
  return h("div", { className: "flex min-h-screen items-center justify-center bg-bg-primary p-4" },
    h("div", { className: "w-full max-w-md space-y-4 rounded-lg border border-border-default bg-surface-card p-6 text-center" },
      h("h1", { className: "text-xl font-bold text-content-primary" }, "Accounts are provisioned by an administrator"),
      h("p", { className: "text-sm text-content-secondary" },
        "Self-registration is disabled. Ask a Gridwolf administrator to register your FORGE identity and assign a role."),
      h(Link, { to: "/login", className: "text-accent hover:underline font-medium text-sm" }, "Back to sign in")));
}
