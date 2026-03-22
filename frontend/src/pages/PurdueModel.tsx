import { useMemo, useState } from 'react';
import { Layers, X, Server, ShieldAlert, ArrowDown, ArrowUp, Shield } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { MOCK_OBJECTS } from '@/data/mock';
import { PURDUE_LEVELS } from '@/lib/constants';
import { cn } from '@/lib/cn';
import type { OntologyObject } from '@/types/ontology';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LEVEL_COLORS: Record<string, string> = {
  L0: '#ef4444',
  L1: '#f97316',
  L2: '#eab308',
  L3: '#22c55e',
  DMZ: '#8b5cf6',
  L4: '#3b82f6',
  L5: '#06b6d4',
};

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  L0: 'Physical sensors, actuators, and process equipment',
  L1: 'PLCs, RTUs, and basic controllers that directly control L0 devices',
  L2: 'HMIs, SCADA servers, and supervisory control systems',
  L3: 'Site-level operations: historians, engineering workstations, MES',
  DMZ: 'Demilitarized zone separating OT from IT networks',
  L4: 'Enterprise IT network: business systems, ERP, email',
  L5: 'Enterprise zone: internet connectivity, cloud services',
};

interface CrossLevelFlow {
  id: string;
  sourceLevel: string;
  targetLevel: string;
  protocol: string;
  description: string;
  authorized: boolean;
  sourceIp: string;
  targetIp: string;
}

const CROSS_LEVEL_FLOWS: CrossLevelFlow[] = [
  { id: 'clf-001', sourceLevel: 'L2', targetLevel: 'L1', protocol: 'Modbus/TCP', description: 'SCADA polling PLC registers', authorized: true, sourceIp: '10.1.2.50', targetIp: '10.1.1.10' },
  { id: 'clf-002', sourceLevel: 'L2', targetLevel: 'L1', protocol: 'EtherNet/IP', description: 'HMI reading PLC tags', authorized: true, sourceIp: '10.1.2.20', targetIp: '10.1.1.10' },
  { id: 'clf-003', sourceLevel: 'L2', targetLevel: 'L1', protocol: 'DNP3', description: 'SCADA polling RTU', authorized: true, sourceIp: '10.1.2.50', targetIp: '192.168.1.50' },
  { id: 'clf-004', sourceLevel: 'L3', targetLevel: 'L1', protocol: 'S7comm', description: 'EWS programming PLC', authorized: true, sourceIp: '10.1.3.15', targetIp: '10.1.1.10' },
  { id: 'clf-005', sourceLevel: 'L3', targetLevel: 'L2', protocol: 'OPC UA', description: 'Historian collecting SCADA data', authorized: true, sourceIp: '10.1.4.100', targetIp: '10.1.2.50' },
  { id: 'clf-006', sourceLevel: 'L0', targetLevel: 'L2', protocol: 'BACnet/IP', description: 'IoT gateway sending sensor data', authorized: true, sourceIp: '192.168.1.200', targetIp: '10.1.2.50' },
  { id: 'clf-007', sourceLevel: 'L0', targetLevel: 'L4', protocol: 'HTTPS', description: 'ALERT: Sensor gateway reaching enterprise network', authorized: false, sourceIp: '192.168.1.200', targetIp: '10.100.1.50' },
  { id: 'clf-008', sourceLevel: 'L5', targetLevel: 'L2', protocol: 'RDP', description: 'ALERT: External IP accessing SCADA directly (bypassing DMZ)', authorized: false, sourceIp: '203.0.113.45', targetIp: '10.1.2.50' },
  { id: 'clf-009', sourceLevel: 'L1', targetLevel: 'L4', protocol: 'TCP/443', description: 'ALERT: PLC attempting outbound connection to enterprise zone', authorized: false, sourceIp: '10.1.1.10', targetIp: '10.100.1.100' },
];

// ---------------------------------------------------------------------------
// Zone boundaries
// ---------------------------------------------------------------------------

const ZONE_BOUNDARIES = [
  { between: ['L3', 'DMZ'], label: 'OT/IT Security Boundary', color: '#ef4444' },
  { between: ['DMZ', 'L4'], label: 'IT Perimeter', color: '#f97316' },
];

// ---------------------------------------------------------------------------
// Helper: Determine level number for distance calculation
// ---------------------------------------------------------------------------

function levelIndex(key: string): number {
  const map: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3, DMZ: 3.5, L4: 4, L5: 5 };
  return map[key] ?? -1;
}

function isUnauthorizedCrossLevel(flow: CrossLevelFlow): boolean {
  if (!flow.authorized) return true;
  const dist = Math.abs(levelIndex(flow.sourceLevel) - levelIndex(flow.targetLevel));
  return dist > 2;
}

// ---------------------------------------------------------------------------
// Side Panel
// ---------------------------------------------------------------------------

function AssetDetailPanel({ asset, onClose }: { asset: OntologyObject; onClose: () => void }) {
  const props = asset.properties;
  return (
    <div className="fixed right-0 top-0 z-50 h-screen w-96 border-l border-border-default bg-surface-card shadow-2xl overflow-y-auto">
      <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
        <h3 className="text-sm font-semibold text-content-primary truncate">{asset.title}</h3>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface-hover text-content-tertiary hover:text-content-primary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[
            ['IP Address', String(props.ip ?? '-')],
            ['Hostname', String(props.hostname ?? '-')],
            ['OS', String(props.os ?? '-')],
            ['Vendor', String(props.vendor ?? '-')],
            ['Model', String(props.model ?? '-')],
            ['Purdue Level', String(props.purdueLevel ?? '-')],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary">{label}</p>
              <p className="mt-0.5 text-sm text-content-primary">{value}</p>
            </div>
          ))}
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary mb-1">Status</p>
          <Badge variant={asset.status === 'active' ? 'default' : 'outline'} dot>{asset.status}</Badge>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary mb-1">Last Seen</p>
          <p className="text-sm text-content-secondary">
            {props.lastSeen ? new Date(String(props.lastSeen)).toLocaleString() : '-'}
          </p>
        </div>

        {/* Related flows */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary mb-2">Cross-Level Flows</p>
          <div className="space-y-1.5">
            {CROSS_LEVEL_FLOWS.filter(
              (f) => f.sourceIp === String(props.ip) || f.targetIp === String(props.ip)
            ).map((f) => (
              <div
                key={f.id}
                className={cn(
                  'rounded-md border px-2.5 py-1.5 text-xs',
                  f.authorized ? 'border-border-default bg-surface-hover/30' : 'border-red-500/30 bg-red-500/5'
                )}
              >
                <p className="text-content-primary">{f.description}</p>
                <p className="text-content-tertiary mt-0.5">{f.protocol} | {f.sourceLevel} &rarr; {f.targetLevel}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function PurdueModel() {
  const [selectedAsset, setSelectedAsset] = useState<OntologyObject | null>(null);

  const hosts = useMemo(
    () => MOCK_OBJECTS.filter((o) => o.typeId === 'type-host'),
    []
  );

  const hostsByLevel = useMemo(() => {
    const groups: Record<string, OntologyObject[]> = {};
    for (const host of hosts) {
      const level = String(host.properties.purdueLevel ?? 'Unknown');
      (groups[level] ??= []).push(host);
    }
    return groups;
  }, [hosts]);

  const unauthorizedFlows = useMemo(
    () => CROSS_LEVEL_FLOWS.filter((f) => !f.authorized),
    []
  );

  const statusColor = (host: OntologyObject) => {
    const vulnCount = MOCK_OBJECTS.filter(
      (o) => o.typeId === 'type-vuln' && (o.severity === 'critical' || o.severity === 'high')
    ).length;
    if (host.status !== 'active') return 'border-content-tertiary bg-surface-hover';
    if (vulnCount > 0) return 'border-amber-500 bg-amber-500/10';
    return 'border-emerald-500 bg-emerald-500/10';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15">
            <Layers className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-content-primary">Purdue Model / ISA-95</h1>
            <p className="text-xs text-content-secondary">
              Industrial network segmentation and cross-level communication analysis
            </p>
          </div>
        </div>
        {unauthorizedFlows.length > 0 && (
          <Badge variant="critical" dot>
            {unauthorizedFlows.length} Unauthorized Cross-Level Flow{unauthorizedFlows.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/15">
              <Server className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-content-primary">{hosts.length}</p>
              <p className="text-xs text-content-secondary">Total Assets</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15">
              <Layers className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-content-primary">{Object.keys(hostsByLevel).length}</p>
              <p className="text-xs text-content-secondary">Active Levels</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15">
              <Shield className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-content-primary">{CROSS_LEVEL_FLOWS.filter((f) => f.authorized).length}</p>
              <p className="text-xs text-content-secondary">Authorized Flows</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/15">
              <ShieldAlert className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-content-primary">{unauthorizedFlows.length}</p>
              <p className="text-xs text-content-secondary">Unauthorized Flows</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Purdue Model Visualization */}
      <Card>
        <CardHeader title="Purdue Reference Architecture" />
        <CardContent className="p-0">
          <div className="relative">
            {/* Render levels top-down: L5 at top, L0 at bottom */}
            {[...PURDUE_LEVELS].reverse().map((pLevel, idx) => {
              const levelKey = pLevel.level === 3.5 ? 'DMZ' : `L${pLevel.level}`;
              const levelHosts = hostsByLevel[levelKey] ?? [];
              const color = LEVEL_COLORS[levelKey] ?? '#6b7280';
              const desc = LEVEL_DESCRIPTIONS[levelKey] ?? '';

              // Check if a zone boundary exists below this level
              const zoneBoundary = ZONE_BOUNDARIES.find((z) => z.between[0] === levelKey);

              return (
                <div key={pLevel.level}>
                  {/* Level Band */}
                  <div
                    className="relative border-l-4 px-5 py-4"
                    style={{ borderLeftColor: color }}
                  >
                    {/* Level label & description */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="inline-flex h-8 min-w-[56px] items-center justify-center rounded-md px-2 text-xs font-bold text-white"
                          style={{ backgroundColor: color }}
                        >
                          {levelKey}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-content-primary">{pLevel.name}</p>
                          <p className="text-xs text-content-tertiary">{desc}</p>
                        </div>
                      </div>
                      <Badge variant="info">{levelHosts.length} asset{levelHosts.length !== 1 ? 's' : ''}</Badge>
                    </div>

                    {/* Assets */}
                    {levelHosts.length === 0 ? (
                      <p className="text-xs text-content-muted italic ml-[68px]">No assets discovered at this level</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ml-[68px]">
                        {levelHosts.map((host) => (
                          <button
                            key={host.id}
                            onClick={() => setSelectedAsset(host)}
                            className={cn(
                              'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all hover:shadow-md cursor-pointer',
                              statusColor(host),
                              selectedAsset?.id === host.id && 'ring-2 ring-accent'
                            )}
                          >
                            <Server className="h-4 w-4 shrink-0 text-content-secondary" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-content-primary truncate">{host.title}</p>
                              <p className="text-[10px] text-content-tertiary truncate">
                                {String(host.properties.ip)} | {String(host.properties.vendor ?? '')}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Inter-level flows from this level */}
                    {CROSS_LEVEL_FLOWS.filter((f) => f.sourceLevel === levelKey).length > 0 && (
                      <div className="mt-3 ml-[68px] flex flex-wrap gap-2">
                        {CROSS_LEVEL_FLOWS.filter((f) => f.sourceLevel === levelKey).map((f) => (
                          <div
                            key={f.id}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px]',
                              f.authorized
                                ? 'border-border-default text-content-secondary'
                                : 'border-red-500/40 bg-red-500/10 text-red-400 font-semibold'
                            )}
                          >
                            {f.authorized ? (
                              <ArrowDown className="h-3 w-3" />
                            ) : (
                              <ShieldAlert className="h-3 w-3" />
                            )}
                            {f.sourceLevel} &rarr; {f.targetLevel}
                            <span className="opacity-70">({f.protocol})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Zone Boundary Separator */}
                  {zoneBoundary && (
                    <div
                      className="relative flex items-center gap-3 px-5 py-2"
                      style={{ backgroundColor: `${zoneBoundary.color}10` }}
                    >
                      <div className="flex-1 border-t-2 border-dashed" style={{ borderColor: zoneBoundary.color }} />
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest" style={{ color: zoneBoundary.color }}>
                        {zoneBoundary.label}
                      </span>
                      <div className="flex-1 border-t-2 border-dashed" style={{ borderColor: zoneBoundary.color }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Unauthorized Communications */}
      {unauthorizedFlows.length > 0 && (
        <Card accentColor="#ef4444">
          <CardHeader
            title="Unauthorized Cross-Level Communications"
            action={<Badge variant="critical" dot>{unauthorizedFlows.length}</Badge>}
          />
          <CardContent>
            <div className="space-y-2">
              {unauthorizedFlows.map((f) => (
                <div
                  key={f.id}
                  className="flex items-start gap-3 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2.5"
                >
                  <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-red-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-content-primary">{f.description}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-content-tertiary">
                      <span className="font-mono">{f.sourceIp} ({f.sourceLevel})</span>
                      <ArrowDown className="h-3 w-3 text-red-400" />
                      <span className="font-mono">{f.targetIp} ({f.targetLevel})</span>
                      <Badge variant="outline">{f.protocol}</Badge>
                    </div>
                  </div>
                  <Badge variant="critical">Violation</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cross-Level Flow Summary */}
      <Card>
        <CardHeader title="All Cross-Level Communication Flows" />
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="border-b border-border-default">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-content-secondary uppercase tracking-wider">Source</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-content-secondary uppercase tracking-wider">Direction</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-content-secondary uppercase tracking-wider">Target</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-content-secondary uppercase tracking-wider">Protocol</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-content-secondary uppercase tracking-wider">Description</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-content-secondary uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="[&>tr:last-child]:border-0">
                {CROSS_LEVEL_FLOWS.map((f) => (
                  <tr
                    key={f.id}
                    className={cn(
                      'border-b border-border-default transition-colors hover:bg-surface-hover/50',
                      !f.authorized && 'bg-red-500/5'
                    )}
                  >
                    <td className="px-3 py-2 font-mono text-xs text-content-primary">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: LEVEL_COLORS[f.sourceLevel] }} />
                        {f.sourceLevel} ({f.sourceIp})
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {levelIndex(f.sourceLevel) > levelIndex(f.targetLevel) ? (
                        <ArrowDown className="h-4 w-4 mx-auto text-content-tertiary" />
                      ) : (
                        <ArrowUp className="h-4 w-4 mx-auto text-content-tertiary" />
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-content-primary">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: LEVEL_COLORS[f.targetLevel] }} />
                        {f.targetLevel} ({f.targetIp})
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">{f.protocol}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-content-secondary max-w-xs truncate">{f.description}</td>
                    <td className="px-3 py-2">
                      {f.authorized ? (
                        <Badge variant="low" dot>Authorized</Badge>
                      ) : (
                        <Badge variant="critical" dot>Unauthorized</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Asset Detail Side Panel */}
      {selectedAsset && (
        <AssetDetailPanel asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
      )}
    </div>
  );
}
