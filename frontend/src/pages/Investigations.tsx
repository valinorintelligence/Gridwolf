import { useState, useEffect } from 'react';
import {
  Search, Star, AlertTriangle, Clock, ChevronDown, ChevronRight,
  Flag, Zap, Eye, Share2, Archive, MoreVertical, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api } from '@/services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Finding {
  id: string | number;
  severity: string;
  title: string;
  description: string;
  src_ip?: string;
  dst_ip?: string;
  protocol?: string;
  status: string;
  confidence?: number;
  created_at?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const severityBg = (s: string) =>
  s === 'critical' ? 'bg-red-500/15 text-red-400' :
  s === 'high' ? 'bg-orange-500/15 text-orange-400' :
  'bg-amber-500/15 text-amber-400';

const statusBg = (s: string) =>
  s === 'investigating' ? 'bg-blue-500/15 text-blue-400' :
  s === 'resolved' ? 'bg-emerald-500/15 text-emerald-400' :
  'bg-gray-500/15 text-gray-400';

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Investigations() {
  const [activeTab, setActiveTab] = useState<'queue' | 'auth-gaps'>('queue');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFindings() {
      try {
        const res = await api.get('/ics/findings/');
        const data = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
        setFindings(data);
        if (data.length > 0) {
          setExpanded(String(data[0].id));
        }
      } catch {
        setFindings([]);
      } finally {
        setLoading(false);
      }
    }
    fetchFindings();
  }, []);

  // Queue = open or investigating findings
  const queueItems = findings.filter(
    (f) => f.status === 'open' || f.status === 'investigating'
  );

  // Auth gaps = findings whose title/description suggest auth issues
  const authGapItems = findings.filter(
    (f) =>
      f.status !== 'resolved' &&
      (f.title?.toLowerCase().includes('auth') ||
        f.title?.toLowerCase().includes('credential') ||
        f.title?.toLowerCase().includes('default') ||
        f.title?.toLowerCase().includes('telnet') ||
        f.title?.toLowerCase().includes('snmp') ||
        f.description?.toLowerCase().includes('authentication') ||
        f.description?.toLowerCase().includes('no auth'))
  );

  async function handleInvestigate(id: string | number) {
    const key = String(id);
    setActionLoading(key);
    try {
      await api.patch(`/ics/findings/${id}/status`, null, { params: { status: 'investigating' } });
      setFindings((prev) =>
        prev.map((f) => (String(f.id) === key ? { ...f, status: 'investigating' } : f))
      );
    } catch {
      // silently fail — user can retry
    } finally {
      setActionLoading(null);
    }
  }

  function toggleStar(id: string) {
    setStarred((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Stats
  const criticalCount = queueItems.filter((f) => f.severity === 'critical').length;
  const investigatingCount = queueItems.filter((f) => f.status === 'investigating').length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2">
            <Search size={24} className="text-accent" /> Investigation Workflows
          </h1>
          <p className="text-sm text-content-secondary mt-1">
            Focus Queue for priority targets, auth gaps, write paths
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setLoading(true);
            api.get('/ics/findings/').then((res) => {
              const data = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
              setFindings(data);
            }).catch(() => {}).finally(() => setLoading(false));
          }}
        >
          <Zap size={14} /> Refresh Queue
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Queue Items', value: queueItems.length, icon: Flag, color: 'text-accent', bg: 'bg-accent/10' },
          { label: 'Investigating', value: investigatingCount, icon: Eye, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Critical', value: criticalCount, icon: Zap, color: 'text-red-400', bg: 'bg-red-500/10' },
          { label: 'Auth Gaps', value: authGapItems.length, icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10' },
          { label: 'Total Findings', value: findings.length, icon: Flag, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        ].map((s) => (
          <div key={s.label} className={`rounded-lg border border-border-default ${s.bg} p-3`}>
            <div className="flex items-center justify-between mb-1">
              <s.icon size={16} className={s.color} />
            </div>
            <p className="text-xl font-bold text-content-primary">{s.value}</p>
            <p className="text-[10px] text-content-tertiary">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-surface-card border border-border-default p-1 w-fit">
        {(['queue', 'auth-gaps'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === t ? 'bg-accent text-white' : 'text-content-secondary hover:bg-surface-hover'
            }`}
          >
            {t === 'queue' ? 'Focus Queue' : 'Authentication Gaps'}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-content-tertiary gap-2">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Loading findings…</span>
        </div>
      )}

      {/* Focus Queue */}
      {!loading && activeTab === 'queue' && (
        <>
          {queueItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-border-default bg-surface-card py-16 text-center">
              <Clock size={32} className="text-content-tertiary mb-3" />
              <p className="text-sm font-medium text-content-primary mb-1">No open findings</p>
              <p className="text-xs text-content-secondary">Upload a PCAP to begin analysis.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
              {queueItems.map((item) => {
                const key = String(item.id);
                const isExpanded = expanded === key;
                return (
                  <div key={key}>
                    <button
                      onClick={() => setExpanded(isExpanded ? null : key)}
                      className="w-full flex items-center justify-between px-4 py-3 border-b border-border-default last:border-0 hover:bg-surface-hover"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); toggleStar(key); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') toggleStar(key); }}
                        >
                          <Star
                            size={12}
                            className={starred.has(key) ? 'fill-amber-400 text-amber-400' : 'text-content-tertiary'}
                          />
                        </span>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-bg-secondary text-content-secondary whitespace-nowrap">
                            {item.protocol ?? 'Unknown'}
                          </span>
                          <span className="text-xs text-content-primary font-medium truncate">{item.title}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${severityBg(item.severity)}`}>
                          {item.severity}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusBg(item.status)}`}>
                          {item.status}
                        </span>
                        {item.confidence !== undefined && (
                          <span className="text-[10px] text-content-tertiary">{item.confidence}%</span>
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="bg-bg-secondary border-t border-border-default px-8 py-3 space-y-2">
                        <div className="grid grid-cols-3 gap-4 mb-3">
                          <div>
                            <p className="text-[10px] text-content-tertiary mb-0.5">Source IP</p>
                            <p className="text-sm text-content-primary font-mono">{item.src_ip ?? '—'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-content-tertiary mb-0.5">Destination IP</p>
                            <p className="text-sm text-content-primary font-mono">{item.dst_ip ?? '—'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-content-tertiary mb-0.5">Detected</p>
                            <p className="text-sm text-content-secondary">
                              {item.created_at ? new Date(item.created_at).toLocaleString() : '—'}
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] text-content-tertiary mb-1">Description</p>
                          <p className="text-xs text-content-secondary">{item.description}</p>
                        </div>

                        <div className="flex gap-3 pt-2 border-t border-border-default">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs flex-1"
                            disabled={actionLoading === key || item.status === 'investigating'}
                            onClick={() => handleInvestigate(item.id)}
                          >
                            {actionLoading === key
                              ? <Loader2 size={10} className="animate-spin" />
                              : <Eye size={10} />}
                            {item.status === 'investigating' ? 'Investigating' : 'Investigate'}
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs flex-1">
                            <Share2 size={10} /> Share
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs flex-1">
                            <Archive size={10} /> Archive
                          </Button>
                          <button className="px-2 py-1.5 rounded border border-border-default hover:bg-surface-hover">
                            <MoreVertical size={12} className="text-content-tertiary" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Authentication Gaps */}
      {!loading && activeTab === 'auth-gaps' && (
        <>
          {authGapItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-border-default bg-surface-card py-16 text-center">
              <AlertTriangle size={32} className="text-content-tertiary mb-3" />
              <p className="text-sm font-medium text-content-primary mb-1">No authentication gaps detected</p>
              <p className="text-xs text-content-secondary">Upload a PCAP to begin analysis.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border-default">
                <p className="text-sm font-medium text-content-primary">Identified Authentication Gaps</p>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-default text-content-tertiary">
                    <th className="text-left px-4 py-2 font-medium">Title</th>
                    <th className="text-left px-4 py-2 font-medium">Source IP</th>
                    <th className="text-left px-4 py-2 font-medium">Protocol</th>
                    <th className="text-left px-4 py-2 font-medium">Severity</th>
                    <th className="text-left px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {authGapItems.map((a) => (
                    <tr key={String(a.id)} className="border-b border-border-default last:border-0 hover:bg-surface-hover">
                      <td className="px-4 py-2 text-content-primary">{a.title}</td>
                      <td className="px-4 py-2 font-mono text-accent">{a.src_ip ?? '—'}</td>
                      <td className="px-4 py-2 text-content-primary font-medium">{a.protocol ?? '—'}</td>
                      <td className="px-4 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${severityBg(a.severity)}`}>
                          {a.severity}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusBg(a.status)}`}>
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
