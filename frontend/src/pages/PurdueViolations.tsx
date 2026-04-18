import { useState, useEffect } from 'react';
import {
  AlertTriangle, Layers, ChevronDown, ChevronRight,
  Zap, Eye, ArrowRight, MapPin, Loader2
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

const PURDUE_MODEL = [
  { level: 'L0', name: 'Field Devices', description: 'PLC, RTU, I/O, Sensors, Drives', color: 'bg-red-500' },
  { level: 'L1', name: 'Basic Control', description: 'Programmable devices, Controllers', color: 'bg-orange-500' },
  { level: 'L2', name: 'Supervisory', description: 'HMI, SCADA, Edge Gateway', color: 'bg-amber-500' },
  { level: 'L3', name: 'Operations', description: 'MES, Historian, Engineering Workstation', color: 'bg-cyan-500' },
  { level: 'L4', name: 'Enterprise', description: 'ERP, Business Systems', color: 'bg-blue-500' },
  { level: 'DMZ', name: 'Demilitarized', description: 'Firewalls, Proxies, External Gateway', color: 'bg-purple-500' },
];

const severityBg = (s: string) =>
  s === 'critical' ? 'bg-red-500/15 text-red-400' :
  s === 'high' ? 'bg-orange-500/15 text-orange-400' :
  'bg-amber-500/15 text-amber-400';

const riskIcon = (s: string) =>
  s === 'critical' || s === 'high'
    ? <AlertTriangle size={14} className="text-red-400" />
    : <AlertTriangle size={14} className="text-amber-400" />;

export default function PurdueViolations() {
  const [violations, setViolations] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'critical' | 'high'>('all');

  useEffect(() => {
    const fetchViolations = async () => {
      setLoading(true);
      try {
        const res = await api.get('/ics/findings/?finding_type=purdue_violation');
        const list: Finding[] = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
        setViolations(list);
        if (list.length > 0) {
          setExpanded(String(list[0].id));
        }
      } catch (err) {
        console.error('PurdueViolations fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchViolations();
  }, []);

  const filtered = filter === 'all' ? violations : violations.filter((v) => v.severity === filter);

  const affectedIPs = new Set([...violations.map((v) => v.src_ip), ...violations.map((v) => v.dst_ip)]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2">
            <Layers size={24} className="text-accent" /> Purdue Model Violations
          </h1>
          <p className="text-sm text-content-secondary mt-1">
            Automated cross-zone communication anomaly detection
          </p>
        </div>
        <Button variant="primary" size="sm"><Zap size={14} /> Re-scan</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Violations', value: violations.length, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
          { label: 'Critical', value: violations.filter((v) => v.severity === 'critical').length, icon: Zap, color: 'text-red-500', bg: 'bg-red-500/10' },
          { label: 'High', value: violations.filter((v) => v.severity === 'high').length, icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10' },
          { label: 'IPs Affected', value: affectedIPs.size, icon: MapPin, color: 'text-blue-400', bg: 'bg-blue-500/10' },
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

      {/* Purdue Model Reference */}
      <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border-default">
          <p className="text-sm font-medium text-content-primary flex items-center gap-2">
            <Layers size={14} className="text-accent" />Purdue Model Reference
          </p>
        </div>
        <div className="grid grid-cols-6 gap-2 p-4">
          {PURDUE_MODEL.map((m) => (
            <div key={m.level} className="rounded-lg border border-border-default p-2 text-[10px]">
              <div className={`${m.color} h-1 rounded mb-1.5`} />
              <p className="font-bold text-content-primary">{m.level}</p>
              <p className="text-content-secondary font-medium">{m.name}</p>
              <p className="text-content-tertiary mt-0.5">{m.description}</p>
            </div>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-content-tertiary gap-2">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Loading Purdue violations...</span>
        </div>
      )}

      {!loading && violations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-border-default bg-surface-card text-center gap-3">
          <Layers size={32} className="text-content-tertiary" />
          <p className="text-sm font-medium text-content-primary">No violations detected</p>
          <p className="text-xs text-content-tertiary max-w-sm">
            No Purdue model violations detected. Upload a PCAP to analyze network segmentation.
          </p>
        </div>
      )}

      {!loading && violations.length > 0 && (
        <>
          {/* Filter Tabs */}
          <div className="flex gap-1 rounded-lg bg-surface-card border border-border-default p-1 w-fit">
            {(['all', 'critical', 'high'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === f ? 'bg-accent text-white' : 'text-content-secondary hover:bg-surface-hover'}`}
              >
                {f === 'all' ? 'All Violations' : `${f.charAt(0).toUpperCase() + f.slice(1)} Only`}
              </button>
            ))}
          </div>

          {/* Violation Details */}
          <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-content-tertiary">
                No {filter} violations found.
              </div>
            ) : filtered.map((v) => {
              const key = String(v.id);
              return (
                <div key={key}>
                  <button
                    onClick={() => setExpanded(expanded === key ? null : key)}
                    className="w-full flex items-center justify-between px-4 py-3 border-b border-border-default last:border-0 hover:bg-surface-hover"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {expanded === key ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      <span className="text-xs font-mono text-accent">{key}</span>
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-content-primary font-mono">{v.src_ip}</span>
                        <ArrowRight size={12} className="text-content-tertiary" />
                        <span className="text-content-primary font-mono">{v.dst_ip}</span>
                      </div>
                      {v.title && (
                        <span className="text-xs text-content-secondary truncate max-w-xs">{v.title}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {v.protocol && <span className="text-[10px] text-content-secondary">{v.protocol}</span>}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${severityBg(v.severity)}`}>
                        {v.severity}
                      </span>
                    </div>
                  </button>

                  {expanded === key && (
                    <div className="bg-bg-secondary border-t border-border-default px-8 py-3 space-y-2">
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-[10px] text-content-tertiary mb-0.5">IPs</p>
                          <p className="text-sm text-content-primary">
                            <span className="font-mono text-accent">{v.src_ip}</span>
                            {' → '}
                            <span className="font-mono text-accent">{v.dst_ip}</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-content-tertiary mb-0.5">Detection Info</p>
                          <p className="text-sm text-content-secondary">
                            Detected {new Date(v.created_at).toLocaleString()} · Confidence: {v.confidence}%
                          </p>
                        </div>
                      </div>

                      {v.description && (
                        <div>
                          <p className="text-[10px] text-content-tertiary mb-1 font-medium">Description</p>
                          <p className="text-xs text-content-secondary">{v.description}</p>
                        </div>
                      )}

                      <div className="flex gap-6 pt-2 border-t border-border-default">
                        <div className="flex items-center gap-2">
                          {riskIcon(v.severity)}
                          <span className="text-[10px] text-content-secondary">
                            <span className="text-content-primary font-medium">Severity:</span> {v.severity}
                          </span>
                        </div>
                        <Button variant="outline" size="sm" className="ml-auto text-xs">
                          <Eye size={10} /> Investigate
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
