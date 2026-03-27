import { useState } from 'react';
import {
  Activity, AlertTriangle
} from 'lucide-react';

const PROTOCOLS = [
  { name: 'Modbus TCP', packets: 45230, endpoints: 8, rate: '12.3/s', port: 502, icon: '⚡' },
  { name: 'EtherNet/IP', packets: 32100, endpoints: 6, rate: '8.7/s', port: 44818, icon: '🔌' },
  { name: 'S7comm', packets: 18500, endpoints: 5, rate: '5.1/s', port: 102, icon: '🏭' },
  { name: 'DNP3', packets: 12300, endpoints: 4, rate: '3.4/s', port: 20000, icon: '📡' },
  { name: 'BACnet', packets: 8900, endpoints: 12, rate: '2.5/s', port: 47808, icon: '🏢' },
  { name: 'IEC 104', packets: 6200, endpoints: 3, rate: '1.7/s', port: 2404, icon: '⚙️' },
  { name: 'PROFINET', packets: 4100, endpoints: 6, rate: '1.1/s', port: 34964, icon: '🔧' },
  { name: 'LLDP', packets: 2800, endpoints: 14, rate: '0.8/s', port: 0, icon: '📋' },
  { name: 'SNMP', packets: 1500, endpoints: 8, rate: '0.4/s', port: 161, icon: '📊' },
];

const MODBUS_FCS = [
  { code: 'FC 03', name: 'Read Holding Registers', pct: 62, count: 28043, security: 'normal' },
  { code: 'FC 06', name: 'Write Single Register', pct: 15, count: 6785, security: 'write' },
  { code: 'FC 16', name: 'Write Multiple Registers', pct: 12, count: 5428, security: 'write' },
  { code: 'FC 01', name: 'Read Coils', pct: 8, count: 3618, security: 'normal' },
  { code: 'FC 43/14', name: 'Device Identification', pct: 3, count: 1356, security: 'info' },
];

const MODBUS_PAIRS = [
  { master: '10.1.3.50', slave: '10.1.1.10', unitId: 1, registers: '40001-40050', interval: '500ms', lastSeen: '2s ago' },
  { master: '10.1.3.50', slave: '10.1.1.20', unitId: 1, registers: '40001-40100', interval: '1000ms', lastSeen: '5s ago' },
  { master: '10.1.3.50', slave: '10.1.1.30', unitId: 2, registers: '30001-30020', interval: '2000ms', lastSeen: '8s ago' },
  { master: '10.1.3.12', slave: '10.1.1.10', unitId: 1, registers: '40001-40050', interval: 'Irregular', lastSeen: '45m ago' },
];

const CIP_DEVICES = [
  { ip: '10.1.1.25', vendor: 'Rockwell Automation', product: 'ControlLogix 5580', serial: 'C0A8-0119', firmware: 'V33.011', role: 'Adapter' },
  { ip: '10.1.2.50', vendor: 'Rockwell Automation', product: 'PanelView Plus 7', serial: 'C0A8-0232', firmware: 'V12.011', role: 'Scanner' },
  { ip: '10.1.3.50', vendor: 'Rockwell Automation', product: 'FactoryTalk Linx', serial: 'SOFT-0001', firmware: 'V6.30', role: 'Scanner' },
];

const S7_FUNCTIONS = [
  { func: 'Read Var', count: 12800, pct: 69, severity: 'normal' },
  { func: 'Write Var', count: 3200, pct: 17, severity: 'write' },
  { func: 'Setup Communication', count: 1850, pct: 10, severity: 'normal' },
  { func: 'Upload', count: 450, pct: 2.4, severity: 'critical' },
  { func: 'Download', count: 150, pct: 0.8, severity: 'critical' },
  { func: 'Stop', count: 50, pct: 0.3, severity: 'critical' },
];

const DNP3_PAIRS = [
  { master: '10.1.3.50', outstation: '10.1.1.30', groups: 'G1,G2,G12,G30', unsolicited: true, lastSeen: '3s ago' },
  { master: '10.1.3.50', outstation: '10.1.1.35', groups: 'G1,G2,G30,G40', unsolicited: false, lastSeen: '10s ago' },
];

const BACNET_DEVICES = [
  { instance: 100, vendor: 'Johnson Controls', model: 'FEC-2611', ip: '10.1.5.10', role: 'Server' },
  { instance: 200, vendor: 'Honeywell', model: 'Spyder', ip: '10.1.5.20', role: 'Server' },
  { instance: 300, vendor: 'Siemens', model: 'PXC36', ip: '10.1.5.30', role: 'Server' },
  { instance: 1000, vendor: 'Tridium', model: 'JACE-8000', ip: '10.1.5.100', role: 'Client' },
];

const IEC104_TYPES = [
  { type: 'I-frame', desc: 'Information Transfer', count: 4200, pct: 68 },
  { type: 'S-frame', desc: 'Supervisory', count: 1500, pct: 24 },
  { type: 'U-frame', desc: 'Unnumbered Control', count: 500, pct: 8 },
];

const TABS = ['Modbus', 'EtherNet/IP', 'S7comm', 'DNP3', 'BACnet', 'IEC 104'] as const;
type TabId = typeof TABS[number];

export default function ProtocolAnalyzer() {
  const [tab, setTab] = useState<TabId>('Modbus');

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2">
          <Activity size={24} className="text-accent" /> Deep Protocol Analysis
        </h1>
        <p className="text-sm text-content-secondary mt-1">Layer-by-layer ICS/SCADA protocol inspection from passive captures</p>
      </div>

      {/* Protocol summary bar */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {PROTOCOLS.map((p) => (
          <div key={p.name} className="shrink-0 rounded-lg border border-border-default bg-surface-card px-3 py-2 min-w-[120px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-content-primary">{p.name}</span>
            </div>
            <p className="text-lg font-bold text-accent">{p.packets.toLocaleString()}</p>
            <p className="text-[10px] text-content-tertiary">{p.endpoints} endpoints &middot; {p.rate}</p>
          </div>
        ))}
      </div>

      {/* Protocol tabs */}
      <div className="flex gap-1 rounded-lg bg-surface-card border border-border-default p-1 w-fit">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === t ? 'bg-accent text-white' : 'text-content-secondary hover:text-content-primary hover:bg-surface-hover'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Modbus */}
      {tab === 'Modbus' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-border-default bg-surface-card p-4">
              <p className="text-sm font-medium text-content-primary mb-3">Function Code Distribution</p>
              <div className="space-y-2">
                {MODBUS_FCS.map((fc) => (
                  <div key={fc.code} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-content-tertiary w-16">{fc.code}</span>
                    <div className="flex-1 h-5 rounded bg-bg-secondary overflow-hidden">
                      <div className={`h-full rounded ${fc.security === 'write' ? 'bg-amber-500/60' : fc.security === 'info' ? 'bg-blue-500/60' : 'bg-accent/60'}`} style={{ width: `${fc.pct}%` }} />
                    </div>
                    <span className="text-xs text-content-secondary w-10 text-right">{fc.pct}%</span>
                    <span className="text-[10px] text-content-tertiary w-16 text-right">{fc.count.toLocaleString()}</span>
                    {fc.security === 'write' && <AlertTriangle size={12} className="text-amber-400" />}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border-default bg-surface-card p-4">
              <p className="text-sm font-medium text-content-primary mb-3">Master / Slave Pairs</p>
              <table className="w-full text-xs">
                <thead><tr className="text-content-tertiary border-b border-border-default"><th className="text-left py-1.5 font-medium">Master</th><th className="text-left py-1.5 font-medium">Slave</th><th className="text-left py-1.5 font-medium">Unit</th><th className="text-left py-1.5 font-medium">Registers</th><th className="text-left py-1.5 font-medium">Interval</th></tr></thead>
                <tbody>
                  {MODBUS_PAIRS.map((p, i) => (
                    <tr key={i} className={`border-b border-border-default last:border-0 ${p.interval === 'Irregular' ? 'bg-amber-500/5' : ''}`}>
                      <td className="py-1.5 font-mono text-content-primary">{p.master}</td>
                      <td className="py-1.5 font-mono text-content-primary">{p.slave}</td>
                      <td className="py-1.5 text-content-secondary">{p.unitId}</td>
                      <td className="py-1.5 text-content-secondary">{p.registers}</td>
                      <td className="py-1.5"><span className={p.interval === 'Irregular' ? 'text-amber-400 font-medium' : 'text-content-secondary'}>{p.interval}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-400" />
            <span className="text-xs text-amber-400">Write operations detected: {MODBUS_FCS.filter((f) => f.security === 'write').reduce((s, f) => s + f.count, 0).toLocaleString()} writes from 2 sources. Irregular polling from 10.1.3.12 (engineering workstation).</span>
          </div>
        </div>
      )}

      {/* EtherNet/IP */}
      {tab === 'EtherNet/IP' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border-default bg-surface-card p-4">
            <p className="text-sm font-medium text-content-primary mb-3">CIP ListIdentity Responses</p>
            <table className="w-full text-xs">
              <thead><tr className="text-content-tertiary border-b border-border-default"><th className="text-left py-1.5 font-medium">IP</th><th className="text-left py-1.5 font-medium">Vendor</th><th className="text-left py-1.5 font-medium">Product</th><th className="text-left py-1.5 font-medium">Serial</th><th className="text-left py-1.5 font-medium">Firmware</th><th className="text-left py-1.5 font-medium">Role</th></tr></thead>
              <tbody>{CIP_DEVICES.map((d) => (
                <tr key={d.ip} className="border-b border-border-default last:border-0 hover:bg-surface-hover">
                  <td className="py-2 font-mono text-accent">{d.ip}</td><td className="py-2 text-content-primary">{d.vendor}</td>
                  <td className="py-2 text-content-primary">{d.product}</td><td className="py-2 font-mono text-content-secondary">{d.serial}</td>
                  <td className="py-2 text-content-secondary">{d.firmware}</td>
                  <td className="py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] ${d.role === 'Scanner' ? 'bg-blue-500/15 text-blue-400' : 'bg-emerald-500/15 text-emerald-400'}`}>{d.role}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[{ label: 'CIP Services', value: '4 types', detail: 'GetAttributeAll, ForwardOpen, ForwardClose, ListIdentity' },
              { label: 'I/O Connections', value: '3 active', detail: 'Implicit messaging at 10ms RPI' },
              { label: 'Scanners', value: '2 detected', detail: 'SCADA server + FactoryTalk Linx' },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border-default bg-surface-card p-3">
                <p className="text-[10px] text-content-tertiary">{s.label}</p>
                <p className="text-lg font-bold text-content-primary">{s.value}</p>
                <p className="text-[10px] text-content-tertiary mt-1">{s.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* S7comm */}
      {tab === 'S7comm' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border-default bg-surface-card p-4">
            <p className="text-sm font-medium text-content-primary mb-3">S7comm Function Codes</p>
            <div className="space-y-2">
              {S7_FUNCTIONS.map((f) => (
                <div key={f.func} className="flex items-center gap-3">
                  <span className="text-xs text-content-primary w-40">{f.func}</span>
                  <div className="flex-1 h-5 rounded bg-bg-secondary overflow-hidden">
                    <div className={`h-full rounded ${f.severity === 'critical' ? 'bg-red-500/60' : f.severity === 'write' ? 'bg-amber-500/60' : 'bg-accent/60'}`} style={{ width: `${Math.max(f.pct, 2)}%` }} />
                  </div>
                  <span className="text-xs text-content-secondary w-10 text-right">{f.pct}%</span>
                  <span className="text-[10px] text-content-tertiary w-16 text-right">{f.count.toLocaleString()}</span>
                  {f.severity === 'critical' && <AlertTriangle size={12} className="text-red-400" />}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-400" />
            <span className="text-xs text-red-400 font-medium">CRITICAL: Program Download (150) and Stop (50) commands detected. Upload activity (450) may indicate program exfiltration. Source: 10.1.3.12</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-border-default bg-surface-card p-4">
              <p className="text-xs font-medium text-content-primary mb-2">Rack/Slot Mappings</p>
              <div className="space-y-1 text-xs">
                {[{ ip: '10.1.1.10', rack: 0, slot: 1, module: 'CPU 1518-4' }, { ip: '10.1.1.15', rack: 0, slot: 1, module: 'CPU 315-2' }, { ip: '10.1.1.99', rack: 0, slot: 2, module: 'CPU 315-2' }].map((m) => (
                  <div key={m.ip} className="flex items-center justify-between px-2 py-1 rounded bg-bg-secondary">
                    <span className="font-mono text-accent">{m.ip}</span>
                    <span className="text-content-secondary">R{m.rack}/S{m.slot}</span>
                    <span className="text-content-primary">{m.module}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border-default bg-surface-card p-4">
              <p className="text-xs font-medium text-content-primary mb-2">SZL Identity Data</p>
              <div className="space-y-1 text-xs">
                {[{ field: 'Module Type', value: 'S7-1500' }, { field: 'Serial Number', value: 'S C-H5K12345' }, { field: 'Hardware Version', value: 'V3.0' }, { field: 'Firmware Version', value: 'V3.2.1' }, { field: 'Plant ID', value: 'PLANT_FLOOR_1' }].map((f) => (
                  <div key={f.field} className="flex items-center justify-between px-2 py-1 rounded bg-bg-secondary">
                    <span className="text-content-tertiary">{f.field}</span>
                    <span className="text-content-primary font-mono">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DNP3 */}
      {tab === 'DNP3' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border-default bg-surface-card p-4">
            <p className="text-sm font-medium text-content-primary mb-3">Master / Outstation Pairs</p>
            <table className="w-full text-xs">
              <thead><tr className="text-content-tertiary border-b border-border-default"><th className="text-left py-1.5 font-medium">Master</th><th className="text-left py-1.5 font-medium">Outstation</th><th className="text-left py-1.5 font-medium">Object Groups</th><th className="text-center py-1.5 font-medium">Unsolicited</th><th className="text-left py-1.5 font-medium">Last Seen</th></tr></thead>
              <tbody>{DNP3_PAIRS.map((p, i) => (
                <tr key={i} className="border-b border-border-default last:border-0">
                  <td className="py-2 font-mono text-content-primary">{p.master}</td>
                  <td className="py-2 font-mono text-content-primary">{p.outstation}</td>
                  <td className="py-2 text-content-secondary">{p.groups}</td>
                  <td className="py-2 text-center">{p.unsolicited ? <span className="text-amber-400">Yes</span> : <span className="text-content-tertiary">No</span>}</td>
                  <td className="py-2 text-content-tertiary">{p.lastSeen}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[{ label: 'Function Codes', value: '8 types', detail: 'Read, Write, Direct Op, Freeze, Cold Restart' },
              { label: 'Object Groups', value: '6 groups', detail: 'Binary Input/Output, Analog, Counter, Class' },
              { label: 'Secure Auth', value: 'Not Enabled', detail: 'SA v5 not detected on any link' },
            ].map((s) => (
              <div key={s.label} className={`rounded-lg border bg-surface-card p-3 ${s.value === 'Not Enabled' ? 'border-red-500/30' : 'border-border-default'}`}>
                <p className="text-[10px] text-content-tertiary">{s.label}</p>
                <p className={`text-lg font-bold ${s.value === 'Not Enabled' ? 'text-red-400' : 'text-content-primary'}`}>{s.value}</p>
                <p className="text-[10px] text-content-tertiary mt-1">{s.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BACnet */}
      {tab === 'BACnet' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border-default bg-surface-card p-4">
            <p className="text-sm font-medium text-content-primary mb-3">I-Am Device Broadcasts</p>
            <table className="w-full text-xs">
              <thead><tr className="text-content-tertiary border-b border-border-default"><th className="text-left py-1.5 font-medium">Instance</th><th className="text-left py-1.5 font-medium">Vendor</th><th className="text-left py-1.5 font-medium">Model</th><th className="text-left py-1.5 font-medium">IP</th><th className="text-left py-1.5 font-medium">Role</th></tr></thead>
              <tbody>{BACNET_DEVICES.map((d) => (
                <tr key={d.instance} className="border-b border-border-default last:border-0 hover:bg-surface-hover">
                  <td className="py-2 font-mono text-accent">{d.instance}</td><td className="py-2 text-content-primary">{d.vendor}</td>
                  <td className="py-2 text-content-secondary">{d.model}</td><td className="py-2 font-mono text-content-secondary">{d.ip}</td>
                  <td className="py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] ${d.role === 'Client' ? 'bg-blue-500/15 text-blue-400' : 'bg-emerald-500/15 text-emerald-400'}`}>{d.role}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* IEC 104 */}
      {tab === 'IEC 104' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border-default bg-surface-card p-4">
            <p className="text-sm font-medium text-content-primary mb-3">APCI Frame Classification</p>
            <div className="space-y-2">
              {IEC104_TYPES.map((t) => (
                <div key={t.type} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-content-primary w-20">{t.type}</span>
                  <div className="flex-1 h-5 rounded bg-bg-secondary overflow-hidden">
                    <div className="h-full rounded bg-accent/60" style={{ width: `${t.pct}%` }} />
                  </div>
                  <span className="text-xs text-content-secondary w-10 text-right">{t.pct}%</span>
                  <span className="text-[10px] text-content-tertiary w-16 text-right">{t.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[{ label: 'Master', value: '10.1.3.50', detail: 'SCADA Control Server' },
              { label: 'Outstation', value: '10.1.1.30', detail: 'ABB RTU560' },
              { label: 'ASDU Types', value: '5 types', detail: 'M_SP_NA, M_ME_NC, C_SC_NA, C_IC_NA, M_IT_NA' },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border-default bg-surface-card p-3">
                <p className="text-[10px] text-content-tertiary">{s.label}</p>
                <p className="text-sm font-bold text-content-primary font-mono">{s.value}</p>
                <p className="text-[10px] text-content-tertiary mt-1">{s.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
