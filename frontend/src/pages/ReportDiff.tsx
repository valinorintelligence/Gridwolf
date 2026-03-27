import { useState } from 'react';
import {
  GitCompare, Plus, Minus, ArrowRightLeft, ChevronDown, ChevronRight,
  Calendar, Eye, Download, AlertTriangle, Check, X, Server, Network
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

const SNAPSHOTS = [
  { id: 'snap-001', name: 'Plant Floor – March 15', date: '2024-03-15 14:30', devices: 22, connections: 48, findings: 23 },
  { id: 'snap-002', name: 'Plant Floor – February 1', date: '2024-02-01 09:00', devices: 20, connections: 42, findings: 15 },
  { id: 'snap-003', name: 'Substation Baseline', date: '2024-01-15 11:00', devices: 18, connections: 35, findings: 8 },
  { id: 'snap-004', name: 'Emergency Scan Dec', date: '2023-12-20 16:45', devices: 19, connections: 40, findings: 12 },
];

const DIFF_NODES = {
  added: [
    { ip: '10.0.1.45', hostname: 'NEW-HMI-03', vendor: 'Siemens', type: 'HMI', purdue: 'L2', protocols: ['S7comm', 'HTTP'], risk: 'medium' },
    { ip: '10.0.2.88', hostname: 'SENSOR-GATEWAY', vendor: 'Moxa', type: 'Gateway', purdue: 'L1', protocols: ['Modbus TCP', 'MQTT'], risk: 'high' },
    { ip: '10.0.3.12', hostname: 'WIFI-AP-FLOOR2', vendor: 'Cisco', type: 'Access Point', purdue: 'L3', protocols: ['802.11', 'SNMP'], risk: 'critical' },
  ],
  removed: [
    { ip: '10.0.1.30', hostname: 'OLD-PLC-07', vendor: 'Allen-Bradley', type: 'PLC', purdue: 'L1', protocols: ['EtherNet/IP'], risk: 'info' },
    { ip: '10.0.2.55', hostname: 'DECOMM-RTU', vendor: 'Schneider', type: 'RTU', purdue: 'L1', protocols: ['Modbus TCP'], risk: 'info' },
  ],
  changed: [
    { ip: '10.0.1.10', hostname: 'PLC-MASTER-01', field: 'firmware', old: 'v4.2.1', new: 'v4.3.0', risk: 'medium' },
    { ip: '10.0.1.10', hostname: 'PLC-MASTER-01', field: 'open_ports', old: '502', new: '502, 80, 443', risk: 'high' },
    { ip: '10.0.1.20', hostname: 'HMI-STATION-01', field: 'protocols', old: 'S7comm', new: 'S7comm, HTTP, Telnet', risk: 'critical' },
    { ip: '10.0.2.10', hostname: 'RTU-SUBSTATION', field: 'connections', old: '3 peers', new: '7 peers', risk: 'high' },
    { ip: '10.0.3.01', hostname: 'HISTORIAN-SRV', field: 'os_version', old: 'Win Server 2016', new: 'Win Server 2022', risk: 'low' },
  ],
};

const EDGE_CHANGES = [
  { src: '10.0.1.45', dst: '10.0.1.10', protocol: 'S7comm', type: 'added' as const, risk: 'medium' },
  { src: '10.0.2.88', dst: '10.0.1.10', protocol: 'Modbus TCP', type: 'added' as const, risk: 'high' },
  { src: '10.0.3.12', dst: '10.0.3.01', protocol: 'HTTP', type: 'added' as const, risk: 'critical' },
  { src: '10.0.1.30', dst: '10.0.1.10', protocol: 'EtherNet/IP', type: 'removed' as const, risk: 'info' },
  { src: '10.0.2.55', dst: '10.0.2.10', protocol: 'Modbus TCP', type: 'removed' as const, risk: 'info' },
  { src: '10.0.1.20', dst: '10.0.4.01', protocol: 'Telnet', type: 'added' as const, risk: 'critical' },
  { src: '10.0.2.10', dst: '10.0.3.01', protocol: 'OPC UA', type: 'added' as const, risk: 'medium' },
];

const riskColor = (r: string) =>
  r === 'critical' ? 'text-red-400' : r === 'high' ? 'text-orange-400' : r === 'medium' ? 'text-amber-400' : r === 'low' ? 'text-blue-400' : 'text-content-tertiary';
const riskBg = (r: string) =>
  r === 'critical' ? 'bg-red-500/15 text-red-400' : r === 'high' ? 'bg-orange-500/15 text-orange-400' : r === 'medium' ? 'bg-amber-500/15 text-amber-400' : r === 'low' ? 'bg-blue-500/15 text-blue-400' : 'bg-border-default text-content-tertiary';

export default function ReportDiff() {
  const [leftSnap, setLeftSnap] = useState(SNAPSHOTS[1].id);
  const [rightSnap, setRightSnap] = useState(SNAPSHOTS[0].id);
  const [expandedSection, setExpandedSection] = useState<string | null>('added');

  const left = SNAPSHOTS.find((s) => s.id === leftSnap)!;
  const right = SNAPSHOTS.find((s) => s.id === rightSnap)!;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2"><GitCompare size={24} className="text-accent" /> Report Diffing</h1>
          <p className="text-sm text-content-secondary mt-1">Side-by-side comparison of network assessment snapshots</p>
        </div>
        <Button variant="outline" size="sm"><Download size={14} /> Export Diff</Button>
      </div>

      {/* Snapshot Selector */}
      <div className="grid grid-cols-2 gap-4">
        {[{ label: 'Baseline (Before)', snap: leftSnap, setSnap: setLeftSnap, color: 'border-blue-500/30' }, { label: 'Current (After)', snap: rightSnap, setSnap: setRightSnap, color: 'border-emerald-500/30' }].map((side) => (
          <div key={side.label} className={`rounded-lg border ${side.color} bg-surface-card p-4`}>
            <p className="text-xs font-medium text-content-tertiary mb-2">{side.label}</p>
            <select value={side.snap} onChange={(e) => side.setSnap(e.target.value)} className="w-full bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-sm text-content-primary">
              {SNAPSHOTS.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.date}</option>)}
            </select>
            <div className="flex gap-4 mt-2 text-xs text-content-secondary">
              <span className="flex items-center gap-1"><Server size={10} />{SNAPSHOTS.find((s) => s.id === side.snap)!.devices} devices</span>
              <span className="flex items-center gap-1"><Network size={10} />{SNAPSHOTS.find((s) => s.id === side.snap)!.connections} connections</span>
              <span>{SNAPSHOTS.find((s) => s.id === side.snap)!.findings} findings</span>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Nodes Added', value: DIFF_NODES.added.length, icon: Plus, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Nodes Removed', value: DIFF_NODES.removed.length, icon: Minus, color: 'text-red-400', bg: 'bg-red-500/10' },
          { label: 'Fields Changed', value: DIFF_NODES.changed.length, icon: ArrowRightLeft, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Edges Added', value: EDGE_CHANGES.filter((e) => e.type === 'added').length, icon: Plus, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Edges Removed', value: EDGE_CHANGES.filter((e) => e.type === 'removed').length, icon: Minus, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        ].map((s) => (
          <div key={s.label} className={`rounded-lg border border-border-default ${s.bg} p-3 flex items-center gap-3`}>
            <s.icon size={18} className={s.color} />
            <div><p className="text-lg font-bold text-content-primary">{s.value}</p><p className="text-[10px] text-content-tertiary">{s.label}</p></div>
          </div>
        ))}
      </div>

      {/* Diff Sections */}
      {([
        { key: 'added', label: 'Added Nodes', icon: Plus, color: 'text-emerald-400', items: DIFF_NODES.added },
        { key: 'removed', label: 'Removed Nodes', icon: Minus, color: 'text-red-400', items: DIFF_NODES.removed },
      ] as const).map((section) => (
        <div key={section.key} className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
          <button onClick={() => setExpandedSection(expandedSection === section.key ? null : section.key)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-hover">
            <div className="flex items-center gap-2">
              {expandedSection === section.key ? <ChevronDown size={14} className="text-content-tertiary" /> : <ChevronRight size={14} className="text-content-tertiary" />}
              <section.icon size={14} className={section.color} />
              <span className="text-sm font-medium text-content-primary">{section.label}</span>
              <span className="text-xs text-content-tertiary">({section.items.length})</span>
            </div>
          </button>
          {expandedSection === section.key && (
            <table className="w-full text-xs">
              <thead><tr className="border-t border-border-default text-content-tertiary">
                <th className="text-left px-4 py-2 font-medium">IP</th><th className="text-left px-4 py-2 font-medium">Hostname</th>
                <th className="text-left px-4 py-2 font-medium">Vendor</th><th className="text-left px-4 py-2 font-medium">Type</th>
                <th className="text-left px-4 py-2 font-medium">Purdue</th><th className="text-left px-4 py-2 font-medium">Protocols</th>
                <th className="text-left px-4 py-2 font-medium">Risk</th>
              </tr></thead>
              <tbody>{section.items.map((n) => (
                <tr key={n.ip} className="border-t border-border-default hover:bg-surface-hover">
                  <td className="px-4 py-2 font-mono text-accent">{n.ip}</td>
                  <td className="px-4 py-2 text-content-primary font-medium">{n.hostname}</td>
                  <td className="px-4 py-2 text-content-secondary">{n.vendor}</td>
                  <td className="px-4 py-2 text-content-secondary">{n.type}</td>
                  <td className="px-4 py-2 text-content-tertiary">{n.purdue}</td>
                  <td className="px-4 py-2 text-content-secondary">{n.protocols.join(', ')}</td>
                  <td className="px-4 py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${riskBg(n.risk)}`}>{n.risk}</span></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      ))}

      {/* Field-Level Changes */}
      <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
        <button onClick={() => setExpandedSection(expandedSection === 'changed' ? null : 'changed')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-hover">
          <div className="flex items-center gap-2">
            {expandedSection === 'changed' ? <ChevronDown size={14} className="text-content-tertiary" /> : <ChevronRight size={14} className="text-content-tertiary" />}
            <ArrowRightLeft size={14} className="text-amber-400" />
            <span className="text-sm font-medium text-content-primary">Field-Level Changes</span>
            <span className="text-xs text-content-tertiary">({DIFF_NODES.changed.length})</span>
          </div>
        </button>
        {expandedSection === 'changed' && (
          <table className="w-full text-xs">
            <thead><tr className="border-t border-border-default text-content-tertiary">
              <th className="text-left px-4 py-2 font-medium">Device</th><th className="text-left px-4 py-2 font-medium">Field</th>
              <th className="text-left px-4 py-2 font-medium">Before</th><th className="text-left px-4 py-2 font-medium">After</th>
              <th className="text-left px-4 py-2 font-medium">Risk</th>
            </tr></thead>
            <tbody>{DIFF_NODES.changed.map((c, i) => (
              <tr key={i} className="border-t border-border-default hover:bg-surface-hover">
                <td className="px-4 py-2"><span className="font-mono text-accent">{c.ip}</span> <span className="text-content-secondary ml-1">{c.hostname}</span></td>
                <td className="px-4 py-2 text-content-primary font-medium">{c.field}</td>
                <td className="px-4 py-2"><span className="bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded font-mono">{c.old}</span></td>
                <td className="px-4 py-2"><span className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-mono">{c.new}</span></td>
                <td className="px-4 py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${riskBg(c.risk)}`}>{c.risk}</span></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      {/* Edge Changes */}
      <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border-default">
          <p className="text-sm font-medium text-content-primary">Connection Changes</p>
        </div>
        <table className="w-full text-xs">
          <thead><tr className="border-b border-border-default text-content-tertiary">
            <th className="text-left px-4 py-2 font-medium">Change</th><th className="text-left px-4 py-2 font-medium">Source</th>
            <th className="text-left px-4 py-2 font-medium">Destination</th><th className="text-left px-4 py-2 font-medium">Protocol</th>
            <th className="text-left px-4 py-2 font-medium">Risk</th>
          </tr></thead>
          <tbody>{EDGE_CHANGES.map((e, i) => (
            <tr key={i} className="border-b border-border-default last:border-0 hover:bg-surface-hover">
              <td className="px-4 py-2">{e.type === 'added' ? <span className="flex items-center gap-1 text-emerald-400"><Plus size={10} />Added</span> : <span className="flex items-center gap-1 text-red-400"><Minus size={10} />Removed</span>}</td>
              <td className="px-4 py-2 font-mono text-accent">{e.src}</td>
              <td className="px-4 py-2 font-mono text-accent">{e.dst}</td>
              <td className="px-4 py-2 text-content-primary">{e.protocol}</td>
              <td className="px-4 py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${riskBg(e.risk)}`}>{e.risk}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
