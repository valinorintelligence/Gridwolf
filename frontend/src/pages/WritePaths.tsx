import { useState, useEffect } from 'react';
import {
  Zap, AlertTriangle, Shield, Lock, ChevronDown, ChevronRight,
  Eye, Map, Terminal, Code, Database, Loader2
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
  protocol?: string;
  confidence: number;
  evidence: Record<string, unknown> | null;
  created_at: string;
}

const severityBg = (s: string) =>
  s === 'critical' ? 'bg-red-500/15 text-red-400' :
  s === 'high' ? 'bg-orange-500/15 text-orange-400' :
  'bg-amber-500/15 text-amber-400';

export default function WritePaths() {
  const [writePaths, setWritePaths] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const fetchWritePaths = async () => {
      setLoading(true);
      try {
        const res = await api.get('/ics/findings/?finding_type=write_path');
        const list: Finding[] = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
        setWritePaths(list);
        if (list.length > 0) {
          setExpanded(String(list[0].id));
        }
      } catch (err) {
        console.error('WritePaths fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchWritePaths();
  }, []);

  const criticalCount = writePaths.filter((w) => w.severity === 'critical').length;
  const highCount = writePaths.filter((w) => w.severity === 'high').length;
  const protocolSet = new Set(writePaths.map((w) => w.protocol).filter(Boolean));
  const ipSet = new Set([...writePaths.map((w) => w.dst_ip)]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2">
            <Zap size={24} className="text-accent" /> Write/Program Access Paths
          </h1>
          <p className="text-sm text-content-secondary mt-1">
            Flags dangerous control paths (Modbus writes, S7 program access)
          </p>
        </div>
        <Button variant="primary" size="sm"><Zap size={14} /> Detect Paths</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Critical Paths', value: criticalCount, icon: Zap, color: 'text-red-500', bg: 'bg-red-500/10' },
          { label: 'High Risk', value: highCount, icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10' },
          { label: 'Devices Targeted', value: ipSet.size, icon: Shield, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { label: 'Protocols', value: protocolSet.size, icon: Code, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
        ].map((s) => (
          <div key={s.label} className={`rounded-lg border border-border-default ${s.bg} p-3`}>
            <div className="flex items-center justify-between mb-1">
              <s.icon size={16} className={s.color} />
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
          <span className="text-sm">Loading write path data...</span>
        </div>
      )}

      {!loading && writePaths.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-border-default bg-surface-card text-center gap-3">
          <Lock size={32} className="text-content-tertiary" />
          <p className="text-sm font-medium text-content-primary">No write paths detected</p>
          <p className="text-xs text-content-tertiary max-w-sm">
            No write paths detected. Upload a PCAP to identify unauthorized write operations.
          </p>
        </div>
      )}

      {!loading && writePaths.length > 0 && (
        <>
          {/* Write Path Details */}
          <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
            {writePaths.map((w) => {
              const key = String(w.id);
              return (
                <div key={key}>
                  <button
                    onClick={() => setExpanded(expanded === key ? null : key)}
                    className="w-full flex items-center justify-between px-4 py-3 border-b border-border-default last:border-0 hover:bg-surface-hover"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {expanded === key ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      <span className="text-xs font-mono text-accent shrink-0">{key}</span>
                      <div className="flex items-center gap-1 text-xs min-w-0 flex-1">
                        <span className="text-content-primary font-mono truncate">{w.src_ip}</span>
                        <span className="text-content-tertiary shrink-0">→</span>
                        <span className="text-content-primary font-mono truncate">{w.dst_ip}</span>
                      </div>
                      {w.title && (
                        <span className="text-xs text-content-secondary truncate max-w-xs hidden lg:block">{w.title}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {w.protocol && <span className="text-[10px] text-content-secondary">{w.protocol}</span>}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${severityBg(w.severity)}`}>
                        {w.severity}
                      </span>
                    </div>
                  </button>

                  {expanded === key && (
                    <div className="bg-bg-secondary border-t border-border-default px-8 py-3 space-y-3">
                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div>
                          <p className="text-[10px] text-content-tertiary mb-0.5">Source</p>
                          <p className="text-sm text-content-primary font-mono">{w.src_ip}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-content-tertiary mb-0.5">Destination</p>
                          <p className="text-sm text-content-primary font-mono">{w.dst_ip}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-content-tertiary mb-0.5">Detection</p>
                          <p className="text-sm text-content-secondary">
                            {new Date(w.created_at).toLocaleString()} · Confidence: {w.confidence}%
                          </p>
                        </div>
                      </div>

                      {w.description && (
                        <p className="text-xs text-content-secondary">{w.description}</p>
                      )}

                      {w.evidence && Object.keys(w.evidence).length > 0 && (
                        <div className="bg-surface-card rounded-lg border border-border-default p-3 mt-3">
                          <p className="text-[10px] font-medium text-content-tertiary mb-2 flex items-center gap-1">
                            <Lock size={10} /> Evidence
                          </p>
                          <div className="space-y-1.5">
                            {Object.entries(w.evidence).map(([k, val]) => (
                              <div key={k} className="flex items-center justify-between px-2 py-1.5 rounded text-[10px] border border-border-default bg-bg-secondary">
                                <span className="font-medium text-content-secondary">{k}</span>
                                <code className="text-[9px] font-mono text-content-primary">
                                  {String(val)}
                                </code>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3 pt-2 border-t border-border-default">
                        <Button variant="outline" size="sm" className="text-xs"><Eye size={10} /> Inspect Flow</Button>
                        <Button variant="outline" size="sm" className="text-xs"><Map size={10} /> Map to Policy</Button>
                        <Button variant="outline" size="sm" className="text-xs ml-auto"><Terminal size={10} /> Log Entry</Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Remediation Guidance */}
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="text-sm font-medium text-amber-400 mb-2 flex items-center gap-2">
              <AlertTriangle size={14} />Remediation Guidance
            </p>
            <ul className="space-y-1 text-xs text-content-secondary">
              <li>• Implement role-based access control (RBAC) to restrict write operations by user</li>
              <li>• Deploy digital signatures for all PLC program uploads</li>
              <li>• Enable write-blocking on data registers unless explicitly needed</li>
              <li>• Implement network segmentation with unidirectional gateways for supervisory→control zones</li>
              <li>• Enable audit logging for all state-changing operations</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
