import { useMemo, useState, useCallback } from 'react';
import {
  Server, Cpu, Shield, HelpCircle, X, ChevronRight,
  Search, Filter, ArrowUpDown, Star, AlertTriangle, Monitor,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import StatCard from '@/components/dashboard/StatCard';
import { cn } from '@/lib/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DeviceType = 'PLC' | 'RTU' | 'HMI' | 'Engineering WS' | 'Switch' | 'Router' | 'Firewall' | 'Server' | 'Historian' | 'SCADA Server' | 'IoT Gateway' | 'Unknown';
type Criticality = 'Critical' | 'High' | 'Medium' | 'Low';
type IdentificationMethod = 'Port Detection' | 'OUI Lookup' | 'Payload Analysis' | 'Protocol Deep Parse' | 'Banner Grab';

interface DeviceRecord {
  id: string;
  ip: string;
  mac: string;
  ouiVendor: string;
  hostname: string;
  deviceType: DeviceType;
  vendor: string;
  model: string;
  firmwareVersion: string;
  purdueLevel: string;
  recommendedPurdueLevel: string;
  protocols: string[];
  confidenceScore: number; // 1-5
  criticality: Criticality;
  firstSeen: string;
  lastSeen: string;
  identificationMethods: IdentificationMethod[];
  communicationPartners: { ip: string; protocol: string; direction: 'inbound' | 'outbound' | 'bidirectional' }[];
  protocolDetails: Record<string, string>;
  securityFindings: string[];
}

// ---------------------------------------------------------------------------
// Mock Device Data (20 realistic ICS devices)
// ---------------------------------------------------------------------------

const DEVICE_INVENTORY: DeviceRecord[] = [
  {
    id: 'dev-001',
    ip: '10.1.1.10',
    mac: '00:1A:2B:3C:4D:01',
    ouiVendor: 'Siemens AG',
    hostname: 'plc-s7-1500',
    deviceType: 'PLC',
    vendor: 'Siemens',
    model: 'S7-1500 CPU 1516-3 PN/DP',
    firmwareVersion: 'V2.9.7',
    purdueLevel: 'L1',
    recommendedPurdueLevel: 'L1',
    protocols: ['S7comm', 'Modbus/TCP', 'PROFINET'],
    confidenceScore: 5,
    criticality: 'Critical',
    firstSeen: '2024-03-01T10:00:00Z',
    lastSeen: '2024-12-18T14:30:00Z',
    identificationMethods: ['OUI Lookup', 'Protocol Deep Parse', 'Payload Analysis'],
    communicationPartners: [
      { ip: '10.1.2.50', protocol: 'Modbus/TCP', direction: 'inbound' },
      { ip: '10.1.2.20', protocol: 'EtherNet/IP', direction: 'inbound' },
      { ip: '10.1.3.15', protocol: 'S7comm', direction: 'inbound' },
    ],
    protocolDetails: {
      'S7comm': 'Module Type: CPU 1516-3 PN/DP, Serial: S C-E6LR23450012, HW Version: 6',
      'Modbus/TCP': 'Unit ID: 1, Registers: 40001-40120, Coils: 1-64',
    },
    securityFindings: ['CVE-2024-38876: Authentication bypass (Critical)', 'Default HTTP port 80 exposed'],
  },
  {
    id: 'dev-002',
    ip: '10.1.1.20',
    mac: '00:1A:2B:3C:4D:02',
    ouiVendor: 'Siemens AG',
    hostname: 'plc-s7-300',
    deviceType: 'PLC',
    vendor: 'Siemens',
    model: 'S7-300 CPU 315-2DP',
    firmwareVersion: 'V3.3.18',
    purdueLevel: 'L1',
    recommendedPurdueLevel: 'L1',
    protocols: ['S7comm', 'PROFINET'],
    confidenceScore: 5,
    criticality: 'Critical',
    firstSeen: '2024-03-02T08:00:00Z',
    lastSeen: '2024-12-18T14:28:00Z',
    identificationMethods: ['OUI Lookup', 'Protocol Deep Parse', 'Banner Grab'],
    communicationPartners: [
      { ip: '10.1.2.50', protocol: 'S7comm', direction: 'inbound' },
      { ip: '10.1.3.15', protocol: 'S7comm', direction: 'inbound' },
    ],
    protocolDetails: {
      'S7comm': 'Module Type: CPU 315-2DP, Serial: S C-B5KR12340089, HW Version: 4',
    },
    securityFindings: ['Firmware end-of-life, no longer receiving security patches'],
  },
  {
    id: 'dev-003',
    ip: '10.1.1.30',
    mac: '00:80:F4:12:34:56',
    ouiVendor: 'Telemecanique',
    hostname: 'plc-m340',
    deviceType: 'PLC',
    vendor: 'Schneider Electric',
    model: 'Modicon M340 BMX P34 2020',
    firmwareVersion: 'V3.40',
    purdueLevel: 'L1',
    recommendedPurdueLevel: 'L1',
    protocols: ['Modbus/TCP', 'EtherNet/IP'],
    confidenceScore: 4,
    criticality: 'Critical',
    firstSeen: '2024-04-15T09:30:00Z',
    lastSeen: '2024-12-18T14:25:00Z',
    identificationMethods: ['OUI Lookup', 'Protocol Deep Parse', 'Payload Analysis'],
    communicationPartners: [
      { ip: '10.1.2.50', protocol: 'Modbus/TCP', direction: 'inbound' },
      { ip: '10.1.2.20', protocol: 'EtherNet/IP', direction: 'bidirectional' },
    ],
    protocolDetails: {
      'Modbus/TCP': 'Unit ID: 2, Registers: 40001-40080',
      'EtherNet/IP': 'Vendor ID: 44 (Schneider), Device Type: 14 (PLC), Product Code: 256',
    },
    securityFindings: ['Modbus/TCP lacks authentication'],
  },
  {
    id: 'dev-004',
    ip: '192.168.1.50',
    mac: '00:0C:25:AA:BB:CC',
    ouiVendor: 'ABB',
    hostname: 'rtu-560',
    deviceType: 'RTU',
    vendor: 'ABB',
    model: 'RTU560',
    firmwareVersion: '12.4.1',
    purdueLevel: 'L1',
    recommendedPurdueLevel: 'L1',
    protocols: ['DNP3', 'IEC 60870-5-104'],
    confidenceScore: 4,
    criticality: 'Critical',
    firstSeen: '2024-04-10T07:30:00Z',
    lastSeen: '2024-12-18T14:10:00Z',
    identificationMethods: ['OUI Lookup', 'Protocol Deep Parse'],
    communicationPartners: [
      { ip: '10.1.2.50', protocol: 'DNP3', direction: 'inbound' },
    ],
    protocolDetails: {
      'DNP3': 'Master Address: 1, Outstation Address: 10, Unsolicited Responses: Enabled',
    },
    securityFindings: ['CVE-2024-41203: DNP3 buffer overflow (High)', 'DNP3 Secure Authentication not enabled'],
  },
  {
    id: 'dev-005',
    ip: '192.168.1.55',
    mac: '00:0C:25:DD:EE:FF',
    ouiVendor: 'ABB',
    hostname: 'rtu-520-sub01',
    deviceType: 'RTU',
    vendor: 'ABB',
    model: 'RTU520',
    firmwareVersion: '13.1.0',
    purdueLevel: 'L1',
    recommendedPurdueLevel: 'L1',
    protocols: ['IEC 61850', 'DNP3'],
    confidenceScore: 3,
    criticality: 'High',
    firstSeen: '2024-06-20T11:00:00Z',
    lastSeen: '2024-12-18T13:50:00Z',
    identificationMethods: ['OUI Lookup', 'Port Detection'],
    communicationPartners: [
      { ip: '10.1.2.50', protocol: 'DNP3', direction: 'inbound' },
    ],
    protocolDetails: {
      'DNP3': 'Master Address: 1, Outstation Address: 11',
    },
    securityFindings: [],
  },
  {
    id: 'dev-006',
    ip: '10.1.2.20',
    mac: '00:00:BC:11:22:33',
    ouiVendor: 'Rockwell Automation',
    hostname: 'hmi-panelview',
    deviceType: 'HMI',
    vendor: 'Rockwell Automation',
    model: 'PanelView Plus 7 Performance',
    firmwareVersion: 'V12.011',
    purdueLevel: 'L2',
    recommendedPurdueLevel: 'L2',
    protocols: ['EtherNet/IP', 'CIP', 'HTTP'],
    confidenceScore: 5,
    criticality: 'High',
    firstSeen: '2024-03-01T10:00:00Z',
    lastSeen: '2024-12-18T14:25:00Z',
    identificationMethods: ['OUI Lookup', 'Protocol Deep Parse', 'Banner Grab'],
    communicationPartners: [
      { ip: '10.1.1.10', protocol: 'EtherNet/IP', direction: 'outbound' },
      { ip: '10.1.1.30', protocol: 'EtherNet/IP', direction: 'bidirectional' },
    ],
    protocolDetails: {
      'EtherNet/IP': 'Vendor ID: 1 (Rockwell), Device Type: 12 (HMI), Product Name: PanelView Plus 7, Serial: ABCD1234',
      'CIP': 'Identity Object, Message Router, Connection Manager',
    },
    securityFindings: ['CVE-2024-29104: Hardcoded credentials (Critical)', 'HTTP management interface exposed on port 80'],
  },
  {
    id: 'dev-007',
    ip: '10.1.2.25',
    mac: '00:00:BC:44:55:66',
    ouiVendor: 'Rockwell Automation',
    hostname: 'hmi-factorytalk',
    deviceType: 'HMI',
    vendor: 'Rockwell Automation',
    model: 'FactoryTalk View SE',
    firmwareVersion: 'V13.0',
    purdueLevel: 'L2',
    recommendedPurdueLevel: 'L2',
    protocols: ['EtherNet/IP', 'CIP', 'OPC UA'],
    confidenceScore: 4,
    criticality: 'High',
    firstSeen: '2024-05-10T08:00:00Z',
    lastSeen: '2024-12-18T14:20:00Z',
    identificationMethods: ['OUI Lookup', 'Protocol Deep Parse', 'Port Detection'],
    communicationPartners: [
      { ip: '10.1.1.10', protocol: 'EtherNet/IP', direction: 'outbound' },
      { ip: '10.1.4.100', protocol: 'OPC UA', direction: 'outbound' },
    ],
    protocolDetails: {
      'OPC UA': 'Endpoint: opc.tcp://hmi-factorytalk:4840, Security Policy: None',
    },
    securityFindings: ['OPC UA Security Policy set to None'],
  },
  {
    id: 'dev-008',
    ip: '10.1.2.50',
    mac: '08:00:27:AA:BB:CC',
    ouiVendor: 'PCS Systemtechnik',
    hostname: 'scada-ignition',
    deviceType: 'SCADA Server',
    vendor: 'Inductive Automation',
    model: 'Ignition 8.1',
    firmwareVersion: '8.1.33',
    purdueLevel: 'L2',
    recommendedPurdueLevel: 'L2',
    protocols: ['Modbus/TCP', 'DNP3', 'OPC UA', 'HTTPS'],
    confidenceScore: 5,
    criticality: 'Critical',
    firstSeen: '2024-02-05T09:00:00Z',
    lastSeen: '2024-12-18T14:31:00Z',
    identificationMethods: ['Port Detection', 'Banner Grab', 'Payload Analysis'],
    communicationPartners: [
      { ip: '10.1.1.10', protocol: 'Modbus/TCP', direction: 'outbound' },
      { ip: '192.168.1.50', protocol: 'DNP3', direction: 'outbound' },
      { ip: '10.1.4.100', protocol: 'OPC UA', direction: 'outbound' },
    ],
    protocolDetails: {
      'Modbus/TCP': 'Master, polling interval: 1s',
      'DNP3': 'Master, Class 1/2/3 polling enabled',
    },
    securityFindings: ['CVE-2024-18432: Weak TLS configuration (Medium)'],
  },
  {
    id: 'dev-009',
    ip: '10.1.3.15',
    mac: '00:80:F4:78:9A:BC',
    ouiVendor: 'Telemecanique',
    hostname: 'ews-unity-pro',
    deviceType: 'Engineering WS',
    vendor: 'Schneider Electric',
    model: 'Engineering Workstation',
    firmwareVersion: 'Unity Pro XL 14.1',
    purdueLevel: 'L3',
    recommendedPurdueLevel: 'L3',
    protocols: ['S7comm', 'Modbus/TCP', 'RDP', 'SMB'],
    confidenceScore: 4,
    criticality: 'High',
    firstSeen: '2024-03-15T09:00:00Z',
    lastSeen: '2024-12-18T13:00:00Z',
    identificationMethods: ['Port Detection', 'OUI Lookup', 'Banner Grab'],
    communicationPartners: [
      { ip: '10.1.1.10', protocol: 'S7comm', direction: 'outbound' },
      { ip: '10.1.1.20', protocol: 'S7comm', direction: 'outbound' },
    ],
    protocolDetails: {
      'S7comm': 'Programming client, PG/PC connection type',
    },
    securityFindings: ['CVE-2024-22019: Outdated OpenSSL (Medium)', 'RDP exposed without NLA'],
  },
  {
    id: 'dev-010',
    ip: '10.1.3.20',
    mac: '00:1E:C9:DE:F0:12',
    ouiVendor: 'Dell Inc.',
    hostname: 'ews-delta-v',
    deviceType: 'Engineering WS',
    vendor: 'Emerson',
    model: 'DeltaV Workstation',
    firmwareVersion: 'DeltaV v14.LTS',
    purdueLevel: 'L3',
    recommendedPurdueLevel: 'L3',
    protocols: ['OPC DA', 'OPC UA', 'RDP', 'SMB'],
    confidenceScore: 3,
    criticality: 'High',
    firstSeen: '2024-05-20T10:00:00Z',
    lastSeen: '2024-12-18T12:00:00Z',
    identificationMethods: ['Port Detection', 'Banner Grab'],
    communicationPartners: [
      { ip: '10.1.4.100', protocol: 'OPC UA', direction: 'outbound' },
    ],
    protocolDetails: {
      'OPC UA': 'Endpoint: opc.tcp://ews-delta-v:4840, Security: Basic256Sha256',
    },
    securityFindings: ['SMBv1 enabled'],
  },
  {
    id: 'dev-011',
    ip: '10.1.4.100',
    mac: '00:25:B5:34:56:78',
    ouiVendor: 'Honeywell',
    hostname: 'historian-srv',
    deviceType: 'Historian',
    vendor: 'Honeywell',
    model: 'Uniformance PHD',
    firmwareVersion: '2023.2',
    purdueLevel: 'L3',
    recommendedPurdueLevel: 'L3',
    protocols: ['OPC UA', 'HTTPS', 'SQL'],
    confidenceScore: 4,
    criticality: 'High',
    firstSeen: '2024-02-20T08:00:00Z',
    lastSeen: '2024-12-18T14:28:00Z',
    identificationMethods: ['Port Detection', 'Banner Grab', 'Payload Analysis'],
    communicationPartners: [
      { ip: '10.1.2.50', protocol: 'OPC UA', direction: 'inbound' },
      { ip: '10.1.2.25', protocol: 'OPC UA', direction: 'inbound' },
      { ip: '10.1.3.20', protocol: 'OPC UA', direction: 'inbound' },
    ],
    protocolDetails: {
      'OPC UA': 'Server, 12,400 tags, Subscription interval: 500ms',
    },
    securityFindings: ['CVE-2024-35587: Insecure deserialization (High)'],
  },
  {
    id: 'dev-012',
    ip: '192.168.100.1',
    mac: '00:1B:17:AB:CD:EF',
    ouiVendor: 'Palo Alto Networks',
    hostname: 'fw-dmz-paloalto',
    deviceType: 'Firewall',
    vendor: 'Palo Alto Networks',
    model: 'PA-3260',
    firmwareVersion: 'PAN-OS 11.1.2',
    purdueLevel: 'DMZ',
    recommendedPurdueLevel: 'DMZ',
    protocols: ['HTTPS', 'SSH', 'Syslog'],
    confidenceScore: 5,
    criticality: 'Critical',
    firstSeen: '2024-01-20T06:00:00Z',
    lastSeen: '2024-12-18T14:32:00Z',
    identificationMethods: ['OUI Lookup', 'Banner Grab', 'Port Detection'],
    communicationPartners: [
      { ip: '10.1.4.200', protocol: 'Syslog', direction: 'outbound' },
    ],
    protocolDetails: {},
    securityFindings: [],
  },
  {
    id: 'dev-013',
    ip: '10.1.0.1',
    mac: '00:1A:A1:12:34:56',
    ouiVendor: 'Cisco Systems',
    hostname: 'ot-core-sw01',
    deviceType: 'Switch',
    vendor: 'Cisco',
    model: 'IE-4010-4S24P',
    firmwareVersion: 'IOS-XE 17.6.5',
    purdueLevel: 'L1',
    recommendedPurdueLevel: 'L1',
    protocols: ['LLDP', 'CDP', 'SNMP', 'SSH'],
    confidenceScore: 5,
    criticality: 'High',
    firstSeen: '2024-01-15T08:00:00Z',
    lastSeen: '2024-12-18T14:32:00Z',
    identificationMethods: ['OUI Lookup', 'Protocol Deep Parse', 'Banner Grab'],
    communicationPartners: [
      { ip: '10.1.0.2', protocol: 'LLDP', direction: 'bidirectional' },
      { ip: '10.1.4.200', protocol: 'SNMP', direction: 'inbound' },
    ],
    protocolDetails: {
      'CDP': 'Platform: IE-4010-4S24P, Capabilities: Switch IGMP',
      'LLDP': 'System Name: ot-core-sw01, Port Description: GigabitEthernet1/0/1',
    },
    securityFindings: ['CVE-2024-19876: Default SNMP community string (High)'],
  },
  {
    id: 'dev-014',
    ip: '10.1.0.2',
    mac: '00:1A:2B:CC:DD:EE',
    ouiVendor: 'Siemens AG',
    hostname: 'ot-dist-sw01',
    deviceType: 'Switch',
    vendor: 'Siemens',
    model: 'SCALANCE X308-2M',
    firmwareVersion: 'V5.5.2',
    purdueLevel: 'L2',
    recommendedPurdueLevel: 'L2',
    protocols: ['LLDP', 'PROFINET', 'SNMP', 'HTTPS'],
    confidenceScore: 4,
    criticality: 'High',
    firstSeen: '2024-01-15T08:00:00Z',
    lastSeen: '2024-12-18T14:31:00Z',
    identificationMethods: ['OUI Lookup', 'Protocol Deep Parse'],
    communicationPartners: [
      { ip: '10.1.0.1', protocol: 'LLDP', direction: 'bidirectional' },
    ],
    protocolDetails: {
      'LLDP': 'System Name: ot-dist-sw01, Chassis ID: 00:1A:2B:CC:DD:EE',
    },
    securityFindings: [],
  },
  {
    id: 'dev-015',
    ip: '10.1.0.3',
    mac: '00:1A:1E:FF:00:11',
    ouiVendor: 'Hewlett Packard Enterprise',
    hostname: 'dmz-sw01',
    deviceType: 'Switch',
    vendor: 'HP',
    model: 'Aruba 2930F-8G',
    firmwareVersion: 'WC.16.11.0012',
    purdueLevel: 'DMZ',
    recommendedPurdueLevel: 'DMZ',
    protocols: ['LLDP', 'SNMP', 'SSH'],
    confidenceScore: 4,
    criticality: 'Medium',
    firstSeen: '2024-02-01T10:00:00Z',
    lastSeen: '2024-12-18T14:30:00Z',
    identificationMethods: ['OUI Lookup', 'Banner Grab', 'Port Detection'],
    communicationPartners: [
      { ip: '10.1.0.1', protocol: 'LLDP', direction: 'bidirectional' },
    ],
    protocolDetails: {},
    securityFindings: [],
  },
  {
    id: 'dev-016',
    ip: '192.168.1.200',
    mac: '00:1A:2B:10:20:30',
    ouiVendor: 'Siemens AG',
    hostname: 'iot-gw-01',
    deviceType: 'IoT Gateway',
    vendor: 'Siemens',
    model: 'IOT2050 Advanced',
    firmwareVersion: 'V1.4.1',
    purdueLevel: 'L0',
    recommendedPurdueLevel: 'L0',
    protocols: ['BACnet/IP', 'MQTT', 'HTTPS'],
    confidenceScore: 3,
    criticality: 'Medium',
    firstSeen: '2024-05-12T11:00:00Z',
    lastSeen: '2024-12-18T12:45:00Z',
    identificationMethods: ['OUI Lookup', 'Port Detection'],
    communicationPartners: [
      { ip: '10.1.2.50', protocol: 'BACnet/IP', direction: 'outbound' },
    ],
    protocolDetails: {
      'BACnet/IP': 'Device Instance: 1001, Vendor ID: 44',
    },
    securityFindings: ['MQTT broker without authentication on port 1883'],
  },
  {
    id: 'dev-017',
    ip: '10.1.4.200',
    mac: '00:50:56:AB:CD:EF',
    ouiVendor: 'VMware Inc.',
    hostname: 'siem-collector',
    deviceType: 'Server',
    vendor: 'VMware',
    model: 'ESXi Virtual Machine',
    firmwareVersion: 'Ubuntu 22.04 LTS',
    purdueLevel: 'L4',
    recommendedPurdueLevel: 'L4',
    protocols: ['Syslog', 'HTTPS', 'SSH'],
    confidenceScore: 3,
    criticality: 'Medium',
    firstSeen: '2024-03-01T08:00:00Z',
    lastSeen: '2024-12-18T14:32:00Z',
    identificationMethods: ['Port Detection', 'Banner Grab'],
    communicationPartners: [
      { ip: '192.168.100.1', protocol: 'Syslog', direction: 'inbound' },
      { ip: '10.1.0.1', protocol: 'SNMP', direction: 'outbound' },
    ],
    protocolDetails: {},
    securityFindings: [],
  },
  {
    id: 'dev-018',
    ip: '10.100.1.50',
    mac: '00:50:56:11:22:33',
    ouiVendor: 'VMware Inc.',
    hostname: 'erp-srv01',
    deviceType: 'Server',
    vendor: 'Dell',
    model: 'PowerEdge R740',
    firmwareVersion: 'Windows Server 2022',
    purdueLevel: 'L4',
    recommendedPurdueLevel: 'L4',
    protocols: ['HTTPS', 'SQL', 'SMB', 'RDP'],
    confidenceScore: 2,
    criticality: 'Medium',
    firstSeen: '2024-07-01T09:00:00Z',
    lastSeen: '2024-12-18T14:00:00Z',
    identificationMethods: ['Port Detection'],
    communicationPartners: [],
    protocolDetails: {},
    securityFindings: [],
  },
  {
    id: 'dev-019',
    ip: '10.1.0.254',
    mac: '00:1A:A1:99:88:77',
    ouiVendor: 'Cisco Systems',
    hostname: 'ot-router-01',
    deviceType: 'Router',
    vendor: 'Cisco',
    model: 'ISR 4331',
    firmwareVersion: 'IOS-XE 17.9.4',
    purdueLevel: 'DMZ',
    recommendedPurdueLevel: 'DMZ',
    protocols: ['OSPF', 'SSH', 'SNMP', 'Syslog'],
    confidenceScore: 4,
    criticality: 'High',
    firstSeen: '2024-01-15T08:00:00Z',
    lastSeen: '2024-12-18T14:32:00Z',
    identificationMethods: ['OUI Lookup', 'Banner Grab', 'Protocol Deep Parse'],
    communicationPartners: [
      { ip: '10.1.4.200', protocol: 'Syslog', direction: 'outbound' },
    ],
    protocolDetails: {
      'OSPF': 'Area 0, Router ID: 10.1.0.254',
    },
    securityFindings: [],
  },
  {
    id: 'dev-020',
    ip: '10.1.2.100',
    mac: '00:DE:AD:BE:EF:01',
    ouiVendor: 'Unknown',
    hostname: '',
    deviceType: 'Unknown',
    vendor: 'Unknown',
    model: '',
    firmwareVersion: '',
    purdueLevel: 'L2',
    recommendedPurdueLevel: 'L1',
    protocols: ['Modbus/TCP'],
    confidenceScore: 1,
    criticality: 'Medium',
    firstSeen: '2024-11-30T15:00:00Z',
    lastSeen: '2024-12-18T10:00:00Z',
    identificationMethods: ['Port Detection'],
    communicationPartners: [
      { ip: '10.1.1.10', protocol: 'Modbus/TCP', direction: 'outbound' },
    ],
    protocolDetails: {
      'Modbus/TCP': 'Unit ID: unknown, sporadic write requests observed',
    },
    securityFindings: ['Unidentified device on OT network', 'Observed Purdue level (L2) does not match recommended (L1)'],
  },
];

// ---------------------------------------------------------------------------
// Confidence stars
// ---------------------------------------------------------------------------

function ConfidenceScore({ score }: { score: number }) {
  const colors = ['', 'text-red-400', 'text-orange-400', 'text-amber-400', 'text-green-400', 'text-blue-400'];
  const bgColors = ['', 'bg-red-500/10', 'bg-orange-500/10', 'bg-amber-500/10', 'bg-green-500/10', 'bg-blue-500/10'];
  return (
    <span className={cn('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded', bgColors[score])}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-2.5 w-2.5 rounded-sm',
            i < score ? bgColors[score] : 'bg-surface-hover',
            i < score ? colors[score] : 'text-content-muted'
          )}
        >
          <Star className={cn('h-2.5 w-2.5', i < score ? 'fill-current' : '')} />
        </span>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Criticality Badge
// ---------------------------------------------------------------------------

function CriticalityBadge({ criticality }: { criticality: Criticality }) {
  const variantMap: Record<Criticality, 'critical' | 'high' | 'medium' | 'low'> = {
    Critical: 'critical',
    High: 'high',
    Medium: 'medium',
    Low: 'low',
  };
  return <Badge variant={variantMap[criticality]} dot>{criticality}</Badge>;
}

// ---------------------------------------------------------------------------
// Device Detail Side Panel
// ---------------------------------------------------------------------------

function DeviceDetailPanel({ device, onClose }: { device: DeviceRecord; onClose: () => void }) {
  const levelMismatch = device.purdueLevel !== device.recommendedPurdueLevel;

  return (
    <div className="fixed right-0 top-0 z-50 h-screen w-[420px] border-l border-border-default bg-surface-card shadow-2xl overflow-y-auto">
      <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-content-primary">{device.hostname || device.ip}</h3>
          <p className="text-[10px] text-content-tertiary">{device.vendor} {device.model}</p>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface-hover text-content-tertiary hover:text-content-primary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-5">
        {/* Properties Grid */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary mb-2">Device Properties</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['IP Address', device.ip],
              ['MAC Address', `${device.mac} (${device.ouiVendor})`],
              ['Hostname', device.hostname || '-'],
              ['Device Type', device.deviceType],
              ['Vendor', device.vendor],
              ['Model', device.model || '-'],
              ['Firmware', device.firmwareVersion || '-'],
              ['Criticality', ''],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary">{label}</p>
                {label === 'Criticality' ? (
                  <CriticalityBadge criticality={device.criticality} />
                ) : (
                  <p className="mt-0.5 text-xs text-content-primary break-all">{value}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Purdue Level */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary mb-2">Purdue Level</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-content-secondary">Observed:</span>
              <Badge variant="info">{device.purdueLevel}</Badge>
            </div>
            <ChevronRight className="h-3 w-3 text-content-muted" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-content-secondary">Recommended:</span>
              <Badge variant={levelMismatch ? 'high' : 'low'}>{device.recommendedPurdueLevel}</Badge>
            </div>
          </div>
          {levelMismatch && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              Observed level does not match recommended placement
            </div>
          )}
        </div>

        {/* Confidence */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary mb-2">Confidence Score</p>
          <ConfidenceScore score={device.confidenceScore} />
        </div>

        {/* Identification Methods */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary mb-2">Identification Methods</p>
          <div className="flex flex-wrap gap-1.5">
            {device.identificationMethods.map((m) => (
              <Badge key={m} variant="outline">{m}</Badge>
            ))}
          </div>
        </div>

        {/* Protocols */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary mb-2">Protocols Observed</p>
          <div className="flex flex-wrap gap-1.5">
            {device.protocols.map((p) => (
              <Badge key={p} variant="default">{p}</Badge>
            ))}
          </div>
        </div>

        {/* Communication Partners */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary mb-2">
            Communication Partners ({device.communicationPartners.length})
          </p>
          <div className="space-y-1.5">
            {device.communicationPartners.length === 0 ? (
              <p className="text-xs text-content-muted italic">No communication partners observed</p>
            ) : (
              device.communicationPartners.map((cp, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border border-border-default bg-surface-hover/30 px-2.5 py-1.5 text-xs">
                  <span className="font-mono text-content-primary">{cp.ip}</span>
                  <Badge variant="outline">{cp.protocol}</Badge>
                  <span className={cn(
                    'ml-auto text-[10px]',
                    cp.direction === 'inbound' ? 'text-cyan-400' :
                    cp.direction === 'outbound' ? 'text-violet-400' : 'text-emerald-400'
                  )}>
                    {cp.direction}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Protocol-Specific Details */}
        {Object.keys(device.protocolDetails).length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary mb-2">Protocol Details</p>
            <div className="space-y-2">
              {Object.entries(device.protocolDetails).map(([proto, detail]) => (
                <div key={proto} className="rounded-md border border-border-default bg-surface-hover/30 px-2.5 py-2">
                  <p className="text-[10px] font-semibold text-accent">{proto}</p>
                  <p className="text-xs text-content-secondary mt-0.5 break-all">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Security Findings */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary mb-2">
            Security Findings ({device.securityFindings.length})
          </p>
          {device.securityFindings.length === 0 ? (
            <p className="text-xs text-content-muted italic">No security findings</p>
          ) : (
            <div className="space-y-1.5">
              {device.securityFindings.map((f, i) => (
                <div key={i} className="flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/5 px-2.5 py-1.5">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-red-400" />
                  <p className="text-xs text-content-primary">{f}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timestamps */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary">First Seen</p>
            <p className="mt-0.5 text-xs text-content-secondary">{new Date(device.firstSeen).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary">Last Seen</p>
            <p className="mt-0.5 text-xs text-content-secondary">{new Date(device.lastSeen).toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function DeviceInventory() {
  const [selectedDevice, setSelectedDevice] = useState<DeviceRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [sortColumn, setSortColumn] = useState<string>('ip');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Stats
  const totalDevices = DEVICE_INVENTORY.length;
  const icsDevices = DEVICE_INVENTORY.filter((d) =>
    ['PLC', 'RTU', 'HMI', 'SCADA Server', 'Historian', 'IoT Gateway'].includes(d.deviceType)
  ).length;
  const infraDevices = DEVICE_INVENTORY.filter((d) =>
    ['Switch', 'Router', 'Firewall'].includes(d.deviceType)
  ).length;
  const unknownDevices = DEVICE_INVENTORY.filter((d) =>
    d.deviceType === 'Unknown'
  ).length;

  // Filter and sort
  const filteredDevices = useMemo(() => {
    let devices = [...DEVICE_INVENTORY];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      devices = devices.filter(
        (d) =>
          d.ip.includes(q) ||
          d.hostname.toLowerCase().includes(q) ||
          d.mac.toLowerCase().includes(q) ||
          d.vendor.toLowerCase().includes(q) ||
          d.model.toLowerCase().includes(q)
      );
    }

    if (typeFilter !== 'all') {
      devices = devices.filter((d) => d.deviceType === typeFilter);
    }

    if (levelFilter !== 'all') {
      devices = devices.filter((d) => d.purdueLevel === levelFilter);
    }

    devices.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sortColumn) {
        case 'ip': aVal = a.ip; bVal = b.ip; break;
        case 'hostname': aVal = a.hostname; bVal = b.hostname; break;
        case 'type': aVal = a.deviceType; bVal = b.deviceType; break;
        case 'vendor': aVal = a.vendor; bVal = b.vendor; break;
        case 'confidence': aVal = a.confidenceScore; bVal = b.confidenceScore; break;
        case 'criticality': {
          const order: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
          aVal = order[a.criticality] ?? 4;
          bVal = order[b.criticality] ?? 4;
          break;
        }
        case 'lastSeen': aVal = a.lastSeen; bVal = b.lastSeen; break;
        default: aVal = a.ip; bVal = b.ip;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return devices;
  }, [searchQuery, typeFilter, levelFilter, sortColumn, sortDir]);

  const handleSort = useCallback((col: string) => {
    if (sortColumn === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDir('asc');
    }
  }, [sortColumn]);

  const deviceTypes = [...new Set(DEVICE_INVENTORY.map((d) => d.deviceType))].sort();
  const purdeLevels = [...new Set(DEVICE_INVENTORY.map((d) => d.purdueLevel))].sort();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15">
          <Server className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-content-primary">Device Inventory</h1>
          <p className="text-xs text-content-secondary">
            Discovered ICS/SCADA devices with passive identification and classification
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Server size={20} />}
          label="Total Devices"
          value={totalDevices}
        />
        <StatCard
          icon={<Cpu size={20} />}
          label="ICS Devices"
          value={icsDevices}
          severity="critical"
        />
        <StatCard
          icon={<Monitor size={20} />}
          label="Network Infrastructure"
          value={infraDevices}
          severity="info"
        />
        <StatCard
          icon={<HelpCircle size={20} />}
          label="Unknown / Unclassified"
          value={unknownDevices}
          severity="medium"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-2">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-content-tertiary" />
              <input
                type="text"
                placeholder="Search by IP, hostname, MAC, vendor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-border-default bg-surface-hover pl-8 pr-3 py-1.5 text-xs text-content-primary placeholder:text-content-muted focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-md border border-border-default bg-surface-hover px-2 py-1.5 text-xs text-content-primary focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="all">All Device Types</option>
              {deviceTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="rounded-md border border-border-default bg-surface-hover px-2 py-1.5 text-xs text-content-primary focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="all">All Purdue Levels</option>
              {purdeLevels.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>

            <span className="text-xs text-content-tertiary ml-auto">
              {filteredDevices.length} of {totalDevices} devices
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Device Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full text-xs border-collapse min-w-[1200px]">
              <thead className="border-b border-border-default bg-surface-hover/30">
                <tr>
                  {[
                    { key: 'ip', label: 'IP Address', width: 'w-[110px]' },
                    { key: 'mac', label: 'MAC Address', width: 'w-[160px]' },
                    { key: 'hostname', label: 'Hostname', width: 'w-[120px]' },
                    { key: 'type', label: 'Device Type', width: 'w-[110px]' },
                    { key: 'vendor', label: 'Vendor', width: 'w-[120px]' },
                    { key: 'model', label: 'Model', width: 'w-[140px]' },
                    { key: 'firmware', label: 'Firmware', width: 'w-[100px]' },
                    { key: 'purdue', label: 'Purdue', width: 'w-[60px]' },
                    { key: 'protocols', label: 'Protocols', width: 'w-[140px]' },
                    { key: 'confidence', label: 'Confidence', width: 'w-[100px]' },
                    { key: 'criticality', label: 'Criticality', width: 'w-[90px]' },
                    { key: 'lastSeen', label: 'Last Seen', width: 'w-[130px]' },
                  ].map((col) => (
                    <th
                      key={col.key}
                      className={cn(
                        'px-2.5 py-2 text-left text-[10px] font-semibold text-content-secondary uppercase tracking-wider cursor-pointer hover:text-content-primary transition-colors',
                        col.width
                      )}
                      onClick={() => handleSort(col.key)}
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        {sortColumn === col.key && (
                          <ArrowUpDown className="h-3 w-3 text-accent" />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDevices.map((device) => (
                  <tr
                    key={device.id}
                    onClick={() => setSelectedDevice(device)}
                    className={cn(
                      'border-b border-border-default transition-colors hover:bg-surface-hover/50 cursor-pointer',
                      selectedDevice?.id === device.id && 'bg-accent/5',
                      device.deviceType === 'Unknown' && 'bg-amber-500/5'
                    )}
                  >
                    <td className="px-2.5 py-2 font-mono text-content-primary">{device.ip}</td>
                    <td className="px-2.5 py-2">
                      <span className="font-mono text-content-primary">{device.mac}</span>
                      <span className="text-[10px] text-content-tertiary block">({device.ouiVendor})</span>
                    </td>
                    <td className="px-2.5 py-2 text-content-primary">{device.hostname || <span className="text-content-muted italic">unknown</span>}</td>
                    <td className="px-2.5 py-2">
                      <Badge variant={
                        ['PLC', 'RTU', 'SCADA Server'].includes(device.deviceType) ? 'critical' :
                        ['HMI', 'Historian', 'Engineering WS'].includes(device.deviceType) ? 'high' :
                        ['Switch', 'Router', 'Firewall'].includes(device.deviceType) ? 'info' :
                        device.deviceType === 'Unknown' ? 'medium' : 'outline'
                      }>
                        {device.deviceType}
                      </Badge>
                    </td>
                    <td className="px-2.5 py-2 text-content-primary">{device.vendor}</td>
                    <td className="px-2.5 py-2 text-content-secondary truncate max-w-[140px]">{device.model || '-'}</td>
                    <td className="px-2.5 py-2 text-content-secondary font-mono text-[10px]">{device.firmwareVersion || '-'}</td>
                    <td className="px-2.5 py-2">
                      <span
                        className="inline-flex h-5 min-w-[32px] items-center justify-center rounded text-[10px] font-bold text-white px-1"
                        style={{ backgroundColor: PURDUE_LEVEL_COLORS[device.purdueLevel] ?? '#6b7280' }}
                      >
                        {device.purdueLevel}
                      </span>
                    </td>
                    <td className="px-2.5 py-2">
                      <div className="flex flex-wrap gap-1">
                        {device.protocols.slice(0, 3).map((p) => (
                          <Badge key={p} variant="outline">{p}</Badge>
                        ))}
                        {device.protocols.length > 3 && (
                          <Badge variant="outline">+{device.protocols.length - 3}</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-2.5 py-2">
                      <ConfidenceScore score={device.confidenceScore} />
                    </td>
                    <td className="px-2.5 py-2">
                      <CriticalityBadge criticality={device.criticality} />
                    </td>
                    <td className="px-2.5 py-2 text-content-tertiary text-[10px]">
                      {new Date(device.lastSeen).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Device Detail Side Panel */}
      {selectedDevice && (
        <DeviceDetailPanel device={selectedDevice} onClose={() => setSelectedDevice(null)} />
      )}
    </div>
  );
}

// Purdue level color map
const PURDUE_LEVEL_COLORS: Record<string, string> = {
  L0: '#ef4444',
  L1: '#f97316',
  L2: '#eab308',
  L3: '#22c55e',
  DMZ: '#8b5cf6',
  L4: '#3b82f6',
  L5: '#06b6d4',
};
