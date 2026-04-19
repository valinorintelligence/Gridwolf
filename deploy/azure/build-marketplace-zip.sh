#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Build the Azure Marketplace submission ZIP.
#
# Produces dist/gridwolf-azure-app-<version>.zip containing:
#   - mainTemplate.json       (compiled from gridwolf.bicep)
#   - createUiDefinition.json (source of truth, copied verbatim)
#   - viewDefinition.json     (source of truth, copied verbatim)
#
# Upload the resulting ZIP to Partner Center → Commercial Marketplace →
# <your offer> → Plan overview → Technical configuration → Package file.
#
# Requirements:
#   - az CLI with the bicep extension (`az bicep install`)
#   - zip (apt install zip, brew install zip)
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${HERE}/../.." && pwd)"
DIST_DIR="${REPO_ROOT}/dist"

# Resolve version: argv[1] > git tag > "dev"
VERSION="${1:-}"
if [[ -z "${VERSION}" ]]; then
  VERSION="$(git -C "${REPO_ROOT}" describe --tags --abbrev=0 2>/dev/null || echo "dev")"
  VERSION="${VERSION#v}"  # strip leading v
fi

OUT="${DIST_DIR}/gridwolf-azure-app-${VERSION}.zip"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Building Azure Marketplace package"
echo "  Version : ${VERSION}"
echo "  Output  : ${OUT}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

command -v az  >/dev/null || { echo "✗ az CLI not found. Install from https://learn.microsoft.com/cli/azure/install-azure-cli" >&2; exit 1; }
command -v zip >/dev/null || { echo "✗ zip not found. apt install zip / brew install zip." >&2; exit 1; }

# 1. Compile bicep → ARM
echo "→ Compiling bicep to ARM..."
az bicep build --file "${HERE}/gridwolf.bicep" --outfile "${HERE}/mainTemplate.json"

# 2. Sanity-check the UI definition parses
echo "→ Validating createUiDefinition.json..."
python3 -c "import json, sys; json.load(open('${HERE}/createUiDefinition.json')); print('  ok')" \
  || { echo "✗ createUiDefinition.json is not valid JSON"; exit 1; }

# 3. Assemble the ZIP (flat — Azure rejects nested directories)
echo "→ Assembling ZIP..."
mkdir -p "${DIST_DIR}"
rm -f "${OUT}"
( cd "${HERE}" && zip -j "${OUT}" \
    mainTemplate.json \
    createUiDefinition.json \
    viewDefinition.json )

echo ""
echo "✓ Package built: ${OUT}"
echo ""
echo "Next steps:"
echo "  1. Preview the UI:"
echo "       Open https://portal.azure.com/#blade/Microsoft_Azure_CreateUIDef/SandboxBlade"
echo "       Paste the contents of deploy/azure/createUiDefinition.json"
echo ""
echo "  2. Upload to Partner Center:"
echo "       https://partner.microsoft.com/dashboard/commercial-marketplace"
echo "       Your offer → Plan overview → Technical configuration → Package file"
echo ""
echo "  3. Submit for certification (expect 3–5 business days)."
