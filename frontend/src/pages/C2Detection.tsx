import { useState } from 'react';
import {
  Radar, AlertTriangle, Activity, Clock, BarChart3, Eye,
  Shield, Skull, Radio, Zap, ChevronDown, ChevronRight, Search
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

const BEACON_DETECTIONS = [
  { id: 'BCN-001', src: '10.0.1.20', dst: '185.220.101.42', port: 443, interval: '60s ± 2s', jitter: 3.2, packets: 1440, duration: '24h', confidence: 98, protocol: 'HTTPS', status: 'confirmed' as const },
  { id: 'BCN-002', src: '10.0.3.50', dst: '91.234.56.78', port: 8443, interval: '300s ± 15s', jitter: 5.0, packets: 288, duration: '24h', confidence: 92, protocol: 'HTTPS', status: 'confirmed' as const },
  { id: 'BCN-003', src: '10.0.2.10', dst: '10.0.4.99', port: 4444, interval: '30s ± 1s', jitter: 2.1, packets: 2880, duration: '24h', confidence: 85, protocol: 'TCP Raw', status: 'suspected' as const },
  { id: 'BCN-004', src: '10.0.1.10', dst: '172.16.0.5', port: 502, interval: '1s ± 0.05s', jitter: 0.5, packets: 86400, duration: '24h', confidence: 15, protocol: 'Modbus', status: 'benign' as const },
];

const DNS_EXFIL = [
  { id: 'DNS-001', src: '10.0.3.50', domain: 'x7k2m.evil-c2.example.com', entropy: 4.82, queryCount: 342, avgLength: 48, dataEstimate: '16.4 KB', confidence: 95, status: 'confirmed' as const },
  { id: 'DNS-002', src: '10.0.1.20', domain: 'aGVsbG8gd29ybGQ.data.example.net', entropy: 4.65, queryCount: 128, avgLength: 52, dataEstimate: '6.7 KB', confidence: 88, status: 'suspected' as const },
  { id: 'DNS-003', src: '10.0.2.20', domain: 'update.vendor-legit.com', entropy: 2.1, queryCount: 24, avgLength: 22, dataEstimate: '0.5 KB', confidence: 12, status: 'benign' as const },
];

const ASYMMETRIC_FLOWS = [
  { src: '10.0.1.20', dst: '185.220.101.42', txBytes: '245 KB', rxBytes: '12.4 MB', ratio: '1:52', protocol: 'HTTPS', duration: '6h', risk: 'critical' as const },
  { src: '10.0.3.50', dst: '91.234.56.78', txBytes: '890 KB', rxBytes: '2.1 MB', ratio: '1:2.4', protocol: 'HTTPS', duration: '4h', risk: 'high' as const },
  { src: '10.0.2.10', dst: '10.0.3.01', txBytes: '1.2 MB', rxBytes: '45 KB', ratio: '27:1', protocol: 'OPC UA', duration: '24h', risk: 'medium' as const },
];

const IAT_HISTOGRAM = [
  { bucket: '0-1s', count: 86400, label: 'Polling (normal)' },
  { bucket: '1-5s', count: 1200, label: 'Mixed' },
  { bucket: '5-30s', count: 340, label: 'Low frequency' },
  { bucket: '28-32s', count: 2880, label: '⚠️ Beacon cluster' },
  { bucket: '55-65s', count: 1440, label: '⚠️ Beacon cluster' },
  { bucket: '285-315s', count: 288, label: '⚠️ Beacon cluster' },
  { bucket: '>600s', count: 45, label: 'Sporadic' },
];

const riskBg = (r: string) =>
  r === 'critical' || r === 'confirmed' ? 'bg-red-500/15 text-red-400' :
  r === 'high' || r === 'suspected' ? 'bg-orange-500/15 text-orange-400' :
  r === 'medium' ? 'bg-amber-500/15 text-amber-400' :
  'bg-emerald-500/15 text-emerald-400';

type TabType = 'beacons' | 'dns' | 'flows';

export default function C2Detection() {
  const [tab, setTab] = useState<TabType>('beacons');
  const [expanded, setExpanded] = useState<string | null>('BCN-001');
  const maxCount = Math.max(...IAT_HISTOGRAM.map((h) => h.count));

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2"><Radar size={24} className="text-accent" /> C2 / Beacon / Exfiltration Detection</h1>
          <p className="text-sm text-content-secondary mt-1">IAT histogram clustering, Shannon entropy DNS analysis, asymmetric flow detection</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-content-tertiary">Analysis window: 24h</span>
          <Button variant="primary" size="sm"><Radar size={14} /> Re-analyze</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Beacon Detections', value: BEACON_DETECTIONS.filter((b) => b.status !== 'benign').length, total: BEACON_DETECTIONS.length, icon: Radio, color: 'text-red-400', bg: 'bg-red-500/10' },
          { label: 'DNS Exfiltration', value: DNS_EXFIL.filter((d) => d.status !== 'benign').length, total: DNS_EXFIL.length, icon: Skull, color: 'text-orange-400', bg: 'bg-orange-500/10' },
          { label: 'Asymmetric Flows', value: ASYMMETRIC_FLOWS.length, total: ASYMMETRIC_FLOWS.length, icon: Activity, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Confirmed Threats', value: 3, total: null, icon: Shield, color: 'text-red-400', bg: 'bg-red-500/10' },
        ].map((s) => (
          <div key={s.label} className={`rounded-lg border border-border-default ${s.bg} p-3`}>
            <div className="flex items-center justify-between mb-1">
              <s.icon size={16} className={s.color} />
              {s.total !== null && <span className="text-[10px] text-content-tertiary">{s.value}/{s.total} suspicious</span>}
            </div>
            <p className="text-xl font-bold text-content-primary">{s.value}</p>
            <p className="text-[10px] text-content-tertiary">{s.label}</p>
          </div>
        ))}
      </div>

      {/* IAT Histogram */}
      <div className="rounded-lg border border-border-default bg-surface-card p-4">
        <p className="text-sm font-medium text-content-primary mb-3 flex items-center gap-2"><BarChart3 size={14} className="text-accent" />Inter-Arrival Time (IAT) Histogram</p>
        <div className="flex items-end gap-2 h-32">
          {IAT_HISTOGRAM.map((h) => {
            const height = Math.max((h.count / maxCount) * 100, 4);
            const isBeacon = h.label.includes('Beacon');
            return (
              <div key={h.bucket} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] text-content-tertiary">{h.count.toLocaleString()}</span>
                <div className={`w-full rounded-t ${isBeacon ? 'bg-red-500' : 'bg-accent/60'}`} style={{ height: `${height}%` }} />
                <span className={`text-[9px] ${isBeacon ? 'text-red-400 font-medium' : 'text-content-tertiary'}`}>{h.bucket}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-2 text-[10px] text-content-tertiary">
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-accent/60" />Normal traffic</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-red-500" />Beacon cluster (periodic)</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-surface-card border border-border-default p-1 w-fit">
        {([['beacons', 'Beacon Detection'], ['dns', 'DNS Exfiltration'], ['flows', 'Asymmetric Flows']] as [TabType, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === k ? 'bg-accent text-white' : 'text-content-secondary hover:bg-surface-hover'}`}>{l}</button>
        ))}
      </div>

      {tab === 'beacons' && (
        <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
          {BEACON_DETECTIONS.map((b) => (
            <div key={b.id}>
              <button onClick={() => setExpanded(expanded === b.id ? null : b.id)} className="w-full flex items-center justify-between px-4 py-3 border-b border-border-default hover:bg-surface-hover">
                <div className="flex items-center gap-3">
                  {expanded === b.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <span className="text-xs font-mono text-accent">{b.id}</span>
                  <span className="text-xs text-content-primary font-mono">{b.src}</span>
                  <span className="text-content-tertiary">→</span>
                  <span className="text-xs text-content-primary font-mono">{b.dst}:{b.port}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${riskBg(b.status)}`}>{b.status}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-content-tertiary">
                  <span>Confidence: <span className={b.confidence > 80 ? 'text-red-400 font-medium' : b.confidence > 50 ? 'text-amber-400' : 'text-emerald-400'}>{b.confidence}%</span></span>
                  <span>Interval: {b.interval}</span>
                </div>
              </button>
              {expanded === b.id && (
                <div className="bg-bg-secondary border-b border-border-default px-8 py-3 grid grid-cols-4 gap-4 text-xs">
                  <div><span className="text-content-tertiary">Protocol</span><p className="text-content-primary font-medium">{b.protocol}</p></div>
                  <div><span className="text-content-tertiary">Jitter</span><p className="text-content-primary">{b.jitter}%</p></div>
                  <div><span className="text-content-tertiary">Packets</span><p className="text-content-primary">{b.packets.toLocaleString()}</p></div>
                  <div><span className="text-content-tertiary">Duration</span><p className="text-content-primary">{b.duration}</p></div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'dns' && (
        <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border-default text-content-tertiary">
              <th className="text-left px-4 py-2 font-medium">ID</th><th className="text-left px-4 py-2 font-medium">Source</th>
              <th className="text-left px-4 py-2 font-medium">Domain</th><th className="text-right px-4 py-2 font-medium">Entropy</th>
              <th className="text-right px-4 py-2 font-medium">Queries</th><th className="text-right px-4 py-2 font-medium">Avg Len</th>
              <th className="text-right px-4 py-2 font-medium">Data Est.</th><th className="text-left px-4 py-2 font-medium">Status</th>
            </tr></thead>
            <tbody>{DNS_EXFIL.map((d) => (
              <tr key={d.id} className="border-b border-border-default last:border-0 hover:bg-surface-hover">
                <td className="px-4 py-2 font-mono text-accent">{d.id}</td>
                <td className="px-4 py-2 font-mono text-content-primary">{d.src}</td>
                <td className="px-4 py-2 font-mono text-content-secondary text-[10px] max-w-[200px] truncate">{d.domain}</td>
                <td className="px-4 py-2 text-right"><span className={d.entropy > 4 ? 'text-red-400 font-medium' : d.entropy > 3 ? 'text-amber-400' : 'text-content-primary'}>{d.entropy}</span></td>
                <td className="px-4 py-2 text-right text-content-primary">{d.queryCount}</td>
                <td className="px-4 py-2 text-right text-content-secondary">{d.avgLength}</td>
                <td className="px-4 py-2 text-right text-content-primary">{d.dataEstimate}</td>
                <td className="px-4 py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${riskBg(d.status)}`}>{d.status}</span></td>
              </tr>
            ))}</tbody>
          </table>
          <div className="px-4 py-2 border-t border-border-default bg-bg-secondary text-[10px] text-content-tertiary">
            Shannon entropy threshold: &gt;4.0 = suspicious, &gt;4.5 = likely encoded data. Normal DNS labels typically &lt;3.0.
          </div>
        </div>
      )}

      {tab === 'flows' && (
        <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border-default text-content-tertiary">
              <th className="text-left px-4 py-2 font-medium">Source</th><th className="text-left px-4 py-2 font-medium">Destination</th>
              <th className="text-right px-4 py-2 font-medium">TX</th><th className="text-right px-4 py-2 font-medium">RX</th>
              <th className="text-right px-4 py-2 font-medium">Ratio</th><th className="text-left px-4 py-2 font-medium">Protocol</th>
              <th className="text-left px-4 py-2 font-medium">Duration</th><th className="text-left px-4 py-2 font-medium">Risk</th>
            </tr></thead>
            <tbody>{ASYMMETRIC_FLOWS.map((f, i) => (
              <tr key={i} className="border-b border-border-default last:border-0 hover:bg-surface-hover">
                <td className="px-4 py-2 font-mono text-accent">{f.src}</td>
                <td className="px-4 py-2 font-mono text-content-primary">{f.dst}</td>
                <td className="px-4 py-2 text-right text-content-primary">{f.txBytes}</td>
                <td className="px-4 py-2 text-right text-content-primary font-medium">{f.rxBytes}</td>
                <td className="px-4 py-2 text-right"><span className={f.risk === 'critical' ? 'text-red-400 font-bold' : f.risk === 'high' ? 'text-orange-400 font-medium' : 'text-content-primary'}>{f.ratio}</span></td>
                <td className="px-4 py-2 text-content-secondary">{f.protocol}</td>
                <td className="px-4 py-2 text-content-tertiary">{f.duration}</td>
                <td className="px-4 py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${riskBg(f.risk)}`}>{f.risk}</span></td>
              </tr>
            ))}</tbody>
          </table>
          <div className="px-4 py-2 border-t border-border-default bg-bg-secondary text-[10px] text-content-tertiary">
            Asymmetric flow analysis flags connections where TX:RX ratio exceeds 10:1 or 1:10 — potential data staging or exfiltration.
          </div>
        </div>
      )}
    </div>
  );
}
