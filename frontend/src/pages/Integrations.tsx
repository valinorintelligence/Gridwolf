import { useState } from 'react';
import {
  Plug, Upload, Check, X, AlertTriangle, Clock, FileJson,
  Search, Filter, ChevronRight, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

const TOOLS = [
  { name: 'Zeek', desc: 'Import conn.log, modbus.log, dnp3.log, s7comm.log for network metadata correlation', formats: 'TSV logs', status: 'connected' as const, lastImport: '2 hours ago', items: 12450, color: 'text-blue-400' },
  { name: 'Suricata', desc: 'IDS alert correlation with discovered devices from EVE JSON', formats: 'EVE JSON', status: 'connected' as const, lastImport: '4 hours ago', items: 890, color: 'text-emerald-400' },
  { name: 'Nmap / Masscan', desc: 'Active scan results tagged with [active-scan] marker for differentiation', formats: 'XML', status: 'not-configured' as const, lastImport: null, items: 0, color: 'text-amber-400' },
  { name: 'Wazuh', desc: 'HIDS/SIEM alert import with device correlation', formats: 'JSON (line/array)', status: 'not-configured' as const, lastImport: null, items: 0, color: 'text-purple-400' },
  { name: 'Siemens SINEMA', desc: 'Asset inventory enrichment from Siemens network management server', formats: 'CSV', status: 'connected' as const, lastImport: '1 day ago', items: 45, color: 'text-cyan-400' },
  { name: 'Siemens TIA Portal', desc: 'PLC project data including hardware config and network topology', formats: 'Project XML', status: 'not-configured' as const, lastImport: null, items: 0, color: 'text-cyan-400' },
  { name: 'Wireshark', desc: 'Auto-detect PCAP format, right-click to open, frame-level inspection', formats: 'PCAP/PCAPNG', status: 'configured' as const, lastImport: null, items: 0, color: 'text-green-400' },
];

const IMPORT_HISTORY = [
  { tool: 'Zeek', file: 'conn.log', date: '2024-03-15 14:30', records: 8420, matched: 18, alerts: 0, status: 'success' as const },
  { tool: 'Zeek', file: 'modbus.log', date: '2024-03-15 14:30', records: 2340, matched: 6, alerts: 0, status: 'success' as const },
  { tool: 'Zeek', file: 'dnp3.log', date: '2024-03-15 14:31', records: 1690, matched: 4, alerts: 0, status: 'success' as const },
  { tool: 'Suricata', file: 'eve.json', date: '2024-03-15 12:15', records: 890, matched: 15, alerts: 23, status: 'success' as const },
  { tool: 'Siemens SINEMA', file: 'inventory_export.csv', date: '2024-03-14 09:00', records: 45, matched: 18, alerts: 0, status: 'success' as const },
  { tool: 'Suricata', file: 'eve_old.json', date: '2024-03-10 16:00', records: 450, matched: 12, alerts: 8, status: 'partial' as const },
  { tool: 'Nmap', file: 'scan_results.xml', date: '2024-03-08 11:30', records: 24, matched: 20, alerts: 0, status: 'success' as const },
  { tool: 'Zeek', file: 'corrupt_conn.log', date: '2024-03-05 08:00', records: 0, matched: 0, alerts: 0, status: 'failed' as const },
];

export default function Integrations() {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2"><Plug size={24} className="text-accent" /> External Tool Import</h1>
        <p className="text-sm text-content-secondary mt-1">Import data from security tools to enrich passive network analysis</p>
      </div>

      {/* Tool cards */}
      <div className="grid grid-cols-2 gap-4">
        {TOOLS.map((t) => (
          <div key={t.name} className={`rounded-lg border bg-surface-card p-4 ${t.status === 'connected' ? 'border-emerald-500/20' : 'border-border-default'}`}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg bg-bg-secondary flex items-center justify-center text-sm font-bold ${t.color}`}>{t.name[0]}</div>
                <div>
                  <p className="text-sm font-bold text-content-primary">{t.name}</p>
                  <span className="text-[10px] text-content-tertiary">{t.formats}</span>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                t.status === 'connected' ? 'bg-emerald-500/15 text-emerald-400' :
                t.status === 'configured' ? 'bg-blue-500/15 text-blue-400' :
                'bg-border-default text-content-tertiary'
              }`}>
                {t.status === 'connected' ? 'Connected' : t.status === 'configured' ? 'Configured' : 'Not Configured'}
              </span>
            </div>
            <p className="text-xs text-content-secondary mb-3">{t.desc}</p>
            {t.name === 'Nmap / Masscan' && (
              <div className="mb-3 px-2 py-1.5 rounded bg-amber-500/10 border border-amber-500/20 flex items-center gap-1.5">
                <AlertTriangle size={10} className="text-amber-400" />
                <span className="text-[10px] text-amber-400">Active scan data tagged separately from passive</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-content-tertiary">
                {t.lastImport ? <><Clock size={10} className="inline mr-1" />Last: {t.lastImport} &middot; {t.items.toLocaleString()} items</> : 'No imports yet'}
              </div>
              <Button variant={t.status === 'not-configured' ? 'outline' : 'primary'} size="sm">
                {t.status === 'not-configured' ? 'Configure' : <><Upload size={12} /> Import</>}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Quick import drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); }}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${dragOver ? 'border-accent bg-accent/10' : 'border-border-default bg-surface-card'}`}
      >
        <Upload size={24} className="mx-auto text-content-tertiary mb-2" />
        <p className="text-sm text-content-primary font-medium">Quick Import - Drop any supported file</p>
        <p className="text-xs text-content-tertiary mt-1">Auto-detects: Zeek logs, Suricata EVE JSON, Nmap XML, Wazuh JSON, SINEMA CSV, TIA XML</p>
      </div>

      {/* Import History */}
      <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border-default">
          <p className="text-sm font-medium text-content-primary">Import History</p>
        </div>
        <table className="w-full text-xs">
          <thead><tr className="border-b border-border-default text-content-tertiary">
            <th className="text-left px-4 py-2 font-medium">Source</th><th className="text-left px-4 py-2 font-medium">File</th>
            <th className="text-left px-4 py-2 font-medium">Date</th><th className="text-right px-4 py-2 font-medium">Records</th>
            <th className="text-right px-4 py-2 font-medium">Matched</th><th className="text-right px-4 py-2 font-medium">Alerts</th>
            <th className="text-left px-4 py-2 font-medium">Status</th>
          </tr></thead>
          <tbody>{IMPORT_HISTORY.map((h, i) => (
            <tr key={i} className="border-b border-border-default last:border-0 hover:bg-surface-hover">
              <td className="px-4 py-2 text-content-primary font-medium">{h.tool}</td>
              <td className="px-4 py-2 font-mono text-content-secondary">{h.file}</td>
              <td className="px-4 py-2 text-content-secondary">{h.date}</td>
              <td className="px-4 py-2 text-right text-content-primary">{h.records.toLocaleString()}</td>
              <td className="px-4 py-2 text-right text-content-primary">{h.matched}</td>
              <td className="px-4 py-2 text-right">{h.alerts > 0 ? <span className="text-amber-400">{h.alerts}</span> : <span className="text-content-tertiary">0</span>}</td>
              <td className="px-4 py-2"><span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                h.status === 'success' ? 'bg-emerald-500/15 text-emerald-400' : h.status === 'partial' ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400'
              }`}>{h.status === 'success' ? <Check size={8} /> : h.status === 'partial' ? <AlertTriangle size={8} /> : <X size={8} />}{h.status}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
