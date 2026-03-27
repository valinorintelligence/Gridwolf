import { useState } from 'react';
import {
  Skull, Shield, AlertTriangle, Eye, ChevronDown, ChevronRight,
  Crosshair, Zap, Target, Search, Bug
} from 'lucide-react';

const TACTICS = [
  { name: 'Initial Access', techniques: [{ id: 'T0819', name: 'Exploit Public-Facing App', count: 0 }, { id: 'T0866', name: 'Exploitation of Remote Services', count: 1 }] },
  { name: 'Execution', techniques: [{ id: 'T0855', name: 'Unauthorized Command Message', count: 3, severity: 'critical' }, { id: 'T0821', name: 'Modify Controller Tasking', count: 1 }] },
  { name: 'Persistence', techniques: [{ id: 'T0839', name: 'Module Firmware', count: 0 }, { id: 'T0873', name: 'Project File Infection', count: 0 }] },
  { name: 'Evasion', techniques: [{ id: 'T0856', name: 'Spoof Reporting Message', count: 0 }, { id: 'T0872', name: 'Indicator Removal', count: 1 }] },
  { name: 'Discovery', techniques: [{ id: 'T0846', name: 'Remote System Discovery', count: 3, severity: 'medium' }, { id: 'T0840', name: 'Network Sniffing', count: 2 }] },
  { name: 'Lateral Movement', techniques: [{ id: 'T0886', name: 'Remote Services', count: 4, severity: 'critical' }, { id: 'T0812', name: 'Default Credentials', count: 2, severity: 'high' }] },
  { name: 'Collection', techniques: [{ id: 'T0811', name: 'Data from Info Repositories', count: 2, severity: 'medium' }, { id: 'T0852', name: 'Screen Capture', count: 0 }] },
  { name: 'Command & Control', techniques: [{ id: 'T0869', name: 'Standard Application Layer', count: 1 }, { id: 'T0885', name: 'Commonly Used Port', count: 2, severity: 'medium' }] },
  { name: 'Inhibit Response', techniques: [{ id: 'T0816', name: 'Device Restart/Shutdown', count: 1, severity: 'high' }, { id: 'T0814', name: 'Denial of Service', count: 0 }, { id: 'T0838', name: 'Modify Alarm Settings', count: 0 }] },
  { name: 'Impair Process', techniques: [{ id: 'T0836', name: 'Modify Parameter', count: 2, severity: 'critical' }, { id: 'T0843', name: 'Program Download', count: 1, severity: 'critical' }, { id: 'T0845', name: 'Program Upload', count: 1, severity: 'high' }] },
  { name: 'Impact', techniques: [{ id: 'T0831', name: 'Manipulation of Control', count: 0 }, { id: 'T0882', name: 'Theft of Operational Info', count: 1 }] },
];

const DETECTION_RULES = [
  { id: 'GW-001', technique: 'T0855', tactic: 'Execution', desc: 'Unauthorized Modbus Write to PLC', severity: 'critical' as const, detections: 2, source: '10.1.3.12', target: '10.1.1.10', lastTriggered: '2h ago', enabled: true },
  { id: 'GW-002', technique: 'T0843', tactic: 'Impair Process', desc: 'S7comm Program Download Detected', severity: 'critical' as const, detections: 1, source: '10.1.3.12', target: '10.1.1.15', lastTriggered: '6h ago', enabled: true },
  { id: 'GW-003', technique: 'T0886', tactic: 'Lateral Movement', desc: 'Cross-Zone Communication L1→L3', severity: 'high' as const, detections: 4, source: '10.1.1.10', target: '10.1.3.50', lastTriggered: '1h ago', enabled: true },
  { id: 'GW-004', technique: 'Context', tactic: 'Discovery', desc: 'Unauthorized Engineering Workstation', severity: 'high' as const, detections: 1, source: '10.1.3.12', target: 'Multiple PLCs', lastTriggered: '3h ago', enabled: true },
  { id: 'GW-005', technique: 'Context', tactic: 'Execution', desc: 'Rogue SCADA Master Detected', severity: 'critical' as const, detections: 1, source: '10.1.5.200', target: '10.1.1.10', lastTriggered: '45m ago', enabled: true },
  { id: 'GW-006', technique: 'Context', tactic: 'Lateral Movement', desc: 'Lateral OT Movement Detected', severity: 'high' as const, detections: 2, source: '10.1.2.45', target: 'L1 devices', lastTriggered: '2h ago', enabled: true },
  { id: 'GW-007', technique: 'T0855', tactic: 'Execution', desc: 'DNP3 Unsolicited Response from Unknown', severity: 'medium' as const, detections: 1, source: '10.1.5.200', target: '10.1.3.50', lastTriggered: '4h ago', enabled: true },
  { id: 'GW-008', technique: 'Anomaly', tactic: 'Collection', desc: 'Abnormal Modbus Polling Interval', severity: 'medium' as const, detections: 3, source: '10.1.3.50', target: '10.1.1.10', lastTriggered: '30m ago', enabled: true },
  { id: 'GW-009', technique: 'T0836', tactic: 'Impair Process', desc: 'PLC Setpoint Modification Detected', severity: 'critical' as const, detections: 2, source: '10.1.3.12', target: '10.1.1.10', lastTriggered: '1h ago', enabled: true },
  { id: 'GW-010', technique: 'T0816', tactic: 'Inhibit Response', desc: 'PLC Stop Command Detected', severity: 'high' as const, detections: 1, source: '10.1.3.12', target: '10.1.1.15', lastTriggered: '5h ago', enabled: true },
  { id: 'GW-011', technique: 'T0846', tactic: 'Discovery', desc: 'Network Scanning Activity (port sweep)', severity: 'medium' as const, detections: 3, source: '10.1.5.200', target: 'Subnet 10.1.1.0/24', lastTriggered: '2h ago', enabled: true },
  { id: 'GW-012', technique: 'T0812', tactic: 'Lateral Movement', desc: 'Default Credential Usage Detected', severity: 'high' as const, detections: 2, source: '10.1.3.12', target: '10.1.2.40', lastTriggered: '3h ago', enabled: true },
  { id: 'GW-013', technique: 'T0845', tactic: 'Impair Process', desc: 'PLC Program Upload (exfiltration risk)', severity: 'high' as const, detections: 1, source: '10.1.3.12', target: '10.1.1.10', lastTriggered: '8h ago', enabled: true },
  { id: 'GW-014', technique: 'Context', tactic: 'C2', desc: 'Cleartext Telnet to ICS Device', severity: 'high' as const, detections: 2, source: '10.1.3.12', target: '10.1.2.40', lastTriggered: '4h ago', enabled: true },
  { id: 'GW-015', technique: 'T0811', tactic: 'Collection', desc: 'Historian Data Bulk Read', severity: 'medium' as const, detections: 2, source: '10.1.3.50', target: '10.1.2.60', lastTriggered: '6h ago', enabled: true },
];

const MALWARE = [
  { name: 'FrostyGoop', status: 'no-match' as const, indicators: ['Modbus TCP targeting', 'Setpoint manipulation', 'L1 device targeting', 'Temperature control interference'], matched: 1, total: 4 },
  { name: 'PIPEDREAM / INCONTROLLER', status: 'partial' as const, indicators: ['CIP scanning', 'S7comm exploitation', 'OPC UA abuse', 'Codesys manipulation', 'Multi-protocol orchestration'], matched: 2, total: 5 },
  { name: 'Industroyer2', status: 'no-match' as const, indicators: ['IEC 104 manipulation', 'Breaker control commands', 'Sequential tripping', 'Wiper component'], matched: 0, total: 4 },
  { name: 'TRITON / TRISIS', status: 'no-match' as const, indicators: ['TriStation protocol', 'SIS controller access', 'Safety logic modification'], matched: 0, total: 3 },
];

const sevColor = (s: string) => s === 'critical' ? 'bg-red-500/15 text-red-400' : s === 'high' ? 'bg-orange-500/15 text-orange-400' : s === 'medium' ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400';

export default function ThreatIntelligence() {
  const [malwareOpen, setMalwareOpen] = useState(true);
  const [ruleFilter, setRuleFilter] = useState('');

  const totalDetections = DETECTION_RULES.reduce((sum, r) => sum + r.detections, 0);
  const criticalCount = DETECTION_RULES.filter((r) => r.severity === 'critical' && r.detections > 0).length;
  const highCount = DETECTION_RULES.filter((r) => r.severity === 'high' && r.detections > 0).length;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2">
          <Skull size={24} className="text-accent" /> MITRE ATT&CK for ICS
        </h1>
        <p className="text-sm text-content-secondary mt-1">Automated threat detection mapped to ATT&CK for ICS framework</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Detection Rules', value: '40+', icon: Shield, color: 'text-accent' },
          { label: 'Active Detections', value: String(totalDetections), icon: Zap, color: 'text-amber-400' },
          { label: 'Techniques Covered', value: '10+', icon: Target, color: 'text-blue-400' },
          { label: 'Critical Findings', value: String(criticalCount), icon: AlertTriangle, color: 'text-red-400' },
          { label: 'High Findings', value: String(highCount), icon: Crosshair, color: 'text-orange-400' },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border-default bg-surface-card p-3">
            <p className="text-[10px] text-content-tertiary flex items-center gap-1"><s.icon size={10} /> {s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ATT&CK Matrix */}
      <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border-default">
          <p className="text-sm font-medium text-content-primary">ATT&CK for ICS Matrix</p>
        </div>
        <div className="overflow-x-auto p-4">
          <div className="flex gap-2 min-w-[1200px]">
            {TACTICS.map((tac) => (
              <div key={tac.name} className="flex-1 min-w-[100px]">
                <div className="text-[10px] font-bold text-content-secondary uppercase text-center py-2 bg-bg-secondary rounded-t border border-border-default">{tac.name}</div>
                <div className="space-y-1 mt-1">
                  {tac.techniques.map((t) => {
                    const hasDet = t.count > 0;
                    const sev = (t as any).severity;
                    return (
                      <div key={t.id} className={`rounded border px-2 py-1.5 text-center transition-colors ${
                        hasDet ? (sev === 'critical' ? 'border-red-500/40 bg-red-500/10' : sev === 'high' ? 'border-orange-500/40 bg-orange-500/10' : 'border-amber-500/40 bg-amber-500/10') : 'border-border-default bg-bg-secondary hover:bg-surface-hover'
                      }`}>
                        <p className="text-[9px] font-mono text-content-tertiary">{t.id}</p>
                        <p className="text-[10px] text-content-primary leading-tight mt-0.5">{t.name}</p>
                        {hasDet && <span className={`inline-block mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${sevColor(sev || 'medium')}`}>{t.count}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detection Rules Table */}
      <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border-default flex items-center justify-between">
          <p className="text-sm font-medium text-content-primary">Detection Rules ({DETECTION_RULES.length})</p>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-tertiary" />
            <input value={ruleFilter} onChange={(e) => setRuleFilter(e.target.value)} placeholder="Filter rules..." className="rounded border border-border-default bg-bg-secondary text-xs px-3 py-1 pl-8 text-content-primary placeholder:text-content-muted w-56" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-default text-content-tertiary">
                <th className="text-left px-3 py-2 font-medium">Rule</th>
                <th className="text-left px-3 py-2 font-medium">Technique</th>
                <th className="text-left px-3 py-2 font-medium">Tactic</th>
                <th className="text-left px-3 py-2 font-medium">Description</th>
                <th className="text-left px-3 py-2 font-medium">Severity</th>
                <th className="text-right px-3 py-2 font-medium">Hits</th>
                <th className="text-left px-3 py-2 font-medium">Source</th>
                <th className="text-left px-3 py-2 font-medium">Target</th>
                <th className="text-left px-3 py-2 font-medium">Last</th>
              </tr>
            </thead>
            <tbody>
              {DETECTION_RULES.filter((r) => !ruleFilter || r.desc.toLowerCase().includes(ruleFilter.toLowerCase())).map((r) => (
                <tr key={r.id} className="border-b border-border-default last:border-0 hover:bg-surface-hover">
                  <td className="px-3 py-2 font-mono text-content-tertiary">{r.id}</td>
                  <td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent text-[10px]">{r.technique}</span></td>
                  <td className="px-3 py-2 text-content-secondary">{r.tactic}</td>
                  <td className="px-3 py-2 text-content-primary font-medium">{r.desc}</td>
                  <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sevColor(r.severity)}`}>{r.severity}</span></td>
                  <td className="px-3 py-2 text-right font-bold text-content-primary">{r.detections}</td>
                  <td className="px-3 py-2 font-mono text-content-secondary text-[10px]">{r.source}</td>
                  <td className="px-3 py-2 font-mono text-content-secondary text-[10px]">{r.target}</td>
                  <td className="px-3 py-2 text-content-tertiary">{r.lastTriggered}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ICS Malware Detection */}
      <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
        <button onClick={() => setMalwareOpen(!malwareOpen)} className="w-full px-4 py-3 border-b border-border-default flex items-center justify-between hover:bg-surface-hover">
          <p className="text-sm font-medium text-content-primary flex items-center gap-2"><Bug size={14} className="text-red-400" /> ICS Malware Behavioral Detection</p>
          {malwareOpen ? <ChevronDown size={14} className="text-content-tertiary" /> : <ChevronRight size={14} className="text-content-tertiary" />}
        </button>
        {malwareOpen && (
          <div className="p-4 grid grid-cols-2 gap-3">
            {MALWARE.map((m) => (
              <div key={m.name} className={`rounded-lg border p-4 ${m.status === 'partial' ? 'border-amber-500/30 bg-amber-500/5' : 'border-border-default bg-bg-secondary'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-content-primary">{m.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    m.status === 'no-match' ? 'bg-emerald-500/15 text-emerald-400' : m.status === 'partial' ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400'
                  }`}>{m.status === 'no-match' ? 'No Match' : m.status === 'partial' ? 'Partial Match' : 'MATCH'}</span>
                </div>
                <div className="space-y-1">
                  {m.indicators.map((ind, i) => (
                    <div key={ind} className={`flex items-center gap-2 text-xs ${i < m.matched ? 'text-amber-400' : 'text-content-tertiary'}`}>
                      {i < m.matched ? <AlertTriangle size={10} /> : <Eye size={10} />}
                      {ind}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-content-tertiary mt-2">Confidence: {m.matched}/{m.total} indicators &middot; Last scan: 30 min ago</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
