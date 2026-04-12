import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  Server, Cpu, Shield, HelpCircle, X, ChevronRight,
  Search, Filter, ArrowUpDown, Star, AlertTriangle, Monitor, Loader2,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import StatCard from '@/components/dashboard/StatCard';
import { cn } from '@/lib/cn';
import { api } from '@/services/api';

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

/** Shape returned by GET /ics/devices/ */
interface ApiDevice {
  id: string;
  session_id?: string;
  ip_address: string;
  mac_address: string;
  hostname: string;
  vendor: string;
  device_type: string;
  purdue_level: string;
  protocols: string[];
  open_ports: number[];
  firmware_version: string;
  model: string;
  confidence: number;
  packet_count?: number;
  first_seen: string;
  last_seen: string;
}

/** Shape returned by GET /ics/devices/{id} (extends ApiDevice with connections) */
interface ApiDeviceDetail extends ApiDevice {
  connections?: {
    ip_address?: string;
    protocol?: string;
    direction?: string;
  }[];
}

// ---------------------------------------------------------------------------
// Helpers – map backend snake_case to component's DeviceRecord
// ---------------------------------------------------------------------------

function deriveCriticality(deviceType: string, confidence: number): Criticality {
  const criticalTypes = ['PLC', 'RTU', 'SCADA Server', 'Firewall'];
  const highTypes = ['HMI', 'Historian', 'Engineering WS', 'Switch', 'Router'];
  if (criticalTypes.includes(deviceType)) return 'Critical';
  if (highTypes.includes(deviceType)) return 'High';
  if (confidence <= 2) return 'Medium';
  return 'Medium';
}

function deriveIdentificationMethods(d: ApiDevice): IdentificationMethod[] {
  const methods: IdentificationMethod[] = [];
  if (d.open_ports && d.open_ports.length > 0) methods.push('Port Detection');
  if (d.mac_address && d.vendor) methods.push('OUI Lookup');
  if (d.protocols && d.protocols.length > 0) methods.push('Protocol Deep Parse');
  if (methods.length === 0) methods.push('Port Detection');
  return methods;
}

function mapApiDeviceToRecord(d: ApiDevice, connections?: ApiDeviceDetail['connections']): DeviceRecord {
  const deviceType = (d.device_type || 'Unknown') as DeviceType;
  const purdueLevel = d.purdue_level || 'Unknown';

  return {
    id: String(d.id),
    ip: d.ip_address || '',
    mac: d.mac_address || '',
    ouiVendor: d.vendor || 'Unknown',
    hostname: d.hostname || '',
    deviceType,
    vendor: d.vendor || 'Unknown',
    model: d.model || '',
    firmwareVersion: d.firmware_version || '',
    purdueLevel,
    recommendedPurdueLevel: purdueLevel,
    protocols: d.protocols || [],
    confidenceScore: Math.max(1, Math.min(5, d.confidence ?? 1)),
    criticality: deriveCriticality(deviceType, d.confidence ?? 1),
    firstSeen: d.first_seen || '',
    lastSeen: d.last_seen || '',
    identificationMethods: deriveIdentificationMethods(d),
    communicationPartners: (connections || []).map((c) => ({
      ip: c.ip_address || '',
      protocol: c.protocol || '',
      direction: (c.direction as 'inbound' | 'outbound' | 'bidirectional') || 'bidirectional',
    })),
    protocolDetails: {},
    securityFindings: [],
  };
}

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
  const [detailDevice, setDetailDevice] = useState<DeviceRecord>(device);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingDetail(true);
    api
      .get<ApiDeviceDetail>(`/ics/devices/${device.id}`)
      .then((res) => {
        if (!cancelled) {
          setDetailDevice(mapApiDeviceToRecord(res.data, res.data.connections));
        }
      })
      .catch(() => {
        // Fall back to the list-level data already available
        if (!cancelled) setDetailDevice(device);
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [device.id]);

  const levelMismatch = detailDevice.purdueLevel !== detailDevice.recommendedPurdueLevel;

  return (
    <div className="fixed right-0 top-0 z-50 h-screen w-[420px] border-l border-border-default bg-surface-card shadow-2xl overflow-y-auto">
      <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-content-primary">{detailDevice.hostname || detailDevice.ip}</h3>
          <p className="text-[10px] text-content-tertiary">{detailDevice.vendor} {detailDevice.model}</p>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface-hover text-content-tertiary hover:text-content-primary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {loadingDetail ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      ) : (
        <div className="p-4 space-y-5">
          {/* Properties Grid */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary mb-2">Device Properties</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['IP Address', detailDevice.ip],
                ['MAC Address', `${detailDevice.mac} (${detailDevice.ouiVendor})`],
                ['Hostname', detailDevice.hostname || '-'],
                ['Device Type', detailDevice.deviceType],
                ['Vendor', detailDevice.vendor],
                ['Model', detailDevice.model || '-'],
                ['Firmware', detailDevice.firmwareVersion || '-'],
                ['Criticality', ''],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary">{label}</p>
                  {label === 'Criticality' ? (
                    <CriticalityBadge criticality={detailDevice.criticality} />
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
                <Badge variant="info">{detailDevice.purdueLevel}</Badge>
              </div>
              <ChevronRight className="h-3 w-3 text-content-muted" />
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-content-secondary">Recommended:</span>
                <Badge variant={levelMismatch ? 'high' : 'low'}>{detailDevice.recommendedPurdueLevel}</Badge>
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
            <ConfidenceScore score={detailDevice.confidenceScore} />
          </div>

          {/* Identification Methods */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary mb-2">Identification Methods</p>
            <div className="flex flex-wrap gap-1.5">
              {detailDevice.identificationMethods.map((m) => (
                <Badge key={m} variant="outline">{m}</Badge>
              ))}
            </div>
          </div>

          {/* Protocols */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary mb-2">Protocols Observed</p>
            <div className="flex flex-wrap gap-1.5">
              {detailDevice.protocols.map((p) => (
                <Badge key={p} variant="default">{p}</Badge>
              ))}
            </div>
          </div>

          {/* Communication Partners */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary mb-2">
              Communication Partners ({detailDevice.communicationPartners.length})
            </p>
            <div className="space-y-1.5">
              {detailDevice.communicationPartners.length === 0 ? (
                <p className="text-xs text-content-muted italic">No communication partners observed</p>
              ) : (
                detailDevice.communicationPartners.map((cp, i) => (
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
          {Object.keys(detailDevice.protocolDetails).length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary mb-2">Protocol Details</p>
              <div className="space-y-2">
                {Object.entries(detailDevice.protocolDetails).map(([proto, detail]) => (
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
              Security Findings ({detailDevice.securityFindings.length})
            </p>
            {detailDevice.securityFindings.length === 0 ? (
              <p className="text-xs text-content-muted italic">No security findings</p>
            ) : (
              <div className="space-y-1.5">
                {detailDevice.securityFindings.map((f, i) => (
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
              <p className="mt-0.5 text-xs text-content-secondary">
                {detailDevice.firstSeen ? new Date(detailDevice.firstSeen).toLocaleString() : '-'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary">Last Seen</p>
              <p className="mt-0.5 text-xs text-content-secondary">
                {detailDevice.lastSeen ? new Date(detailDevice.lastSeen).toLocaleString() : '-'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function DeviceInventory() {
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDevice, setSelectedDevice] = useState<DeviceRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [sortColumn, setSortColumn] = useState<string>('ip');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Fetch devices from API
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .get<ApiDevice[]>('/ics/devices/')
      .then((res) => {
        if (!cancelled) {
          const data = Array.isArray(res.data) ? res.data : [];
          setDevices(data.map((d) => mapApiDeviceToRecord(d)));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.detail || 'Failed to load devices');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Stats
  const totalDevices = devices.length;
  const icsDevices = devices.filter((d) =>
    ['PLC', 'RTU', 'HMI', 'SCADA Server', 'Historian', 'IoT Gateway'].includes(d.deviceType)
  ).length;
  const infraDevices = devices.filter((d) =>
    ['Switch', 'Router', 'Firewall'].includes(d.deviceType)
  ).length;
  const unknownDevices = devices.filter((d) =>
    d.deviceType === 'Unknown'
  ).length;

  // Filter and sort
  const filteredDevices = useMemo(() => {
    let list = [...devices];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (d) =>
          d.ip.toLowerCase().includes(q) ||
          d.hostname.toLowerCase().includes(q) ||
          d.mac.toLowerCase().includes(q) ||
          d.vendor.toLowerCase().includes(q) ||
          d.model.toLowerCase().includes(q)
      );
    }

    if (typeFilter !== 'all') {
      list = list.filter((d) => d.deviceType === typeFilter);
    }

    if (levelFilter !== 'all') {
      list = list.filter((d) => d.purdueLevel === levelFilter);
    }

    list.sort((a, b) => {
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

    return list;
  }, [devices, searchQuery, typeFilter, levelFilter, sortColumn, sortDir]);

  const handleSort = useCallback((col: string) => {
    if (sortColumn === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDir('asc');
    }
  }, [sortColumn]);

  const deviceTypes = [...new Set(devices.map((d) => d.deviceType))].sort();
  const purdeLevels = [...new Set(devices.map((d) => d.purdueLevel))].sort();

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

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
              <p className="text-sm text-content-secondary">Loading device inventory...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {!loading && error && (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center gap-3">
              <AlertTriangle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-content-secondary">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && devices.length === 0 && (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center gap-3">
              <Server className="h-10 w-10 text-content-muted" />
              <p className="text-sm font-medium text-content-secondary">No devices discovered yet</p>
              <p className="text-xs text-content-tertiary">Upload a PCAP to discover devices</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters + Table (only when we have data) */}
      {!loading && !error && devices.length > 0 && (
        <>
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
                          {device.lastSeen ? new Date(device.lastSeen).toLocaleString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

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
