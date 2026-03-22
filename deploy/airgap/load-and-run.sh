#!/usr/bin/env bash
# =============================================================================
# Gridwolf Air-Gap Loader and Runner
# =============================================================================
# Run this script on the air-gapped target host after extracting the bundle.
# It will load images, configure the environment, start services, and verify
# everything is operational.
#
# Usage:  ./load-and-run.sh [--bind 0.0.0.0] [--skip-seed]
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Colors and helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

step() {
    STEP_NUM=$((STEP_NUM + 1))
    echo ""
    echo -e "${BOLD}━━━ Step ${STEP_NUM}: $* ━━━${NC}"
}

STEP_NUM=0

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
BIND_ADDRESS="127.0.0.1"
SKIP_SEED=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --bind)
            BIND_ADDRESS="$2"
            shift 2
            ;;
        --skip-seed)
            SKIP_SEED=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--bind ADDRESS] [--skip-seed]"
            echo ""
            echo "Options:"
            echo "  --bind ADDRESS   IP address to bind ports to (default: 127.0.0.1)"
            echo "  --skip-seed      Skip database seeding (for reinstalls)"
            exit 0
            ;;
        *)
            error "Unknown argument: $1. Use --help for usage."
            ;;
    esac
done

# ---------------------------------------------------------------------------
# Determine paths
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.airgap.yml"
ENV_FILE="${SCRIPT_DIR}/.env"
ENV_TEMPLATE="${SCRIPT_DIR}/.env.template"
IMAGES_TAR="${SCRIPT_DIR}/gridwolf-images.tar"
CHECKSUMS_FILE="${SCRIPT_DIR}/checksums.sha256"
VERSION_FILE="${SCRIPT_DIR}/VERSION"

echo ""
echo -e "${BOLD}========================================${NC}"
echo -e "${BOLD}  Gridwolf Air-Gap Deployment${NC}"
if [[ -f "${VERSION_FILE}" ]]; then
    echo -e "${BOLD}  Version: $(grep '^version=' "${VERSION_FILE}" | cut -d= -f2)${NC}"
fi
echo -e "${BOLD}========================================${NC}"

# ---------------------------------------------------------------------------
# Preflight checks
# ---------------------------------------------------------------------------
step "Preflight checks"

command -v docker >/dev/null 2>&1 || error "Docker is not installed. Install Docker before proceeding."
docker info >/dev/null 2>&1     || error "Docker daemon is not running. Start Docker with: sudo systemctl start docker"

# Check docker compose (v2)
if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    error "Docker Compose is not installed. Install Docker Compose v2 before proceeding."
fi

[[ -f "${IMAGES_TAR}" ]]    || error "Docker images tarball not found: ${IMAGES_TAR}"
[[ -f "${COMPOSE_FILE}" ]]  || error "Compose file not found: ${COMPOSE_FILE}"
[[ -f "${ENV_TEMPLATE}" ]]  || error "Environment template not found: ${ENV_TEMPLATE}"

# Check disk space (need at least 5 GB free)
AVAIL_KB=$(df --output=avail "${SCRIPT_DIR}" 2>/dev/null | tail -1 || df -k "${SCRIPT_DIR}" | tail -1 | awk '{print $4}')
AVAIL_GB=$((AVAIL_KB / 1024 / 1024))
if [[ ${AVAIL_GB} -lt 5 ]]; then
    warn "Less than 5 GB free disk space available (${AVAIL_GB} GB). This may not be enough."
fi

success "Preflight checks passed."

# ---------------------------------------------------------------------------
# Verify checksums
# ---------------------------------------------------------------------------
step "Verifying file integrity"

if [[ -f "${CHECKSUMS_FILE}" ]]; then
    # Checksum verification that works on both Linux and macOS
    VERIFY_FAILED=false
    while IFS= read -r line; do
        expected_hash=$(echo "${line}" | awk '{print $1}')
        file_name=$(echo "${line}" | awk '{print $2}' | sed 's|^\./||')
        if [[ -f "${SCRIPT_DIR}/${file_name}" ]]; then
            if command -v sha256sum >/dev/null 2>&1; then
                actual_hash=$(sha256sum "${SCRIPT_DIR}/${file_name}" | awk '{print $1}')
            else
                actual_hash=$(shasum -a 256 "${SCRIPT_DIR}/${file_name}" | awk '{print $1}')
            fi
            if [[ "${expected_hash}" != "${actual_hash}" ]]; then
                echo -e "${RED}  FAILED: ${file_name}${NC}"
                VERIFY_FAILED=true
            else
                echo -e "${GREEN}  OK: ${file_name}${NC}"
            fi
        else
            warn "File listed in checksums not found: ${file_name}"
        fi
    done < "${CHECKSUMS_FILE}"

    if [[ "${VERIFY_FAILED}" == "true" ]]; then
        error "Checksum verification failed. The bundle may be corrupted. Re-transfer from the build machine."
    fi
    success "All file checksums verified."
else
    warn "No checksums file found. Skipping integrity verification."
fi

# ---------------------------------------------------------------------------
# Load Docker images
# ---------------------------------------------------------------------------
step "Loading Docker images (this may take several minutes)"

docker load -i "${IMAGES_TAR}"
success "Docker images loaded."

# List loaded images
info "Available Gridwolf images:"
docker images --format "  {{.Repository}}:{{.Tag}} ({{.Size}})" | grep -E "gridwolf|postgres|redis" || true

# ---------------------------------------------------------------------------
# Generate environment file
# ---------------------------------------------------------------------------
step "Configuring environment"

generate_secret() {
    # Generate a cryptographically secure random string
    # Works on systems without /dev/urandom by falling back to openssl
    if [[ -r /dev/urandom ]]; then
        head -c 48 /dev/urandom | base64 | tr -d '/+=' | head -c 64
    elif command -v openssl >/dev/null 2>&1; then
        openssl rand -base64 48 | tr -d '/+=' | head -c 64
    else
        error "Cannot generate secure random values. Ensure /dev/urandom or openssl is available."
    fi
}

if [[ -f "${ENV_FILE}" ]]; then
    warn "Existing .env file found. It will NOT be overwritten."
    info "If you need fresh secrets, delete .env and re-run this script."
else
    cp "${ENV_TEMPLATE}" "${ENV_FILE}"

    # Generate secure passwords and secrets
    DB_PASSWORD="$(generate_secret)"
    JWT_SECRET="$(generate_secret)"

    # Platform-compatible sed in-place editing
    if [[ "$(uname)" == "Darwin" ]]; then
        sed -i '' "s|POSTGRES_PASSWORD=GENERATE_ME|POSTGRES_PASSWORD=${DB_PASSWORD}|" "${ENV_FILE}"
        sed -i '' "s|GRIDWOLF_SECRET_KEY=GENERATE_ME|GRIDWOLF_SECRET_KEY=${JWT_SECRET}|" "${ENV_FILE}"
        sed -i '' "s|BIND_ADDRESS=127.0.0.1|BIND_ADDRESS=${BIND_ADDRESS}|" "${ENV_FILE}"
    else
        sed -i "s|POSTGRES_PASSWORD=GENERATE_ME|POSTGRES_PASSWORD=${DB_PASSWORD}|" "${ENV_FILE}"
        sed -i "s|GRIDWOLF_SECRET_KEY=GENERATE_ME|GRIDWOLF_SECRET_KEY=${JWT_SECRET}|" "${ENV_FILE}"
        sed -i "s|BIND_ADDRESS=127.0.0.1|BIND_ADDRESS=${BIND_ADDRESS}|" "${ENV_FILE}"
    fi

    # Update the database URL with the generated password
    if [[ "$(uname)" == "Darwin" ]]; then
        sed -i '' "s|GRIDWOLF_DATABASE_URL=.*|GRIDWOLF_DATABASE_URL=postgresql+asyncpg://gridwolf:${DB_PASSWORD}@postgres:5432/gridwolf|" "${ENV_FILE}"
    else
        sed -i "s|GRIDWOLF_DATABASE_URL=.*|GRIDWOLF_DATABASE_URL=postgresql+asyncpg://gridwolf:${DB_PASSWORD}@postgres:5432/gridwolf|" "${ENV_FILE}"
    fi

    # Secure the env file
    chmod 600 "${ENV_FILE}"
    success "Environment configured with generated secrets."
fi

# ---------------------------------------------------------------------------
# Create data directories
# ---------------------------------------------------------------------------
step "Creating data directories"

mkdir -p "${SCRIPT_DIR}/data/scans"
mkdir -p "${SCRIPT_DIR}/data/backups"
success "Data directories created."

# ---------------------------------------------------------------------------
# Start services
# ---------------------------------------------------------------------------
step "Starting Gridwolf services"

${COMPOSE_CMD} -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d

info "Waiting for services to become healthy..."

# Wait for services to be healthy (up to 120 seconds)
TIMEOUT=120
ELAPSED=0
INTERVAL=5

while [[ ${ELAPSED} -lt ${TIMEOUT} ]]; do
    HEALTHY_COUNT=$(${COMPOSE_CMD} -f "${COMPOSE_FILE}" ps --format json 2>/dev/null \
        | grep -c '"healthy"' 2>/dev/null || echo "0")

    # Alternative check if json format is not supported
    if [[ "${HEALTHY_COUNT}" == "0" ]]; then
        HEALTHY_COUNT=$(${COMPOSE_CMD} -f "${COMPOSE_FILE}" ps 2>/dev/null \
            | grep -c "(healthy)" 2>/dev/null || echo "0")
    fi

    if [[ ${HEALTHY_COUNT} -ge 4 ]]; then
        break
    fi

    echo -ne "\r  Waiting for services... (${ELAPSED}s / ${TIMEOUT}s)"
    sleep ${INTERVAL}
    ELAPSED=$((ELAPSED + INTERVAL))
done
echo ""

if [[ ${ELAPSED} -ge ${TIMEOUT} ]]; then
    warn "Some services may not be fully healthy yet. Checking status..."
    ${COMPOSE_CMD} -f "${COMPOSE_FILE}" ps
else
    success "All services are running and healthy."
fi

# ---------------------------------------------------------------------------
# Run database migrations
# ---------------------------------------------------------------------------
step "Running database migrations"

${COMPOSE_CMD} -f "${COMPOSE_FILE}" exec -T backend \
    alembic upgrade head 2>&1 || warn "Migration command failed. You may need to run migrations manually."

success "Database migrations complete."

# ---------------------------------------------------------------------------
# Seed initial data
# ---------------------------------------------------------------------------
if [[ "${SKIP_SEED}" == "false" ]]; then
    step "Seeding initial data"

    ${COMPOSE_CMD} -f "${COMPOSE_FILE}" exec -T backend \
        python -m app.seed 2>&1 || warn "Seed script failed or not found. You can seed manually later."

    success "Initial data seeded."
else
    info "Skipping database seeding (--skip-seed)."
fi

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
step "Running final health checks"

check_service() {
    local name="$1"
    local check_cmd="$2"

    if eval "${check_cmd}" >/dev/null 2>&1; then
        echo -e "  ${GREEN}[PASS]${NC} ${name}"
        return 0
    else
        echo -e "  ${RED}[FAIL]${NC} ${name}"
        return 1
    fi
}

HEALTH_FAILURES=0

check_service "PostgreSQL" "${COMPOSE_CMD} -f ${COMPOSE_FILE} exec -T postgres pg_isready -U gridwolf" || HEALTH_FAILURES=$((HEALTH_FAILURES + 1))
check_service "Redis" "${COMPOSE_CMD} -f ${COMPOSE_FILE} exec -T redis redis-cli ping" || HEALTH_FAILURES=$((HEALTH_FAILURES + 1))
check_service "Backend API" "curl -sf http://${BIND_ADDRESS}:8000/health" || HEALTH_FAILURES=$((HEALTH_FAILURES + 1))
check_service "Frontend" "curl -sf http://${BIND_ADDRESS}:3000/" || HEALTH_FAILURES=$((HEALTH_FAILURES + 1))

echo ""
if [[ ${HEALTH_FAILURES} -gt 0 ]]; then
    warn "${HEALTH_FAILURES} service(s) failed health check. Review logs with:"
    echo "  ${COMPOSE_CMD} -f ${COMPOSE_FILE} logs"
else
    success "All services passed health checks."
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}========================================${NC}"
echo -e "${GREEN}${BOLD}  Gridwolf is running!${NC}"
echo -e "${BOLD}========================================${NC}"
echo ""
echo -e "  ${BOLD}Web UI:${NC}     http://${BIND_ADDRESS}:3000"
echo -e "  ${BOLD}API:${NC}        http://${BIND_ADDRESS}:8000"
echo -e "  ${BOLD}Data Dir:${NC}   ${SCRIPT_DIR}/data"
echo ""
echo -e "  ${BOLD}Useful commands:${NC}"
echo "    View logs:     ${COMPOSE_CMD} -f ${COMPOSE_FILE} logs -f"
echo "    Stop services: ${COMPOSE_CMD} -f ${COMPOSE_FILE} down"
echo "    Restart:       ${COMPOSE_CMD} -f ${COMPOSE_FILE} up -d"
echo ""
