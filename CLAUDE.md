# Gridwolf — Claude Orientation

Project-local notes for Claude sessions. Kept short on purpose.

## What Gridwolf is

Passive ICS/SCADA network discovery + vulnerability intelligence platform.
Packaged for OVA, Docker Hub, Azure Marketplace, AWS Marketplace, airgap,
and an enterprise-appliance build (see `deploy/ova/`).

## Repo layout (high level)

- `backend/` — FastAPI + SQLAlchemy async, Pydantic, JWT auth, SQLite default
- `frontend/` — React 19 + Vite + Tailwind + Zustand
- `deploy/` — per-channel packaging (aws, azure, airgap, kubernetes, ova)
- `DEPLOYMENT.md` — top-level index of all deployment paths
- `docker-compose.yml` — local dev + OVA workload
- `.env.example` — required env with generated-secret instructions

## Port plan (appliance)

| Port | Service                                |
| ---- | -------------------------------------- |
| 22   | SSH                                    |
| 3000 | Gridwolf UI                            |
| 8000 | Gridwolf API                           |
| 9090 | Cockpit web console (Linux management) |

## Running conventions

- **No demo / mock data anywhere in production code.** Seed files, vuln
  feeds, fingerprint DBs and export payloads were all emptied — repopulate
  from the backend at runtime, never fabricate. See commit `17c696b`.
- Frontend calls backend exclusively through `@/services/api`.
- Backend enums are the contract — align frontend payloads to them,
  not the other way round (see commit `20109a1`).
- Status/severity/type colour tokens are semantic — do not re-theme.

## CI

Three jobs: `lint-backend`, `lint-frontend`, `build-frontend`. All must be
green before ship. `.gitattributes` forces LF on source files to keep
`ruff format --check` stable across Windows editors and Linux runners.

## Deferred work

### Theme revamp — "Gridwolf Control"

Proposal approved in principle (2026-04-21). Deferred until after the
appliance/OVA work is complete.

Direction: cyan (`#22d3ee`) as primary signal colour, violet
(`#7c3aed`) as structural secondary, magenta reserved for rare
highlights only. Surfaces get a 2% cyan tint, card rims a cyan
hairline, the auth-page 40 px grid backdrop applied behind main
content, `bus-shimmer` util for data-flow dividers, JetBrains Mono
on numeric displays.

Rollout: **staged** — first commit is tokens + animations only
(`index.css`), second commit is component-level re-skinning
(`Button`, `Badge`, `Card`, `Tabs`, `Modal`, `Sidebar`, `TopBar`).

Full spec: see the proposal in session transcript dated 2026-04-21.
