import type { ObjectTypeDefinition, OntologyObject, ObjectLink, ObjectAction, GraphData } from '@/types/ontology';
import type { DashboardStats, AuditEvent } from '@/types/api';

// ---------------------------------------------------------------------------
// Object Type Definitions
// ---------------------------------------------------------------------------

export const OBJECT_TYPE_DEFINITIONS: ObjectTypeDefinition[] = [
  {
    id: 'type-host',
    name: 'Host',
    icon: 'Server',
    color: '#3b82f6',
    description: 'Physical or virtual hosts on the OT/IT network',
    propertiesSchema: [
      { key: 'ip', label: 'IP Address', type: 'string', required: true },
      { key: 'hostname', label: 'Hostname', type: 'string', required: false },
      { key: 'os', label: 'Operating System', type: 'string', required: false },
      { key: 'purdueLevel', label: 'Purdue Level', type: 'enum', required: false, enumValues: ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'DMZ'] },
      { key: 'vendor', label: 'Vendor', type: 'string', required: false },
      { key: 'model', label: 'Model', type: 'string', required: false },
      { key: 'lastSeen', label: 'Last Seen', type: 'date', required: false },
    ],
    createdAt: '2024-01-15T08:00:00Z',
  },
  {
    id: 'type-vuln',
    name: 'Vulnerability',
    icon: 'ShieldAlert',
    color: '#dc2626',
    description: 'Security vulnerabilities discovered across the environment',
    propertiesSchema: [
      { key: 'cveId', label: 'CVE ID', type: 'string', required: false },
      { key: 'cvssScore', label: 'CVSS Score', type: 'number', required: false },
      { key: 'description', label: 'Description', type: 'string', required: false },
      { key: 'scanner', label: 'Scanner', type: 'string', required: false },
      { key: 'filePath', label: 'File Path', type: 'string', required: false },
      { key: 'lineNumber', label: 'Line Number', type: 'number', required: false },
      { key: 'remediation', label: 'Remediation', type: 'string', required: false },
    ],
    createdAt: '2024-01-15T08:00:00Z',
  },
  {
    id: 'type-flow',
    name: 'NetworkFlow',
    icon: 'Network',
    color: '#8b5cf6',
    description: 'Observed network traffic flows between hosts',
    propertiesSchema: [
      { key: 'srcIp', label: 'Source IP', type: 'string', required: true },
      { key: 'dstIp', label: 'Destination IP', type: 'string', required: true },
      { key: 'protocol', label: 'Protocol', type: 'string', required: false },
      { key: 'srcPort', label: 'Source Port', type: 'number', required: false },
      { key: 'dstPort', label: 'Destination Port', type: 'number', required: false },
      { key: 'bytes', label: 'Bytes', type: 'number', required: false },
      { key: 'packets', label: 'Packets', type: 'number', required: false },
    ],
    createdAt: '2024-01-15T08:00:00Z',
  },
  {
    id: 'type-protocol',
    name: 'Protocol',
    icon: 'Cpu',
    color: '#06b6d4',
    description: 'Network and industrial communication protocols',
    propertiesSchema: [
      { key: 'name', label: 'Name', type: 'string', required: true },
      { key: 'layer', label: 'OSI Layer', type: 'enum', required: false, enumValues: ['L2', 'L3', 'L4', 'L7'] },
      { key: 'isIcs', label: 'ICS Protocol', type: 'boolean', required: false },
      { key: 'port', label: 'Default Port', type: 'number', required: false },
    ],
    createdAt: '2024-01-15T08:00:00Z',
  },
  {
    id: 'type-product',
    name: 'Product',
    icon: 'Package',
    color: '#10b981',
    description: 'Software products deployed in the environment',
    propertiesSchema: [
      { key: 'name', label: 'Name', type: 'string', required: true },
      { key: 'version', label: 'Version', type: 'string', required: false },
      { key: 'type', label: 'Type', type: 'enum', required: false, enumValues: ['web', 'api', 'mobile', 'iot', 'ics'] },
      { key: 'riskScore', label: 'Risk Score', type: 'number', required: false },
      { key: 'owner', label: 'Owner', type: 'string', required: false },
    ],
    createdAt: '2024-01-15T08:00:00Z',
  },
  {
    id: 'type-scanner',
    name: 'Scanner',
    icon: 'Scan',
    color: '#f59e0b',
    description: 'Security scanning tools and their configurations',
    propertiesSchema: [
      { key: 'name', label: 'Name', type: 'string', required: true },
      { key: 'type', label: 'Type', type: 'enum', required: false, enumValues: ['sast', 'dast', 'sca', 'iac', 'secrets'] },
      { key: 'lastRun', label: 'Last Run', type: 'date', required: false },
      { key: 'findingCount', label: 'Finding Count', type: 'number', required: false },
    ],
    createdAt: '2024-01-15T08:00:00Z',
  },
  {
    id: 'type-attack-path',
    name: 'AttackPath',
    icon: 'Route',
    color: '#ef4444',
    description: 'Modeled attack paths through the environment',
    propertiesSchema: [
      { key: 'name', label: 'Name', type: 'string', required: true },
      { key: 'blastRadius', label: 'Blast Radius', type: 'number', required: false },
      { key: 'steps', label: 'Steps', type: 'number', required: false },
      { key: 'riskScore', label: 'Risk Score', type: 'number', required: false },
    ],
    createdAt: '2024-01-15T08:00:00Z',
  },
  {
    id: 'type-compliance',
    name: 'ComplianceControl',
    icon: 'ClipboardCheck',
    color: '#6366f1',
    description: 'Compliance framework controls and their status',
    propertiesSchema: [
      { key: 'framework', label: 'Framework', type: 'enum', required: false, enumValues: ['IEC-62443', 'NIST-800-82', 'OWASP', 'PCI-DSS', 'NERC-CIP'] },
      { key: 'controlId', label: 'Control ID', type: 'string', required: true },
      { key: 'title', label: 'Title', type: 'string', required: false },
      { key: 'status', label: 'Status', type: 'enum', required: false, enumValues: ['pass', 'fail', 'na', 'partial'] },
    ],
    createdAt: '2024-01-15T08:00:00Z',
  },
  {
    id: 'type-component',
    name: 'Component',
    icon: 'Component',
    color: '#14b8a6',
    description: 'Software components and dependencies (SBOM)',
    propertiesSchema: [
      { key: 'packageName', label: 'Package Name', type: 'string', required: true },
      { key: 'version', label: 'Version', type: 'string', required: false },
      { key: 'license', label: 'License', type: 'string', required: false },
      { key: 'isVulnerable', label: 'Vulnerable', type: 'boolean', required: false },
      { key: 'ecosystem', label: 'Ecosystem', type: 'enum', required: false, enumValues: ['npm', 'pip', 'maven', 'cargo'] },
    ],
    createdAt: '2024-01-15T08:00:00Z',
  },
  {
    id: 'type-user',
    name: 'Identity',
    icon: 'User',
    color: '#a855f7',
    description: 'User identities and service accounts',
    propertiesSchema: [
      { key: 'username', label: 'Username', type: 'string', required: true },
      { key: 'role', label: 'Role', type: 'string', required: false },
      { key: 'lastActive', label: 'Last Active', type: 'date', required: false },
      { key: 'department', label: 'Department', type: 'string', required: false },
    ],
    createdAt: '2024-01-15T08:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Mock Objects (~50 instances)
// ---------------------------------------------------------------------------

export const MOCK_OBJECTS: OntologyObject[] = [
  // ── Hosts (8) ──────────────────────────────────────────────────────────
  {
    id: 'h-001', typeId: 'type-host', typeName: 'Host',
    title: 'PLC-SIEMENS-01',
    properties: { ip: '10.1.1.10', hostname: 'plc-s7-1500', os: 'Siemens SIMATIC', purdueLevel: 'L1', vendor: 'Siemens', model: 'S7-1500', lastSeen: '2024-12-18T14:30:00Z' },
    status: 'active', createdAt: '2024-03-01T10:00:00Z', updatedAt: '2024-12-18T14:30:00Z',
  },
  {
    id: 'h-002', typeId: 'type-host', typeName: 'Host',
    title: 'HMI-ROCKWELL-01',
    properties: { ip: '10.1.2.20', hostname: 'hmi-panelview', os: 'Windows 10 LTSC', purdueLevel: 'L2', vendor: 'Rockwell', model: 'PanelView Plus 7', lastSeen: '2024-12-18T14:25:00Z' },
    status: 'active', createdAt: '2024-03-01T10:00:00Z', updatedAt: '2024-12-18T14:25:00Z',
  },
  {
    id: 'h-003', typeId: 'type-host', typeName: 'Host',
    title: 'EWS-SCHNEIDER-01',
    properties: { ip: '10.1.3.15', hostname: 'ews-unity-pro', os: 'Windows 11', purdueLevel: 'L3', vendor: 'Schneider Electric', model: 'Engineering Workstation', lastSeen: '2024-12-18T13:00:00Z' },
    status: 'active', createdAt: '2024-03-15T09:00:00Z', updatedAt: '2024-12-18T13:00:00Z',
  },
  {
    id: 'h-004', typeId: 'type-host', typeName: 'Host',
    title: 'HISTORIAN-01',
    properties: { ip: '10.1.4.100', hostname: 'historian-srv', os: 'Windows Server 2022', purdueLevel: 'L3', vendor: 'Honeywell', model: 'Uniformance PHD', lastSeen: '2024-12-18T14:28:00Z' },
    status: 'active', createdAt: '2024-02-20T08:00:00Z', updatedAt: '2024-12-18T14:28:00Z',
  },
  {
    id: 'h-005', typeId: 'type-host', typeName: 'Host',
    title: 'RTU-ABB-01',
    properties: { ip: '192.168.1.50', hostname: 'rtu-560', os: 'ABB RTU560 Firmware', purdueLevel: 'L1', vendor: 'ABB', model: 'RTU560', lastSeen: '2024-12-18T14:10:00Z' },
    status: 'active', createdAt: '2024-04-10T07:30:00Z', updatedAt: '2024-12-18T14:10:00Z',
  },
  {
    id: 'h-006', typeId: 'type-host', typeName: 'Host',
    title: 'FIREWALL-DMZ-01',
    properties: { ip: '192.168.100.1', hostname: 'fw-dmz-paloalto', os: 'PAN-OS 11.1', purdueLevel: 'DMZ', vendor: 'Palo Alto', model: 'PA-3260', lastSeen: '2024-12-18T14:32:00Z' },
    status: 'active', createdAt: '2024-01-20T06:00:00Z', updatedAt: '2024-12-18T14:32:00Z',
  },
  {
    id: 'h-007', typeId: 'type-host', typeName: 'Host',
    title: 'SCADA-SERVER-01',
    properties: { ip: '10.1.2.50', hostname: 'scada-ignition', os: 'Ubuntu 22.04', purdueLevel: 'L2', vendor: 'Inductive Automation', model: 'Ignition 8.1', lastSeen: '2024-12-18T14:31:00Z' },
    status: 'active', createdAt: '2024-02-05T09:00:00Z', updatedAt: '2024-12-18T14:31:00Z',
  },
  {
    id: 'h-008', typeId: 'type-host', typeName: 'Host',
    title: 'SENSOR-GATEWAY-01',
    properties: { ip: '192.168.1.200', hostname: 'iot-gw-01', os: 'Linux 5.15', purdueLevel: 'L0', vendor: 'Siemens', model: 'IOT2050', lastSeen: '2024-12-18T12:45:00Z' },
    status: 'active', createdAt: '2024-05-12T11:00:00Z', updatedAt: '2024-12-18T12:45:00Z',
  },

  // ── Vulnerabilities (10) ───────────────────────────────────────────────
  {
    id: 'v-001', typeId: 'type-vuln', typeName: 'Vulnerability',
    title: 'Siemens S7-1500 Authentication Bypass',
    properties: { cveId: 'CVE-2024-38876', cvssScore: 9.8, description: 'Critical authentication bypass in Siemens S7-1500 PLC firmware allows unauthenticated remote code execution', scanner: 'Nessus', remediation: 'Update to firmware v3.1.2 or later' },
    status: 'active', severity: 'critical', createdAt: '2024-11-20T10:00:00Z', updatedAt: '2024-12-15T08:00:00Z',
  },
  {
    id: 'v-002', typeId: 'type-vuln', typeName: 'Vulnerability',
    title: 'Modbus TCP Lack of Authentication',
    properties: { cveId: 'CVE-2024-32015', cvssScore: 8.6, description: 'Modbus TCP protocol implementation lacks authentication allowing unauthorized read/write of coils and registers', scanner: 'Nuclei', remediation: 'Deploy Modbus/TCP security proxy or migrate to OPC UA' },
    status: 'active', severity: 'high', createdAt: '2024-10-05T09:00:00Z', updatedAt: '2024-12-10T12:00:00Z',
  },
  {
    id: 'v-003', typeId: 'type-vuln', typeName: 'Vulnerability',
    title: 'Hardcoded Credentials in HMI Application',
    properties: { cveId: 'CVE-2024-29104', cvssScore: 9.1, description: 'Hardcoded service account credentials found in HMI configuration file', scanner: 'Semgrep', filePath: '/opt/hmi/config/auth.xml', lineNumber: 42, remediation: 'Remove hardcoded credentials and use secrets management' },
    status: 'active', severity: 'critical', createdAt: '2024-09-18T14:00:00Z', updatedAt: '2024-12-12T09:30:00Z',
  },
  {
    id: 'v-004', typeId: 'type-vuln', typeName: 'Vulnerability',
    title: 'DNP3 Buffer Overflow in RTU Firmware',
    properties: { cveId: 'CVE-2024-41203', cvssScore: 7.5, description: 'Stack-based buffer overflow in DNP3 packet parser allows denial of service', scanner: 'Nessus', remediation: 'Apply vendor patch ABB-RTU-2024-003' },
    status: 'active', severity: 'high', createdAt: '2024-08-22T11:00:00Z', updatedAt: '2024-12-01T10:00:00Z',
  },
  {
    id: 'v-005', typeId: 'type-vuln', typeName: 'Vulnerability',
    title: 'Insecure Deserialization in Historian',
    properties: { cveId: 'CVE-2024-35587', cvssScore: 8.1, description: 'Insecure Java deserialization in historian web interface allows remote code execution', scanner: 'Semgrep', filePath: '/opt/historian/lib/api-gateway.jar', remediation: 'Upgrade Uniformance PHD to v2024.1 or later' },
    status: 'active', severity: 'high', createdAt: '2024-07-14T16:00:00Z', updatedAt: '2024-11-28T07:00:00Z',
  },
  {
    id: 'v-006', typeId: 'type-vuln', typeName: 'Vulnerability',
    title: 'Outdated OpenSSL on Engineering Workstation',
    properties: { cveId: 'CVE-2024-22019', cvssScore: 5.3, description: 'OpenSSL 1.1.1 is end-of-life and contains known vulnerabilities', scanner: 'Trivy', remediation: 'Upgrade OpenSSL to 3.x branch' },
    status: 'active', severity: 'medium', createdAt: '2024-06-20T08:00:00Z', updatedAt: '2024-11-15T09:00:00Z',
  },
  {
    id: 'v-007', typeId: 'type-vuln', typeName: 'Vulnerability',
    title: 'Weak TLS Configuration on SCADA Server',
    properties: { cveId: 'CVE-2024-18432', cvssScore: 4.3, description: 'TLS 1.0 and weak cipher suites enabled on SCADA web interface', scanner: 'Nuclei', remediation: 'Disable TLS 1.0/1.1 and configure strong cipher suites' },
    status: 'mitigated', severity: 'medium', createdAt: '2024-05-10T12:00:00Z', updatedAt: '2024-12-05T15:00:00Z',
  },
  {
    id: 'v-008', typeId: 'type-vuln', typeName: 'Vulnerability',
    title: 'Cross-Site Scripting in HMI Dashboard',
    properties: { cveId: 'CVE-2024-27653', cvssScore: 6.1, description: 'Reflected XSS vulnerability in HMI dashboard search parameter', scanner: 'Nuclei', filePath: '/app/views/search.jsp', lineNumber: 118, remediation: 'Sanitize user input and implement Content-Security-Policy' },
    status: 'active', severity: 'medium', createdAt: '2024-04-25T10:30:00Z', updatedAt: '2024-11-20T11:00:00Z',
  },
  {
    id: 'v-009', typeId: 'type-vuln', typeName: 'Vulnerability',
    title: 'Default SNMP Community String',
    properties: { cveId: 'CVE-2024-19876', cvssScore: 7.2, description: 'Default SNMP community string "public" allows unauthorized network reconnaissance', scanner: 'Nessus', remediation: 'Change SNMP community strings and restrict SNMP access' },
    status: 'active', severity: 'high', createdAt: '2024-03-30T09:15:00Z', updatedAt: '2024-11-10T08:00:00Z',
  },
  {
    id: 'v-010', typeId: 'type-vuln', typeName: 'Vulnerability',
    title: 'Information Disclosure in Error Pages',
    properties: { cveId: 'CVE-2024-15234', cvssScore: 3.7, description: 'Verbose error pages expose internal stack traces and server versions', scanner: 'Nuclei', remediation: 'Configure custom error pages and disable debug mode' },
    status: 'resolved', severity: 'low', createdAt: '2024-02-14T07:00:00Z', updatedAt: '2024-10-22T14:00:00Z',
  },

  // ── Network Flows (6) ─────────────────────────────────────────────────
  {
    id: 'f-001', typeId: 'type-flow', typeName: 'NetworkFlow',
    title: 'PLC Modbus Control Traffic',
    properties: { srcIp: '10.1.2.50', dstIp: '10.1.1.10', protocol: 'Modbus/TCP', srcPort: 49152, dstPort: 502, bytes: 1048576, packets: 8432 },
    status: 'active', createdAt: '2024-12-18T00:00:00Z', updatedAt: '2024-12-18T14:30:00Z',
  },
  {
    id: 'f-002', typeId: 'type-flow', typeName: 'NetworkFlow',
    title: 'RTU DNP3 Polling',
    properties: { srcIp: '10.1.2.50', dstIp: '192.168.1.50', protocol: 'DNP3', srcPort: 55201, dstPort: 20000, bytes: 524288, packets: 4216 },
    status: 'active', createdAt: '2024-12-18T00:00:00Z', updatedAt: '2024-12-18T14:10:00Z',
  },
  {
    id: 'f-003', typeId: 'type-flow', typeName: 'NetworkFlow',
    title: 'HMI EtherNet/IP to PLC',
    properties: { srcIp: '10.1.2.20', dstIp: '10.1.1.10', protocol: 'EtherNet/IP', srcPort: 49200, dstPort: 44818, bytes: 2097152, packets: 15320 },
    status: 'active', createdAt: '2024-12-18T00:00:00Z', updatedAt: '2024-12-18T14:25:00Z',
  },
  {
    id: 'f-004', typeId: 'type-flow', typeName: 'NetworkFlow',
    title: 'Historian Data Ingest',
    properties: { srcIp: '10.1.2.50', dstIp: '10.1.4.100', protocol: 'TCP', srcPort: 49300, dstPort: 3389, bytes: 4194304, packets: 32100 },
    status: 'active', createdAt: '2024-12-18T00:00:00Z', updatedAt: '2024-12-18T14:28:00Z',
  },
  {
    id: 'f-005', typeId: 'type-flow', typeName: 'NetworkFlow',
    title: 'EWS to PLC Programming',
    properties: { srcIp: '10.1.3.15', dstIp: '10.1.1.10', protocol: 'S7comm', srcPort: 49400, dstPort: 102, bytes: 262144, packets: 1842 },
    status: 'active', createdAt: '2024-12-17T08:00:00Z', updatedAt: '2024-12-17T17:00:00Z',
  },
  {
    id: 'f-006', typeId: 'type-flow', typeName: 'NetworkFlow',
    title: 'IoT Gateway BACnet Traffic',
    properties: { srcIp: '192.168.1.200', dstIp: '10.1.2.50', protocol: 'BACnet/IP', srcPort: 47808, dstPort: 47808, bytes: 131072, packets: 920 },
    status: 'active', createdAt: '2024-12-18T00:00:00Z', updatedAt: '2024-12-18T12:45:00Z',
  },

  // ── Protocols (4) ─────────────────────────────────────────────────────
  {
    id: 'p-001', typeId: 'type-protocol', typeName: 'Protocol',
    title: 'Modbus/TCP',
    properties: { name: 'Modbus/TCP', layer: 'L7', isIcs: true, port: 502 },
    status: 'active', createdAt: '2024-01-15T08:00:00Z', updatedAt: '2024-01-15T08:00:00Z',
  },
  {
    id: 'p-002', typeId: 'type-protocol', typeName: 'Protocol',
    title: 'DNP3',
    properties: { name: 'DNP3', layer: 'L7', isIcs: true, port: 20000 },
    status: 'active', createdAt: '2024-01-15T08:00:00Z', updatedAt: '2024-01-15T08:00:00Z',
  },
  {
    id: 'p-003', typeId: 'type-protocol', typeName: 'Protocol',
    title: 'EtherNet/IP',
    properties: { name: 'EtherNet/IP', layer: 'L7', isIcs: true, port: 44818 },
    status: 'active', createdAt: '2024-01-15T08:00:00Z', updatedAt: '2024-01-15T08:00:00Z',
  },
  {
    id: 'p-004', typeId: 'type-protocol', typeName: 'Protocol',
    title: 'BACnet/IP',
    properties: { name: 'BACnet/IP', layer: 'L7', isIcs: true, port: 47808 },
    status: 'active', createdAt: '2024-01-15T08:00:00Z', updatedAt: '2024-01-15T08:00:00Z',
  },

  // ── Products (4) ──────────────────────────────────────────────────────
  {
    id: 'pr-001', typeId: 'type-product', typeName: 'Product',
    title: 'SCADA HMI Platform',
    properties: { name: 'Ignition SCADA', version: '8.1.33', type: 'ics', riskScore: 72, owner: 'OT Engineering' },
    status: 'active', createdAt: '2024-02-01T08:00:00Z', updatedAt: '2024-12-10T09:00:00Z',
  },
  {
    id: 'pr-002', typeId: 'type-product', typeName: 'Product',
    title: 'PLC Firmware Suite',
    properties: { name: 'SIMATIC STEP 7', version: '5.7 SP1', type: 'ics', riskScore: 85, owner: 'OT Engineering' },
    status: 'active', createdAt: '2024-02-01T08:00:00Z', updatedAt: '2024-11-20T10:00:00Z',
  },
  {
    id: 'pr-003', typeId: 'type-product', typeName: 'Product',
    title: 'Historian Database',
    properties: { name: 'Uniformance PHD', version: '2023.2', type: 'ics', riskScore: 58, owner: 'Data Engineering' },
    status: 'active', createdAt: '2024-02-01T08:00:00Z', updatedAt: '2024-12-05T11:00:00Z',
  },
  {
    id: 'pr-004', typeId: 'type-product', typeName: 'Product',
    title: 'Engineering Workstation Software',
    properties: { name: 'Unity Pro XL', version: '14.1', type: 'ics', riskScore: 64, owner: 'Control Systems' },
    status: 'active', createdAt: '2024-03-10T08:00:00Z', updatedAt: '2024-11-30T09:00:00Z',
  },

  // ── Scanners (4) ──────────────────────────────────────────────────────
  {
    id: 'sc-001', typeId: 'type-scanner', typeName: 'Scanner',
    title: 'Semgrep SAST',
    properties: { name: 'Semgrep', type: 'sast', lastRun: '2024-12-18T06:00:00Z', findingCount: 47 },
    status: 'active', createdAt: '2024-01-20T08:00:00Z', updatedAt: '2024-12-18T06:00:00Z',
  },
  {
    id: 'sc-002', typeId: 'type-scanner', typeName: 'Scanner',
    title: 'Trivy SCA',
    properties: { name: 'Trivy', type: 'sca', lastRun: '2024-12-18T04:00:00Z', findingCount: 128 },
    status: 'active', createdAt: '2024-01-20T08:00:00Z', updatedAt: '2024-12-18T04:00:00Z',
  },
  {
    id: 'sc-003', typeId: 'type-scanner', typeName: 'Scanner',
    title: 'Nuclei DAST',
    properties: { name: 'Nuclei', type: 'dast', lastRun: '2024-12-17T22:00:00Z', findingCount: 23 },
    status: 'active', createdAt: '2024-02-10T08:00:00Z', updatedAt: '2024-12-17T22:00:00Z',
  },
  {
    id: 'sc-004', typeId: 'type-scanner', typeName: 'Scanner',
    title: 'Nessus Vulnerability Scanner',
    properties: { name: 'Nessus', type: 'dast', lastRun: '2024-12-18T02:00:00Z', findingCount: 86 },
    status: 'active', createdAt: '2024-01-25T08:00:00Z', updatedAt: '2024-12-18T02:00:00Z',
  },

  // ── Attack Paths (3) ──────────────────────────────────────────────────
  {
    id: 'ap-001', typeId: 'type-attack-path', typeName: 'AttackPath',
    title: 'Internet → DMZ → SCADA → PLC Takeover',
    properties: { name: 'Internet → DMZ → SCADA → PLC Takeover', blastRadius: 24, steps: 5, riskScore: 95 },
    status: 'active', severity: 'critical', createdAt: '2024-11-01T10:00:00Z', updatedAt: '2024-12-15T08:00:00Z',
  },
  {
    id: 'ap-002', typeId: 'type-attack-path', typeName: 'AttackPath',
    title: 'Compromised EWS → Historian Data Exfil',
    properties: { name: 'Compromised EWS → Historian Data Exfil', blastRadius: 12, steps: 3, riskScore: 78 },
    status: 'active', severity: 'high', createdAt: '2024-11-05T10:00:00Z', updatedAt: '2024-12-12T09:00:00Z',
  },
  {
    id: 'ap-003', typeId: 'type-attack-path', typeName: 'AttackPath',
    title: 'Rogue IoT Device → Lateral Movement to L2',
    properties: { name: 'Rogue IoT Device → Lateral Movement to L2', blastRadius: 8, steps: 4, riskScore: 67 },
    status: 'active', severity: 'high', createdAt: '2024-11-10T10:00:00Z', updatedAt: '2024-12-10T11:00:00Z',
  },

  // ── Compliance Controls (5) ───────────────────────────────────────────
  {
    id: 'cc-001', typeId: 'type-compliance', typeName: 'ComplianceControl',
    title: 'IEC 62443 – Network Segmentation',
    properties: { framework: 'IEC-62443', controlId: 'SR 5.1', title: 'Network Segmentation', status: 'pass' },
    status: 'active', createdAt: '2024-06-01T08:00:00Z', updatedAt: '2024-12-01T08:00:00Z',
  },
  {
    id: 'cc-002', typeId: 'type-compliance', typeName: 'ComplianceControl',
    title: 'NIST 800-82 – Access Control',
    properties: { framework: 'NIST-800-82', controlId: 'AC-3', title: 'Access Enforcement', status: 'fail' },
    status: 'active', createdAt: '2024-06-01T08:00:00Z', updatedAt: '2024-12-01T08:00:00Z',
  },
  {
    id: 'cc-003', typeId: 'type-compliance', typeName: 'ComplianceControl',
    title: 'OWASP – Input Validation',
    properties: { framework: 'OWASP', controlId: 'V5.1', title: 'Input Validation', status: 'partial' },
    status: 'active', createdAt: '2024-06-01T08:00:00Z', updatedAt: '2024-12-01T08:00:00Z',
  },
  {
    id: 'cc-004', typeId: 'type-compliance', typeName: 'ComplianceControl',
    title: 'PCI-DSS – Encryption in Transit',
    properties: { framework: 'PCI-DSS', controlId: '4.1', title: 'Use Strong Cryptography', status: 'pass' },
    status: 'active', createdAt: '2024-06-01T08:00:00Z', updatedAt: '2024-12-01T08:00:00Z',
  },
  {
    id: 'cc-005', typeId: 'type-compliance', typeName: 'ComplianceControl',
    title: 'NERC CIP – Electronic Security Perimeter',
    properties: { framework: 'NERC-CIP', controlId: 'CIP-005-7', title: 'Electronic Security Perimeter', status: 'fail' },
    status: 'active', createdAt: '2024-06-01T08:00:00Z', updatedAt: '2024-12-01T08:00:00Z',
  },

  // ── Components (4) ────────────────────────────────────────────────────
  {
    id: 'cmp-001', typeId: 'type-component', typeName: 'Component',
    title: 'lodash',
    properties: { packageName: 'lodash', version: '4.17.20', license: 'MIT', isVulnerable: true, ecosystem: 'npm' },
    status: 'active', createdAt: '2024-03-01T08:00:00Z', updatedAt: '2024-12-01T08:00:00Z',
  },
  {
    id: 'cmp-002', typeId: 'type-component', typeName: 'Component',
    title: 'requests',
    properties: { packageName: 'requests', version: '2.28.0', license: 'Apache-2.0', isVulnerable: false, ecosystem: 'pip' },
    status: 'active', createdAt: '2024-03-01T08:00:00Z', updatedAt: '2024-12-01T08:00:00Z',
  },
  {
    id: 'cmp-003', typeId: 'type-component', typeName: 'Component',
    title: 'express',
    properties: { packageName: 'express', version: '4.18.2', license: 'MIT', isVulnerable: false, ecosystem: 'npm' },
    status: 'active', createdAt: '2024-03-01T08:00:00Z', updatedAt: '2024-12-01T08:00:00Z',
  },
  {
    id: 'cmp-004', typeId: 'type-component', typeName: 'Component',
    title: 'cryptography',
    properties: { packageName: 'cryptography', version: '41.0.1', license: 'Apache-2.0', isVulnerable: true, ecosystem: 'pip' },
    status: 'active', createdAt: '2024-03-01T08:00:00Z', updatedAt: '2024-12-01T08:00:00Z',
  },

  // ── Identities (3) ────────────────────────────────────────────────────
  {
    id: 'u-001', typeId: 'type-user', typeName: 'Identity',
    title: 'jchen (OT Admin)',
    properties: { username: 'jchen', role: 'OT Administrator', lastActive: '2024-12-18T14:00:00Z', department: 'OT Operations' },
    status: 'active', createdAt: '2024-01-10T08:00:00Z', updatedAt: '2024-12-18T14:00:00Z',
  },
  {
    id: 'u-002', typeId: 'type-user', typeName: 'Identity',
    title: 'asmith (Security Analyst)',
    properties: { username: 'asmith', role: 'Security Analyst', lastActive: '2024-12-18T13:30:00Z', department: 'Cybersecurity' },
    status: 'active', createdAt: '2024-01-10T08:00:00Z', updatedAt: '2024-12-18T13:30:00Z',
  },
  {
    id: 'u-003', typeId: 'type-user', typeName: 'Identity',
    title: 'svc-scada (Service Account)',
    properties: { username: 'svc-scada', role: 'Service Account', lastActive: '2024-12-18T14:32:00Z', department: 'System' },
    status: 'active', createdAt: '2024-02-01T08:00:00Z', updatedAt: '2024-12-18T14:32:00Z',
  },
];

// ---------------------------------------------------------------------------
// Mock Links (~30)
// ---------------------------------------------------------------------------

export const MOCK_LINKS: ObjectLink[] = [
  // Hosts ↔ Vulnerabilities (HAS_VULNERABILITY)
  { id: 'l-001', sourceId: 'h-001', targetId: 'v-001', linkType: 'HAS_VULNERABILITY', createdAt: '2024-11-20T10:00:00Z' },
  { id: 'l-002', sourceId: 'h-001', targetId: 'v-002', linkType: 'HAS_VULNERABILITY', createdAt: '2024-10-05T09:00:00Z' },
  { id: 'l-003', sourceId: 'h-002', targetId: 'v-003', linkType: 'HAS_VULNERABILITY', createdAt: '2024-09-18T14:00:00Z' },
  { id: 'l-004', sourceId: 'h-002', targetId: 'v-008', linkType: 'HAS_VULNERABILITY', createdAt: '2024-04-25T10:30:00Z' },
  { id: 'l-005', sourceId: 'h-005', targetId: 'v-004', linkType: 'HAS_VULNERABILITY', createdAt: '2024-08-22T11:00:00Z' },
  { id: 'l-006', sourceId: 'h-004', targetId: 'v-005', linkType: 'HAS_VULNERABILITY', createdAt: '2024-07-14T16:00:00Z' },
  { id: 'l-007', sourceId: 'h-003', targetId: 'v-006', linkType: 'HAS_VULNERABILITY', createdAt: '2024-06-20T08:00:00Z' },
  { id: 'l-008', sourceId: 'h-007', targetId: 'v-007', linkType: 'HAS_VULNERABILITY', createdAt: '2024-05-10T12:00:00Z' },
  { id: 'l-009', sourceId: 'h-006', targetId: 'v-009', linkType: 'HAS_VULNERABILITY', createdAt: '2024-03-30T09:15:00Z' },
  { id: 'l-010', sourceId: 'h-007', targetId: 'v-010', linkType: 'HAS_VULNERABILITY', createdAt: '2024-02-14T07:00:00Z' },

  // Flows ↔ Protocols (USES_PROTOCOL)
  { id: 'l-011', sourceId: 'f-001', targetId: 'p-001', linkType: 'USES_PROTOCOL', createdAt: '2024-12-18T00:00:00Z' },
  { id: 'l-012', sourceId: 'f-002', targetId: 'p-002', linkType: 'USES_PROTOCOL', createdAt: '2024-12-18T00:00:00Z' },
  { id: 'l-013', sourceId: 'f-003', targetId: 'p-003', linkType: 'USES_PROTOCOL', createdAt: '2024-12-18T00:00:00Z' },
  { id: 'l-014', sourceId: 'f-006', targetId: 'p-004', linkType: 'USES_PROTOCOL', createdAt: '2024-12-18T00:00:00Z' },

  // Hosts ↔ Products (RUNS)
  { id: 'l-015', sourceId: 'h-007', targetId: 'pr-001', linkType: 'RUNS', createdAt: '2024-02-05T09:00:00Z' },
  { id: 'l-016', sourceId: 'h-001', targetId: 'pr-002', linkType: 'RUNS', createdAt: '2024-03-01T10:00:00Z' },
  { id: 'l-017', sourceId: 'h-004', targetId: 'pr-003', linkType: 'RUNS', createdAt: '2024-02-20T08:00:00Z' },
  { id: 'l-018', sourceId: 'h-003', targetId: 'pr-004', linkType: 'RUNS', createdAt: '2024-03-15T09:00:00Z' },

  // Products ↔ Components (DEPENDS_ON)
  { id: 'l-019', sourceId: 'pr-001', targetId: 'cmp-001', linkType: 'DEPENDS_ON', createdAt: '2024-03-01T08:00:00Z' },
  { id: 'l-020', sourceId: 'pr-001', targetId: 'cmp-003', linkType: 'DEPENDS_ON', createdAt: '2024-03-01T08:00:00Z' },
  { id: 'l-021', sourceId: 'pr-003', targetId: 'cmp-002', linkType: 'DEPENDS_ON', createdAt: '2024-03-01T08:00:00Z' },
  { id: 'l-022', sourceId: 'pr-003', targetId: 'cmp-004', linkType: 'DEPENDS_ON', createdAt: '2024-03-01T08:00:00Z' },

  // Attack Paths ↔ Vulnerabilities (EXPLOITS)
  { id: 'l-023', sourceId: 'ap-001', targetId: 'v-001', linkType: 'EXPLOITS', createdAt: '2024-11-01T10:00:00Z' },
  { id: 'l-024', sourceId: 'ap-001', targetId: 'v-002', linkType: 'EXPLOITS', createdAt: '2024-11-01T10:00:00Z' },
  { id: 'l-025', sourceId: 'ap-002', targetId: 'v-005', linkType: 'EXPLOITS', createdAt: '2024-11-05T10:00:00Z' },
  { id: 'l-026', sourceId: 'ap-003', targetId: 'v-009', linkType: 'EXPLOITS', createdAt: '2024-11-10T10:00:00Z' },

  // Compliance Controls ↔ Products (APPLIES_TO)
  { id: 'l-027', sourceId: 'cc-001', targetId: 'pr-001', linkType: 'APPLIES_TO', createdAt: '2024-06-01T08:00:00Z' },
  { id: 'l-028', sourceId: 'cc-002', targetId: 'pr-002', linkType: 'APPLIES_TO', createdAt: '2024-06-01T08:00:00Z' },
  { id: 'l-029', sourceId: 'cc-003', targetId: 'pr-001', linkType: 'APPLIES_TO', createdAt: '2024-06-01T08:00:00Z' },
  { id: 'l-030', sourceId: 'cc-005', targetId: 'pr-001', linkType: 'APPLIES_TO', createdAt: '2024-06-01T08:00:00Z' },

  // Scanners ↔ Vulnerabilities (DETECTED)
  { id: 'l-031', sourceId: 'sc-004', targetId: 'v-001', linkType: 'DETECTED', createdAt: '2024-11-20T10:00:00Z' },
  { id: 'l-032', sourceId: 'sc-001', targetId: 'v-003', linkType: 'DETECTED', createdAt: '2024-09-18T14:00:00Z' },
];

// ---------------------------------------------------------------------------
// Mock Actions
// ---------------------------------------------------------------------------

export const MOCK_ACTIONS: ObjectAction[] = [
  {
    id: 'act-001',
    name: 'Create Jira Ticket',
    objectTypeId: 'type-vuln',
    actionType: 'jira',
    config: { project: 'SEC', issueType: 'Bug', priority: 'High' },
  },
  {
    id: 'act-002',
    name: 'Isolate Host',
    objectTypeId: 'type-host',
    actionType: 'isolate',
    config: { method: 'network_acl', duration: '24h', notifyOwner: true },
  },
  {
    id: 'act-003',
    name: 'Remediate Finding',
    objectTypeId: 'type-vuln',
    actionType: 'remediate',
    config: { workflow: 'auto_patch', requireApproval: true },
  },
  {
    id: 'act-004',
    name: 'Notify Team',
    objectTypeId: '*',
    actionType: 'notify',
    config: { channels: ['slack', 'email'], template: 'security_alert' },
  },
  {
    id: 'act-005',
    name: 'Rescan',
    objectTypeId: 'type-scanner',
    actionType: 'custom',
    config: { command: 'trigger_scan', timeout: 3600 },
  },
];

// ---------------------------------------------------------------------------
// Dashboard Stats
// ---------------------------------------------------------------------------

const RECENT_EVENTS: AuditEvent[] = [
  {
    id: 'evt-001', objectId: 'v-001', objectTitle: 'Siemens S7-1500 Authentication Bypass', objectType: 'Vulnerability',
    action: 'created', timestamp: '2024-12-18T14:30:00Z',
  },
  {
    id: 'evt-002', objectId: 'h-006', objectTitle: 'FIREWALL-DMZ-01', objectType: 'Host',
    action: 'updated', details: { field: 'lastSeen' }, timestamp: '2024-12-18T14:32:00Z',
  },
  {
    id: 'evt-003', objectId: 'sc-001', objectTitle: 'Semgrep SAST', objectType: 'Scanner',
    action: 'scan_completed', details: { findings: 47 }, timestamp: '2024-12-18T06:00:00Z',
  },
  {
    id: 'evt-004', objectId: 'v-010', objectTitle: 'Information Disclosure in Error Pages', objectType: 'Vulnerability',
    action: 'status_changed', details: { from: 'active', to: 'resolved' }, timestamp: '2024-12-17T16:00:00Z',
  },
  {
    id: 'evt-005', objectId: 'ap-001', objectTitle: 'Internet → DMZ → SCADA → PLC Takeover', objectType: 'AttackPath',
    action: 'risk_recalculated', details: { previousScore: 91, newScore: 95 }, timestamp: '2024-12-15T08:00:00Z',
  },
];

export const MOCK_DASHBOARD_STATS: DashboardStats = {
  totalObjects: MOCK_OBJECTS.length,
  activeAlerts: 12,
  criticalVulns: 3,
  threatLevel: 'high',
  severityBreakdown: {
    critical: 3,
    high: 4,
    medium: 3,
    low: 1,
    info: 0,
  },
  objectTypeCounts: {
    Host: 8,
    Vulnerability: 10,
    NetworkFlow: 6,
    Protocol: 4,
    Product: 4,
    Scanner: 4,
    AttackPath: 3,
    ComplianceControl: 5,
    Component: 4,
    Identity: 3,
  },
  recentEvents: RECENT_EVENTS,
};

// ---------------------------------------------------------------------------
// Graph Data (Cytoscape-ready)
// ---------------------------------------------------------------------------

function buildTypeColorMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const t of OBJECT_TYPE_DEFINITIONS) {
    map[t.id] = t.color;
  }
  return map;
}

const TYPE_COLORS = buildTypeColorMap();

export const MOCK_GRAPH_DATA: GraphData = {
  nodes: MOCK_OBJECTS.map((obj) => ({
    id: obj.id,
    label: obj.title,
    type: obj.typeName,
    color: TYPE_COLORS[obj.typeId] ?? '#6b7280',
    properties: obj.properties,
  })),
  edges: MOCK_LINKS.map((link) => ({
    id: link.id,
    source: link.sourceId,
    target: link.targetId,
    label: link.linkType,
  })),
};
