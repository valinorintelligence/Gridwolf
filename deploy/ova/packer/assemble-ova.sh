#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# assemble-ova.sh — turn a Packer qcow2 into a portable .ova
#
# Lowest-common-denominator OVA: streamOptimized vmdk + hand-rendered OVF 1.0
# envelope + SHA-256 manifest, tarred in the order mandated by DMTF DSP0243
# (ovf first, mf second, disk last).  Accepted by VMware Workstation/ESXi 8,
# VirtualBox 7, and Proxmox VE 8 without manual edits.  No dependency on the
# proprietary VMware ovftool.
#
# Usage:
#   assemble-ova.sh \
#     --qcow2 build/gridwolf-1.1.0-20260422.qcow2 \
#     --name  gridwolf-1.1.0-20260422 \
#     --out-dir build \
#     --cpus 4 --memory-mb 8192 --capacity-gb 40
#
# Required tools on PATH: qemu-img, sha256sum, tar, sed, stat, awk
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

QCOW2=""
NAME=""
OUT_DIR=""
CPUS=4
MEMORY_MB=8192
CAPACITY_GB=40

while [[ $# -gt 0 ]]; do
  case "$1" in
    --qcow2)       QCOW2="$2";       shift 2 ;;
    --name)        NAME="$2";        shift 2 ;;
    --out-dir)     OUT_DIR="$2";     shift 2 ;;
    --cpus)        CPUS="$2";        shift 2 ;;
    --memory-mb)   MEMORY_MB="$2";   shift 2 ;;
    --capacity-gb) CAPACITY_GB="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

for v in QCOW2 NAME OUT_DIR; do
  if [[ -z "${!v}" ]]; then
    echo "missing required --${v,,} argument" >&2
    exit 2
  fi
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="${SCRIPT_DIR}/templates/appliance.ovf.tmpl"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "OVF template not found at $TEMPLATE" >&2
  exit 1
fi
if [[ ! -f "$QCOW2" ]]; then
  echo "qcow2 source not found at $QCOW2" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

VMDK_NAME="${NAME}-disk1.vmdk"
OVF_NAME="${NAME}.ovf"
MF_NAME="${NAME}.mf"
OVA_PATH="${OUT_DIR}/${NAME}.ova"

echo "==> Converting qcow2 → streamOptimized vmdk"
qemu-img convert -p -O vmdk \
  -o subformat=streamOptimized,adapter_type=lsilogic \
  "$QCOW2" "${STAGE}/${VMDK_NAME}"

DISK_SIZE="$(stat -c '%s' "${STAGE}/${VMDK_NAME}")"
CAPACITY_BYTES=$(( CAPACITY_GB * 1024 * 1024 * 1024 ))

echo "==> Rendering OVF descriptor"
sed \
  -e "s|@VM_NAME@|${NAME}|g" \
  -e "s|@DISK_FILE@|${VMDK_NAME}|g" \
  -e "s|@DISK_SIZE@|${DISK_SIZE}|g" \
  -e "s|@CAPACITY@|${CAPACITY_BYTES}|g" \
  -e "s|@CPUS@|${CPUS}|g" \
  -e "s|@MEMORY_MB@|${MEMORY_MB}|g" \
  "$TEMPLATE" > "${STAGE}/${OVF_NAME}"

echo "==> Generating manifest (SHA-256)"
# OVF 1.0 §7.1 manifest line format: `SHA256(file)= <hex>`  (note the space)
(
  cd "$STAGE"
  for f in "$OVF_NAME" "$VMDK_NAME"; do
    hex="$(sha256sum "$f" | awk '{print $1}')"
    printf 'SHA256(%s)= %s\n' "$f" "$hex"
  done
) > "${STAGE}/${MF_NAME}"

echo "==> Tarring OVA (ovf, mf, vmdk — order matters)"
tar --format=ustar -cf "$OVA_PATH" \
  -C "$STAGE" "$OVF_NAME" "$MF_NAME" "$VMDK_NAME"

echo "==> Hashing final artifact"
( cd "$OUT_DIR" && sha256sum "${NAME}.ova" > "${NAME}.ova.sha256" )

echo "==> Done: $OVA_PATH"
ls -lh "$OVA_PATH" "${OVA_PATH}.sha256"
