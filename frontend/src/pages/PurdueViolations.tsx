import { useState } from 'react';
import {
  AlertTriangle, Network, Shield, ChevronDown, ChevronRight,
  Zap, Lock, Eye, ArrowRight, MapPin, Layers
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

const VIOLATIONS = [
  {
    id: 'VIO-001',
    src: '10.0.3.50',
    srcHostname: 'ENG-WORKSTATION',
    srcLevel: 'L3',
    dst: '10.0.1.10',
    dstHostname: 'PLC-MASTER-01',
    dstLevel: 'L1',
    protocol: 'S7comm',
    severity: 'critical' as const,
    type: 'Cross-Zone L3→L1' as const,
    violations: [
      'L3 → L1 direct communication (should use L2 gateway)',
      'Engineering workstation bypassing supervisory layer',
      'Direct control protocol access from management zone',
    ],
    firstSeen: '2024-03-20 14:23:15',
    packets: 342,
    risk: 'Program upload/download to PLC',
  },
  {
    id: 'VIO-002',
    src: '10.0.4.01',
    srcHostname: 'FIREWALL-DMZ',
    srcLevel: 'DMZ',
    dst: '10.0.3.01',
    dstHostname: 'HISTORIAN-SRV',
    dstLevel: 'L3',
    protocol: 'OPC UA',
    severity: 'high' as const,
    type: 'DMZ→L3 Data Access' as const,
    violations: [
      'Untrusted zone (DMZ) to operational zone (L3)',
      'OPC UA from external firewall to historian',
      'Potential for data exfiltration or tampering',
    ],
    firstSeen: '2024-03-20 09:45:22',
    packets: 87,
    risk: 'Data integrity compromise',
  },
  {
    id: 'VIO-003',
    src: '10.0.2.20',
    srcHostname: 'SWITCH-ICS-01',
    srcLevel: 'L2',
    dst: '10.0.1.10',
    dstHostname: 'PLC-MASTER-01',
    dstLevel: 'L1',
    protocol: 'SNMP',
    severity: 'medium' as const,
    type: 'L2→L1 Management' as const,
    violations: [
      'Management protocol traversing to basic control',
      'Switch SNMP polling of PLC (non-standard)',
      'Potential for MIB modification attacks',
    ],
    firstSeen: '2024-03-19 16:30:00',
    packets: 234,
    risk: 'Device configuration tampering',
  },
  {
    id: 'VIO-004',
    src: '10.0.3.50',
    srcHostname: 'ENG-WORKSTATION',
    srcLevel: 'L3',
    dst: '10.0.2.10',
    dstHostname: 'RTU-SUBSTATION',
    dstLevel: 'L1',
    protocol: 'Modbus TCP',
    severity: 'high' as const,
    type: 'Cross-Zone L3→L1' as const,
    violations: [
      'L3 → L1 direct modbus writes',
      'Engineering workstation controlling RTU',
      'No L2 supervisory validation',
    ],
    firstSeen: '2024-03-20 11:15:45',
    packets: 156,
    risk: 'Field device control without oversight',
  },
];

const PURDUE_MODEL = [
  { level: 'L0', name: 'Field Devices', description: 'PLC, RTU, I/O, Sensors, Drives', color: 'bg-red-500', zones: ['Manufacturing Cell', 'Substation'] },
  { level: 'L1', name: 'Basic Control', description: 'Programmable devices, Controllers', color: 'bg-orange-500', zones: ['Manufacturing Cell', 'Substation'] },
  { level: 'L2', name: 'Supervisory', description: 'HMI, SCADA, Edge Gateway', color: 'bg-amber-500', zones: ['Manufacturing Cell', 'Substation'] },
  { level: 'L3', name: 'Operations', description: 'MES, Historian, Engineering Workstation', color: 'bg-cyan-500', zones: ['Site Operations', 'Data Center'] },
  { level: 'L4', name: 'Enterprise', description: 'ERP, Business Systems', color: 'bg-blue-500', zones: ['Corporate', 'Cloud'] },
  { level: 'DMZ', name: 'Demilitarized', description: 'Firewalls, Proxies, External Gateway', color: 'bg-purple-500', zones: ['Internet-Facing'] },
];

const severityBg = (s: string) =>
  s === 'critical' ? 'bg-red-500/15 text-red-400' :
  s === 'high' ? 'bg-orange-500/15 text-orange-400' :
  'bg-amber-500/15 text-amber-400';

const riskIcon = (s: string) =>
  s === 'critical' || s === 'high' ? <AlertTriangle size={14} className="text-red-400" /> :
  <AlertTriangle size={14} className="text-amber-400" />;

export default function PurdueViolations() {
  const [expanded, setExpanded] = useState<string | null>('VIO-001');
  const [filter, setFilter] = useState<'all' | 'critical' | 'high'>('all');

  const filtered = filter === 'all' ? VIOLATIONS : VIOLATIONS.filter((v) => v.severity === filter);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2"><Layers size={24} className="text-accent" /> Purdue Model Violations</h1>
          <p className="text-sm text-content-secondary mt-1">Automated cross-zone communication anomaly detection</p>
        </div>
        <Button variant="primary" size="sm"><Zap size={14} /> Re-scan</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Violations', value: VIOLATIONS.length, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
          { label: 'Critical', value: VIOLATIONS.filter((v) => v.severity === 'critical').length, icon: Zap, color: 'text-red-500', bg: 'bg-red-500/10' },
          { label: 'High', value: VIOLATIONS.filter((v) => v.severity === 'high').length, icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10' },
          { label: 'Zones Affected', value: '4', icon: MapPin, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        ].map((s) => (
          <div key={s.label} className={`rounded-lg border border-border-default ${s.bg} p-3`}>
            <div className="flex items-center justify-between mb-1">
              <s.icon size={16} className={s.color} />
            </div>
            <p className="text-xl font-bold text-content-primary">{s.value}</p>
            <p className="text-[10px] text-content-tertiary">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Purdue Model Reference */}
      <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border-default">
          <p className="text-sm font-medium text-content-primary flex items-center gap-2"><Layers size={14} className="text-accent" />Purdue Model Reference</p>
        </div>
        <div className="grid grid-cols-6 gap-2 p-4">
          {PURDUE_MODEL.map((m) => (
            <div key={m.level} className={`rounded-lg border border-border-default p-2 text-[10px]`}>
              <div className={`${m.color} h-1 rounded mb-1.5`} />
              <p className="font-bold text-content-primary">{m.level}</p>
              <p className="text-content-secondary font-medium">{m.name}</p>
              <p className="text-content-tertiary mt-0.5">{m.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 rounded-lg bg-surface-card border border-border-default p-1 w-fit">
        {['all', 'critical', 'high'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === f ? 'bg-accent text-white' : 'text-content-secondary hover:bg-surface-hover'}`}
          >
            {f === 'all' ? 'All Violations' : `${f.charAt(0).toUpperCase() + f.slice(1)} Only`}
          </button>
        ))}
      </div>

      {/* Violation Details */}
      <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
        {filtered.map((v) => (
          <div key={v.id}>
            <button
              onClick={() => setExpanded(expanded === v.id ? null : v.id)}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-border-default last:border-0 hover:bg-surface-hover"
            >
              <div className="flex items-center gap-3 flex-1">
                {expanded === v.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span className="text-xs font-mono text-accent">{v.id}</span>
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-content-primary font-medium">{v.srcHostname}</span>
                  <span className="px-1 py-0.5 rounded text-[10px] bg-bg-secondary text-content-secondary">{v.srcLevel}</span>
                  <ArrowRight size={12} className="text-content-tertiary" />
                  <span className="text-content-primary font-medium">{v.dstHostname}</span>
                  <span className="px-1 py-0.5 rounded text-[10px] bg-bg-secondary text-content-secondary">{v.dstLevel}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-content-secondary">{v.protocol}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${severityBg(v.severity)}`}>{v.severity}</span>
              </div>
            </button>

            {expanded === v.id && (
              <div className="bg-bg-secondary border-t border-border-default px-8 py-3 space-y-2">
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="text-[10px] text-content-tertiary mb-0.5">IPs & Hostname</p>
                    <p className="text-sm text-content-primary">
                      <span className="font-mono text-accent">{v.src}</span> ({v.srcHostname}) →{' '}
                      <span className="font-mono text-accent">{v.dst}</span> ({v.dstHostname})
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-content-tertiary mb-0.5">Detection Info</p>
                    <p className="text-sm text-content-secondary">
                      First seen {v.firstSeen} • {v.packets} packets
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-content-tertiary mb-1 font-medium">Violations Triggered</p>
                  <ul className="space-y-1">
                    {v.violations.map((vio, i) => (
                      <li key={i} className="text-xs text-content-secondary flex items-start gap-2">
                        <span className="text-red-400 mt-0.5">•</span>
                        <span>{vio}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex gap-6 pt-2 border-t border-border-default">
                  <div className="flex items-center gap-2">
                    {riskIcon(v.severity)}
                    <span className="text-[10px] text-content-secondary"><span className="text-content-primary font-medium">Risk:</span> {v.risk}</span>
                  </div>
                  <Button variant="outline" size="sm" className="ml-auto text-xs"><Eye size={10} /> Investigate</Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
