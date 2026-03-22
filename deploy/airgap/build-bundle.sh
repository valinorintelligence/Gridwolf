#!/usr/bin/env bash
# =============================================================================
# Gridwolf Air-Gap Bundle Builder
# =============================================================================
# Run this script on an internet-connected build machine to produce a single
# transferable bundle for air-gapped deployment.
#
# Usage:  ./build-bundle.sh [--tag VERSION]
# Output: gridwolf-airgap-bundle.tar.gz
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
VERSION=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --tag)
            VERSION="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [--tag VERSION]"
            echo ""
            echo "Options:"
            echo "  --tag VERSION   Set the version tag (default: git describe or timestamp)"
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
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BUILD_DIR="${PROJECT_ROOT}/build/airgap-bundle"
BUNDLE_NAME="gridwolf-airgap-bundle"

# Determine version
if [[ -z "${VERSION}" ]]; then
    if git -C "${PROJECT_ROOT}" describe --tags --always 2>/dev/null; then
        VERSION="$(git -C "${PROJECT_ROOT}" describe --tags --always 2>/dev/null)"
    else
        VERSION="$(date +%Y%m%d-%H%M%S)"
    fi
fi

echo ""
echo -e "${BOLD}========================================${NC}"
echo -e "${BOLD}  Gridwolf Air-Gap Bundle Builder${NC}"
echo -e "${BOLD}  Version: ${VERSION}${NC}"
echo -e "${BOLD}========================================${NC}"

# ---------------------------------------------------------------------------
# Preflight checks
# ---------------------------------------------------------------------------
step "Preflight checks"

command -v docker >/dev/null 2>&1 || error "Docker is not installed or not in PATH."
docker info >/dev/null 2>&1     || error "Docker daemon is not running."
command -v sha256sum >/dev/null 2>&1 || command -v shasum >/dev/null 2>&1 || error "Neither sha256sum nor shasum found."

# Checksum function that works on both Linux and macOS
calc_sha256() {
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$1"
    else
        shasum -a 256 "$1"
    fi
}

success "Docker is available and running."

# ---------------------------------------------------------------------------
# Clean and prepare build directory
# ---------------------------------------------------------------------------
step "Preparing build directory"

rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"
success "Build directory created: ${BUILD_DIR}"

# ---------------------------------------------------------------------------
# Build Docker images
# ---------------------------------------------------------------------------
step "Building frontend Docker image"

docker build \
    -t gridwolf-frontend:latest \
    -t "gridwolf-frontend:${VERSION}" \
    -f "${PROJECT_ROOT}/Dockerfile.frontend" \
    "${PROJECT_ROOT}"

success "Frontend image built."

step "Building backend Docker image"

docker build \
    -t gridwolf-backend:latest \
    -t "gridwolf-backend:${VERSION}" \
    -f "${PROJECT_ROOT}/Dockerfile.backend" \
    "${PROJECT_ROOT}"

success "Backend image built."

# ---------------------------------------------------------------------------
# Pull base images
# ---------------------------------------------------------------------------
step "Pulling base images"

docker pull postgres:16-alpine
docker pull redis:7-alpine
success "Base images pulled."

# ---------------------------------------------------------------------------
# Export images to tarball
# ---------------------------------------------------------------------------
step "Exporting Docker images to tarball"

IMAGES_TAR="${BUILD_DIR}/gridwolf-images.tar"

docker save \
    gridwolf-frontend:latest \
    "gridwolf-frontend:${VERSION}" \
    gridwolf-backend:latest \
    "gridwolf-backend:${VERSION}" \
    postgres:16-alpine \
    redis:7-alpine \
    -o "${IMAGES_TAR}"

info "Images tarball size: $(du -h "${IMAGES_TAR}" | cut -f1)"
success "Docker images exported."

# ---------------------------------------------------------------------------
# Copy deployment files
# ---------------------------------------------------------------------------
step "Assembling bundle contents"

cp "${SCRIPT_DIR}/docker-compose.airgap.yml" "${BUILD_DIR}/docker-compose.airgap.yml"
cp "${SCRIPT_DIR}/.env.template"             "${BUILD_DIR}/.env.template"
cp "${SCRIPT_DIR}/load-and-run.sh"           "${BUILD_DIR}/load-and-run.sh"
cp "${SCRIPT_DIR}/update-bundle.sh"          "${BUILD_DIR}/update-bundle.sh"

chmod +x "${BUILD_DIR}/load-and-run.sh"
chmod +x "${BUILD_DIR}/update-bundle.sh"

# Copy seed script if it exists
if [[ -f "${PROJECT_ROOT}/backend/app/seed.py" ]]; then
    cp "${PROJECT_ROOT}/backend/app/seed.py" "${BUILD_DIR}/seed.py"
    success "Seed script included."
else
    warn "No seed script found at backend/app/seed.py — skipping."
fi

# Version metadata
cat > "${BUILD_DIR}/VERSION" <<VEOF
version=${VERSION}
build_date=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
build_host=$(hostname)
git_sha=$(git -C "${PROJECT_ROOT}" rev-parse --short HEAD 2>/dev/null || echo "unknown")
git_branch=$(git -C "${PROJECT_ROOT}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
VEOF

success "Bundle contents assembled."

# ---------------------------------------------------------------------------
# Generate checksums
# ---------------------------------------------------------------------------
step "Generating checksums"

cd "${BUILD_DIR}"
calc_sha256 gridwolf-images.tar          > checksums.sha256
calc_sha256 docker-compose.airgap.yml   >> checksums.sha256
calc_sha256 .env.template               >> checksums.sha256
calc_sha256 load-and-run.sh             >> checksums.sha256
calc_sha256 update-bundle.sh            >> checksums.sha256
calc_sha256 VERSION                     >> checksums.sha256

success "Checksums written to checksums.sha256."

# ---------------------------------------------------------------------------
# Create final compressed bundle
# ---------------------------------------------------------------------------
step "Creating compressed bundle"

cd "${PROJECT_ROOT}/build"
tar czf "${BUNDLE_NAME}.tar.gz" -C "${BUILD_DIR}" .

BUNDLE_PATH="${PROJECT_ROOT}/build/${BUNDLE_NAME}.tar.gz"
BUNDLE_SIZE="$(du -h "${BUNDLE_PATH}" | cut -f1)"

# Checksum of the final bundle
BUNDLE_CHECKSUM="$(calc_sha256 "${BUNDLE_PATH}" | awk '{print $1}')"

success "Bundle created: ${BUNDLE_PATH}"

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
rm -rf "${BUILD_DIR}"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}========================================${NC}"
echo -e "${GREEN}${BOLD}  Bundle built successfully!${NC}"
echo -e "${BOLD}========================================${NC}"
echo ""
echo -e "  ${BOLD}File:${NC}     ${BUNDLE_PATH}"
echo -e "  ${BOLD}Size:${NC}     ${BUNDLE_SIZE}"
echo -e "  ${BOLD}Version:${NC}  ${VERSION}"
echo -e "  ${BOLD}SHA256:${NC}   ${BUNDLE_CHECKSUM}"
echo ""
echo -e "${BOLD}Transfer Instructions:${NC}"
echo ""
echo "  1. Copy the bundle to a USB drive:"
echo "     cp ${BUNDLE_PATH} /media/usb/"
echo ""
echo "  2. Record this checksum for verification on the target host:"
echo "     ${BUNDLE_CHECKSUM}"
echo ""
echo "  3. On the air-gapped host:"
echo "     tar xzf ${BUNDLE_NAME}.tar.gz"
echo "     cd gridwolf-airgap"
echo "     ./load-and-run.sh"
echo ""
