import { useState } from 'react';
import {
  GitCompare, ArrowRight, Plus, Minus, RefreshCw, TrendingUp,
  AlertTriangle, Check, Server, Link2, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

const NEW_ASSETS = [
  { ip: '10.1.2.45', mac: '00:1A:2B:3C:4D:5E', type: 'IoT Gateway', vendor: 'Siemens IOT2050', firstSeen: '2024-03-12', purdue: 'L2' },
  { ip: '10.1.3.12', mac: '00:50:C2:8E:3A:01', type: 'Engineering WS', vendor: 'Dell Precision', firstSeen: '2024-03-10', purdue: 'L3' },
  { ip: '10.1.1.99', mac: '00:0E:8C:AA:BB:CC', type: 'PLC', vendor: 'Siemens S7-300', firstSeen: '2024-03-08', purdue: 'L1' },
  { ip: '10.1.4.88', mac: '00:80:F4:12:34:56', type: 'HMI', vendor: 'Rockwell PanelView', firstSeen: '2024-03-14', purdue: 'L2' },
  { ip: '10.1.5.200', mac: 'B4:2E:99:11:22:33', type: 'Unknown', vendor: 'Unknown', firstSeen: '2024-03-15', purdue: '?' },
];

const MISSING_ASSETS = [
  { ip: '10.1.2.30', mac: '00:0E:8C:55:66:77', type: 'RTU', vendor: 'ABB RTU520', lastSeen: '2024-01-15', purdue: 'L1' },
  { ip: '10.1.4.15', mac: '00:1B:44:11:3A:B7', type: 'Printer', vendor: 'HP LaserJet', lastSeen: '2024-01-10', purdue: 'L4' },
];

const CHANGED_ASSETS = [
  { ip: '10.1.1.10', device: 'Siemens S7-1500', change: 'Firmware', before: 'v3.2.1', after: 'v3.3.0', severity: 'medium' },
  { ip: '10.1.2.20', device: 'Schneider M340', change: 'New Protocol', before: 'EtherNet/IP only', after: 'EtherNet/IP + Modbus TCP', severity: 'high' },
  { ip: '10.1.1.5', device: 'ABB RTU560', change: 'Purdue Level', before: 'L2', after: 'L1', severity: 'critical' },
  { ip: '10.1.3.50', device: 'Ignition SCADA', change: 'New Connection', before: '12 peers', after: '15 peers (+3 unknown)', severity: 'high' },
  { ip: '10.1.1.20', device: 'Rockwell ControlLogix', change: 'Polling Interval', before: '500ms avg', after: '2100ms avg', severity: 'medium' },
  { ip: '10.1.2.40', device: 'Cisco IE-4010', change: 'Port Config', before: '16 active', after: '19 active (+3 new)', severity: 'low' },
  { ip: '10.1.4.100', device: 'Palo Alto PA-3260', change: 'Rules', before: '45 ACL rules', after: '42 ACL rules (-3 removed)', severity: 'high' },
  { ip: '10.1.1.15', device: 'Emerson DeltaV', change: 'Firmware', before: 'v14.3', after: 'v14.3.1 (patched)', severity: 'info' },
];

const CONNECTION_CHANGES = [
  { src: '10.1.1.99', dst: '10.1.3.50', protocol: 'S7comm', status: 'new' as const, detail: 'New PLC → SCADA connection' },
  { src: '10.1.2.45', dst: '10.1.1.10', protocol: 'Modbus TCP', status: 'new' as const, detail: 'IoT Gateway polling PLC' },
  { src: '10.1.2.30', dst: '10.1.3.50', protocol: 'DNP3', status: 'missing' as const, detail: 'RTU no longer responding' },
  { src: '10.1.5.200', dst: '10.1.1.10', protocol: 'S7comm', status: 'new' as const, detail: 'Unknown device accessing PLC' },
  { src: '10.1.1.20', dst: '10.1.3.12', protocol: 'CIP', status: 'changed' as const, detail: 'Data volume increased 340%' },
];

export default function BaselineDrift() {
  const [baseline, setBaseline] = useState('plant-jan');
  const [current, setCurrent] = useState('latest-mar');
  const [compared, setCompared] = useState(true);

  const driftScore = 23;
  const driftColor = driftScore < 10 ? 'text-emerald-400' : driftScore < 30 ? 'text-amber-400' : 'text-red-400';
  const driftBg = driftScore < 10 ? 'border-emerald-500/30' : driftScore < 30 ? 'border-amber-500/30' : 'border-red-500/30';

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2">
          <GitCompare size={24} className="text-accent" /> Baseline Drift Detection
        </h1>
        <p className="text-sm text-content-secondary mt-1">Compare network assessments to detect changes in your OT environment</p>
      </div>

      {/* Comparison selector */}
      <div className="flex items-center gap-4 rounded-lg border border-border-default bg-surface-card p-4">
        <div className="flex-1">
          <label className="block text-xs font-medium text-content-secondary mb-1">Baseline Session</label>
          <select value={baseline} onChange={(e) => setBaseline(e.target.value)} className="w-full rounded border border-border-default bg-bg-secondary text-content-primary text-sm px-3 py-1.5">
            <option value="plant-jan">Plant Floor Baseline - Jan 2024</option>
            <option value="scada-dec">SCADA Baseline - Dec 2023</option>
            <option value="sub-nov">Substation Baseline - Nov 2023</option>
          </select>
        </div>
        <ArrowRight size={20} className="text-content-tertiary mt-4" />
        <div className="flex-1">
          <label className="block text-xs font-medium text-content-secondary mb-1">Current Session</label>
          <select value={current} onChange={(e) => setCurrent(e.target.value)} className="w-full rounded border border-border-default bg-bg-secondary text-content-primary text-sm px-3 py-1.5">
            <option value="latest-mar">Latest Scan - Mar 2024</option>
            <option value="weekly-mar15">Weekly Scan - Mar 15</option>
            <option value="adhoc-mar10">Ad-hoc Scan - Mar 10</option>
          </select>
        </div>
        <Button variant="primary" size="lg" className="mt-4" onClick={() => setCompared(true)}>
          <GitCompare size={16} /> Compare
        </Button>
      </div>

      {compared && (
        <>
          {/* Drift score */}
          <div className={`rounded-xl border-2 ${driftBg} bg-surface-card p-6 flex items-center gap-8`}>
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className="text-border-default" strokeWidth="8" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className={driftColor} strokeWidth="8"
                  strokeDasharray={`${driftScore * 2.51} 251`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-2xl font-bold ${driftColor}`}>{driftScore}%</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-lg font-semibold text-content-primary">Moderate Drift Detected</p>
              <p className="text-sm text-content-secondary mt-1">Network has moderately drifted from baseline. Review changes below.</p>
              <div className="flex gap-6 mt-3">
                <span className="text-xs text-emerald-400 flex items-center gap-1"><Plus size={12} /> 5 new devices</span>
                <span className="text-xs text-red-400 flex items-center gap-1"><Minus size={12} /> 2 missing devices</span>
                <span className="text-xs text-amber-400 flex items-center gap-1"><RefreshCw size={12} /> 8 changed devices</span>
                <span className="text-xs text-blue-400 flex items-center gap-1"><Link2 size={12} /> +12 new connections</span>
                <span className="text-xs text-red-400 flex items-center gap-1"><Link2 size={12} /> -3 missing connections</span>
              </div>
            </div>
          </div>

          {/* Three columns: new / missing / changed */}
          <div className="grid grid-cols-3 gap-4">
            {/* New */}
            <div className="rounded-lg border border-emerald-500/30 bg-surface-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border-default bg-emerald-500/5 flex items-center gap-2">
                <Plus size={14} className="text-emerald-400" />
                <span className="text-sm font-medium text-emerald-400">New Assets ({NEW_ASSETS.length})</span>
              </div>
              <div className="divide-y divide-border-default">
                {NEW_ASSETS.map((a) => (
                  <div key={a.ip} className="px-4 py-2.5 hover:bg-surface-hover">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-mono text-content-primary">{a.ip}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-accent/15 text-accent">{a.purdue}</span>
                    </div>
                    <p className="text-xs text-content-secondary">{a.vendor} &middot; {a.type}</p>
                    <p className="text-[10px] text-content-tertiary">First seen: {a.firstSeen}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Missing */}
            <div className="rounded-lg border border-red-500/30 bg-surface-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border-default bg-red-500/5 flex items-center gap-2">
                <Minus size={14} className="text-red-400" />
                <span className="text-sm font-medium text-red-400">Missing Assets ({MISSING_ASSETS.length})</span>
              </div>
              <div className="divide-y divide-border-default">
                {MISSING_ASSETS.map((a) => (
                  <div key={a.ip} className="px-4 py-2.5 hover:bg-surface-hover">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-mono text-content-primary">{a.ip}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/15 text-red-400">{a.purdue}</span>
                    </div>
                    <p className="text-xs text-content-secondary">{a.vendor} &middot; {a.type}</p>
                    <p className="text-[10px] text-content-tertiary">Last seen: {a.lastSeen}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Changed */}
            <div className="rounded-lg border border-amber-500/30 bg-surface-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border-default bg-amber-500/5 flex items-center gap-2">
                <RefreshCw size={14} className="text-amber-400" />
                <span className="text-sm font-medium text-amber-400">Changed Assets ({CHANGED_ASSETS.length})</span>
              </div>
              <div className="divide-y divide-border-default max-h-80 overflow-y-auto">
                {CHANGED_ASSETS.map((a) => (
                  <div key={a.ip + a.change} className="px-4 py-2.5 hover:bg-surface-hover">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-mono text-content-primary">{a.ip}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        a.severity === 'critical' ? 'bg-red-500/15 text-red-400' :
                        a.severity === 'high' ? 'bg-orange-500/15 text-orange-400' :
                        a.severity === 'medium' ? 'bg-amber-500/15 text-amber-400' :
                        a.severity === 'info' ? 'bg-blue-500/15 text-blue-400' :
                        'bg-emerald-500/15 text-emerald-400'
                      }`}>{a.severity}</span>
                    </div>
                    <p className="text-xs text-content-secondary">{a.device} &middot; {a.change}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px]">
                      <span className="text-red-400 line-through">{a.before}</span>
                      <ArrowRight size={10} className="text-content-tertiary" />
                      <span className="text-emerald-400">{a.after}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Connection changes */}
          <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border-default">
              <p className="text-sm font-medium text-content-primary">Connection Changes</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default text-xs text-content-tertiary">
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-left px-4 py-2 font-medium">Source</th>
                  <th className="text-left px-4 py-2 font-medium">Destination</th>
                  <th className="text-left px-4 py-2 font-medium">Protocol</th>
                  <th className="text-left px-4 py-2 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {CONNECTION_CHANGES.map((c, i) => (
                  <tr key={i} className={`border-b border-border-default last:border-0 ${
                    c.status === 'new' ? 'bg-emerald-500/5' : c.status === 'missing' ? 'bg-red-500/5' : 'bg-amber-500/5'
                  }`}>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        c.status === 'new' ? 'bg-emerald-500/15 text-emerald-400' :
                        c.status === 'missing' ? 'bg-red-500/15 text-red-400' :
                        'bg-amber-500/15 text-amber-400'
                      }`}>
                        {c.status === 'new' ? <Plus size={10} /> : c.status === 'missing' ? <Minus size={10} /> : <RefreshCw size={10} />}
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-content-primary text-xs">{c.src}</td>
                    <td className="px-4 py-2.5 font-mono text-content-primary text-xs">{c.dst}</td>
                    <td className="px-4 py-2.5"><span className="px-1.5 py-0.5 rounded text-[10px] bg-accent/15 text-accent">{c.protocol}</span></td>
                    <td className="px-4 py-2.5 text-xs text-content-secondary">{c.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Drift timeline */}
          <div className="rounded-lg border border-border-default bg-surface-card p-4">
            <p className="text-sm font-medium text-content-primary mb-3 flex items-center gap-2"><TrendingUp size={14} /> Drift Score Over Time</p>
            <div className="h-32 flex items-end gap-3 px-4">
              {[
                { date: 'Nov 23', score: 0 },
                { date: 'Dec 23', score: 5 },
                { date: 'Jan 24', score: 8 },
                { date: 'Feb 24', score: 15 },
                { date: 'Mar 24', score: 23 },
              ].map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`w-full rounded-t transition-all ${
                    d.score < 10 ? 'bg-emerald-500/60' : d.score < 30 ? 'bg-amber-500/60' : 'bg-red-500/60'
                  }`} style={{ height: `${Math.max(d.score * 4, 4)}px` }} />
                  <span className="text-[10px] text-content-tertiary">{d.date}</span>
                  <span className="text-[10px] text-content-secondary font-medium">{d.score}%</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
