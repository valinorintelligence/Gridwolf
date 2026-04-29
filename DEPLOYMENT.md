# Gridwolf — Deployment Guide

Gridwolf ships as a set of signed container images and an appliance OVA.
Pick the path that matches how you run infrastructure.

| Path | Best for | Time to first login |
|---|---|---|
| [Docker Compose](#1-docker-compose) | Laptops, single-VM eval | 3 min |
| [Air-gapped bundle](#2-air-gapped-bundle) | Offline / classified sites | 10 min (after bundle transfer) |
| [Kubernetes (Helm)](#3-kubernetes-helm) | Existing k8s clusters, HA | 5 min |
| [OVA appliance](#4-ova-appliance-esxi--workstation--virtualbox--proxmox) | vSphere / VirtualBox / Workstation / Proxmox | 8 min |
| [AWS (CloudFormation)](#5-aws-cloudformation) | AWS self-deploy | 6 min |
| [Azure (Bicep / ARM)](#6-azure-bicep--arm) | Azure self-deploy | 6 min |
| [AWS Marketplace](#7-aws-marketplace) | One-click AMI purchase | 5 min |
| [Azure Marketplace](#8-azure-marketplace) | One-click Managed App | 5 min |

All paths produce the same Gridwolf — same admin UI, same REST API, same
features. Pick based on where you want the infrastructure to live.

---

## Verifying what you're running

Every signed image carries a Sigstore keyless signature. Before deploying
in production, verify the supply chain:

```bash
cosign verify ghcr.io/valinorintelligence/gridwolf-backend:1.1.0 \
  --certificate-identity-regexp='^https://github.com/valinorintelligence/Gridwolf' \
  --certificate-oidc-issuer='https://token.actions.githubusercontent.com'
```

See [`SECURITY.md`](SECURITY.md) for the full verification procedure and our
vulnerability disclosure policy.

---

## 1. Docker Compose

```bash
curl -fsSL https://raw.githubusercontent.com/valinorintelligence/Gridwolf/main/docker-compose.hub.yml \
  -o docker-compose.yml
docker compose up -d
```

First-run admin credentials print to the container logs:

```bash
docker compose logs backend | grep -A3 "First-Run Admin"
```

Open `http://localhost` and sign in.

---

## 2. Air-gapped bundle

For sites with no outbound internet access. Pre-bundles the images, compose
file, and load scripts into a single tarball you can transfer via USB.

```bash
# On an internet-connected machine
./deploy/airgap/build-bundle.sh

# Transfer gridwolf-airgap-*.tar.gz to the target host

# On the target
tar -xzf gridwolf-airgap-*.tar.gz
cd gridwolf-airgap
./load-and-run.sh
```

See [`deploy/airgap/README.md`](deploy/airgap/README.md) for details.

---

## 3. Kubernetes (Helm)

```bash
helm install gridwolf deploy/kubernetes/helm/gridwolf \
  --namespace gridwolf --create-namespace \
  --set ingress.hosts[0].host=gridwolf.example.com
```

Defaults ship with an in-cluster Postgres + Redis for evaluation. For
production, toggle `postgresql.enabled=false` and point at a managed DB:

```yaml
# values.prod.yaml
postgresql:
  enabled: false
  host: gridwolf-prod.postgres.database.azure.com
  database: gridwolf
secrets:
  createSecret: false
  existingSecret: gridwolf-prod-secrets   # populate via External Secrets Operator
```

Full chart options: [`deploy/kubernetes/helm/gridwolf/values.yaml`](deploy/kubernetes/helm/gridwolf/values.yaml).

---

## 4. OVA appliance (ESXi / Workstation / VirtualBox / Proxmox)

Tenable-Core-style appliance: Ubuntu 24.04 LTS + Gridwolf + **Cockpit**
web console, with an interactive first-boot wizard on the hypervisor
console. No SSH-required setup, no auto-generated passwords mailed
through logs.

OVAs are produced by the [`Build Gridwolf OVA`](.github/workflows/build-ova.yml)
workflow on every `release/v*` tag and attached to a draft GitHub Release
as `gridwolfOS-<version>.ova` plus its SHA-256.

| Port | Service                                           |
| ---- | ------------------------------------------------- |
| 22   | SSH                                               |
| 3000 | Gridwolf UI                                       |
| 8000 | Gridwolf REST + WebSocket API                     |
| 9090 | Cockpit web console (storage, network, services)  |

**Deploy:**

1. Download `gridwolfOS-<version>.ova` from the [release page](https://github.com/valinorintelligence/Gridwolf/releases).
2. **ESXi / vCenter:** Host → Actions → Deploy OVF template → browse to the file.
3. **VirtualBox / Workstation:** File → Import Appliance → select the file.
4. **Proxmox VE:** `qm importovf <vmid> gridwolfOS-<ver>.ova local-lvm`.
5. Boot the VM. The first-boot wizard runs on `tty1` and walks you through
   hostname, timezone, NTP, network (DHCP or static IPv4), and the admin
   password (≥12 chars). When the wizard finishes Cockpit and the Gridwolf
   service come online and the URLs print on the console.
6. Browse to `https://<ip>:9090` (Cockpit) or `https://<ip>:3000` (Gridwolf UI).

Default appliance specs declared in the OVF: **4 vCPU · 8 GB RAM · 40 GB disk**.
Adjust before first boot if you expect long PCAP retention.

Full operator guide: [`deploy/ova/README.md`](deploy/ova/README.md).

---

## 5. AWS (CloudFormation)

Self-deploy to your own AWS account (no Marketplace purchase required):

```bash
aws cloudformation deploy \
  --template-file deploy/aws/gridwolf.template.yaml \
  --stack-name gridwolf \
  --parameter-overrides \
      KeyPairName=my-keypair \
      AllowedCidr=203.0.113.0/24 \
      GridwolfVersion=1.1.0 \
  --capabilities CAPABILITY_IAM
```

The stack creates:
- An EC2 instance (default `t3.large`) with the latest Ubuntu 24.04 AMI
- A retained, encrypted EBS data volume
- A security group (HTTP/HTTPS/SSH, restricted to `AllowedCidr`)
- A static Elastic IP

Stack outputs include the web UI URL and SSH command. Admin credentials
are written to `/opt/gridwolf/admin-credentials.txt` on the instance on
first boot (also visible via CloudWatch if you enable the agent).

---

## 6. Azure (Bicep / ARM)

```bash
az group create -n gridwolf-rg -l eastus
az deployment group create \
  -g gridwolf-rg \
  -f deploy/azure/gridwolf.bicep \
  -p adminPasswordOrKey="$(cat ~/.ssh/id_ed25519.pub)" \
     gridwolfVersion=1.1.0
```

Same shape as the AWS CFN template: one VM, one persistent data disk, one
NSG, one static public IP. SSH into the VM and run `cat /opt/gridwolf/admin-credentials.txt`
to retrieve the auto-generated password.

---

## 7. AWS Marketplace

*Listing submission in progress — tracking issue coming soon.*

Once live, the Marketplace listing lets you one-click launch the exact same
CloudFormation stack as §5, but with a pre-baked AMI (Gridwolf installs in
~30 seconds instead of ~4 minutes of cold docker pulls).

---

## 8. Azure Marketplace

*Listing submission in progress — tracking issue coming soon.*

The Azure Marketplace "Solution Template" offer wraps the Bicep from §6
with a portal form (size picker, SSH-key box, data-disk slider) and
deploys into the customer's own subscription with no managed-service
lock-in.

---

## Upgrading

| Path | Upgrade command |
|---|---|
| Docker Compose | `docker compose pull && docker compose up -d` |
| Air-gapped | Run `deploy/airgap/update-bundle.sh` on the build host, transfer, re-run `load-and-run.sh` |
| Kubernetes | `helm upgrade gridwolf ./chart --set image.tag=1.2.0` |
| OVA | In Cockpit → Terminal: `sudo /opt/gridwolf/provision.sh` (re-pulls images, preserves `/opt/gridwolf/.env` + data); or import a fresh OVA and reattach the old data disk |
| AWS / Azure | `aws cloudformation update-stack` / `az deployment group create` with a bumped `GridwolfVersion` |
| Marketplaces | Redeploy from the listing — data disks are retained across replacements |

Gridwolf uses semver. Minor versions are database-compatible (no manual
migrations); major versions ship a migration script in the release notes.

---

## Questions

- Bugs / security reports: see [`SECURITY.md`](SECURITY.md)
- Marketplace publisher questions: see [`deploy/MARKETPLACE.md`](deploy/MARKETPLACE.md)
- General questions: [GitHub Discussions](https://github.com/valinorintelligence/Gridwolf/discussions)
