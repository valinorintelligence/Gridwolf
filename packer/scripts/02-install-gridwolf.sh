#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Gridwolf OVA build — Step 2: Pull images + install application
# Variables injected by Packer:
#   DOCKERHUB_USERNAME   e.g. gridwolf
#   GRIDWOLF_VERSION     e.g. v0.9.8
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME:-gridwolf}"
GRIDWOLF_VERSION="${GRIDWOLF_VERSION:-latest}"
INSTALL_DIR="/opt/gridwolf"

echo "[gridwolf] Installing Gridwolf ${GRIDWOLF_VERSION} from ${DOCKERHUB_USERNAME}..."

# ── Create install directory ──────────────────────────────────────────────────
mkdir -p "${INSTALL_DIR}"/{data/uploads,data/reports}
chown -R gridwolf:gridwolf "${INSTALL_DIR}"

# ── Pull Docker images (baked into OVA — no internet needed at runtime) ───────
IMAGES=(
  "${DOCKERHUB_USERNAME}/backend:${GRIDWOLF_VERSION}"
  "${DOCKERHUB_USERNAME}/frontend:${GRIDWOLF_VERSION}"
  "postgres:16-alpine"
  "redis:7-alpine"
)

for img in "${IMAGES[@]}"; do
  echo "[gridwolf] Pulling ${img}..."
  docker pull "${img}"
done

# Tag versioned images as :latest so compose can use fixed tag
docker tag "${DOCKERHUB_USERNAME}/backend:${GRIDWOLF_VERSION}"  "${DOCKERHUB_USERNAME}/backend:latest"
docker tag "${DOCKERHUB_USERNAME}/frontend:${GRIDWOLF_VERSION}" "${DOCKERHUB_USERNAME}/frontend:latest"

# ── Write docker-compose.yml ───────────────────────────────────────────────────
cat > "${INSTALL_DIR}/docker-compose.yml" <<EOF
# Gridwolf OVA — runtime compose (do not edit; managed by gridwolf-setup)
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: gridwolf
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
      POSTGRES_DB: gridwolf
    volumes:
      - ${INSTALL_DIR}/data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U gridwolf"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
    restart: unless-stopped

  backend:
    image: ${DOCKERHUB_USERNAME}/backend:latest
    environment:
      GRIDWOLF_DATABASE_URL: "postgresql+asyncpg://gridwolf:\${POSTGRES_PASSWORD}@postgres:5432/gridwolf"
      GRIDWOLF_REDIS_URL: "redis://redis:6379/0"
      GRIDWOLF_SECRET_KEY: "\${GRIDWOLF_SECRET_KEY}"
      GRIDWOLF_CORS_ORIGINS: "\${GRIDWOLF_CORS_ORIGINS}"
      GRIDWOLF_UPLOAD_DIR: "/data/uploads"
      GRIDWOLF_REPORTS_DIR: "/data/reports"
      GRIDWOLF_DEBUG: "false"
    volumes:
      - ${INSTALL_DIR}/data/uploads:/data/uploads
      - ${INSTALL_DIR}/data/reports:/data/reports
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 20s
    restart: unless-stopped

  frontend:
    image: ${DOCKERHUB_USERNAME}/frontend:latest
    ports:
      - "80:80"
    depends_on:
      backend:
        condition: service_healthy
    restart: unless-stopped
EOF

chown gridwolf:gridwolf "${INSTALL_DIR}/docker-compose.yml"

echo "[gridwolf] Images pulled and compose file written to ${INSTALL_DIR}."
