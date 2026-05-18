# ─────────────────────────────────────────────────────────────────────────────
# Gridwolf appliance — Packer template
#
# Builds a Ubuntu 24.04 LTS OVA preloaded with:
#   * Gridwolf (docker compose, pulled from Docker Hub)
#   * Cockpit   (https://<host>:9090)
#
# Build:
#     cd deploy/ova/packer
#     packer init .
#     packer build -var gridwolf_version=1.1.0 gridwolf.pkr.hcl
#
# Output: build/gridwolf-<version>-<date>.ova  (compatible with VMware,
# VirtualBox, Proxmox, Nutanix AHV, KVM via ovftool conversion).
# ─────────────────────────────────────────────────────────────────────────────

packer {
  required_plugins {
    qemu = {
      source  = "github.com/hashicorp/qemu"
      version = "~> 1"
    }
  }
}

variable "gridwolf_version" {
  type    = string
  default = "latest"
}

variable "ubuntu_iso_url" {
  type    = string
  default = "https://releases.ubuntu.com/24.04/ubuntu-24.04.4-live-server-amd64.iso"
}

variable "ubuntu_iso_checksum" {
  type    = string
  # Pinned to 24.04.4 point release. Replaces `file:…/SHA256SUMS` lookup which
  # failed in rc.1 (Packer couldn't parse the `*<filename>` format reliably).
  default = "sha256:e907d92eeec9df64163a7e454cbc8d7755e8ddc7ed42f99dbc80c40f1a138433"
}

variable "disk_size_mb" {
  type    = number
  default = 40960 # 40 GB — fits appliance + 6 months of typical capture data
}

variable "memory_mb" {
  # NOTE: this is build-time memory only. The OVF declares 8192 MB for the
  # production appliance (see deploy/ova/packer/templates/appliance.ovf.tmpl).
  # 4 GB is plenty for the autoinstall + provisioning pass and frees CI runner headroom.
  type    = number
  default = 4096
}

variable "cpus" {
  # Build-time CPU count. Production OVF declares 4 vCPU. 2 is enough for install.
  type    = number
  default = 2
}

locals {
  build_date = formatdate("YYYYMMDD", timestamp())
  vm_name    = "gridwolf-${var.gridwolf_version}-${local.build_date}"
}

source "qemu" "gridwolf" {
  iso_url          = var.ubuntu_iso_url
  iso_checksum     = var.ubuntu_iso_checksum
  output_directory = "build"
  vm_name          = "${local.vm_name}.qcow2"

  disk_size        = var.disk_size_mb
  disk_compression = true
  memory           = var.memory_mb
  cpus             = var.cpus
  format           = "qcow2"
  accelerator      = "kvm"
  headless         = true
  net_device       = "virtio-net"
  disk_interface   = "virtio"

  # Autoinstall via cloud-init (http_directory serves user-data + meta-data).
  # Canonical GRUB edit-entry pattern: select default entry, press `e` to edit,
  # jump to end of `linux` line, append autoinstall args, F10 to boot.
  # `;` is a GRUB statement separator → escape with `\;` so the kernel sees it.
  http_directory          = "http"
  boot_wait               = "10s"
  boot_keygroup_interval  = "150ms"
  boot_command = [
    "<wait3s>",
    "e<wait2s>",
    "<down><down><down><end>",
    " autoinstall ds=nocloud-net\\;s=http://{{ .HTTPIP }}:{{ .HTTPPort }}/",
    "<f10>",
  ]

  shutdown_command = "echo 'gridwolf' | sudo -S shutdown -P now"
  ssh_username     = "gridwolf"
  ssh_password     = "gridwolf" # rotated during provision.sh
  ssh_timeout      = "30m"
}

build {
  sources = ["source.qemu.gridwolf"]

  # Copy the provisioning script onto the VM
  provisioner "file" {
    source      = "../provision.sh"
    destination = "/tmp/provision.sh"
  }

  # Run it
  provisioner "shell" {
    inline = [
      "chmod +x /tmp/provision.sh",
      "sudo GRIDWOLF_VERSION=${var.gridwolf_version} GRIDWOLF_APPLIANCE_BUILD=1 /tmp/provision.sh",
      "sudo rm -f /tmp/provision.sh",
    ]
  }

  # Cleanup before imaging
  provisioner "shell" {
    inline = [
      "sudo cloud-init clean --logs",
      "sudo truncate -s 0 /etc/machine-id",
      "sudo rm -f /var/lib/dbus/machine-id",
      "sudo ln -s /etc/machine-id /var/lib/dbus/machine-id",
      "sudo apt-get clean",
      "sudo fstrim -av || true",
      "sudo dd if=/dev/zero of=/EMPTY bs=1M status=progress || true",
      "sudo rm -f /EMPTY",
    ]
  }

  # Convert qcow2 → OVA via the in-repo assembler (no proprietary ovftool dep).
  # Production hardware sizing (8 GB / 4 vCPU / 40 GB) is declared here, not at
  # build time — the qemu builder runs leaner to keep CI runners happy.
  post-processor "shell-local" {
    inline = [
      "bash ${path.root}/assemble-ova.sh --qcow2 build/${local.vm_name}.qcow2 --name ${local.vm_name} --out-dir build --cpus 4 --memory-mb 8192 --capacity-gb 40",
    ]
  }
}
