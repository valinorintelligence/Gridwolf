import { AlertTriangle, Wifi, WifiOff, Clock, Cpu } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import type { OntologyObject } from '@/types/ontology';

// Fingerprint shape read from ontology object properties (persisted server-side).
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


// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AssetFingerprintProps {
  object: OntologyObject;
  className?: string;
}

/**
 * Read a typed fingerprint out of the ontology object's persisted `properties`
 * map. Returns null unless every required field is present — we don't want
 * to render partial fingerprints that imply scan data we don't actually have.
 */
function readFingerprint(object: OntologyObject): FingerprintData | null {
  const p = (object.properties ?? {}) as Partial<FingerprintData>;
  const required: (keyof FingerprintData)[] = [
    'vendor', 'model', 'firmwareVersion', 'firmwareStatus', 'protocols',
    'networkExposure', 'hardwareLifecycle',
  ];
  for (const key of required) {
    if (p[key] === undefined || p[key] === null || p[key] === '') return null;
  }
  return p as FingerprintData;
}

export function AssetFingerprint({ object, className }: AssetFingerprintProps) {
  const fingerprint = readFingerprint(object);

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
