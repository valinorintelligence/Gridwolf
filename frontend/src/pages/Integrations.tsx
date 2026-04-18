import { useState, useEffect } from 'react';
import {
  Plug, Upload, Check, X, AlertTriangle, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api } from '@/services/api';

// ─── Static tool catalogue (no backend endpoint needed) ──────────
const TOOLS = [
  { name: 'Zeek', desc: 'Import conn.log, modbus.log, dnp3.log, s7comm.log for network metadata correlation', formats: 'TSV logs', color: 'text-blue-400' },
  { name: 'Suricata', desc: 'IDS alert correlation with discovered devices from EVE JSON', formats: 'EVE JSON', color: 'text-emerald-400' },
  { name: 'Nmap / Masscan', desc: 'Active scan results tagged with [active-scan] marker for differentiation', formats: 'XML', color: 'text-amber-400', activeWarning: true },
  { name: 'Wazuh', desc: 'HIDS/SIEM alert import with device correlation', formats: 'JSON (line/array)', color: 'text-purple-400' },
  { name: 'Siemens SINEMA', desc: 'Asset inventory enrichment from Siemens network management server', formats: 'CSV', color: 'text-cyan-400' },
  { name: 'Siemens TIA Portal', desc: 'PLC project data including hardware config and network topology', formats: 'Project XML', color: 'text-cyan-400' },
  { name: 'Wireshark / PCAP', desc: 'Upload PCAP/PCAPNG files for passive ICS/OT protocol analysis', formats: 'PCAP/PCAPNG', color: 'text-green-400' },
];

// ─── Types ───────────────────────────────────────────────────────
interface PcapRecord {
  pcap_id: string;
  session_id: string | null;
  filename: string;
  file_size: number | null;
  status: string;
  packet_count: number | null;
  protocol_summary: Record<string, number> | null;
  created_at: string | null;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

// ─── Component ────────────────────────────────────────────────────
export default function Integrations() {
  const [dragOver, setDragOver] = useState(false);
  const [pcaps, setPcaps] = useState<PcapRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/ics/pcap/list')
      .then((r) => setPcaps(Array.isArray(r.data) ? r.data : []))
      .catch(() => setPcaps([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2">
          <Plug size={24} className="text-accent" /> External Tool Import
        </h1>
        <p className="text-sm text-content-secondary mt-1">
          Import data from security tools to enrich passive network analysis
        </p>
      </div>

      {/* Tool cards */}
      <div className="grid grid-cols-2 gap-4">
        {TOOLS.map((t) => (
          <div key={t.name} className="rounded-lg border border-border-default bg-surface-card p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg bg-bg-secondary flex items-center justify-center text-sm font-bold ${t.color}`}>
                  {t.name[0]}
                </div>
                <div>
                  <p className="text-sm font-bold text-content-primary">{t.name}</p>
                  <span className="text-[10px] text-content-tertiary">{t.formats}</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-content-secondary mb-3">{t.desc}</p>
            {t.activeWarning && (
              <div className="mb-3 px-2 py-1.5 rounded bg-amber-500/10 border border-amber-500/20 flex items-center gap-1.5">
                <AlertTriangle size={10} className="text-amber-400" />
                <span className="text-[10px] text-amber-400">Active scan data tagged separately from passive</span>
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="outline" size="sm">
                <Upload size={12} /> Import
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
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
          dragOver ? 'border-accent bg-accent/10' : 'border-border-default bg-surface-card'
        }`}
      >
        <Upload size={24} className="mx-auto text-content-tertiary mb-2" />
        <p className="text-sm text-content-primary font-medium">Quick Import — Drop any supported file</p>
        <p className="text-xs text-content-tertiary mt-1">
          Auto-detects: Zeek logs, Suricata EVE JSON, Nmap XML, Wazuh JSON, SINEMA CSV, TIA XML, PCAP/PCAPNG
        </p>
      </div>

      {/* PCAP Import History (from real API) */}
      <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border-default flex items-center justify-between">
          <p className="text-sm font-medium text-content-primary">PCAP Import History</p>
          {pcaps.length > 0 && (
            <span className="text-xs text-content-tertiary">{pcaps.length} file{pcaps.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : pcaps.length === 0 ? (
          <div className="p-8 text-center text-sm text-content-secondary">
            <Clock size={24} className="mx-auto text-content-tertiary mb-3" />
            No PCAP files imported yet.{' '}
            <a href="/pcap" className="text-accent hover:underline">Upload your first PCAP →</a>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-default text-content-tertiary">
                <th className="text-left px-4 py-2 font-medium">File</th>
                <th className="text-left px-4 py-2 font-medium">Date</th>
                <th className="text-right px-4 py-2 font-medium">Size</th>
                <th className="text-right px-4 py-2 font-medium">Packets</th>
                <th className="text-left px-4 py-2 font-medium">Protocols</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {pcaps.map((p) => (
                <tr key={p.pcap_id} className="border-b border-border-default last:border-0 hover:bg-surface-hover">
                  <td className="px-4 py-2 font-mono text-content-secondary">{p.filename}</td>
                  <td className="px-4 py-2 text-content-secondary">{formatDate(p.created_at)}</td>
                  <td className="px-4 py-2 text-right text-content-primary">{formatBytes(p.file_size)}</td>
                  <td className="px-4 py-2 text-right text-content-primary">
                    {p.packet_count != null ? p.packet_count.toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-2 text-content-secondary">
                    {p.protocol_summary
                      ? Object.keys(p.protocol_summary).slice(0, 4).join(', ') || '-'
                      : '-'}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                      p.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' :
                      p.status === 'processing' ? 'bg-blue-500/15 text-blue-400' :
                      p.status === 'failed' ? 'bg-red-500/15 text-red-400' :
                      'bg-amber-500/15 text-amber-400'
                    }`}>
                      {p.status === 'completed' ? <Check size={8} /> :
                       p.status === 'failed' ? <X size={8} /> :
                       <AlertTriangle size={8} />}
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
