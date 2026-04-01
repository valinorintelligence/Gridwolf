import { useState } from 'react';
import {
  Search, Star, AlertTriangle, Clock, ChevronDown, ChevronRight,
  Flag, Zap, Eye, Share2, Archive, MoreVertical
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

const FOCUS_QUEUE_ITEMS = [
  {
    id: 'FQ-001',
    type: 'Beacon Detection',
    title: 'Suspected C2 Beacon: 10.0.1.20 → 185.220.101.42:443',
    severity: 'critical' as const,
    priority: 1,
    device: '10.0.1.20 (HMI-STATION-01)',
    indicator: 'IAT clustering 60s±2s, 98% confidence',
    firstSeen: '2024-03-20 09:15:22',
    status: 'investigating' as const,
    notes: 'HMI workstation showing periodic outbound HTTPS to known Tor exit node',
  },
  {
    id: 'FQ-002',
    type: 'Write Path Detection',
    title: 'PLC Program Upload from Engineering Workstation',
    severity: 'critical' as const,
    priority: 2,
    device: '10.0.1.10 (PLC-MASTER-01)',
    indicator: 'S7comm FC 28 (Program Download), 3x in 24h',
    firstSeen: '2024-03-20 09:00:00',
    status: 'investigating' as const,
    notes: 'Scheduled maintenance or unauthorized code injection risk',
  },
  {
    id: 'FQ-003',
    type: 'Purdue Violation',
    title: 'Cross-Zone L3→L1 Communication',
    severity: 'high' as const,
    priority: 3,
    device: '10.0.3.50 (ENG-WORKSTATION)',
    indicator: 'Direct S7comm to L1 PLC without L2 gateway',
    firstSeen: '2024-03-19 14:30:00',
    status: 'queued' as const,
    notes: 'Engineering workstation bypassing supervisory layer controls',
  },
  {
    id: 'FQ-004',
    type: 'Default Credential',
    title: 'Schneider Electric RTU with Factory Default SNMP Community',
    severity: 'high' as const,
    priority: 4,
    device: '10.0.2.10 (RTU-SUBSTATION)',
    indicator: 'SNMP community string "public" detected, MIB access allowed',
    firstSeen: '2024-03-18 08:00:00',
    status: 'queued' as const,
    notes: 'Credentials never changed from factory default',
  },
  {
    id: 'FQ-005',
    type: 'New Device Detection',
    title: 'Unknown Device on Manufacturing Floor Network',
    severity: 'medium' as const,
    priority: 5,
    device: '10.0.1.45 (NEW-HMI-03)',
    indicator: 'Siemens KTP HMI, Modbus TCP, S7comm capable',
    firstSeen: '2024-03-20 11:22:15',
    status: 'queued' as const,
    notes: 'Legitimate addition or unauthorized hardware placement?',
  },
  {
    id: 'FQ-006',
    type: 'Authentication Gap',
    title: 'Telnet Service Enabled on Critical Workstation',
    severity: 'medium' as const,
    priority: 6,
    device: '10.0.3.50 (ENG-WORKSTATION)',
    indicator: 'Port 23/TCP open, plaintext authentication enabled',
    firstSeen: '2024-03-19 16:45:00',
    status: 'resolved' as const,
    notes: 'SSH should replace Telnet for secure remote access',
  },
];

const AUTH_GAPS = [
  { device: '10.0.1.10 (PLC-MASTER-01)', service: 'Modbus TCP', issue: 'No authentication', risk: 'high' as const },
  { device: '10.0.1.20 (HMI-STATION-01)', service: 'S7comm', issue: 'No access control', risk: 'critical' as const },
  { device: '10.0.2.10 (RTU-SUBSTATION)', service: 'SNMP', issue: 'Default community string', risk: 'high' as const },
  { device: '10.0.3.50 (ENG-WORKSTATION)', service: 'Telnet', issue: 'Plaintext credentials', risk: 'high' as const },
  { device: '10.0.3.01 (HISTORIAN-SRV)', service: 'OPC UA', issue: 'Certificate validation weak', risk: 'medium' as const },
];

const severityBg = (s: string) =>
  s === 'critical' ? 'bg-red-500/15 text-red-400' :
  s === 'high' ? 'bg-orange-500/15 text-orange-400' :
  'bg-amber-500/15 text-amber-400';

const statusBg = (s: string) =>
  s === 'investigating' ? 'bg-blue-500/15 text-blue-400' :
  s === 'resolved' ? 'bg-emerald-500/15 text-emerald-400' :
  'bg-gray-500/15 text-gray-400';

export default function Investigations() {
  const [activeTab, setActiveTab] = useState<'queue' | 'auth-gaps'>('queue');
  const [expanded, setExpanded] = useState<string | null>('FQ-001');
  const [starred, setStarred] = useState<Set<string>>(new Set(['FQ-001', 'FQ-002']));

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2"><Search size={24} className="text-accent" /> Investigation Workflows</h1>
          <p className="text-sm text-content-secondary mt-1">Focus Queue for priority targets, auth gaps, write paths</p>
        </div>
        <Button variant="primary" size="sm"><Zap size={14} /> Refresh Queue</Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Queue Items', value: FOCUS_QUEUE_ITEMS.length, icon: Flag, color: 'text-accent', bg: 'bg-accent/10' },
          { label: 'Investigating', value: FOCUS_QUEUE_ITEMS.filter((f) => f.status === 'investigating').length, icon: Eye, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Critical', value: FOCUS_QUEUE_ITEMS.filter((f) => f.severity === 'critical').length, icon: Zap, color: 'text-red-400', bg: 'bg-red-500/10' },
          { label: 'Auth Gaps', value: AUTH_GAPS.length, icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10' },
          { label: 'Write Paths', value: FOCUS_QUEUE_ITEMS.filter((f) => f.type === 'Write Path Detection').length, icon: Flag, color: 'text-purple-400', bg: 'bg-purple-500/10' },
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

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-surface-card border border-border-default p-1 w-fit">
        {(['queue', 'auth-gaps'] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === t ? 'bg-accent text-white' : 'text-content-secondary hover:bg-surface-hover'}`}>
            {t === 'queue' ? 'Focus Queue' : 'Authentication Gaps'}
          </button>
        ))}
      </div>

      {/* Focus Queue */}
      {activeTab === 'queue' && (
        <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
          {FOCUS_QUEUE_ITEMS.map((item) => (
            <div key={item.id}>
              <button
                onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                className="w-full flex items-center justify-between px-4 py-3 border-b border-border-default last:border-0 hover:bg-surface-hover"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {expanded === item.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setStarred((s) => new Set([...s].includes(item.id) ? [...s].filter((x) => x !== item.id) : [...s, item.id])); }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.click(); }}>
                    <Star size={12} className={starred.has(item.id) ? 'fill-amber-400 text-amber-400' : 'text-content-tertiary'} />
                  </span>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-bg-secondary text-content-secondary whitespace-nowrap">{item.type}</span>
                    <span className="text-xs text-content-primary font-medium truncate">{item.title}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${severityBg(item.severity)}`}>{item.severity}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusBg(item.status)}`}>{item.status}</span>
                  <span className="text-[10px] text-content-tertiary">P{item.priority}</span>
                </div>
              </button>

              {expanded === item.id && (
                <div className="bg-bg-secondary border-t border-border-default px-8 py-3 space-y-2">
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <p className="text-[10px] text-content-tertiary mb-0.5">Affected Device</p>
                      <p className="text-sm text-content-primary font-mono">{item.device}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-content-tertiary mb-0.5">Indicator</p>
                      <p className="text-sm text-content-secondary">{item.indicator}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-content-tertiary mb-0.5">First Seen</p>
                      <p className="text-sm text-content-secondary">{item.firstSeen}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] text-content-tertiary mb-1">Investigation Notes</p>
                    <p className="text-xs text-content-secondary">{item.notes}</p>
                  </div>

                  <div className="flex gap-3 pt-2 border-t border-border-default">
                    <Button variant="outline" size="sm" className="text-xs flex-1"><Eye size={10} /> Investigate</Button>
                    <Button variant="outline" size="sm" className="text-xs flex-1"><Share2 size={10} /> Share</Button>
                    <Button variant="outline" size="sm" className="text-xs flex-1"><Archive size={10} /> Archive</Button>
                    <button className="px-2 py-1.5 rounded border border-border-default hover:bg-surface-hover"><MoreVertical size={12} className="text-content-tertiary" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Authentication Gaps */}
      {activeTab === 'auth-gaps' && (
        <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border-default">
            <p className="text-sm font-medium text-content-primary">Identified Authentication Gaps</p>
          </div>
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border-default text-content-tertiary">
              <th className="text-left px-4 py-2 font-medium">Device</th><th className="text-left px-4 py-2 font-medium">Service</th>
              <th className="text-left px-4 py-2 font-medium">Issue</th><th className="text-left px-4 py-2 font-medium">Risk</th>
              <th className="text-left px-4 py-2 font-medium">Remediation</th>
            </tr></thead>
            <tbody>{AUTH_GAPS.map((a, i) => (
              <tr key={i} className="border-b border-border-default last:border-0 hover:bg-surface-hover">
                <td className="px-4 py-2 font-mono text-accent">{a.device}</td>
                <td className="px-4 py-2 text-content-primary font-medium">{a.service}</td>
                <td className="px-4 py-2 text-content-secondary">{a.issue}</td>
                <td className="px-4 py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${severityBg(a.risk)}`}>{a.risk}</span></td>
                <td className="px-4 py-2 text-[10px] text-content-tertiary">
                  {a.service === 'Telnet' ? 'Enable SSH' :
                   a.service === 'SNMP' ? 'Set custom community' :
                   a.service === 'OPC UA' ? 'Enforce cert validation' :
                   'Implement RBAC'}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
