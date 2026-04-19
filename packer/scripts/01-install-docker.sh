#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Gridwolf OVA build — Step 1: Docker Engine + Compose
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

echo "[gridwolf] Installing Docker Engine..."

# Remove any old installations
apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

# Add Docker's official GPG key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update -qq
apt-get install -y --no-install-recommends \
  docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

# Enable + start Docker
systemctl enable docker
systemctl start docker

# Add gridwolf user to docker group (no sudo needed to run docker)
usermod -aG docker gridwolf

# Verify
docker --version
docker compose version

echo "[gridwolf] Docker installed successfully."
