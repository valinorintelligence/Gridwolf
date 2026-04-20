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

Packer + cloud-init autoinstall. Run on any Linux host with KVM.

```bash
cd deploy/ova/packer
packer init .
packer build -var gridwolf_version=1.1.0 gridwolf.pkr.hcl
```

Output: `build/gridwolf-<version>-<yyyymmdd>.ova` + SHA256 checksum.

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

### First login

- Connect to **`https://<ip>:9090`** (Cockpit login)
  - Username: `gridwolf`
  - Password: see the hypervisor console on first boot — a generated password is printed there and stored at `/opt/gridwolf/.admin-password` on the VM.
- From the Cockpit overview, click the **Gridwolf** menu entry → **Open Gridwolf UI** → opens `https://<ip>:3000`.
- Log in to Gridwolf with the admin credentials printed on the same first-boot banner.

**Rotate both passwords immediately** and delete `/opt/gridwolf/.admin-password`.

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
