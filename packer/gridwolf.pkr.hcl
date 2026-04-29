# ─────────────────────────────────────────────────────────────────────────────
# Gridwolf — Packer build definition
#
# Produces:
#   output/gridwolf-<version>-amd64.ova   (VMware ESXi / Workstation / VirtualBox)
#
# Requirements (build machine):
#   packer >= 1.11       https://developer.hashicorp.com/packer/install
#   VirtualBox >= 7.0    (for virtualbox-iso builder)
#   Docker               (to pre-pull images into the OVA)
#
# Usage:
#   export GRIDWOLF_VERSION=v1.1.0
#   packer init .
#   packer build -var "gridwolf_version=$GRIDWOLF_VERSION" .
# ─────────────────────────────────────────────────────────────────────────────

packer {
  required_version = ">= 1.11.0"
  required_plugins {
    virtualbox = {
      source  = "github.com/hashicorp/virtualbox"
      version = "~> 1"
    }
  }
}

# ── Variables ─────────────────────────────────────────────────────────────────
variable "gridwolf_version" {
  type    = string
  default = "latest"
}

variable "registry_namespace" {
  type    = string
  default = "ghcr.io/valinorintelligence/gridwolf"
}

variable "vm_cpus" {
  type    = number
  default = 2
}

variable "vm_memory_mb" {
  type    = number
  default = 4096
}

variable "disk_size_mb" {
  type    = number
  default = 20480   # 20 GB — comfortable with images + data
}

variable "ssh_password" {
  type      = string
  default   = "gridwolf"
  sensitive = true
}

# ── Ubuntu 24.04 LTS autoinstall ──────────────────────────────────────────────
locals {
  iso_url      = "https://releases.ubuntu.com/24.04/ubuntu-24.04.2-live-server-amd64.iso"
  iso_checksum = "file:https://releases.ubuntu.com/24.04/SHA256SUMS"
  vm_name      = "gridwolf-${var.gridwolf_version}"
}

source "virtualbox-iso" "gridwolf" {
  vm_name              = local.vm_name
  iso_url              = local.iso_url
  iso_checksum         = local.iso_checksum

  cpus                 = var.vm_cpus
  memory               = var.vm_memory_mb
  disk_size            = var.disk_size_mb
  guest_os_type        = "Ubuntu_64"
  headless             = true

  # Ubuntu 24.04 autoinstall served by Packer's HTTP mini-server
  http_directory       = "${path.root}/http"
  boot_command = [
    "<wait3>",
    "c",
    "linux /casper/vmlinuz --- autoinstall ds=nocloud-net;seedfrom=http://{{.HTTPIP}}:{{.HTTPPort}}/ quiet<enter><wait>",
    "initrd /casper/initrd<enter><wait>",
    "boot<enter>"
  ]
  boot_wait            = "5s"

  ssh_username         = "gridwolf"
  ssh_password         = var.ssh_password
  ssh_timeout          = "30m"
  ssh_port             = 22

  shutdown_command     = "echo '${var.ssh_password}' | sudo -S shutdown -P now"

  # Export as OVF 1.0 — compatible with VMware ESXi, Workstation, VirtualBox
  format               = "ova"
  export_opts = [
    "--manifest",
    "--vsys", "0",
    "--description", "Gridwolf ICS/OT Security Platform ${var.gridwolf_version}",
    "--version", var.gridwolf_version,
  ]

  vboxmanage = [
    ["modifyvm", "{{.Name}}", "--nat-localhostreachable1", "on"],
    ["modifyvm", "{{.Name}}", "--audio", "none"],
    ["modifyvm", "{{.Name}}", "--usb",   "off"],
  ]

  output_directory = "${path.root}/../output"
}

# ── Build steps ───────────────────────────────────────────────────────────────
build {
  name    = "gridwolf-ova"
  sources = ["source.virtualbox-iso.gridwolf"]

  # 1 — system hardening + Docker
  provisioner "shell" {
    script          = "${path.root}/scripts/01-install-docker.sh"
    execute_command = "echo '${var.ssh_password}' | sudo -S bash {{.Path}}"
  }

  # 2 — pull Gridwolf images + install compose stack
  provisioner "shell" {
    environment_vars = [
      "REGISTRY_NAMESPACE=${var.registry_namespace}",
      "GRIDWOLF_VERSION=${var.gridwolf_version}",
    ]
    script          = "${path.root}/scripts/02-install-gridwolf.sh"
    execute_command = "echo '${var.ssh_password}' | sudo -S bash {{.Path}}"
  }

  # 3 — install first-boot wizard + systemd services
  provisioner "shell" {
    script          = "${path.root}/scripts/03-first-boot-setup.sh"
    execute_command = "echo '${var.ssh_password}' | sudo -S bash {{.Path}}"
  }

  # 4 — clean up build artefacts, cloud-init, bash history
  provisioner "shell" {
    inline = [
      "sudo apt-get autoremove -y",
      "sudo apt-get clean",
      "sudo rm -rf /tmp/* /var/tmp/*",
      "sudo truncate -s 0 /etc/machine-id",
      "sudo rm -f /var/lib/dbus/machine-id",
      "sudo ln -sf /etc/machine-id /var/lib/dbus/machine-id",
      "sudo cloud-init clean --logs",
      "cat /dev/null > ~/.bash_history",
      "history -c",
    ]
  }
}
