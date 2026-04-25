# Gridwolf Appliance (OVA)

Enterprise-grade, self-contained virtual appliance. Ships Gridwolf alongside
**Cockpit**, the Red Hat Linux web console, so operators get full GUI access
to the underlying host — storage, networking, services, logs, terminal,
software updates, SSH keys — without ever touching SSH.

This is the same pattern as Tenable Core: one download, one boot, one login
URL, everything running.

---

## What's on the appliance

| Port | Service | What it does |
|------|---------|--------------|
| **22** | SSH | Standard Linux shell access |
| **3000** | **Gridwolf UI** | The product — passive ICS/SCADA discovery, findings, reports |
| **8000** | Gridwolf API | REST + WebSocket for integrations and programmatic control |
| **9090** | **Cockpit** | Full Linux web console (storage, network, services, updates, terminal, logs) |

All other inbound traffic is blocked by the default UFW policy.

### Host OS

- **Ubuntu Server 24.04 LTS** (minimal install)
- Docker Engine + Compose plugin
- Unattended security updates enabled
- fail2ban on SSH
- `qemu-guest-agent` for hypervisor integration

### Cockpit modules pre-installed

- `cockpit-podman` — inspect the Gridwolf containers from the browser
- `cockpit-networkmanager` — bond / VLAN / bridge config from the GUI
- `cockpit-storaged` — LVM, RAID, LUKS, partition growth
- `cockpit-packagekit` — apply OS updates
- `cockpit-pcp` — historical performance graphs
- `cockpit-sosreport` — generate a support bundle with one click

---

## Building the OVA

### Recommended: GitHub Actions (reproducible release builds)

Push a tag of the form `release/v<semver>` and the
[`Build Gridwolf OVA`](../../.github/workflows/build-ova.yml) workflow will
build the appliance on a hosted `ubuntu-24.04` runner with KVM acceleration
and attach `gridwolfOS-<version>.ova` (plus `.sha256`) to a draft GitHub
Release.

```bash
git tag release/v1.1.0
git push origin release/v1.1.0
```

Plain `v*` tags are reserved for Docker-only releases and do **not** trigger
the OVA build (saves ~30 min of CI per point release).

### Developer / airgap rebuild

Any Linux host with KVM, Packer 1.11+, and `qemu-utils` can reproduce the
artifact locally:

```bash
cd deploy/ova/packer
packer init .
packer build -var gridwolf_version=1.1.0 gridwolf.pkr.hcl
```

Output: `build/gridwolf-<version>-<yyyymmdd>.ova` + SHA256 checksum. The OVA
is assembled by `assemble-ova.sh` (qemu-img + hand-rendered OVF 1.0 + tar) —
no dependency on VMware's proprietary `ovftool`.

The same template supports:

- VMware ESXi / vSphere (native .ova)
- VirtualBox (native .ova)
- Proxmox VE (import via `qm importovf`)
- KVM / libvirt (use the intermediate .qcow2)
- Nutanix AHV (via Prism upload)

---

## Deploying the OVA

1. Import into your hypervisor (vCenter → Deploy OVF Template, etc.).
2. Allocate resources:
   - **Minimum**: 4 vCPU · 8 GB RAM · 40 GB disk
   - **Recommended**: 8 vCPU · 16 GB RAM · 200 GB disk (enterprise workloads with long PCAP retention)
3. Attach the VM to the network where ICS traffic is observable (SPAN/mirror port → dedicated NIC is ideal).
4. Power on. First boot takes ~60 seconds.
5. Retrieve the appliance IP from the hypervisor console or your DHCP server.

### First boot — interactive setup wizard

The appliance ships with Cockpit and the Gridwolf service **disabled**. On
first boot a whiptail wizard runs on `tty1` (the hypervisor console) and
walks the operator through:

1. Hostname
2. Timezone
3. Network time sync (systemd-timesyncd) on/off
4. Network — DHCP or static IPv4 (with gateway + DNS)
5. Admin password (minimum 12 characters, set for both Gridwolf and the
   `gridwolf` OS account)

When the wizard finishes it enables `cockpit.socket`, starts the Gridwolf
service, drops a marker at `/var/lib/gridwolf/.setup-complete`, and prints
the URLs. The wizard is one-shot — subsequent boots skip it.

After setup:

- **`https://<ip>:9090`** — Cockpit (Linux host management). Log in as
  `gridwolf` with the password set in the wizard.
- From the Cockpit overview, click the **Gridwolf** menu entry → **Open
  Gridwolf UI** → opens `https://<ip>:3000`.

---

## Manual provisioning (existing VMs)

If you already have a bare Ubuntu 24.04 LTS VM and want to convert it into a
Gridwolf appliance, run `provision.sh`:

```bash
sudo \
    GRIDWOLF_ADMIN_USERNAME=admin \
    GRIDWOLF_ADMIN_PASSWORD='your-strong-password' \
    GRIDWOLF_VERSION=1.1.0 \
    ./provision.sh
```

The script is **idempotent** — safe to re-run to pick up a newer Gridwolf
image or to refresh Cockpit. Existing secrets in `/opt/gridwolf/.env` are
never overwritten.

---

## Day-2 operations

### Upgrade Gridwolf

From Cockpit → Terminal:

```bash
sudo sed -i 's/GRIDWOLF_IMAGE=.*/GRIDWOLF_IMAGE=gridwolf\/backend:1.2.0/'   /opt/gridwolf/.env
sudo sed -i 's/GRIDWOLF_FRONTEND_IMAGE=.*/GRIDWOLF_FRONTEND_IMAGE=gridwolf\/frontend:1.2.0/' /opt/gridwolf/.env
sudo systemctl restart gridwolf
```

Or: `sudo /opt/gridwolf/provision.sh` (picks up the latest tag).

### Back up

`/opt/gridwolf/` is the only directory with state. A file-level backup of
that path captures SQLite DB, reports, uploads, and env configuration.

```bash
sudo tar czf /opt/gridwolf/backups/gridwolf-$(date +%F).tar.gz \
    -C /opt/gridwolf data reports uploads .env
```

### Restore

```bash
sudo systemctl stop gridwolf
sudo tar xzf /opt/gridwolf/backups/gridwolf-<date>.tar.gz -C /opt/gridwolf
sudo systemctl start gridwolf
```

### Logs

- Gridwolf: `journalctl -u gridwolf -f` or Cockpit → Logs → filter `gridwolf`
- Container: `docker compose -f /opt/gridwolf/docker-compose.yml logs -f`
- Cockpit: `journalctl -u cockpit.socket -u cockpit -f`

### Factory reset

```bash
sudo systemctl stop gridwolf
sudo rm -rf /opt/gridwolf/data /opt/gridwolf/reports /opt/gridwolf/uploads /opt/gridwolf/.env /opt/gridwolf/.admin-password
sudo /opt/gridwolf/provision.sh
```

---

## Hardening beyond the defaults

The appliance ships with sensible-default hardening. For high-assurance
deployments, consider additionally:

1. **TLS with real certs** — swap the self-signed Cockpit cert:
   ```bash
   sudo cp yourcert.pem /etc/cockpit/ws-certs.d/1-gridwolf.cert
   sudo systemctl restart cockpit
   ```
   Put nginx in front of port 3000 / 8000 for Gridwolf TLS.
2. **Disable password SSH** — Cockpit + keys only:
   ```bash
   sudo sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
   sudo systemctl restart ssh
   ```
3. **SELinux / AppArmor** — Ubuntu 24.04 ships AppArmor; the Docker service
   profile is active by default.
4. **Firewall scope** — if management should be isolated, restrict 9090/3000
   to a management subnet:
   ```bash
   sudo ufw delete allow 9090/tcp
   sudo ufw allow from 10.0.10.0/24 to any port 9090 proto tcp
   ```
5. **Audit logging** — Cockpit writes to `/var/log/cockpit-ws.log`; forward to
   your SIEM via rsyslog/journal-remote.

---

## Troubleshooting

| Symptom | Check |
|---|---|
| Gridwolf UI unreachable | `systemctl status gridwolf`, then `docker compose -f /opt/gridwolf/docker-compose.yml ps` |
| Cockpit unreachable | `systemctl status cockpit.socket`, firewall allows 9090 |
| Backend health failing | `curl -s http://localhost:8000/health`, then container logs |
| No admin password printed | `sudo cat /opt/gridwolf/.admin-password` (delete after rotating) |
| Appliance won't boot | Attach to hypervisor console — cloud-init logs print to tty1 |

---

## Layout on disk

```
/opt/gridwolf/
├── docker-compose.yml         # pinned image tags, no build context
├── .env                       # 0600, root-owned, contains SECRET_KEY
├── .admin-password            # only present if password was auto-generated
├── data/                      # SQLite DB + session state
├── reports/                   # generated assessment reports
├── uploads/                   # inbound PCAPs / scans
└── backups/                   # manual tarballs (operator-managed)

/etc/systemd/system/gridwolf.service
/usr/share/cockpit/gridwolf/   # branded Cockpit tile + launch page
/etc/cockpit/cockpit.conf      # Gridwolf login-page branding
```
