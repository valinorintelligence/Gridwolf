// ─────────────────────────────────────────────────────────────────────────────
// Gridwolf ICS/OT Security Platform — Azure VM deployment
//
// Deploy:
//   az group create -n gridwolf-rg -l eastus
//   az deployment group create \
//     -g gridwolf-rg \
//     -f gridwolf.bicep \
//     -p adminPasswordOrKey='<your-ssh-pub-key>' \
//        gridwolfVersion='v0.9.8'
// ─────────────────────────────────────────────────────────────────────────────

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('VM size. Standard_D2s_v3 (2 vCPU, 8 GB) recommended for standard use.')
@allowed([
  'Standard_B2s'
  'Standard_D2s_v3'
  'Standard_D4s_v3'
  'Standard_F4s_v2'
])
param vmSize string = 'Standard_D2s_v3'

@description('SSH public key or password for the gridwolf admin account')
@secure()
param adminPasswordOrKey string

@description('Authentication type: sshPublicKey or password')
@allowed(['sshPublicKey', 'password'])
param authenticationType string = 'sshPublicKey'

@description('Docker Hub image tag (e.g. v0.9.8 or latest)')
param gridwolfVersion string = 'latest'

@description('Container image registry/namespace prefix (suffixed with -backend / -frontend)')
param imageRegistry string = 'ghcr.io/valinorintelligence/gridwolf'

@description('Data disk size in GB')
param dataDiskSizeGB int = 64

// ── Computed names ─────────────────────────────────────────────────────────
var prefix       = 'gridwolf'
var vmName       = '${prefix}-vm'
var nicName      = '${prefix}-nic'
var pipName      = '${prefix}-pip'
var nsgName      = '${prefix}-nsg'
var vnetName     = '${prefix}-vnet'
var subnetName   = '${prefix}-subnet'
var diskName     = '${prefix}-data-disk'
var adminUser    = 'gridwolf'

var linuxConfig = {
  disablePasswordAuthentication: authenticationType == 'sshPublicKey'
  ssh: {
    publicKeys: authenticationType == 'sshPublicKey' ? [
      {
        path: '/home/${adminUser}/.ssh/authorized_keys'
        keyData: adminPasswordOrKey
      }
    ] : null
  }
}

// ── Network ────────────────────────────────────────────────────────────────
resource nsg 'Microsoft.Network/networkSecurityGroups@2023-09-01' = {
  name: nsgName
  location: location
  properties: {
    securityRules: [
      {
        name: 'allow-http'
        properties: {
          priority: 100
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '80'
          description: 'Gridwolf web UI'
        }
      }
      {
        name: 'allow-https'
        properties: {
          priority: 110
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '443'
          description: 'HTTPS (when TLS configured)'
        }
      }
      {
        name: 'allow-ssh'
        properties: {
          priority: 120
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '22'
          description: 'SSH admin access'
        }
      }
    ]
  }
}

resource vnet 'Microsoft.Network/virtualNetworks@2023-09-01' = {
  name: vnetName
  location: location
  properties: {
    addressSpace: { addressPrefixes: ['10.0.0.0/16'] }
    subnets: [
      {
        name: subnetName
        properties: {
          addressPrefix: '10.0.0.0/24'
          networkSecurityGroup: { id: nsg.id }
        }
      }
    ]
  }
}

resource pip 'Microsoft.Network/publicIPAddresses@2023-09-01' = {
  name: pipName
  location: location
  sku: { name: 'Standard' }
  properties: {
    publicIPAllocationMethod: 'Static'
    dnsSettings: {
      domainNameLabel: '${prefix}-${uniqueString(resourceGroup().id)}'
    }
  }
}

resource nic 'Microsoft.Network/networkInterfaces@2023-09-01' = {
  name: nicName
  location: location
  properties: {
    ipConfigurations: [
      {
        name: 'ipconfig1'
        properties: {
          subnet: { id: '${vnet.id}/subnets/${subnetName}' }
          publicIPAddress: { id: pip.id }
          privateIPAllocationMethod: 'Dynamic'
        }
      }
    ]
  }
}

// ── Data disk ──────────────────────────────────────────────────────────────
resource dataDisk 'Microsoft.Compute/disks@2023-10-02' = {
  name: diskName
  location: location
  sku: { name: 'Premium_LRS' }
  properties: {
    diskSizeGB: dataDiskSizeGB
    creationData: { createOption: 'Empty' }
    encryption: { type: 'EncryptionAtRestWithPlatformKey' }
  }
}

// ── Virtual Machine ────────────────────────────────────────────────────────
resource vm 'Microsoft.Compute/virtualMachines@2023-09-01' = {
  name: vmName
  location: location
  properties: {
    hardwareProfile: { vmSize: vmSize }
    osProfile: {
      computerName: vmName
      adminUsername: adminUser
      adminPassword: authenticationType == 'password' ? adminPasswordOrKey : null
      linuxConfiguration: linuxConfig
      customData: base64('''#!/bin/bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

# Mount data disk
DATA_DEV=/dev/sdc
DATA_MOUNT=/opt/gridwolf/data
if ! blkid "$DATA_DEV" &>/dev/null; then
  mkfs.ext4 -L gridwolf-data "$DATA_DEV"
fi
mkdir -p "$DATA_MOUNT"
echo "LABEL=gridwolf-data $DATA_MOUNT ext4 defaults,nofail 0 2" >> /etc/fstab
mount -a

# Install Docker
curl -fsSL https://get.docker.com | bash
systemctl enable --now docker

# Generate secrets
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(64))")
POSTGRES_PASS=$(openssl rand -hex 32)
PUBLIC_IP=$(curl -sf http://169.254.169.254/metadata/instance/network/interface/0/ipv4/ipAddress/0/publicIpAddress?api-version=2021-02-01&format=text || hostname -I | awk '{print $1}')

# Install Gridwolf
INSTALL_DIR=/opt/gridwolf
mkdir -p "$INSTALL_DIR"/{data/uploads,data/reports,data/postgres}

cat > "$INSTALL_DIR/.env" <<EOF
GRIDWOLF_SECRET_KEY=${SECRET_KEY}
POSTGRES_PASSWORD=${POSTGRES_PASS}
GRIDWOLF_CORS_ORIGINS=["http://${PUBLIC_IP}","https://${PUBLIC_IP}"]
GRIDWOLF_UPLOAD_DIR=/data/uploads
GRIDWOLF_REPORTS_DIR=/data/reports
GRIDWOLF_DEBUG=false
EOF
chmod 600 "$INSTALL_DIR/.env"

docker pull ${imageRegistry}-backend:${gridwolfVersion}
docker pull ${imageRegistry}-frontend:${gridwolfVersion}
docker pull postgres:16-alpine redis:7-alpine

curl -fsSL https://raw.githubusercontent.com/valinorintelligence/Gridwolf/main/docker-compose.hub.yml \
  -o "$INSTALL_DIR/docker-compose.yml"
cd "$INSTALL_DIR" && docker compose --env-file .env up -d
''')
    }
    storageProfile: {
      imageReference: {
        publisher: 'canonical'
        offer:     '0001-com-ubuntu-server-jammy'
        sku:       '24_04-lts-gen2'
        version:   'latest'
      }
      osDisk: {
        createOption:            'FromImage'
        managedDisk:             { storageAccountType: 'Premium_LRS' }
        diskSizeGB:              30
        deleteOption:            'Delete'
      }
      dataDisks: [
        {
          lun:          0
          createOption: 'Attach'
          managedDisk:  { id: dataDisk.id }
          deleteOption: 'Detach'
        }
      ]
    }
    networkProfile: {
      networkInterfaces: [{ id: nic.id }]
    }
  }
}

// ── Outputs ────────────────────────────────────────────────────────────────
output publicIp string       = pip.properties.ipAddress
output fqdn string           = pip.properties.dnsSettings.fqdn
output webUI string          = 'http://${pip.properties.ipAddress}'
output apiDocs string        = 'http://${pip.properties.ipAddress}/api/docs'
output sshCommand string     = 'ssh ${adminUser}@${pip.properties.ipAddress}'
