#!/usr/bin/env bash
# =============================================================================
# Gridwolf Air-Gap Update Script
# =============================================================================
# Safely applies an updated air-gap bundle to a running Gridwolf deployment.
# Backs up the database, loads new images, runs migrations, and restarts.
#
# Usage:  ./update-bundle.sh /path/to/gridwolf-airgap-bundle.tar.gz
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
if [[ $# -lt 1 ]]; then
    echo "Usage: $0 /path/to/gridwolf-airgap-bundle.tar.gz"
    echo ""
    echo "Applies an updated air-gap bundle to a running Gridwolf deployment."
    echo "The database will be backed up before any changes are made."
    exit 1
fi

BUNDLE_PATH="$1"
[[ -f "${BUNDLE_PATH}" ]] || error "Bundle file not found: ${BUNDLE_PATH}"

# ---------------------------------------------------------------------------
# Determine paths
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.airgap.yml"
ENV_FILE="${SCRIPT_DIR}/.env"
BACKUP_DIR="${SCRIPT_DIR}/data/backups"
STAGING_DIR="${SCRIPT_DIR}/.update-staging"

# Detect compose command
if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    error "Docker Compose is not installed."
fi

# Read current version
CURRENT_VERSION="unknown"
if [[ -f "${SCRIPT_DIR}/VERSION" ]]; then
    CURRENT_VERSION="$(grep '^version=' "${SCRIPT_DIR}/VERSION" | cut -d= -f2)"
fi

echo ""
echo -e "${BOLD}========================================${NC}"
echo -e "${BOLD}  Gridwolf Air-Gap Update${NC}"
echo -e "${BOLD}  Current Version: ${CURRENT_VERSION}${NC}"
echo -e "${BOLD}========================================${NC}"

# ---------------------------------------------------------------------------
# Preflight checks
# ---------------------------------------------------------------------------
step "Preflight checks"

command -v docker >/dev/null 2>&1 || error "Docker is not installed."
docker info >/dev/null 2>&1     || error "Docker daemon is not running."
[[ -f "${ENV_FILE}" ]]          || error "No .env file found. Is Gridwolf installed here?"
[[ -f "${COMPOSE_FILE}" ]]      || error "No compose file found. Is Gridwolf installed here?"

# Check if services are running
RUNNING=$(${COMPOSE_CMD} -f "${COMPOSE_FILE}" ps -q 2>/dev/null | wc -l | tr -d ' ')
if [[ "${RUNNING}" == "0" ]]; then
    warn "No Gridwolf services are currently running."
fi

success "Preflight checks passed."

# ---------------------------------------------------------------------------
# Extract new bundle to staging
# ---------------------------------------------------------------------------
step "Extracting update bundle"

rm -rf "${STAGING_DIR}"
mkdir -p "${STAGING_DIR}"
tar xzf "${BUNDLE_PATH}" -C "${STAGING_DIR}"

# Read new version
NEW_VERSION="unknown"
if [[ -f "${STAGING_DIR}/VERSION" ]]; then
    NEW_VERSION="$(grep '^version=' "${STAGING_DIR}/VERSION" | cut -d= -f2)"
fi

info "Updating: ${CURRENT_VERSION} -> ${NEW_VERSION}"

# Verify checksums of new bundle
if [[ -f "${STAGING_DIR}/checksums.sha256" ]]; then
    info "Verifying bundle integrity..."
    VERIFY_FAILED=false
    while IFS= read -r line; do
        expected_hash=$(echo "${line}" | awk '{print $1}')
        file_name=$(echo "${line}" | awk '{print $2}' | sed 's|^\./||')
        if [[ -f "${STAGING_DIR}/${file_name}" ]]; then
            if command -v sha256sum >/dev/null 2>&1; then
                actual_hash=$(sha256sum "${STAGING_DIR}/${file_name}" | awk '{print $1}')
            else
                actual_hash=$(shasum -a 256 "${STAGING_DIR}/${file_name}" | awk '{print $1}')
            fi
            if [[ "${expected_hash}" != "${actual_hash}" ]]; then
                echo -e "  ${RED}FAILED: ${file_name}${NC}"
                VERIFY_FAILED=true
            fi
        fi
    done < "${STAGING_DIR}/checksums.sha256"

    if [[ "${VERIFY_FAILED}" == "true" ]]; then
        rm -rf "${STAGING_DIR}"
        error "Bundle integrity check failed. The file may be corrupted."
    fi
    success "Bundle integrity verified."
else
    warn "No checksums in bundle. Skipping integrity check."
fi

[[ -f "${STAGING_DIR}/gridwolf-images.tar" ]] || error "No images tarball found in bundle."

# ---------------------------------------------------------------------------
# Back up database
# ---------------------------------------------------------------------------
step "Backing up database"

mkdir -p "${BACKUP_DIR}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/gridwolf-db-${TIMESTAMP}.sql.gz"

if [[ "${RUNNING}" != "0" ]]; then
    # Source env file to get DB credentials
    set -a
    source "${ENV_FILE}"
    set +a

    ${COMPOSE_CMD} -f "${COMPOSE_FILE}" exec -T postgres \
        pg_dump -U "${POSTGRES_USER:-gridwolf}" "${POSTGRES_DB:-gridwolf}" \
        | gzip > "${BACKUP_FILE}"

    BACKUP_SIZE="$(du -h "${BACKUP_FILE}" | cut -f1)"
    success "Database backed up to: ${BACKUP_FILE} (${BACKUP_SIZE})"
else
    warn "Services not running. Skipping database backup."
fi

# ---------------------------------------------------------------------------
# Stop services gracefully
# ---------------------------------------------------------------------------
step "Stopping services gracefully"

if [[ "${RUNNING}" != "0" ]]; then
    ${COMPOSE_CMD} -f "${COMPOSE_FILE}" down --timeout 30
    success "Services stopped."
else
    info "Services were not running."
fi

# ---------------------------------------------------------------------------
# Load new Docker images
# ---------------------------------------------------------------------------
step "Loading new Docker images (this may take several minutes)"

docker load -i "${STAGING_DIR}/gridwolf-images.tar"
success "New Docker images loaded."

# ---------------------------------------------------------------------------
# Update deployment files
# ---------------------------------------------------------------------------
step "Updating deployment files"

# Update compose file and scripts, but preserve .env
cp "${STAGING_DIR}/docker-compose.airgap.yml" "${COMPOSE_FILE}"
cp "${STAGING_DIR}/load-and-run.sh"           "${SCRIPT_DIR}/load-and-run.sh"
cp "${STAGING_DIR}/update-bundle.sh"          "${SCRIPT_DIR}/update-bundle.sh"
cp "${STAGING_DIR}/VERSION"                   "${SCRIPT_DIR}/VERSION"
cp "${STAGING_DIR}/.env.template"             "${SCRIPT_DIR}/.env.template"

chmod +x "${SCRIPT_DIR}/load-and-run.sh"
chmod +x "${SCRIPT_DIR}/update-bundle.sh"

if [[ -f "${STAGING_DIR}/seed.py" ]]; then
    cp "${STAGING_DIR}/seed.py" "${SCRIPT_DIR}/seed.py"
fi

# Update checksums
cp "${STAGING_DIR}/checksums.sha256" "${SCRIPT_DIR}/checksums.sha256"

success "Deployment files updated. (.env preserved)"

# ---------------------------------------------------------------------------
# Restart services
# ---------------------------------------------------------------------------
step "Starting services with new images"

${COMPOSE_CMD} -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d

info "Waiting for services to become healthy..."

TIMEOUT=120
ELAPSED=0
INTERVAL=5

while [[ ${ELAPSED} -lt ${TIMEOUT} ]]; do
    HEALTHY_COUNT=$(${COMPOSE_CMD} -f "${COMPOSE_FILE}" ps 2>/dev/null \
        | grep -c "(healthy)" 2>/dev/null || echo "0")

    if [[ ${HEALTHY_COUNT} -ge 4 ]]; then
        break
    fi

    echo -ne "\r  Waiting for services... (${ELAPSED}s / ${TIMEOUT}s)"
    sleep ${INTERVAL}
    ELAPSED=$((ELAPSED + INTERVAL))
done
echo ""

success "Services started."

# ---------------------------------------------------------------------------
# Run database migrations
# ---------------------------------------------------------------------------
step "Running database migrations"

${COMPOSE_CMD} -f "${COMPOSE_FILE}" exec -T backend \
    alembic upgrade head 2>&1 || warn "Migration command failed. Check logs for details."

success "Database migrations complete."

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
step "Verifying deployment health"

# Source env to get bind address
set -a
source "${ENV_FILE}"
set +a

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
check_service "Backend API" "curl -sf http://${BIND_ADDRESS:-127.0.0.1}:${BACKEND_PORT:-8000}/health" || HEALTH_FAILURES=$((HEALTH_FAILURES + 1))
check_service "Frontend" "curl -sf http://${BIND_ADDRESS:-127.0.0.1}:${FRONTEND_PORT:-3000}/" || HEALTH_FAILURES=$((HEALTH_FAILURES + 1))

# ---------------------------------------------------------------------------
# Cleanup staging
# ---------------------------------------------------------------------------
rm -rf "${STAGING_DIR}"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
if [[ ${HEALTH_FAILURES} -gt 0 ]]; then
    echo -e "${BOLD}========================================${NC}"
    echo -e "${YELLOW}${BOLD}  Update completed with warnings${NC}"
    echo -e "${BOLD}========================================${NC}"
    echo ""
    echo -e "  ${HEALTH_FAILURES} service(s) failed health check."
    echo ""
    echo -e "  ${BOLD}View logs:${NC}"
    echo "    ${COMPOSE_CMD} -f ${COMPOSE_FILE} logs"
    echo ""
    echo -e "  ${BOLD}Rollback (if needed):${NC}"
    echo "    ${COMPOSE_CMD} -f ${COMPOSE_FILE} down"
    echo "    # Restore database from backup:"
    echo "    gunzip -c ${BACKUP_FILE} | docker exec -i gridwolf-postgres psql -U gridwolf gridwolf"
    echo "    # Re-load previous images and restart"
else
    echo -e "${BOLD}========================================${NC}"
    echo -e "${GREEN}${BOLD}  Update successful!${NC}"
    echo -e "${BOLD}========================================${NC}"
    echo ""
    echo -e "  ${BOLD}Version:${NC}  ${CURRENT_VERSION} -> ${NEW_VERSION}"
    echo -e "  ${BOLD}Backup:${NC}   ${BACKUP_FILE}"
    echo -e "  ${BOLD}Web UI:${NC}   http://${BIND_ADDRESS:-127.0.0.1}:${FRONTEND_PORT:-3000}"
fi
echo ""
