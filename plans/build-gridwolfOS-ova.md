# Plan — Build `gridwolfOS.ova` and ship it via GitHub Releases

**Status:** Approved by user 2026-04-22. Ready to execute phase by phase.
**Owner:** Claude Code session(s).
**Output:** A reproducible `gridwolfOS-<version>.ova` (Ubuntu 24.04.2 LTS + Cockpit + Gridwolf stack) attached to GitHub Releases, built end-to-end by GitHub Actions from a tagged commit. No human in the build loop. No proprietary tools (no VMware `ovftool`).

---

## Decisions locked in (do not relitigate)

| # | Decision | Value |
|---|---|---|
| 1 | Base OS | Ubuntu Server 24.04.2 LTS (Noble Numbat, latest point release) |
| 2 | Virtual hardware | 40 GB disk, 8192 MB RAM, 4 vCPU |
| 3 | First-login UX | Force setup wizard via tty1 + `chage -d 0`, mirroring Tenable Core. No default password handed out. |
| 4 | Repo lockdown | None (open repo) — reproducibility from source IS the trust mechanism |
| 5 | Release trigger | GitHub Actions runs on tags matching `release/v*` (so plain `v*` tags can ship Docker-only updates without a 30 min OVA rebuild) |
| 6 | OVA assembly | Pure OSS path: `qemu-img convert` → vmdk + hand-written OVF 1.0 + `tar` (NO `ovftool`, NO `VBoxManage`) |
| 7 | CI runner | GitHub-hosted `ubuntu-24.04` (KVM enabled by default since Jan 2024) — fallback to BuildJet if hosted runner regresses |

---

## Success criteria (for the final phase to declare DONE)

1. Pushing a tag `release/v1.1.0-rc.1` triggers `.github/workflows/build-ova.yml`.
2. Workflow finishes ≤ 35 minutes, green.
3. `gridwolfOS-1.1.0-rc.1.ova` (≤ 2 GB) and `gridwolfOS-1.1.0-rc.1.ova.sha256` are attached to a draft GitHub Release.
4. The OVA imports cleanly into **VirtualBox 7.x AND VMware Workstation 17 AND Proxmox VE 8** (smoke-tested in at least one of these per release).
5. First boot of the OVA: tty1 shows a Gridwolf-branded whiptail wizard. Cockpit on `:9090` is unreachable until the wizard completes.
6. After wizard completes: Cockpit on `:9090` prompts admin to set a new password (PAM-driven, via `chage -d 0`), then lands on the Gridwolf launch tile. Gridwolf UI on `:3000`, API on `:8000`.
7. Re-import the same OVA on a second VM → identical behaviour, no leftover state from the first instance.

---

## Phase 0 — Allowed APIs (Documentation Discovery, completed)

This phase is **already done**. Two subagents researched the build chain and the Cockpit/CI specifics. The findings below are the source of truth; subsequent phases must cite this section, not re-derive.

### 0.1 Packer 1.11+ `qemu` builder (HCL2)

**Source:** `developer.hashicorp.com/packer/integrations/hashicorp/qemu/latest/components/builder/qemu` + working scaffold at `deploy/ova/packer/gridwolf.pkr.hcl:17-90`.

**Approved fields:** `iso_url`, `iso_checksum` (use `file:<url>` form), `output_directory`, `vm_name`, `format` (`qcow2`), `accelerator` (`kvm`), `headless` (`true` — required on CI), `disk_size`, `disk_compression` (qcow2-only, silently ignored on vmdk), `disk_interface` (`virtio`), `net_device` (`virtio-net`), `memory`, `cpus`, `http_directory`, `boot_wait`, `boot_command`, `shutdown_command`, `ssh_username`, `ssh_password`, `ssh_timeout`.

**Removed/banned fields:** `iso_checksum_url`, `iso_checksum_type`, `ssh_wait_timeout`, top-level `type = "qemu"` JSON syntax. Do not hardcode `qemu_binary = "/usr/bin/kvm"` — leave it default.

**Boot command shape (more robust than F6/Esc tab path on UEFI casper 24.04.2):**
```
"c<wait>",
"linux /casper/vmlinuz autoinstall ds=nocloud-net;s=http://{{ .HTTPIP }}:{{ .HTTPPort }}/ ---<enter>",
"initrd /casper/initrd<enter>",
"boot<enter>"
```

### 0.2 Ubuntu 24.04 autoinstall `user-data`

**Source:** `canonical-subiquity.readthedocs-hosted.com/en/latest/reference/autoinstall-reference.html`.

- `version: 1` is the only accepted value.
- 24.04 strictly validates the schema and **fails non-interactively** on unknown keys.
- `interactive-sections: []` is required for zero-prompt serial-console install.
- Password MUST be SHA-512 crypted (`mkpasswd -m sha-512`); plaintext is rejected.
- `late-commands` raw shell paths must be prefixed with `/target/...` OR wrapped in `curtin in-target -- ...`.
- A **`meta-data` file (can be empty)** must be served alongside `user-data` or NoCloud refuses to mount.

### 0.3 OSS OVA assembly (chosen approach)

**Approach:** `qemu-img convert -O vmdk -o subformat=streamOptimized,adapter_type=lsilogic` → hand-written OVF 1.0 envelope → SHA256 manifest (`.mf`) → `tar -cf` (ovf, mf, vmdk in that order, ustar format).

**Why not VBoxManage:** injects `vbox:` namespace `Machine` extensions that ESXi 8 sometimes rejects; also pulls a DKMS chain that fails on GitHub runners.

**Why OVF 1.0 not 2.0:** VirtualBox 7.x parser is OVF 1.0/1.1 only — emitting 2.0 yields "unsupported OVF version".

**Lowest-common-denominator OVF profile that VMware/VBox/ESXi 8/Proxmox 8 all accept:** IDE disk controller, E1000 NIC, hardware version `vmx-13`, no vendor-namespaced sections except the one `vmw:osType="ubuntu64Guest"` attribute.

**Manifest format (mandated by OVF 1.0 §7.1):** `SHA256(filename)= hex` — note the equals-space.

**ResourceType IDs (CIM):** 3=Processor, 4=Memory, 5=IDE, 10=Ethernet, 17=Disk.

### 0.4 GitHub Actions `/dev/kvm` on hosted runners

**Source:** `github.blog/changelog/2023-02-23-hardware-accelerated-android-virtualization-...`.

- Enabled by default on `ubuntu-22.04`, `ubuntu-24.04`, `ubuntu-latest` since 2023-02-23.
- No opt-in, no larger-runner requirement.
- **Required workflow step** to grant the runner user permission:
  ```yaml
  - name: Enable KVM
    run: |
      echo 'KERNEL=="kvm", GROUP="kvm", MODE="0666", OPTIONS+="static_node=kvm"' \
        | sudo tee /etc/udev/rules.d/99-kvm4all.rules
      sudo udevadm control --reload-rules
      sudo udevadm trigger --name-match=kvm
  ```
- **Build time baseline:** 18-28 min for an Ubuntu 24.04 autoinstall + cloud-init + qcow2 compress on stock 4-vCPU/16 GB hosted runner.
- **Fallbacks if hosted-runner KVM regresses:** BuildJet `buildjet-4vcpu-ubuntu-2204` ($0.008/min, ½ price), Namespace ($0.006/min), self-hosted on Hetzner CCX23 ($0.0009/min amortised).

### 0.5 Cockpit first-login wizard (chosen pattern)

**Cockpit ships NO built-in first-run wizard.** Confirmed by reading `cockpit-project/cockpit/pkg/` source tree.

**Tenable Core's pattern (we are copying this):**
1. Image ships with admin user, password forced to expire (`chage -d 0`).
2. First console login forces password change via standard PAM `pam_unix` flow.
3. A custom Cockpit package shadows the landing page until a marker file exists.
4. `cockpit.socket` itself is **not** delayed — gating done inside the Cockpit UI by redirect.

**Our hybrid implementation** (slightly stricter than Tenable — we DO delay `cockpit.socket` so that no remote management is possible until the operator has touched the console):
- `gridwolf-firstboot.service` runs `Before=cockpit.socket` on tty1 with whiptail TUI.
- Wizard collects: hostname, timezone, NTP server, optional static IP.
- On completion: writes `/var/lib/gridwolf/.setup-complete`, then `systemctl enable --now cockpit.socket`.
- `ConditionPathExists=!/var/lib/gridwolf/.setup-complete` makes subsequent boots a no-op.
- `chage -d 0 admin` forces PAM password change at first Cockpit (or SSH) login.

### 0.6 Anti-patterns to avoid (HARD STOPS)

- ❌ Top-level `users:` in autoinstall → use `identity:`.
- ❌ Plaintext password in autoinstall → must be SHA-512 crypt.
- ❌ Missing `#cloud-config` first line → installer falls back to interactive.
- ❌ Missing `meta-data` file → NoCloud refuses to mount.
- ❌ Self-signed HTTPS for the Packer HTTP server → kernel `ds=nocloud-net` doesn't honour CA bundle.
- ❌ OVF 2.0 disk section (`<disk lowercase>` + mandatory `populatedSize`) → VBox rejects.
- ❌ `vmw:ExtraConfig`, `vmw:StorageAllocationSection`, `ResourceSubType=VmxNet3` → VBox rejects.
- ❌ `vbox:Machine` blocks → ESXi rejects.
- ❌ SCSI controller subtypes other than `lsilogic` / `VirtualSCSI` → Proxmox `qm importovf` ignores or errors.
- ❌ Forgetting the udev rule → KVM acceleration silently falls back to TCG, build takes ~6× longer.

---

## Phase 1 — Refresh Packer template + autoinstall to 24.04.2

**Goal:** existing `deploy/ova/packer/gridwolf.pkr.hcl` and `http/user-data` boot reliably on the latest Ubuntu point release with the modern autoinstall schema. Provision.sh remains unchanged in this phase.

### What to implement

1. In `deploy/ova/packer/gridwolf.pkr.hcl`:
   - **COPY** the variable structure from existing file (lines 26-54), update default `ubuntu_iso_url` to `https://releases.ubuntu.com/24.04/ubuntu-24.04.2-live-server-amd64.iso`. Keep `iso_checksum = "file:https://releases.ubuntu.com/24.04/SHA256SUMS"`.
   - **REPLACE** existing `boot_command` (lines 79-84) with the GRUB-`c`-console form from §0.1.
   - Bump default `memory` from 8192 to 4096 during build (the appliance runs at 8192 in production but only needs 4 GB during install — frees CI runner headroom). Production memory is set by the OVF, not by Packer.
   - Bump default `cpus` from 4 to 2 for the same reason.
   - Add `disk_compression = true` (currently absent).
   - Keep `ssh_username = "gridwolf"`, `ssh_password = "gridwolf"`, `ssh_timeout = "45m"`.

2. In `deploy/ova/packer/http/user-data`:
   - **COPY** the existing structure (it is already mostly correct — preserves the `version: 1`, `identity:`, `late-commands` shape).
   - Add `interactive-sections: []` after `version: 1`.
   - Replace the legacy `storage: { layout: { name: direct } }` with `storage: { layout: { name: lvm, sizing-policy: all } }`.
   - Verify the bcrypt password hash on line 14 is valid SHA-512 crypt (`$6$...`); if any doubt, regenerate via `mkpasswd -m sha-512 'gridwolf'` and replace.
   - Confirm `meta-data` file exists at `deploy/ova/packer/http/meta-data` (currently does — leave alone).

### Documentation references

- Packer qemu builder fields: §0.1 of this plan.
- Autoinstall schema: §0.2 of this plan.
- Anti-patterns: §0.6 (especially the password-format and missing-`meta-data` traps).

### Verification checklist

- [ ] `cd deploy/ova/packer && packer init . && packer validate gridwolf.pkr.hcl` exits 0.
- [ ] `grep -E '(iso_checksum_url|ssh_wait_timeout|qemu_binary)' deploy/ova/packer/gridwolf.pkr.hcl` returns nothing.
- [ ] `head -1 deploy/ova/packer/http/user-data` is exactly `#cloud-config`.
- [ ] `grep '^autoinstall:' deploy/ova/packer/http/user-data` matches; `grep 'version: 1' ...` matches.
- [ ] If a local KVM host is available: `packer build gridwolf.pkr.hcl` reaches `provisioner "file"` step (proves install + first-boot SSH worked). Otherwise defer to Phase 4 CI verification.

### Anti-pattern guards

- Do NOT remove the existing `cleanup` provisioner block (lines 110-122) — the `cloud-init clean --logs` + `truncate machine-id` + zero-fill-and-discard sequence is correct and important.
- Do NOT replace the entire HCL file; surgical edits only.
- Do NOT switch storage layout to `direct` "for simplicity" — LVM gives operators room to grow `/opt/gridwolf` without resize gymnastics.

---

## Phase 2 — Replace `ovftool` with OSS OVA assembly

**Goal:** strip the proprietary VMware dependency. The `post-processor "shell-local"` block at `gridwolf.pkr.hcl:125-131` must produce a valid OVA using only `qemu-img`, `tar`, and `sha256sum`.

### What to implement

1. **Create** `deploy/ova/packer/assemble-ova.sh` — a standalone shell script callable from the Packer post-processor and from a developer's laptop. Inputs: `--qcow2 <path>` `--name <stem>` `--out-dir <dir>` `--cpus N --memory-mb N --capacity-gb N`. Outputs: `<out-dir>/<stem>.ova` + `<stem>.ova.sha256`. Internally:
   - `qemu-img convert -p -O vmdk -o subformat=streamOptimized,adapter_type=lsilogic` → `<stem>-disk1.vmdk`
   - Render OVF 1.0 envelope from a heredoc template (substitute `@DISK_FILE@`, `@DISK_SIZE@`, `@CAPACITY@`, `@CPUS@`, `@MEMORY_MB@`, `@VM_NAME@`).
   - Generate `<stem>.mf` with the `SHA256(file)= hex` format from §0.3.
   - `tar -cvf <stem>.ova --format=ustar <stem>.ovf <stem>.mf <stem>-disk1.vmdk` (order matters).
   - `sha256sum <stem>.ova > <stem>.ova.sha256`.

2. **Create** `deploy/ova/packer/templates/appliance.ovf.tmpl` — the OVF 1.0 envelope template (copy verbatim from §0.3 of this plan, with the `@PLACEHOLDER@` substitution markers).

3. **Modify** `deploy/ova/packer/gridwolf.pkr.hcl` — replace the existing `post-processor "shell-local"` block (lines 125-131) with:
   ```hcl
   post-processor "shell-local" {
     inline = [
       "bash ${path.root}/assemble-ova.sh \\
         --qcow2 build/${local.vm_name}.qcow2 \\
         --name ${local.vm_name} \\
         --out-dir build \\
         --cpus 4 --memory-mb 8192 --capacity-gb 40"
     ]
   }
   ```

### Documentation references

- OVA assembly approach + exact commands: §0.3 of this plan.
- Anti-patterns (cross-hypervisor LCD, OVF 1.0 vs 2.0): §0.6.
- DMTF OVF 1.0 spec for ResourceType IDs: `docs.oasis-open.org/ovf/v1.0/os/ovf-v1.0-os.html`.

### Verification checklist

- [ ] `bash deploy/ova/packer/assemble-ova.sh --help` prints usage.
- [ ] Given any small qcow2 (`qemu-img create -f qcow2 /tmp/dummy.qcow2 1G`), the script produces a valid `.ova` (test: `tar -tf /tmp/out/dummy.ova` lists `.ovf .mf .vmdk` in that order).
- [ ] `xmllint --noout deploy/ova/packer/templates/appliance.ovf.tmpl` exits 0 (template is well-formed XML even with placeholders, since `@PLACEHOLDER@` strings are valid attribute values).
- [ ] Manifest line format check: `head -1 /tmp/out/dummy.mf` matches regex `^SHA256\(.*\)= [a-f0-9]{64}$` (with the equals-space).
- [ ] If VirtualBox is available locally: `VBoxManage import /tmp/out/dummy.ova --dry-run` exits 0.

### Anti-pattern guards

- Do NOT use `tar -czf` (gzip-compressed OVA — most hypervisors require uncompressed tar).
- Do NOT put the disk file before the `.ovf` in the tar — VMware specifically requires the OVF descriptor to be first.
- Do NOT add `populatedSize` to the `<Disk>` element — that's an OVF 2.0 attribute, will break VBox.
- Do NOT add a SHA1 manifest fallback "for older hypervisors" — SHA256-only is correct for OVF 1.0 + modern VMware/VBox/Proxmox.

---

## Phase 3 — First-boot setup wizard in `provision.sh`

**Goal:** baked-in OVA boots to a Gridwolf-branded whiptail wizard on tty1. Cockpit is unreachable until the wizard completes. After completion, `chage -d 0` forces a Cockpit password change on first login.

### What to implement

1. **Append to `deploy/ova/provision.sh`** (after the existing `# ---- Cockpit: enable + brand ----` block at line 184):
   - Install whiptail: add `whiptail` to the `apt-get install` list at line 55.
   - Create `/usr/local/sbin/gridwolf-firstboot` (whiptail script — see template below).
   - Create `/etc/systemd/system/gridwolf-firstboot.service` (unit from §0.5).
   - **Disable cockpit.socket at boot:** change `systemctl enable --now cockpit.socket` (line 185) to `systemctl disable cockpit.socket` for the OVA build path. Add `systemctl enable gridwolf-firstboot.service`.
   - Run `chage -d 0 ${GRIDWOLF_ADMIN_USERNAME}` so the admin (or `gridwolf`) account is forced to change password at first login.
   - Add a guard: if `/var/lib/gridwolf/.setup-complete` exists (= manual install path on a pre-existing VM, not OVA build), keep cockpit.socket enabled and skip the firstboot service install.

2. **Wizard script** `/usr/local/sbin/gridwolf-firstboot` — exact shape per §0.5 with these collected fields:
   - Hostname (default: `gridwolf`)
   - Timezone (default: `UTC`, validated against `timedatectl list-timezones`)
   - NTP server (default: `pool.ntp.org`)
   - Network mode: DHCP (default) or static (prompt for IP/CIDR/gateway/DNS via netplan)
   - **Admin password for Cockpit/SSH** — set via `passwd ${GRIDWOLF_ADMIN_USERNAME}` (no need for `chage -d 0` after this; if user picks "skip", `chage -d 0` already forces it on next login).
   - On submit: write `/var/lib/gridwolf/.setup-complete` (with timestamp + hostname + tz contents for audit), `systemctl enable --now cockpit.socket`, print "Cockpit ready at https://<ip>:9090" to tty1.

3. **Update `/etc/cockpit/cockpit.conf`** (already partly written by provision.sh at line 255) to add:
   ```ini
   [WebService]
   LoginTitle = Gridwolf Control
   ```
   (already present — verify.)

### Documentation references

- First-boot wizard pattern + systemd unit + gating mechanism: §0.5 of this plan.
- Tenable Core reference: `docs.tenable.com/tenable-core/Nessus/Content/TenableCore/IntroTC.htm`.
- `chage` semantics: `man7.org/linux/man-pages/man1/chage.1.html`.

### Verification checklist

- [ ] In a fresh test VM (or after `packer build`): `systemctl status gridwolf-firstboot.service` shows enabled, not started.
- [ ] `systemctl is-enabled cockpit.socket` returns `disabled`.
- [ ] `chage -l ${GRIDWOLF_ADMIN_USERNAME}` shows "Last password change : password must be changed".
- [ ] `[ -f /var/lib/gridwolf/.setup-complete ]` returns false on a fresh OVA boot.
- [ ] After interactively running `gridwolf-firstboot` on tty1: marker file exists, `cockpit.socket` is active, browsing to `:9090` works.
- [ ] On second boot: `gridwolf-firstboot.service` is `condition: skipped` (per `ConditionPathExists=!`), `cockpit.socket` is auto-enabled.

### Anti-pattern guards

- Do NOT bake any default Cockpit/SSH password into the OVA. The wizard sets it; until then, no remote access path exists.
- Do NOT also gate Gridwolf containers on the marker. They can boot in the background; they're not network-reachable from anywhere useful until cockpit/firewall lets traffic through.
- Do NOT use `/etc/cockpit/disabled-by-firstboot` or any other ad-hoc marker; stick to `/var/lib/gridwolf/.setup-complete` (one marker, well-named, audited path).
- Do NOT skip the `Before=cockpit.socket` ordering in the unit — without it, race conditions on slow boots can let cockpit start first.

---

## Phase 4 — GitHub Actions workflow (`build-ova.yml`)

**Goal:** tagging `release/v1.1.0-rc.1` causes a fresh OVA build on a hosted runner, attached to a draft GitHub Release.

### What to implement

1. **Create** `.github/workflows/build-ova.yml`:
   ```yaml
   name: Build OVA

   on:
     push:
       tags:
         - 'release/v*'
     workflow_dispatch:
       inputs:
         version:
           description: 'Gridwolf version (e.g. 1.1.0-rc.1)'
           required: true

   permissions:
     contents: write   # needed to create a Release

   jobs:
     build-ova:
       runs-on: ubuntu-24.04
       timeout-minutes: 60
       steps:
         - uses: actions/checkout@v4

         - name: Resolve version
           id: ver
           run: |
             if [ -n "${{ inputs.version }}" ]; then
               echo "version=${{ inputs.version }}" >> $GITHUB_OUTPUT
             else
               echo "version=${GITHUB_REF_NAME#release/v}" >> $GITHUB_OUTPUT
             fi

         - name: Enable KVM
           run: |
             echo 'KERNEL=="kvm", GROUP="kvm", MODE="0666", OPTIONS+="static_node=kvm"' \
               | sudo tee /etc/udev/rules.d/99-kvm4all.rules
             sudo udevadm control --reload-rules
             sudo udevadm trigger --name-match=kvm

         - name: Install Packer + QEMU
           run: |
             wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
             echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" \
               | sudo tee /etc/apt/sources.list.d/hashicorp.list
             sudo apt-get update
             sudo apt-get install -y packer qemu-system-x86 qemu-utils ovmf

         - name: Packer init
           working-directory: deploy/ova/packer
           run: packer init .

         - name: Packer build
           working-directory: deploy/ova/packer
           env:
             PACKER_LOG: '1'
           run: |
             packer build \
               -var "gridwolf_version=${{ steps.ver.outputs.version }}" \
               gridwolf.pkr.hcl

         - name: Locate artifact
           id: artifact
           working-directory: deploy/ova/packer/build
           run: |
             OVA=$(ls *.ova | head -n1)
             echo "ova=$OVA" >> $GITHUB_OUTPUT
             echo "ova_path=deploy/ova/packer/build/$OVA" >> $GITHUB_OUTPUT
             ls -lh

         - name: Rename to gridwolfOS-<ver>.ova
           working-directory: deploy/ova/packer/build
           run: |
             mv "${{ steps.artifact.outputs.ova }}" "gridwolfOS-${{ steps.ver.outputs.version }}.ova"
             sha256sum "gridwolfOS-${{ steps.ver.outputs.version }}.ova" > "gridwolfOS-${{ steps.ver.outputs.version }}.ova.sha256"

         - name: Create draft release
           uses: softprops/action-gh-release@v2
           with:
             draft: true
             prerelease: ${{ contains(steps.ver.outputs.version, '-rc') || contains(steps.ver.outputs.version, '-beta') }}
             tag_name: ${{ github.ref_name }}
             name: Gridwolf ${{ steps.ver.outputs.version }}
             generate_release_notes: true
             files: |
               deploy/ova/packer/build/gridwolfOS-${{ steps.ver.outputs.version }}.ova
               deploy/ova/packer/build/gridwolfOS-${{ steps.ver.outputs.version }}.ova.sha256
   ```

2. **Update `deploy/ova/README.md`** "Building the OVA" section to lead with the GitHub Actions path and demote the manual `packer build` to "developer / airgap rebuild".

### Documentation references

- KVM enablement udev rule: §0.4.
- Tag pattern decision: locked-in §5 above.
- `softprops/action-gh-release@v2` is the de-facto release-creation action: `github.com/softprops/action-gh-release`.

### Verification checklist

- [ ] YAML lint: `npx yaml-lint .github/workflows/build-ova.yml` exits 0 (or use `yamllint`).
- [ ] `actionlint` (if installed): no errors.
- [ ] Workflow appears in the repo's Actions tab after pushing the file.
- [ ] **Smoke test:** `gh workflow run build-ova.yml -f version=0.0.1-smoke` (or push `release/v0.0.1-smoke`) — the run should at minimum reach the "Packer init" step. Cancel after to save runner minutes.

### Anti-pattern guards

- Do NOT trigger on `v*` (without the `release/` prefix) — that's reserved for Docker-only releases per locked decision §5.
- Do NOT set `runs-on: ubuntu-latest` (today that's 22.04, but Microsoft rolls it forward unannounced; pin to `ubuntu-24.04` for reproducibility).
- Do NOT add `sudo` inside the `packer build` step — qemu's KVM accelerator works as the runner user once the udev rule is in place; sudo would break Packer's HTTP server (different network namespace surprise).
- Do NOT use `actions/checkout@v3` — pin to `v4`.
- Do NOT publish the release as non-draft from CI without a manual gate. Draft → human reviews artifacts → publish.

---

## Phase 5 — Verification (release candidate cycle)

**Goal:** prove the whole chain end-to-end with a real `release/v1.1.0-rc.1` tag, then a real `release/v1.1.0` if rc passes.

### What to do

1. Commit Phases 1-4 to `main` (one logical commit per phase, or one bundled — operator's call).
2. `git tag release/v1.1.0-rc.1 && git push origin release/v1.1.0-rc.1`.
3. Watch `gh run watch` until the build job completes (expect 18-28 min).
4. Open the draft Release in GitHub UI; confirm `gridwolfOS-1.1.0-rc.1.ova` + `.sha256` are attached.
5. Download the OVA. Verify checksum locally: `sha256sum -c gridwolfOS-1.1.0-rc.1.ova.sha256`.
6. **Hypervisor smoke test** — at minimum one of:
   - VirtualBox 7.x: `VBoxManage import gridwolfOS-1.1.0-rc.1.ova` → start VM headless → `VBoxManage controlvm <name> screenshotpng /tmp/screen.png` after 90 sec → expect to see whiptail wizard.
   - VMware Workstation 17 / ESXi: deploy OVF → power on → console shows wizard.
   - Proxmox VE 8: `qm importovf 9000 gridwolfOS-1.1.0-rc.1.ova local-lvm` → start → console shows wizard.
7. Walk through the wizard. Set hostname/tz/NTP/password. Confirm Cockpit on `:9090` becomes reachable.
8. Cockpit login → forced password change → land on Gridwolf launch tile. Click → `:3000` Gridwolf UI loads.
9. Re-import the same OVA in a second VM → verify isolated state (different machine-id, different first-boot wizard run).
10. **If all green:** publish the draft release as `1.1.0-rc.1`. Cut `release/v1.1.0` once one operator has shaken it down for a day.
11. **If anything fails:** file an issue with logs + screenshots, return to the relevant phase, do not publish.

### Verification checklist

- [ ] CI green
- [ ] OVA artifact ≤ 2 GB (GitHub Release per-file cap)
- [ ] SHA256 verifies
- [ ] OVA imports into ≥ 1 hypervisor without manual edits to the OVF
- [ ] First-boot wizard appears on tty1
- [ ] Cockpit unreachable on `:9090` BEFORE wizard completes
- [ ] Cockpit reachable on `:9090` AFTER wizard, forces password change
- [ ] Gridwolf UI loads on `:3000`, API on `:8000`
- [ ] Second OVA boot from a fresh import is independent of the first

### Anti-pattern guards

- Do NOT publish a Release without the hypervisor smoke test, even if CI is green. CI proves the OVA is well-formed; only a real boot proves it works.
- Do NOT delete the rc tag/release after promoting to GA — keep it for forensic reproducibility.
- Do NOT run the firstboot wizard via SSH "to save time" — that bypasses the gating logic; always use the hypervisor console.

---

## Open questions / known gaps

These came out of Phase 0 research and are NOT blocking, but should be revisited before v1.1.0 GA:

1. **Network wizard scope** — current plan collects static IP via netplan inside whiptail. If the operator network already has DHCP + DNS + reachable NTP, the wizard could skip those screens entirely. Decision deferred: ship "always prompt" for rc.1, gather feedback, possibly add "auto if DHCP leases" detection in v1.1.1.
2. **Build-time vs runtime image pull** — `provision.sh` pulls Docker images during OVA build (line 317: `docker compose pull`). This bloats the OVA but means first boot has no internet dependency. If OVA size is approaching the 2 GB GitHub Release cap, switch to runtime pull (delete the build-time `pull`, add it to the firstboot wizard with a "needs internet" check).
3. **Proxmox `qm importovf` against the exact OVF template** — research confidence was "medium" on whether Proxmox accepts the LCD profile cleanly. Phase 5 smoke test on Proxmox will confirm; if it rejects, fix is a `vmw:osType` attribute tweak.
4. **Hosted-runner KVM regression risk** — GitHub has not announced removing KVM, but if it ever does, we fall back to BuildJet (`runs-on: buildjet-4vcpu-ubuntu-2204`) — single-line change.
5. **Signed releases** — locked decision #4 says no repo lockdown for now. Once the v1.x line is established, consider GPG-signing release tags + uploading detached `.asc` signatures alongside the OVA.

---

## Appendix — File inventory after all phases land

```
.github/workflows/build-ova.yml                      [new, Phase 4]
deploy/ova/README.md                                 [updated, Phase 4]
deploy/ova/provision.sh                              [updated, Phase 3]
deploy/ova/packer/gridwolf.pkr.hcl                   [updated, Phases 1+2]
deploy/ova/packer/http/user-data                     [updated, Phase 1]
deploy/ova/packer/http/meta-data                     [unchanged]
deploy/ova/packer/assemble-ova.sh                    [new, Phase 2]
deploy/ova/packer/templates/appliance.ovf.tmpl       [new, Phase 2]
plans/build-gridwolfOS-ova.md                        [this file]
```
