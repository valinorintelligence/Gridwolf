import { useState, useEffect, useMemo } from 'react';
import {
  GitCompare, Plus, Minus, ArrowRightLeft, ChevronDown, ChevronRight,
  Download, Server, Network, Info
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api } from '@/services/api';

// ─── Types ────────────────────────────────────────────────────────
interface SessionRecord {
  id: string;
  name: string;
  created_at: string | null;
  device_count?: number;
  finding_count?: number;
}

interface DeviceRecord {
  id: string;
  ip_address: string;
  hostname: string | null;
  vendor: string | null;
  device_type: string;
  purdue_level: string;
  protocols: string[];
  firmware_version: string | null;
  open_ports: number[];
}

interface DiffNode extends DeviceRecord {
  risk: string;
}

interface FieldChange {
  ip: string;
  hostname: string | null;
  field: string;
  old: string;
  new: string;
  risk: string;
}

// ─── Helpers ──────────────────────────────────────────────────────
const riskBg = (r: string) =>
  r === 'critical' ? 'bg-red-500/15 text-red-400' :
  r === 'high' ? 'bg-orange-500/15 text-orange-400' :
  r === 'medium' ? 'bg-amber-500/15 text-amber-400' :
  r === 'low' ? 'bg-blue-500/15 text-blue-400' :
  'bg-border-default text-content-tertiary';

function deviceRisk(d: DeviceRecord): string {
  const HIGH_PROTOS = new Set(['modbus', 's7comm', 'iec104', 'dnp3']);
  const hasHighProto = d.protocols?.some((p) => HIGH_PROTOS.has(p.toLowerCase()));
  if (hasHighProto) return 'high';
  if (d.purdue_level === 'L1' || d.purdue_level === 'L0') return 'medium';
  return 'low';
}

function computeFieldChanges(left: DeviceRecord[], right: DeviceRecord[]): FieldChange[] {
  const leftMap = new Map(left.map((d) => [d.ip_address, d]));
  const changes: FieldChange[] = [];
  for (const rd of right) {
    const ld = leftMap.get(rd.ip_address);
    if (!ld) continue;
    // Firmware
    if (ld.firmware_version !== rd.firmware_version && (ld.firmware_version || rd.firmware_version)) {
      changes.push({ ip: rd.ip_address, hostname: rd.hostname, field: 'firmware', old: ld.firmware_version ?? '—', new: rd.firmware_version ?? '—', risk: 'medium' });
    }
    // Protocols
    const lp = (ld.protocols ?? []).slice().sort().join(', ');
    const rp = (rd.protocols ?? []).slice().sort().join(', ');
    if (lp !== rp) {
      changes.push({ ip: rd.ip_address, hostname: rd.hostname, field: 'protocols', old: lp || '—', new: rp || '—', risk: 'high' });
    }
    // Open ports
    const lports = (ld.open_ports ?? []).slice().sort((a, b) => a - b).join(', ');
    const rports = (rd.open_ports ?? []).slice().sort((a, b) => a - b).join(', ');
    if (lports !== rports && (lports || rports)) {
      changes.push({ ip: rd.ip_address, hostname: rd.hostname, field: 'open_ports', old: lports || '—', new: rports || '—', risk: 'medium' });
    }
  }
  return changes;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

// ─── Component ────────────────────────────────────────────────────
export default function ReportDiff() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');

  const [leftDevices, setLeftDevices] = useState<DeviceRecord[]>([]);
  const [rightDevices, setRightDevices] = useState<DeviceRecord[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);

  const [expandedSection, setExpandedSection] = useState<string | null>('added');

  // Load session list
  useEffect(() => {
    api.get('/ics/sessions/', { params: { limit: 200 } })
      .then((r) => {
        const items: SessionRecord[] = Array.isArray(r.data) ? r.data : (r.data?.sessions ?? []);
        setSessions(items);
        if (items.length >= 2) {
          setLeftId(items[1].id);
          setRightId(items[0].id);
        } else if (items.length === 1) {
          setLeftId(items[0].id);
          setRightId(items[0].id);
        }
      })
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false));
  }, []);

  // Fetch devices for both selected sessions whenever selection changes
  useEffect(() => {
    if (!leftId || !rightId) return;
    setDevicesLoading(true);
    Promise.allSettled([
      api.get('/ics/devices/', { params: { session_id: leftId, limit: 2000 } }),
      api.get('/ics/devices/', { params: { session_id: rightId, limit: 2000 } }),
    ]).then(([lRes, rRes]) => {
      setLeftDevices(lRes.status === 'fulfilled' ? (Array.isArray(lRes.value.data) ? lRes.value.data : []) : []);
      setRightDevices(rRes.status === 'fulfilled' ? (Array.isArray(rRes.value.data) ? rRes.value.data : []) : []);
    }).finally(() => setDevicesLoading(false));
  }, [leftId, rightId]);

  // Compute diff
  const diff = useMemo(() => {
    const leftIPs = new Set(leftDevices.map((d) => d.ip_address));
    const rightIPs = new Set(rightDevices.map((d) => d.ip_address));

    const added: DiffNode[] = rightDevices
      .filter((d) => !leftIPs.has(d.ip_address))
      .map((d) => ({ ...d, risk: deviceRisk(d) }));

    const removed: DiffNode[] = leftDevices
      .filter((d) => !rightIPs.has(d.ip_address))
      .map((d) => ({ ...d, risk: deviceRisk(d) }));

    const changed: FieldChange[] = leftId !== rightId
      ? computeFieldChanges(leftDevices, rightDevices)
      : [];

    return { added, removed, changed };
  }, [leftDevices, rightDevices, leftId, rightId]);

  const leftSession = sessions.find((s) => s.id === leftId);
  const rightSession = sessions.find((s) => s.id === rightId);

  if (sessionsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2">
            <GitCompare size={24} className="text-accent" /> Report Diffing
          </h1>
          <p className="text-sm text-content-secondary mt-1">
            Side-by-side comparison of network assessment snapshots
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Download size={14} /> Export Diff
        </Button>
      </div>

      {/* No sessions */}
      {sessions.length === 0 && (
        <div className="rounded-lg border border-border-default bg-surface-card p-8 text-center">
          <Info size={24} className="mx-auto text-content-tertiary mb-3" />
          <p className="text-sm font-semibold text-content-primary mb-1">No sessions available</p>
          <p className="text-xs text-content-secondary">
            Upload at least two PCAP files to compare assessment snapshots.{' '}
            <a href="/pcap" className="text-accent hover:underline">Go to PCAP Analysis →</a>
          </p>
        </div>
      )}

      {sessions.length > 0 && (
        <>
          {/* Session Selector */}
          <div className="grid grid-cols-2 gap-4">
            {([
              { label: 'Baseline (Before)', id: leftId, setId: setLeftId, color: 'border-blue-500/30', session: leftSession },
              { label: 'Current (After)', id: rightId, setId: setRightId, color: 'border-emerald-500/30', session: rightSession },
            ] as const).map((side) => (
              <div key={side.label} className={`rounded-lg border ${side.color} bg-surface-card p-4`}>
                <p className="text-xs font-medium text-content-tertiary mb-2">{side.label}</p>
                <select
                  value={side.id}
                  onChange={(e) => side.setId(e.target.value)}
                  className="w-full bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-sm text-content-primary"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {formatDate(s.created_at)}
                    </option>
                  ))}
                </select>
                <div className="flex gap-4 mt-2 text-xs text-content-secondary">
                  <span className="flex items-center gap-1">
                    <Server size={10} />
                    {side.id === leftId ? leftDevices.length : rightDevices.length} devices
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Loading */}
          {devicesLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Devices Added', value: diff.added.length, icon: Plus, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                  { label: 'Devices Removed', value: diff.removed.length, icon: Minus, color: 'text-red-400', bg: 'bg-red-500/10' },
                  { label: 'Fields Changed', value: diff.changed.length, icon: ArrowRightLeft, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                ].map((s) => (
                  <div key={s.label} className={`rounded-lg border border-border-default ${s.bg} p-3 flex items-center gap-3`}>
                    <s.icon size={18} className={s.color} />
                    <div>
                      <p className="text-lg font-bold text-content-primary">{s.value}</p>
                      <p className="text-[10px] text-content-tertiary">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0 && (
                <div className="rounded-lg border border-border-default bg-surface-card p-6 text-center">
                  <Network size={24} className="mx-auto text-content-tertiary mb-3" />
                  <p className="text-sm font-semibold text-content-primary">No differences found</p>
                  <p className="text-xs text-content-secondary mt-1">
                    {leftId === rightId
                      ? 'Select two different sessions to compare them.'
                      : 'Both sessions have identical device inventories.'}
                  </p>
                </div>
              )}

              {/* Added / Removed node sections */}
              {([
                { key: 'added', label: 'Added Devices', icon: Plus, color: 'text-emerald-400', items: diff.added },
                { key: 'removed', label: 'Removed Devices', icon: Minus, color: 'text-red-400', items: diff.removed },
              ] as const).map((section) => section.items.length > 0 && (
                <div key={section.key} className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
                  <button
                    onClick={() => setExpandedSection(expandedSection === section.key ? null : section.key)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-hover"
                  >
                    <div className="flex items-center gap-2">
                      {expandedSection === section.key ? <ChevronDown size={14} className="text-content-tertiary" /> : <ChevronRight size={14} className="text-content-tertiary" />}
                      <section.icon size={14} className={section.color} />
                      <span className="text-sm font-medium text-content-primary">{section.label}</span>
                      <span className="text-xs text-content-tertiary">({section.items.length})</span>
                    </div>
                  </button>
                  {expandedSection === section.key && (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-t border-border-default text-content-tertiary">
                          <th className="text-left px-4 py-2 font-medium">IP</th>
                          <th className="text-left px-4 py-2 font-medium">Hostname</th>
                          <th className="text-left px-4 py-2 font-medium">Vendor</th>
                          <th className="text-left px-4 py-2 font-medium">Type</th>
                          <th className="text-left px-4 py-2 font-medium">Purdue</th>
                          <th className="text-left px-4 py-2 font-medium">Protocols</th>
                          <th className="text-left px-4 py-2 font-medium">Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.items.map((n) => (
                          <tr key={n.ip_address} className="border-t border-border-default hover:bg-surface-hover">
                            <td className="px-4 py-2 font-mono text-accent">{n.ip_address}</td>
                            <td className="px-4 py-2 text-content-primary font-medium">{n.hostname || '—'}</td>
                            <td className="px-4 py-2 text-content-secondary">{n.vendor || '—'}</td>
                            <td className="px-4 py-2 text-content-secondary">{n.device_type}</td>
                            <td className="px-4 py-2 text-content-tertiary">{n.purdue_level}</td>
                            <td className="px-4 py-2 text-content-secondary">{(n.protocols ?? []).join(', ') || '—'}</td>
                            <td className="px-4 py-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${riskBg(n.risk)}`}>{n.risk}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}

              {/* Field-Level Changes */}
              {diff.changed.length > 0 && (
                <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
                  <button
                    onClick={() => setExpandedSection(expandedSection === 'changed' ? null : 'changed')}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-hover"
                  >
                    <div className="flex items-center gap-2">
                      {expandedSection === 'changed' ? <ChevronDown size={14} className="text-content-tertiary" /> : <ChevronRight size={14} className="text-content-tertiary" />}
                      <ArrowRightLeft size={14} className="text-amber-400" />
                      <span className="text-sm font-medium text-content-primary">Field-Level Changes</span>
                      <span className="text-xs text-content-tertiary">({diff.changed.length})</span>
                    </div>
                  </button>
                  {expandedSection === 'changed' && (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-t border-border-default text-content-tertiary">
                          <th className="text-left px-4 py-2 font-medium">Device</th>
                          <th className="text-left px-4 py-2 font-medium">Field</th>
                          <th className="text-left px-4 py-2 font-medium">Before</th>
                          <th className="text-left px-4 py-2 font-medium">After</th>
                          <th className="text-left px-4 py-2 font-medium">Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diff.changed.map((c, i) => (
                          <tr key={i} className="border-t border-border-default hover:bg-surface-hover">
                            <td className="px-4 py-2">
                              <span className="font-mono text-accent">{c.ip}</span>
                              {c.hostname && <span className="text-content-secondary ml-1">{c.hostname}</span>}
                            </td>
                            <td className="px-4 py-2 text-content-primary font-medium">{c.field}</td>
                            <td className="px-4 py-2">
                              <span className="bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded font-mono">{c.old}</span>
                            </td>
                            <td className="px-4 py-2">
                              <span className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-mono">{c.new}</span>
                            </td>
                            <td className="px-4 py-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${riskBg(c.risk)}`}>{c.risk}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
