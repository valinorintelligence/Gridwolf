import { Server, Shield, AlertTriangle, Wifi, WifiOff, Clock, Cpu } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import type { OntologyObject } from '@/types/ontology';

// ---------------------------------------------------------------------------
// Mock fingerprint data keyed by host id
// ---------------------------------------------------------------------------

interface FingerprintData {
  vendor: string;
  model: string;
  firmwareVersion: string;
  firmwareStatus: 'current' | 'outdated' | 'end-of-life';
  latestFirmware: string;
  protocols: string[];
  cveCount: number;
  criticalCves: number;
  networkExposure: 'internet-facing' | 'dmz' | 'isolated';
  lastScanTimestamp: string;
  hardwareLifecycle: 'active' | 'limited-support' | 'end-of-life';
  serialNumber: string;
  macAddress: string;
}

const FINGERPRINT_DB: Record<string, FingerprintData> = {
  'h-001': {
    vendor: 'Siemens',
    model: 'S7-1500 CPU 1516-3 PN/DP',
    firmwareVersion: '2.9.4',
    firmwareStatus: 'outdated',
    latestFirmware: '3.1.2',
    protocols: ['S7comm', 'Modbus/TCP', 'PROFINET', 'OPC UA'],
    cveCount: 12,
    criticalCves: 3,
    networkExposure: 'isolated',
    lastScanTimestamp: '2024-12-18T06:00:00Z',
    hardwareLifecycle: 'active',
    serialNumber: 'S7C-2024-001583',
    macAddress: '00:1C:06:1A:2B:3C',
  },
  'h-002': {
    vendor: 'Rockwell Automation',
    model: 'PanelView Plus 7 2711P-T10C22D8S',
    firmwareVersion: '12.011',
    firmwareStatus: 'current',
    latestFirmware: '12.011',
    protocols: ['EtherNet/IP', 'CIP'],
    cveCount: 4,
    criticalCves: 1,
    networkExposure: 'isolated',
    lastScanTimestamp: '2024-12-18T06:00:00Z',
    hardwareLifecycle: 'active',
    serialNumber: 'RA-PV7-089214',
    macAddress: '00:00:BC:3E:4F:5A',
  },
  'h-003': {
    vendor: 'Schneider Electric',
    model: 'Engineering Workstation (Unity Pro XL)',
    firmwareVersion: '14.1',
    firmwareStatus: 'outdated',
    latestFirmware: '15.0',
    protocols: ['Modbus/TCP', 'OPC UA', 'UMAS'],
    cveCount: 8,
    criticalCves: 0,
    networkExposure: 'isolated',
    lastScanTimestamp: '2024-12-18T06:00:00Z',
    hardwareLifecycle: 'active',
    serialNumber: 'SE-EWS-442781',
    macAddress: '00:80:F4:12:34:56',
  },
  'h-004': {
    vendor: 'Honeywell',
    model: 'Uniformance PHD Server',
    firmwareVersion: '2023.2',
    firmwareStatus: 'outdated',
    latestFirmware: '2024.1',
    protocols: ['OPC UA', 'OPC DA', 'ODBC'],
    cveCount: 6,
    criticalCves: 2,
    networkExposure: 'dmz',
    lastScanTimestamp: '2024-12-18T06:00:00Z',
    hardwareLifecycle: 'active',
    serialNumber: 'HW-PHD-119832',
    macAddress: '00:D0:C9:AA:BB:CC',
  },
  'h-005': {
    vendor: 'ABB',
    model: 'RTU560',
    firmwareVersion: '12.4.1',
    firmwareStatus: 'end-of-life',
    latestFirmware: 'N/A (EoL)',
    protocols: ['DNP3', 'IEC 61850', 'Modbus/TCP'],
    cveCount: 15,
    criticalCves: 4,
    networkExposure: 'isolated',
    lastScanTimestamp: '2024-12-18T06:00:00Z',
    hardwareLifecycle: 'end-of-life',
    serialNumber: 'ABB-RTU-005412',
    macAddress: '00:21:99:DD:EE:FF',
  },
  'h-006': {
    vendor: 'Palo Alto Networks',
    model: 'PA-3260',
    firmwareVersion: '11.1.2',
    firmwareStatus: 'current',
    latestFirmware: '11.1.2',
    protocols: ['Syslog', 'SNMP', 'NetFlow'],
    cveCount: 1,
    criticalCves: 0,
    networkExposure: 'dmz',
    lastScanTimestamp: '2024-12-18T06:00:00Z',
    hardwareLifecycle: 'active',
    serialNumber: 'PA-3260-SN88123',
    macAddress: '00:1B:17:00:01:02',
  },
  'h-007': {
    vendor: 'Inductive Automation',
    model: 'Ignition Gateway 8.1',
    firmwareVersion: '8.1.33',
    firmwareStatus: 'current',
    latestFirmware: '8.1.33',
    protocols: ['Modbus/TCP', 'OPC UA', 'EtherNet/IP', 'DNP3', 'BACnet/IP'],
    cveCount: 3,
    criticalCves: 0,
    networkExposure: 'isolated',
    lastScanTimestamp: '2024-12-18T06:00:00Z',
    hardwareLifecycle: 'active',
    serialNumber: 'IA-IGN-771002',
    macAddress: '08:00:27:1A:2B:3C',
  },
  'h-008': {
    vendor: 'Siemens',
    model: 'IOT2050 Advanced',
    firmwareVersion: '1.3.1',
    firmwareStatus: 'outdated',
    latestFirmware: '1.4.0',
    protocols: ['BACnet/IP', 'MQTT', 'Modbus/TCP'],
    cveCount: 5,
    criticalCves: 1,
    networkExposure: 'isolated',
    lastScanTimestamp: '2024-12-18T06:00:00Z',
    hardwareLifecycle: 'active',
    serialNumber: 'SI-IOT-203944',
    macAddress: '00:1C:06:4D:5E:6F',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AssetFingerprintProps {
  object: OntologyObject;
  className?: string;
}

export function AssetFingerprint({ object, className }: AssetFingerprintProps) {
  const fingerprint = FINGERPRINT_DB[object.id];

  if (!fingerprint) {
    return (
      <Card className={className}>
        <CardHeader title="Asset Fingerprint" />
        <CardContent>
          <p className="text-xs text-content-muted">
            No fingerprint data available for this asset. Run an active scan to discover device details.
          </p>
        </CardContent>
      </Card>
    );
  }

  const firmwareVariant: Record<string, 'default' | 'critical' | 'high' | 'medium'> = {
    current: 'default',
    outdated: 'medium',
    'end-of-life': 'critical',
  };

  const exposureVariant: Record<string, 'critical' | 'high' | 'default'> = {
    'internet-facing': 'critical',
    dmz: 'high',
    isolated: 'default',
  };

  const lifecycleVariant: Record<string, 'default' | 'medium' | 'critical'> = {
    active: 'default',
    'limited-support': 'medium',
    'end-of-life': 'critical',
  };

  return (
    <Card className={className}>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-accent" />
            Asset Fingerprint
          </span>
        }
        action={<Badge variant={lifecycleVariant[fingerprint.hardwareLifecycle]} dot>{fingerprint.hardwareLifecycle}</Badge>}
      />
      <CardContent className="space-y-4">
        {/* Device Info */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary">Vendor</p>
            <p className="mt-0.5 text-sm font-medium text-content-primary">{fingerprint.vendor}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary">Model</p>
            <p className="mt-0.5 text-sm text-content-primary">{fingerprint.model}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary">Serial Number</p>
            <p className="mt-0.5 text-sm font-mono text-content-secondary">{fingerprint.serialNumber}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary">MAC Address</p>
            <p className="mt-0.5 text-sm font-mono text-content-secondary">{fingerprint.macAddress}</p>
          </div>
        </div>

        {/* Firmware */}
        <div className="rounded-md border border-border-default p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-content-primary">Firmware</p>
            <Badge variant={firmwareVariant[fingerprint.firmwareStatus]} dot>
              {fingerprint.firmwareStatus === 'current' ? 'Up to Date' : fingerprint.firmwareStatus === 'outdated' ? 'Update Available' : 'End of Life'}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-content-secondary">
              Installed: <span className="font-mono text-content-primary">{fingerprint.firmwareVersion}</span>
            </span>
            {fingerprint.firmwareStatus !== 'current' && (
              <span className="text-content-secondary">
                Latest: <span className="font-mono text-content-primary">{fingerprint.latestFirmware}</span>
              </span>
            )}
          </div>
        </div>

        {/* Protocol Support */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary mb-2">Protocol Support</p>
          <div className="flex flex-wrap gap-1.5">
            {fingerprint.protocols.map((proto) => (
              <Badge key={proto} variant="info">{proto}</Badge>
            ))}
          </div>
        </div>

        {/* CVE Exposure */}
        <div className="flex items-center justify-between rounded-md border border-border-default p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className={cn('h-4 w-4', fingerprint.criticalCves > 0 ? 'text-red-400' : 'text-amber-400')} />
            <span className="text-xs text-content-primary">CVE Exposure</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-content-primary">{fingerprint.cveCount} total</span>
            {fingerprint.criticalCves > 0 && (
              <Badge variant="critical">{fingerprint.criticalCves} critical</Badge>
            )}
          </div>
        </div>

        {/* Network Exposure */}
        <div className="flex items-center justify-between rounded-md border border-border-default p-3">
          <div className="flex items-center gap-2">
            {fingerprint.networkExposure === 'isolated' ? (
              <WifiOff className="h-4 w-4 text-emerald-400" />
            ) : (
              <Wifi className="h-4 w-4 text-amber-400" />
            )}
            <span className="text-xs text-content-primary">Network Exposure</span>
          </div>
          <Badge variant={exposureVariant[fingerprint.networkExposure]} dot>
            {fingerprint.networkExposure}
          </Badge>
        </div>

        {/* Last Scan */}
        <div className="flex items-center gap-2 text-xs text-content-tertiary">
          <Clock className="h-3.5 w-3.5" />
          <span>Last scanned: {new Date(fingerprint.lastScanTimestamp).toLocaleString()}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default AssetFingerprint;
