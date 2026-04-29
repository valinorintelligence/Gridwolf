# Plan — Ship gridwolfOS v1.1.0 OVA to GitHub Release

**Goal:** A downloadable, end-to-end functional Ubuntu 24.04-based OVA on the
public GitHub release page, runnable in VirtualBox / VMware / Proxmox with
working frontend, backend, first-boot wizard, and Cockpit.

**Repo:** `valinorintelligence/Gridwolf` · branch `main`
**Target tag:** `release/v1.1.0` (production) — preceded by `release/v1.1.0-rc.1`
**Date drafted:** 2026-04-30

---

## Current state (carry-over from log.txt)

- Build pipeline **complete** (Phases 1–4 of `plans/build-gridwolfOS-ova.md`,
  commit `0b0eb9f`):
  - Packer template builds Ubuntu 24.04.2 image
  - `assemble-ova.sh` produces OVA without `ovftool` (qemu-img + sed + tar)
  - First-boot whiptail wizard (hostname / NTP / network / admin password)
  - `.github/workflows/build-ova.yml` triggers on `release/v*` tags
- Phase 5 (smoke test + public release) **not yet executed**
- **Blocker carried over:** `gridwolf` Docker Hub org is unclaimed.
  The OVA's `docker-compose.hub.yml` pulls `gridwolf/backend:latest` +
  `gridwolf/frontend:latest`. If the org is unclaimed, first boot fails to
  pull images → wizard completes but UI never comes up.

---

## Decision required up-front: image registry

Two viable routes. Pick before Phase 0 starts.

### Route A — Claim `gridwolf` Docker Hub org (user manual step, ~5 min)

1. Sign in to <https://hub.docker.com> as Valinor Intelligence
2. Create org `gridwolf` (fallback `valinor-gridwolf` if taken — see Route C)
3. Create public repos `gridwolf/backend` + `gridwolf/frontend`
4. Generate Hub PAT (Read+Write+Delete), add as GH secrets
   `DOCKERHUB_USERNAME=gridwolf`, `DOCKERHUB_TOKEN=<pat>`

Pros: zero code change; existing `docker-hub.yml` + 8 hardcoded paths just work.
Cons: requires the Docker Hub org to actually be available.

### Route B — Pivot to GHCR (`ghcr.io/valinorintelligence/*`) — code change

1. Edit `.github/workflows/docker-hub.yml` → log in to `ghcr.io` w/ `GITHUB_TOKEN`,
   push `ghcr.io/valinorintelligence/gridwolf-backend` + `-frontend`
2. Search/replace `gridwolf/backend` → `ghcr.io/valinorintelligence/gridwolf-backend`
   (and `frontend`) across **8 files**:
   - `docker-compose.hub.yml`, `docker-compose.prod.yml`, `.env.example`
   - `deploy/ova/provision.sh`, `deploy/azure/gridwolf.bicep`
   - `DEPLOYMENT.md`, `DOCKER_HUB.md`, `SECURITY.md`, `deploy/MARKETPLACE.md`
3. Update cosign verify examples to point at GHCR

Pros: no external account claim, GHCR is free + already wired to repo.
Cons: more files to change; Helm chart values + AWS/Azure templates also touch
the `gridwolf` repo prefix.

### Route C — Fallback name `valinor-gridwolf` on Docker Hub

Same as Route A but with `valinor-gridwolf` as the org. Same 8-file rename
as Route B but to `valinor-gridwolf/backend` etc.

**Recommendation:** **Route A** if user can claim `gridwolf` now (smallest
surface area). **Route B** if there's any doubt (one workflow + 8 sed edits,
all reversible).

> ⚠ The rest of the plan assumes the registry decision is locked in before
> Phase 1 starts. Mark the chosen route here: **[ ] A   [ ] B   [ ] C**

---

## Phase 0 — Pre-flight (one-time, ~15 min)

1. Confirm CI baseline green:
   `cd backend && ruff check . && ruff format --check .`
   `cd frontend && npx tsc --noEmit && npm run lint && npm run build`
2. Confirm the chosen registry secrets exist on the repo
   (`gh secret list -R valinorintelligence/Gridwolf`).
3. Confirm `release/v*` tag protection (none currently — direct push OK).
4. Local sanity boot:
   `docker compose -f docker-compose.hub.yml --env-file .env up -d`
   → http://localhost reachable, `/api/docs` renders.

**Exit gate:** CI green + `docker compose up` works end-to-end locally.

## Phase 1 — Apply registry decision (only if Route B or C)

Single commit, mechanical search/replace across the 8 files listed in Route B.
Touch nothing else. PR title: `chore(registry): switch image refs to <new>`.

**Exit gate:** `git grep -n 'gridwolf/backend\b'` returns zero hits (Route B/C only).

## Phase 2 — Build images on Docker Hub / GHCR

Cut the **lightweight** image-only tag first (no OVA yet):

```bash
git tag v1.1.0-rc.1
git push origin v1.1.0-rc.1
```

This triggers `docker-hub.yml` (or its GHCR-pivoted variant) to build +
sign + push `backend:1.1.0-rc.1` and `frontend:1.1.0-rc.1` for amd64 + arm64.

**Exit gate:**
- Both image tags pullable from chosen registry
- `cosign verify <reg>/backend:1.1.0-rc.1 ...` succeeds
- The release-note workflow comments on the auto-created GH release for `v1.1.0-rc.1`

## Phase 3 — Build OVA on hosted runner

Cut the OVA-triggering tag:

```bash
git tag release/v1.1.0-rc.1
git push origin release/v1.1.0-rc.1
```

This triggers `build-ova.yml` on `ubuntu-24.04` runner with KVM. ~25–35 min.

**Watch:**

```bash
gh run watch --exit-status
```

**Exit gate:**
- Workflow green
- Artifact `gridwolfOS-1.1.0-rc.1.ova` attached to the **draft** GH release
- SHA-256 published in the release body

## Phase 4 — Hypervisor smoke test (manual, user)

This is the only step Claude cannot automate. Pick **at least one** of:

### 4a. VirtualBox 7

```
File → Import Appliance → gridwolfOS-1.1.0-rc.1.ova
RAM: 8 GB · vCPU: 4 · NIC: Bridged
Start → wait for tty1
```

### 4b. VMware Workstation 17 / Player 17

```
Open → gridwolfOS-1.1.0-rc.1.ova → accept defaults
Settings → Network: Bridged → Power on
```

### 4c. Proxmox VE 8

```
scp gridwolfOS-1.1.0-rc.1.ova root@pve:/tmp/
ssh root@pve
qm importovf 9000 /tmp/gridwolfOS-1.1.0-rc.1.ova local-lvm
qm set 9000 --memory 8192 --cores 4 --net0 virtio,bridge=vmbr0
qm start 9000
```

### Acceptance checklist (record per hypervisor)

- [ ] Import succeeds without manual OVF edits
- [ ] tty1 shows whiptail first-boot wizard within 30 s of boot
- [ ] Wizard accepts: hostname / timezone / DHCP / admin password (≥12 chars)
- [ ] After wizard, `/var/lib/gridwolf/.setup-complete` exists
- [ ] Reboot → wizard skipped, system reaches multi-user.target cleanly
- [ ] `https://<vm-ip>:9090` (Cockpit) reachable, branded login page
- [ ] `http://<vm-ip>:3000` (Gridwolf UI) reachable, login screen renders
- [ ] `http://<vm-ip>:8000/docs` (API) renders Swagger UI
- [ ] Login as wizard-created admin succeeds → dashboard loads
- [ ] **Functional smoke:** create scan → upload sample PCAP → see assets
- [ ] **Functional smoke:** generate report → download PDF
- [ ] **Functional smoke:** export hub → download CSV/JSON

If any item fails, **do not promote**. File issue, fix, cut `-rc.2`.

**Exit gate:** all items checked on at least one hypervisor.

## Phase 5 — Promote to public v1.1.0 release

Once `-rc.1` passes:

```bash
git tag release/v1.1.0
git push origin release/v1.1.0
```

Re-runs `build-ova.yml` against the same commit, produces
`gridwolfOS-1.1.0.ova`, attaches to a new draft release.

Then:

1. `gh release view release/v1.1.0` → confirm artifact + checksum present
2. Edit release body via `gh release edit release/v1.1.0 --notes-file RELEASE_NOTES.md`
   — pull from `CHANGELOG.md` if it exists, else hand-write from
   `git log release/v1.0.x..release/v1.1.0`
3. `gh release edit release/v1.1.0 --draft=false` → public

Optional polish before publishing:
- Add a one-paragraph "What's in the OVA" section
- Link `DEPLOYMENT.md` for non-OVA paths
- Embed first-boot wizard screenshot if available

**Exit gate:** Public release page lists `gridwolfOS-1.1.0.ova` with SHA-256
+ install instructions. URL shareable.

## Phase 6 — Post-release hygiene (within 24 h of public release)

1. Update `log.txt` with: tag SHA, hypervisor pass record, public release URL
2. Update `DEPLOYMENT.md §4` if any wizard text changed during smoke test
3. Tag `gridwolf/backend:latest` + `gridwolf/frontend:latest` on the registry
   (the `docker-hub.yml` workflow already does this on semver push)
4. Close the Docker Hub blocker note in `deploy/MARKETPLACE.md`
5. Commit follow-up `docs(log): record v1.1.0 ship + smoke test results`

---

## Risk register

| # | Risk | Likelihood | Mitigation |
|---|------|------------|------------|
| 1 | `gridwolf` Hub org taken | medium | Route B (GHCR) ready; Route C fallback name |
| 2 | KVM unavailable on hosted runner | low | `cross-platform-actions/action` fallback noted in workflow |
| 3 | Wizard hangs on tty1 because cockpit.socket re-enables too early | medium | Already gated by `ConditionPathExists=!/var/lib/gridwolf/.setup-complete` per provision.sh — verify in Phase 4 |
| 4 | OVA boots in VBox but not VMware (vmx-13 too old) | low | OVF templates `vmx-13` which is broadly supported; if it fails, bump to `vmx-15` and re-cut `-rc.2` |
| 5 | Image pull rate-limited at first boot | low | Public Hub repos are exempt for anonymous pulls under the daily limit; if hit, add Hub PAT to wizard |
| 6 | OVA size > 2 GB (GH release single-file limit is 2 GB) | medium | Current sizing target ~1.2 GB compressed; if over, switch to release asset upload via `gh release upload --clobber` chunked or host on a separate CDN with link-only release |

## Time estimate

| Phase | Owner | Wall time |
|-------|-------|-----------|
| 0 — pre-flight | Claude + user | 15 min |
| 1 — registry pivot (only if B/C) | Claude | 30 min |
| 2 — image build via tag | CI | ~15 min |
| 3 — OVA build via tag | CI | ~30 min |
| 4 — hypervisor smoke test | user | 45–90 min |
| 5 — promote to v1.1.0 | Claude + user | 20 min |
| 6 — post-release hygiene | Claude | 15 min |

**Total ~3 h elapsed (mostly CI + manual smoke test).**

---

## Out of scope for this plan

- AWS Marketplace AMI submission (separate plan, requires AMI Packer pass)
- Azure Marketplace ZIP submission (separate plan, blocked on bicep fix)
- Helm chart publication to a public Helm repo
- Theme revamp Stage 3+ (none planned; Stage 2 is final)
