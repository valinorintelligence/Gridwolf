# Gridwolf Air-Gap Deployment Guide

Gridwolf is an OT/ICS security platform designed to operate in fully air-gapped
industrial environments with zero internet access. This guide covers the complete
workflow: building on a connected machine, transferring via removable media, and
running on the isolated target host.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Building the Bundle (Connected Machine)](#building-the-bundle)
4. [Transferring via USB / Removable Media](#transferring-the-bundle)
5. [Loading and Running (Air-Gapped Host)](#loading-and-running)
6. [Applying Updates](#applying-updates)
7. [Security Hardening for OT Networks](#security-hardening)
8. [Network Segmentation (Purdue Model)](#network-segmentation)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Build Machine (internet-connected)

- Docker Engine 24.0+ and Docker Compose v2
- Git
- 8 GB RAM minimum (for image builds)
- 10 GB free disk space
- Access to the Gridwolf source repository

### Target Host (air-gapped)

- Docker Engine 24.0+ and Docker Compose v2 (pre-installed)
- Linux x86_64 (tested on RHEL 8/9, Ubuntu 22.04 LTS, Rocky Linux 9)
- 4 GB RAM minimum (8 GB recommended)
- 20 GB free disk space
- A non-root user in the `docker` group

If Docker is not yet installed on the air-gapped host, you must install it via
offline packages before proceeding. Consult your OS vendor documentation for
offline Docker installation.

---

## Architecture Overview

The air-gapped deployment runs five containers on a single host:

| Service        | Purpose                                | Default Port |
|----------------|----------------------------------------|--------------|
| frontend       | Nginx serving the React UI             | 3000         |
| backend        | FastAPI application server             | 8000         |
| celery-worker  | Background scan processing             | (none)       |
| postgres       | PostgreSQL 16 database                 | 5432         |
| redis          | Redis 7 message broker and cache       | 6379         |

All containers communicate over an internal Docker network with no external
access. By default, only the frontend and backend ports are bound to
`127.0.0.1` on the host.

---

## Building the Bundle

On the internet-connected build machine:

```bash
cd /path/to/Gridwolf
./deploy/airgap/build-bundle.sh
```

This script will:

1. Build the frontend and backend Docker images.
2. Pull the PostgreSQL and Redis base images.
3. Export all images into a single compressed tarball.
4. Bundle the docker-compose file, environment template, and helper scripts.
5. Generate SHA256 checksums for integrity verification.
6. Write a version metadata file.

The output is a single file: `gridwolf-airgap-bundle.tar.gz`

---

## Transferring the Bundle

1. Copy `gridwolf-airgap-bundle.tar.gz` to a USB drive or other approved
   removable media per your facility's data transfer policy.

2. Follow your site's media scanning and approval procedures before connecting
   the USB drive to any OT network host.

3. Copy the bundle to the target host:
   ```bash
   cp /media/usb/gridwolf-airgap-bundle.tar.gz /opt/gridwolf/
   ```

4. Verify the file was not corrupted during transfer (the checksum is printed
   by the build script and is also inside the bundle):
   ```bash
   sha256sum gridwolf-airgap-bundle.tar.gz
   ```
   Compare the output against the checksum recorded during the build.

---

## Loading and Running

On the air-gapped target host:

```bash
cd /opt/gridwolf
tar xzf gridwolf-airgap-bundle.tar.gz
cd gridwolf-airgap
./load-and-run.sh
```

The script will:

1. Verify SHA256 checksums of all bundled files.
2. Load Docker images from the tarball into the local Docker daemon.
3. Create persistent data directories.
4. Generate secure random secrets for JWT, database passwords, etc.
5. Start all services via docker-compose.
6. Run database migrations (Alembic).
7. Seed initial data (default admin user, baseline scan profiles).
8. Run health checks to confirm all services are operational.

After completion, access Gridwolf at `http://localhost:3000`.

---

## Applying Updates

When a new version is available:

1. Build the new bundle on the connected machine using `build-bundle.sh`.
2. Transfer it to the air-gapped host via approved removable media.
3. Run the update script:

```bash
cd /opt/gridwolf/gridwolf-airgap
./update-bundle.sh /path/to/new/gridwolf-airgap-bundle.tar.gz
```

The update script will:

1. Gracefully stop running services.
2. Back up the PostgreSQL database to a timestamped file.
3. Load the new Docker images.
4. Run any pending database migrations.
5. Restart all services.
6. Verify health of all containers.

Database backups are stored in `./backups/` and retained for rollback.

---

## Security Hardening

### Host-Level Hardening

- Run Docker in rootless mode where supported.
- Restrict the `docker` group to authorized operators only.
- Disable USB auto-mount; use manual mount procedures.
- Enable SELinux or AppArmor with Docker-compatible profiles.
- Configure auditd to log all Docker daemon and container activity.
- Disable unnecessary services (SSH can be restricted to local console).

### Container-Level Hardening

- All containers run with `no-new-privileges` and drop all capabilities
  except those explicitly required.
- No container has access to the Docker socket.
- Resource limits (CPU, memory) are enforced to prevent runaway processes
  from affecting the host.
- Read-only root filesystems where possible.
- The docker-compose file uses internal-only networks with no external gateway.

### Data Protection

- Database and Redis volumes should reside on encrypted filesystems (LUKS).
- Back up the `./data/` directory according to your site backup policy.
- The `.env` file contains secrets and must have permissions `600`.
- Rotate JWT secrets and database passwords on a schedule defined by your
  security policy.

### Logging

- Container logs are written to Docker's default logging driver.
- Configure log rotation in `/etc/docker/daemon.json`:
  ```json
  {
    "log-driver": "json-file",
    "log-opts": {
      "max-size": "10m",
      "max-file": "5"
    }
  }
  ```
- Forward logs to your facility's SIEM if a unidirectional data diode is
  available.

---

## Network Segmentation

Gridwolf is designed to operate within the Purdue Model for industrial
network segmentation. Recommended placement:

### Level 3 — Site Operations (DMZ)

This is the recommended deployment level for Gridwolf. At Level 3, the
platform can:

- Receive scan data from Level 2 controllers and HMIs via read-only
  protocols.
- Provide dashboards to Level 3/4 operations staff.
- Remain isolated from Level 0-1 (physical process) networks.

### Network Rules

| Direction                    | Allow / Deny | Purpose                           |
|------------------------------|--------------|-----------------------------------|
| Level 2 to Gridwolf (L3)    | Allow        | Scan data ingestion (read-only)   |
| Gridwolf (L3) to Level 2    | Deny         | No write access to control layer  |
| Level 4 to Gridwolf (L3)    | Allow        | Dashboard access for IT/OT staff  |
| Gridwolf (L3) to Internet   | Deny         | Air-gapped, no external access    |
| Gridwolf (L3) to Level 0-1  | Deny         | No access to field devices        |

### Firewall Configuration

If the Gridwolf host is on a network segment with other systems, restrict
inbound access:

```
# Allow dashboard access from operations workstations only
iptables -A INPUT -p tcp --dport 3000 -s 10.3.0.0/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 3000 -j DROP

# Allow scan data ingestion from Level 2 segment
iptables -A INPUT -p tcp --dport 8000 -s 10.2.0.0/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 8000 -j DROP

# Deny all outbound to lower Purdue levels
iptables -A OUTPUT -d 10.1.0.0/24 -j DROP
iptables -A OUTPUT -d 10.0.0.0/24 -j DROP
```

Adjust subnets to match your facility's network plan.

---

## Troubleshooting

### Services fail to start

Check that Docker is running: `systemctl status docker`

View container logs: `docker compose -f docker-compose.airgap.yml logs`

### Database connection errors

Verify PostgreSQL is healthy: `docker compose -f docker-compose.airgap.yml exec postgres pg_isready -U gridwolf`

### Images fail to load

Confirm the tarball is not corrupted by checking SHA256 checksums.
Ensure sufficient disk space: `df -h`

### Port conflicts

If ports 3000 or 8000 conflict with existing services, edit the `BIND_ADDRESS`
and port mappings in `.env` before starting.
