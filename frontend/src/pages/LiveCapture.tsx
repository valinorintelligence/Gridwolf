import { useState } from 'react';
import {
  Radio, Play, Pause, Square, Activity, Server, Network,
  AlertTriangle, Clock, Cpu, HardDrive, Eye, Layers, Zap, Wifi
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

const INTERFACES = ['eth0 (Management)', 'eth1 (SPAN Port)', 'eth2 (ICS Network)', 'br0 (Bridge)'];

const LIVE_NODES = [
  { ip: '10.0.1.10', hostname: 'PLC-MASTER-01', vendor: 'Siemens', type: 'PLC', purdue: 'L1', protocols: ['S7comm'], discoveredAt: '00:00:03', status: 'active' },
  { ip: '10.0.1.20', hostname: 'HMI-STATION-01', vendor: 'Siemens', type: 'HMI', purdue: 'L2', protocols: ['S7comm', 'HTTP'], discoveredAt: '00:00:05', status: 'active' },
  { ip: '10.0.1.30', hostname: 'PLC-SLAVE-02', vendor: 'Allen-Bradley', type: 'PLC', purdue: 'L1', protocols: ['EtherNet/IP'], discoveredAt: '00:00:08', status: 'active' },
  { ip: '10.0.2.10', hostname: 'RTU-SUBSTATION', vendor: 'Schneider', type: 'RTU', purdue: 'L1', protocols: ['Modbus TCP'], discoveredAt: '00:00:12', status: 'active' },
  { ip: '10.0.2.20', hostname: 'SWITCH-ICS-01', vendor: 'Hirschmann', type: 'Switch', purdue: 'L2', protocols: ['LLDP', 'SNMP'], discoveredAt: '00:00:15', status: 'active' },
  { ip: '10.0.3.01', hostname: 'HISTORIAN-SRV', vendor: 'OSIsoft', type: 'Server', purdue: 'L3', protocols: ['OPC UA', 'HTTP'], discoveredAt: '00:00:22', status: 'active' },
  { ip: '10.0.3.50', hostname: 'ENG-WORKSTATION', vendor: 'Dell', type: 'Workstation', purdue: 'L3', protocols: ['S7comm', 'HTTP', 'SSH'], discoveredAt: '00:01:05', status: 'new' },
  { ip: '10.0.4.01', hostname: 'FIREWALL-DMZ', vendor: 'Fortinet', type: 'Firewall', purdue: 'DMZ', protocols: ['Syslog', 'SNMP'], discoveredAt: '00:01:30', status: 'new' },
];

const LIVE_CONNECTIONS = [
  { src: '10.0.1.20', dst: '10.0.1.10', protocol: 'S7comm', packets: 1245, bytes: '2.1 MB', status: 'active' },
  { src: '10.0.1.30', dst: '10.0.1.10', protocol: 'EtherNet/IP', packets: 890, bytes: '1.4 MB', status: 'active' },
  { src: '10.0.2.10', dst: '10.0.1.10', protocol: 'Modbus TCP', packets: 456, bytes: '320 KB', status: 'active' },
  { src: '10.0.3.01', dst: '10.0.1.20', protocol: 'OPC UA', packets: 234, bytes: '1.8 MB', status: 'active' },
  { src: '10.0.3.50', dst: '10.0.1.10', protocol: 'S7comm', packets: 12, bytes: '8 KB', status: 'new' },
  { src: '10.0.4.01', dst: '10.0.3.01', protocol: 'Syslog', packets: 89, bytes: '45 KB', status: 'active' },
];

const ALERTS = [
  { time: '00:01:32', severity: 'critical', msg: 'New device 10.0.3.50 sending S7comm Program commands to PLC-MASTER-01' },
  { time: '00:01:05', severity: 'high', msg: 'Engineering workstation discovered with Telnet service enabled' },
  { time: '00:00:45', severity: 'medium', msg: 'Cross-zone communication: L3 → L1 via S7comm (ENG-WORKSTATION → PLC-MASTER-01)' },
  { time: '00:00:22', severity: 'low', msg: 'Historian server discovered running OPC UA on non-standard port 4841' },
];

export default function LiveCapture() {
  const [capturing, setCapturing] = useState(true);
  const [iface, setIface] = useState(INTERFACES[1]);
  const elapsed = '00:02:15';

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2"><Radio size={24} className="text-accent" /> Live Capture</h1>
          <p className="text-sm text-content-secondary mt-1">Real-time topology rendering during active packet capture</p>
        </div>
        <div className="flex items-center gap-2">
          {capturing && <span className="flex items-center gap-1.5 text-xs text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />CAPTURING</span>}
          <Button variant={capturing ? 'outline' : 'primary'} size="sm" onClick={() => setCapturing(!capturing)}>
            {capturing ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Resume</>}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCapturing(false)}><Square size={14} /> Stop</Button>
        </div>
      </div>

      {/* Capture Config + Live Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-border-default bg-surface-card p-3">
          <p className="text-[10px] text-content-tertiary mb-1">Interface</p>
          <select value={iface} onChange={(e) => setIface(e.target.value)} className="w-full bg-bg-secondary border border-border-default rounded px-2 py-1 text-xs text-content-primary">
            {INTERFACES.map((i) => <option key={i}>{i}</option>)}
          </select>
          <div className="flex items-center gap-2 mt-2 text-[10px] text-content-tertiary">
            <Clock size={10} /><span>Elapsed: {elapsed}</span>
          </div>
        </div>
        {[
          { label: 'Packets', value: '24,891', icon: Activity, color: 'text-accent', sub: '1,842/sec' },
          { label: 'Devices Found', value: LIVE_NODES.length.toString(), icon: Server, color: 'text-emerald-400', sub: `${LIVE_NODES.filter((n) => n.status === 'new').length} new` },
          { label: 'Connections', value: LIVE_CONNECTIONS.length.toString(), icon: Network, color: 'text-blue-400', sub: `${LIVE_CONNECTIONS.filter((c) => c.status === 'new').length} new` },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border-default bg-surface-card p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-content-tertiary">{s.label}</p>
              <s.icon size={14} className={s.color} />
            </div>
            <p className="text-xl font-bold text-content-primary mt-1">{s.value}</p>
            <p className="text-[10px] text-content-tertiary">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Progressive Discovery - Left */}
        <div className="col-span-2 space-y-3">
          {/* Topology Mini-Map */}
          <div className="rounded-lg border border-border-default bg-surface-card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-content-primary flex items-center gap-2"><Eye size={14} className="text-accent" />Progressive Discovery</p>
              <div className="flex gap-2 text-[10px] text-content-tertiary">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />Active</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />New</span>
              </div>
            </div>
            {/* Purdue Level Bands */}
            <div className="space-y-1">
              {['L3 — Site Operations', 'DMZ', 'L2 — Supervisory', 'L1 — Basic Control'].map((level) => {
                const nodes = LIVE_NODES.filter((n) =>
                  level.startsWith('L1') ? n.purdue === 'L1' :
                  level.startsWith('L2') ? n.purdue === 'L2' :
                  level.startsWith('L3') ? n.purdue === 'L3' :
                  n.purdue === 'DMZ'
                );
                return (
                  <div key={level} className="flex items-center gap-3 rounded border border-border-default bg-bg-secondary p-2">
                    <span className="text-[10px] text-content-tertiary w-32 shrink-0">{level}</span>
                    <div className="flex gap-2 flex-wrap">
                      {nodes.map((n) => (
                        <div key={n.ip} className={`px-2 py-1 rounded text-[10px] border ${n.status === 'new' ? 'border-amber-500/40 bg-amber-500/10 text-amber-400 animate-pulse' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'}`}>
                          <span className="font-medium">{n.hostname}</span>
                          <span className="text-content-tertiary ml-1">({n.ip})</span>
                        </div>
                      ))}
                      {nodes.length === 0 && <span className="text-[10px] text-content-tertiary italic">No devices</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Connection lines summary */}
            <div className="mt-3 flex items-center gap-4 text-[10px] text-content-tertiary">
              <span>{LIVE_CONNECTIONS.length} active flows</span>
              <span>{LIVE_CONNECTIONS.reduce((s, c) => s + c.packets, 0).toLocaleString()} total packets</span>
              <span>{LIVE_NODES.filter((n) => n.protocols.includes('S7comm') || n.protocols.includes('Modbus TCP') || n.protocols.includes('EtherNet/IP')).length} ICS-speaking devices</span>
            </div>
          </div>

          {/* Live Connections Table */}
          <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
            <div className="px-4 py-2 border-b border-border-default">
              <p className="text-sm font-medium text-content-primary">Active Flows</p>
            </div>
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border-default text-content-tertiary">
                <th className="text-left px-4 py-2 font-medium">Source</th><th className="text-left px-4 py-2 font-medium">Destination</th>
                <th className="text-left px-4 py-2 font-medium">Protocol</th><th className="text-right px-4 py-2 font-medium">Packets</th>
                <th className="text-right px-4 py-2 font-medium">Bytes</th><th className="text-left px-4 py-2 font-medium">Status</th>
              </tr></thead>
              <tbody>{LIVE_CONNECTIONS.map((c, i) => (
                <tr key={i} className="border-b border-border-default last:border-0 hover:bg-surface-hover">
                  <td className="px-4 py-2 font-mono text-accent">{c.src}</td>
                  <td className="px-4 py-2 font-mono text-accent">{c.dst}</td>
                  <td className="px-4 py-2 text-content-primary font-medium">{c.protocol}</td>
                  <td className="px-4 py-2 text-right text-content-primary">{c.packets.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-content-secondary">{c.bytes}</td>
                  <td className="px-4 py-2">{c.status === 'new' ? <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-400 animate-pulse">NEW</span> : <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-400">Active</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>

        {/* Right Panel - Alerts & Protocol Breakdown */}
        <div className="space-y-3">
          {/* Live Alerts */}
          <div className="rounded-lg border border-border-default bg-surface-card p-3">
            <p className="text-sm font-medium text-content-primary flex items-center gap-2 mb-2"><AlertTriangle size={14} className="text-amber-400" />Live Alerts</p>
            <div className="space-y-2">
              {ALERTS.map((a, i) => (
                <div key={i} className={`rounded border p-2 ${a.severity === 'critical' ? 'border-red-500/30 bg-red-500/5' : a.severity === 'high' ? 'border-orange-500/30 bg-orange-500/5' : a.severity === 'medium' ? 'border-amber-500/30 bg-amber-500/5' : 'border-border-default'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-content-tertiary font-mono">{a.time}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${a.severity === 'critical' ? 'bg-red-500/15 text-red-400' : a.severity === 'high' ? 'bg-orange-500/15 text-orange-400' : a.severity === 'medium' ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'}`}>{a.severity}</span>
                  </div>
                  <p className="text-[11px] text-content-secondary">{a.msg}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Protocol Breakdown */}
          <div className="rounded-lg border border-border-default bg-surface-card p-3">
            <p className="text-sm font-medium text-content-primary mb-2">Protocol Breakdown</p>
            {[
              { name: 'S7comm', pct: 35, color: 'bg-blue-500' },
              { name: 'EtherNet/IP', pct: 22, color: 'bg-emerald-500' },
              { name: 'Modbus TCP', pct: 18, color: 'bg-amber-500' },
              { name: 'OPC UA', pct: 12, color: 'bg-purple-500' },
              { name: 'HTTP/HTTPS', pct: 8, color: 'bg-cyan-500' },
              { name: 'Other', pct: 5, color: 'bg-gray-500' },
            ].map((p) => (
              <div key={p.name} className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] text-content-secondary w-20">{p.name}</span>
                <div className="flex-1 h-2 rounded-full bg-bg-secondary overflow-hidden"><div className={`h-full rounded-full ${p.color}`} style={{ width: `${p.pct}%` }} /></div>
                <span className="text-[10px] text-content-tertiary w-8 text-right">{p.pct}%</span>
              </div>
            ))}
          </div>

          {/* System Resources */}
          <div className="rounded-lg border border-border-default bg-surface-card p-3">
            <p className="text-sm font-medium text-content-primary mb-2">Capture Resources</p>
            {[
              { label: 'Buffer Usage', value: '34%', icon: HardDrive },
              { label: 'CPU Load', value: '12%', icon: Cpu },
              { label: 'Capture Size', value: '48 MB', icon: Activity },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between py-1">
                <span className="text-[10px] text-content-secondary flex items-center gap-1"><r.icon size={10} />{r.label}</span>
                <span className="text-[10px] text-content-primary font-medium">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
