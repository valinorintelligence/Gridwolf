# Gridwolf

**Passive ICS / OT / SCADA network discovery, vulnerability intelligence, and
security assessment platform.**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/valinorintelligence/Gridwolf/releases)
[![License](https://img.shields.io/badge/license-AGPL--3.0-green.svg)](https://github.com/valinorintelligence/Gridwolf/blob/main/LICENSE)

---

## What is Gridwolf?

Gridwolf ingests packet captures (PCAP / PCAPNG) from your OT environment
and, without sending a single probe onto the plant network, identifies:

- **Assets** — PLCs, HMIs, RTUs, historians, engineering workstations
- **Protocols** — Modbus, DNP3, S7, EtherNet/IP, BACnet, IEC-104, OPC-UA, GOOSE
- **Vulnerabilities** — CVEs correlated against a live NVD feed
- **Threat activity** — mapped to MITRE ATT&CK for ICS

It produces auditor-ready PDF reports and a real-time web dashboard.

---

## Images

| Image | Purpose |
| ----- | ------- |
| `ghcr.io/valinorintelligence/gridwolf-backend:latest`  | FastAPI API + Celery workers + scanners |
| `ghcr.io/valinorintelligence/gridwolf-frontend:latest` | React SPA served by Nginx              |

Tags: `latest`, `1.0.0`, `1.0`, `1`. Multi-arch: `linux/amd64`, `linux/arm64`.

---

## Quick start (Docker Compose)

```bash
# 1. Grab the compose file + env template
curl -fsSL https://raw.githubusercontent.com/valinorintelligence/Gridwolf/main/docker-compose.hub.yml -o docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/valinorintelligence/Gridwolf/main/.env.example -o .env

# 2. Generate secrets
sed -i "s|REPLACE_WITH_GENERATED_SECRET_KEY|$(python3 -c 'import secrets; print(secrets.token_urlsafe(64))')|" .env
sed -i "s|REPLACE_WITH_STRONG_POSTGRES_PASSWORD|$(openssl rand -hex 32)|" .env

# 3. Launch
docker compose up -d

# 4. Open http://localhost and grab the admin password from the logs
docker compose logs backend | grep -A1 "Password"
```

Full docs: **<https://github.com/valinorintelligence/Gridwolf>**

---

## Single container (backend only, for CI)

```bash
docker run --rm -p 8000:8000 \
  -e GRIDWOLF_SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(64))')" \
  -e GRIDWOLF_DATABASE_URL="sqlite+aiosqlite:////data/gridwolf.db" \
  -v gridwolf-data:/data \
  ghcr.io/valinorintelligence/gridwolf-backend:latest
```

---

## Required environment variables

| Variable                   | Required | Notes |
| -------------------------- | :------: | ----- |
| `GRIDWOLF_SECRET_KEY`      | ✅       | JWT signing key, min 32 chars |
| `POSTGRES_PASSWORD`        | ✅ (pg)  | Only when using the Postgres profile |
| `GRIDWOLF_DATABASE_URL`    |          | Defaults to SQLite at `/data/gridwolf.db` |
| `GRIDWOLF_CORS_ORIGINS`    |          | JSON array — set to your public hostname |
| `GRIDWOLF_ADMIN_PASSWORD`  |          | If blank, a random one is printed to stdout on first boot |

Full reference: <https://github.com/valinorintelligence/Gridwolf/blob/main/.env.example>

---

## Health check

Both images expose `/health` (backend) and `/` (frontend) for Docker / k8s
liveness probes. Backend returns HTTP 503 if the database is unreachable.

---

## Other install methods

- **Virtual appliance (OVA)** — VMware / VirtualBox / Hyper-V
- **AWS Marketplace** — CloudFormation one-click
- **Azure Marketplace** — Bicep one-click
- **Kubernetes** — Helm chart under `deploy/kubernetes/helm/gridwolf`

See the main README for details.

---

## Support

- 📖 Docs: <https://github.com/valinorintelligence/Gridwolf#readme>
- 🐛 Issues: <https://github.com/valinorintelligence/Gridwolf/issues>
- 🔒 Security: see [SECURITY.md](https://github.com/valinorintelligence/Gridwolf/blob/main/SECURITY.md)

---

## License

AGPL-3.0 © Valinor Intelligence. Commercial licenses available.
