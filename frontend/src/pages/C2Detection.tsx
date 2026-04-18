import { useState, useEffect } from 'react';
import {
  Radar, AlertTriangle, Activity, BarChart3,
  Shield, Skull, Radio, ChevronDown, ChevronRight, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api } from '@/services/api';

interface Finding {
  id: string | number;
  finding_type: string;
  severity: string;
  title: string;
  description: string;
  src_ip: string;
  dst_ip: string;
  protocol: string;
  confidence: number;
  evidence: Record<string, unknown> | null;
  created_at: string;
}

const riskBg = (r: string) =>
  r === 'critical' || r === 'confirmed' ? 'bg-red-500/15 text-red-400' :
  r === 'high' || r === 'suspected' ? 'bg-orange-500/15 text-orange-400' :
  r === 'medium' ? 'bg-amber-500/15 text-amber-400' :
  'bg-emerald-500/15 text-emerald-400';

const severityLabel = (confidence: number): string =>
  confidence >= 80 ? 'confirmed' : confidence >= 50 ? 'suspected' : 'benign';

type TabType = 'beacons' | 'dns' | 'flows';

export default function C2Detection() {
  const [tab, setTab] = useState<TabType>('beacons');
  const [expanded, setExpanded] = useState<string | null>(null);

  const [beacons, setBeacons] = useState<Finding[]>([]);
  const [dnsExfil, setDnsExfil] = useState<Finding[]>([]);
  const [asymFlows, setAsymFlows] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [bRes, dRes, aRes] = await Promise.all([
          api.get('/ics/findings/?finding_type=beacon'),
          api.get('/ics/findings/?finding_type=dns_exfil'),
          api.get('/ics/findings/?finding_type=asymmetric_flow'),
        ]);
        setBeacons(Array.isArray(bRes.data) ? bRes.data : (bRes.data?.results ?? []));
        setDnsExfil(Array.isArray(dRes.data) ? dRes.data : (dRes.data?.results ?? []));
        setAsymFlows(Array.isArray(aRes.data) ? aRes.data : (aRes.data?.results ?? []));
      } catch (err) {
        console.error('C2Detection fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const confirmedThreats = [...beacons, ...dnsExfil, ...asymFlows].filter(
    (f) => f.confidence >= 80
  ).length;

  const isEmpty = !loading && beacons.length === 0 && dnsExfil.length === 0 && asymFlows.length === 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2">
            <Radar size={24} className="text-accent" /> C2 / Beacon / Exfiltration Detection
          </h1>
          <p className="text-sm text-content-secondary mt-1">
            IAT histogram clustering, Shannon entropy DNS analysis, asymmetric flow detection
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-content-tertiary">Analysis window: 24h</span>
          <Button variant="primary" size="sm"><Radar size={14} /> Re-analyze</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Beacon Detections', value: beacons.filter((b) => b.confidence >= 50).length, total: beacons.length, icon: Radio, color: 'text-red-400', bg: 'bg-red-500/10' },
          { label: 'DNS Exfiltration', value: dnsExfil.filter((d) => d.confidence >= 50).length, total: dnsExfil.length, icon: Skull, color: 'text-orange-400', bg: 'bg-orange-500/10' },
          { label: 'Asymmetric Flows', value: asymFlows.length, total: asymFlows.length, icon: Activity, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Confirmed Threats', value: confirmedThreats, total: null, icon: Shield, color: 'text-red-400', bg: 'bg-red-500/10' },
        ].map((s) => (
          <div key={s.label} className={`rounded-lg border border-border-default ${s.bg} p-3`}>
            <div className="flex items-center justify-between mb-1">
              <s.icon size={16} className={s.color} />
              {s.total !== null && (
                <span className="text-[10px] text-content-tertiary">{s.value}/{s.total} suspicious</span>
              )}
            </div>
            <p className="text-xl font-bold text-content-primary">
              {loading ? <Loader2 size={16} className="animate-spin" /> : s.value}
            </p>
            <p className="text-[10px] text-content-tertiary">{s.label}</p>
          </div>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-content-tertiary gap-2">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Loading C2 detection data...</span>
        </div>
      )}

      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-border-default bg-surface-card text-center gap-3">
          <Radar size={32} className="text-content-tertiary" />
          <p className="text-sm font-medium text-content-primary">No C2 activity detected</p>
          <p className="text-xs text-content-tertiary max-w-sm">
            Upload and analyze a PCAP to detect C2 beacons
          </p>
        </div>
      )}

      {!loading && !isEmpty && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 rounded-lg bg-surface-card border border-border-default p-1 w-fit">
            {([['beacons', 'Beacon Detection'], ['dns', 'DNS Exfiltration'], ['flows', 'Asymmetric Flows']] as [TabType, string][]).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === k ? 'bg-accent text-white' : 'text-content-secondary hover:bg-surface-hover'}`}
              >
                {l}
              </button>
            ))}
          </div>

          {tab === 'beacons' && (
            <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
              {beacons.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-content-tertiary">No beacon detections found.</div>
              ) : beacons.map((b) => {
                const key = String(b.id);
                const status = severityLabel(b.confidence);
                return (
                  <div key={key}>
                    <button
                      onClick={() => setExpanded(expanded === key ? null : key)}
                      className="w-full flex items-center justify-between px-4 py-3 border-b border-border-default hover:bg-surface-hover"
                    >
                      <div className="flex items-center gap-3">
                        {expanded === key ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <span className="text-xs font-mono text-accent">{key}</span>
                        <span className="text-xs text-content-primary font-mono">{b.src_ip}</span>
                        <span className="text-content-tertiary">→</span>
                        <span className="text-xs text-content-primary font-mono">{b.dst_ip}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${riskBg(status)}`}>{status}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-content-tertiary">
                        <span>Confidence: <span className={b.confidence > 80 ? 'text-red-400 font-medium' : b.confidence > 50 ? 'text-amber-400' : 'text-emerald-400'}>{b.confidence}%</span></span>
                        <span>{b.protocol}</span>
                      </div>
                    </button>
                    {expanded === key && (
                      <div className="bg-bg-secondary border-b border-border-default px-8 py-3 grid grid-cols-3 gap-4 text-xs">
                        <div><span className="text-content-tertiary">Protocol</span><p className="text-content-primary font-medium">{b.protocol}</p></div>
                        <div><span className="text-content-tertiary">Severity</span><p className="text-content-primary">{b.severity}</p></div>
                        <div><span className="text-content-tertiary">Detected</span><p className="text-content-primary">{new Date(b.created_at).toLocaleString()}</p></div>
                        {b.description && (
                          <div className="col-span-3">
                            <span className="text-content-tertiary">Description</span>
                            <p className="text-content-secondary mt-0.5">{b.description}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'dns' && (
            <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
              {dnsExfil.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-content-tertiary">No DNS exfiltration findings found.</div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border-default text-content-tertiary">
                      <th className="text-left px-4 py-2 font-medium">ID</th>
                      <th className="text-left px-4 py-2 font-medium">Source</th>
                      <th className="text-left px-4 py-2 font-medium">Destination</th>
                      <th className="text-left px-4 py-2 font-medium">Protocol</th>
                      <th className="text-right px-4 py-2 font-medium">Confidence</th>
                      <th className="text-left px-4 py-2 font-medium">Severity</th>
                      <th className="text-left px-4 py-2 font-medium">Detected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dnsExfil.map((d) => (
                      <tr key={String(d.id)} className="border-b border-border-default last:border-0 hover:bg-surface-hover">
                        <td className="px-4 py-2 font-mono text-accent">{String(d.id)}</td>
                        <td className="px-4 py-2 font-mono text-content-primary">{d.src_ip}</td>
                        <td className="px-4 py-2 font-mono text-content-secondary text-[10px] max-w-[200px] truncate">{d.dst_ip}</td>
                        <td className="px-4 py-2 text-content-secondary">{d.protocol}</td>
                        <td className="px-4 py-2 text-right">
                          <span className={d.confidence > 80 ? 'text-red-400 font-medium' : d.confidence > 50 ? 'text-amber-400' : 'text-content-primary'}>
                            {d.confidence}%
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${riskBg(d.severity)}`}>{d.severity}</span>
                        </td>
                        <td className="px-4 py-2 text-content-tertiary">{new Date(d.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="px-4 py-2 border-t border-border-default bg-bg-secondary text-[10px] text-content-tertiary">
                Shannon entropy threshold: &gt;4.0 = suspicious, &gt;4.5 = likely encoded data. Normal DNS labels typically &lt;3.0.
              </div>
            </div>
          )}

          {tab === 'flows' && (
            <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
              {asymFlows.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-content-tertiary">No asymmetric flow findings found.</div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border-default text-content-tertiary">
                      <th className="text-left px-4 py-2 font-medium">Source</th>
                      <th className="text-left px-4 py-2 font-medium">Destination</th>
                      <th className="text-left px-4 py-2 font-medium">Protocol</th>
                      <th className="text-right px-4 py-2 font-medium">Confidence</th>
                      <th className="text-left px-4 py-2 font-medium">Severity</th>
                      <th className="text-left px-4 py-2 font-medium">Detected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asymFlows.map((f, i) => (
                      <tr key={String(f.id ?? i)} className="border-b border-border-default last:border-0 hover:bg-surface-hover">
                        <td className="px-4 py-2 font-mono text-accent">{f.src_ip}</td>
                        <td className="px-4 py-2 font-mono text-content-primary">{f.dst_ip}</td>
                        <td className="px-4 py-2 text-content-secondary">{f.protocol}</td>
                        <td className="px-4 py-2 text-right">
                          <span className={f.confidence > 80 ? 'text-red-400 font-bold' : f.confidence > 50 ? 'text-orange-400 font-medium' : 'text-content-primary'}>
                            {f.confidence}%
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${riskBg(f.severity)}`}>{f.severity}</span>
                        </td>
                        <td className="px-4 py-2 text-content-tertiary">{new Date(f.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="px-4 py-2 border-t border-border-default bg-bg-secondary text-[10px] text-content-tertiary">
                Asymmetric flow analysis flags connections where TX:RX ratio exceeds 10:1 or 1:10 — potential data staging or exfiltration.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
