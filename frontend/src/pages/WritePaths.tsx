import { useState } from 'react';
import {
  Zap, AlertTriangle, Shield, Lock, ChevronDown, ChevronRight,
  Eye, Map, Terminal, Code, Database, Flag
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

const WRITE_PATHS = [
  {
    id: 'WP-001',
    src: '10.0.3.50',
    srcHostname: 'ENG-WORKSTATION',
    dst: '10.0.1.10',
    dstHostname: 'PLC-MASTER-01',
    protocol: 'S7comm',
    operation: 'S7 Program Upload (FC 28)',
    severity: 'critical' as const,
    description: 'Engineering workstation uploading new program to PLC',
    risk: 'Complete device reprogramming',
    firstSeen: '2024-03-20 09:15:22',
    count: 3,
    devices: ['PLC-MASTER-01'],
    controlPoints: [
      { point: 'Load block to module memory', value: 'ENABLED', status: 'dangerous' as const },
      { point: 'Start download', value: 'ALLOWED', status: 'dangerous' as const },
      { point: 'Signature verification', value: 'NOT ENFORCED', status: 'dangerous' as const },
    ],
  },
  {
    id: 'WP-002',
    src: '10.0.3.50',
    srcHostname: 'ENG-WORKSTATION',
    dst: '10.0.1.10',
    dstHostname: 'PLC-MASTER-01',
    protocol: 'S7comm',
    operation: 'S7 Memory Write (FC 5)',
    severity: 'critical' as const,
    description: 'Direct write to PLC discrete/analog outputs',
    risk: 'Field device output manipulation',
    firstSeen: '2024-03-20 14:30:45',
    count: 12,
    devices: ['PLC-MASTER-01'],
    controlPoints: [
      { point: 'Write to M-memory', value: 'ALLOWED', status: 'dangerous' as const },
      { point: 'Write to outputs', value: 'ALLOWED', status: 'dangerous' as const },
      { point: 'Write authentication', value: 'NONE', status: 'dangerous' as const },
    ],
  },
  {
    id: 'WP-003',
    src: '10.0.3.50',
    srcHostname: 'ENG-WORKSTATION',
    dst: '10.0.1.30',
    dstHostname: 'PLC-SLAVE-02',
    protocol: 'EtherNet/IP',
    operation: 'CIP Tag Write',
    severity: 'high' as const,
    description: 'Writing to remote PLC tags over EtherNet/IP',
    risk: 'Field device output control',
    firstSeen: '2024-03-19 11:45:00',
    count: 8,
    devices: ['PLC-SLAVE-02'],
    controlPoints: [
      { point: 'Tag write access', value: 'OPEN', status: 'dangerous' as const },
      { point: 'Encryption', value: 'NONE', status: 'warning' as const },
      { point: 'Authentication', value: 'NONE', status: 'dangerous' as const },
    ],
  },
  {
    id: 'WP-004',
    src: '10.0.2.10',
    srcHostname: 'RTU-SUBSTATION',
    dst: '10.0.2.20',
    dstHostname: 'SWITCH-ICS-01',
    protocol: 'Modbus TCP',
    operation: 'Holding Register Write',
    severity: 'medium' as const,
    description: 'RTU writing configuration to networked devices',
    risk: 'Configuration tampering',
    firstSeen: '2024-03-18 08:22:10',
    count: 5,
    devices: ['SWITCH-ICS-01'],
    controlPoints: [
      { point: 'Register write access', value: 'PERMITTED', status: 'warning' as const },
      { point: 'Write function codes', value: '16 (Multiple writes)', status: 'warning' as const },
      { point: 'Access control', value: 'WEAK', status: 'warning' as const },
    ],
  },
  {
    id: 'WP-005',
    src: '10.0.3.01',
    srcHostname: 'HISTORIAN-SRV',
    dst: '10.0.1.10',
    dstHostname: 'PLC-MASTER-01',
    protocol: 'OPC UA',
    operation: 'Attribute Write (Method Call)',
    severity: 'high' as const,
    description: 'Historian calling OPC UA methods on PLC',
    risk: 'Device state modification',
    firstSeen: '2024-03-20 16:10:33',
    count: 2,
    devices: ['PLC-MASTER-01'],
    controlPoints: [
      { point: 'Method execution allowed', value: 'YES', status: 'dangerous' as const },
      { point: 'User authentication', value: 'CERTIFICATE', status: 'ok' as const },
      { point: 'Permission model', value: 'BASIC', status: 'warning' as const },
    ],
  },
];

const STATUS_ICON = {
  dangerous: <Flag size={12} className="text-red-400" />,
  warning: <AlertTriangle size={12} className="text-amber-400" />,
  ok: <Shield size={12} className="text-emerald-400" />,
};

const severityBg = (s: string) =>
  s === 'critical' ? 'bg-red-500/15 text-red-400' :
  s === 'high' ? 'bg-orange-500/15 text-orange-400' :
  'bg-amber-500/15 text-amber-400';

const controlStatusBg = (s: string) =>
  s === 'dangerous' ? 'bg-red-500/10 text-red-400' :
  s === 'warning' ? 'bg-amber-500/10 text-amber-400' :
  'bg-emerald-500/10 text-emerald-400';

export default function WritePaths() {
  const [expanded, setExpanded] = useState<string | null>('WP-001');

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2"><Zap size={24} className="text-accent" /> Write/Program Access Paths</h1>
          <p className="text-sm text-content-secondary mt-1">Flags dangerous control paths (Modbus writes, S7 program access)</p>
        </div>
        <Button variant="primary" size="sm"><Zap size={14} /> Detect Paths</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Critical Paths', value: WRITE_PATHS.filter((w) => w.severity === 'critical').length, icon: Zap, color: 'text-red-500', bg: 'bg-red-500/10' },
          { label: 'High Risk', value: WRITE_PATHS.filter((w) => w.severity === 'high').length, icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10' },
          { label: 'Write Attempts', value: WRITE_PATHS.reduce((s, w) => s + w.count, 0), icon: Database, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Devices Affected', value: new Set(WRITE_PATHS.flatMap((w) => w.devices)).size, icon: Shield, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { label: 'Protocols', value: new Set(WRITE_PATHS.map((w) => w.protocol)).size, icon: Code, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
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

      {/* Write Path Details */}
      <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
        {WRITE_PATHS.map((w) => (
          <div key={w.id}>
            <button
              onClick={() => setExpanded(expanded === w.id ? null : w.id)}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-border-default last:border-0 hover:bg-surface-hover"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {expanded === w.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span className="text-xs font-mono text-accent shrink-0">{w.id}</span>
                <div className="flex items-center gap-1 text-xs min-w-0 flex-1">
                  <span className="text-content-primary font-medium truncate">{w.srcHostname}</span>
                  <span className="text-content-tertiary shrink-0">→</span>
                  <span className="text-content-primary font-medium truncate">{w.dstHostname}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[10px] text-content-secondary">{w.protocol}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${severityBg(w.severity)}`}>{w.severity}</span>
              </div>
            </button>

            {expanded === w.id && (
              <div className="bg-bg-secondary border-t border-border-default px-8 py-3 space-y-3">
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div>
                    <p className="text-[10px] text-content-tertiary mb-0.5">Operation</p>
                    <p className="text-sm text-content-primary font-mono">{w.operation}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-content-tertiary mb-0.5">Risk</p>
                    <p className="text-sm text-content-secondary">{w.risk}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-content-tertiary mb-0.5">Detection</p>
                    <p className="text-sm text-content-secondary">First seen {w.firstSeen} • {w.count} attempts</p>
                  </div>
                </div>

                <p className="text-xs text-content-secondary">{w.description}</p>

                {/* Control Points */}
                <div className="bg-surface-card rounded-lg border border-border-default p-3 mt-3">
                  <p className="text-[10px] font-medium text-content-tertiary mb-2 flex items-center gap-1"><Lock size={10} />Control Point Assessment</p>
                  <div className="space-y-1.5">
                    {w.controlPoints.map((cp, i) => (
                      <div key={i} className={`flex items-center justify-between px-2 py-1.5 rounded text-[10px] border ${controlStatusBg(cp.status)}`}>
                        <span className="font-medium">{cp.point}</span>
                        <div className="flex items-center gap-2">
                          <code className="text-[9px] font-mono">{cp.value}</code>
                          {STATUS_ICON[cp.status as keyof typeof STATUS_ICON]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2 border-t border-border-default">
                  <Button variant="outline" size="sm" className="text-xs"><Eye size={10} /> Inspect Flow</Button>
                  <Button variant="outline" size="sm" className="text-xs"><Map size={10} /> Map to Policy</Button>
                  <Button variant="outline" size="sm" className="text-xs ml-auto"><Terminal size={10} /> Log Entry</Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Remediation Guidance */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <p className="text-sm font-medium text-amber-400 mb-2 flex items-center gap-2"><AlertTriangle size={14} />Remediation Guidance</p>
        <ul className="space-y-1 text-xs text-content-secondary">
          <li>• Implement role-based access control (RBAC) to restrict write operations by user</li>
          <li>• Deploy digital signatures for all PLC program uploads</li>
          <li>• Enable write-blocking on data registers unless explicitly needed</li>
          <li>• Implement network segmentation with unidirectional gateways for supervisory→control zones</li>
          <li>• Enable audit logging for all state-changing operations</li>
        </ul>
      </div>
    </div>
  );
}
