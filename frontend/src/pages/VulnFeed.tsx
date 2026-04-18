import { useState, useEffect, useMemo } from 'react';
import {
  Shield, AlertTriangle, Clock, ChevronDown, ChevronRight, Search,
  Download, RefreshCw, Filter, ExternalLink, CheckCircle2, XCircle,
  Zap, Eye, EyeOff, Globe, Lock, Unlock, User,
  Activity, TrendingUp, Bell, Info, Loader2
} from 'lucide-react';
import { api } from '@/services/api';

// ─── Types ────────────────────────────────────────────────────

interface Advisory {
  id: string;
  cve_id?: string;
  title: string;
  description?: string;
  source?: string;
  vendor?: string;
  products?: string[];
  affected_products?: string[];
  affected_versions?: string;
  fixed_versions?: string;
  cvss_score?: number;
  cvss_vector?: string;
  severity: string;
  kev_listed?: boolean;
  kev_due_date?: string;
  epss_score?: number;
  epss_percentile?: number;
  urgency_tier?: string;
  attack_vector?: string;
  auth_required?: string;
  complexity?: string;
  user_interaction?: string;
  sector?: string;
  published_date?: string;
  patch_available?: boolean;
  remediation_immediate?: string;
  remediation_scheduled?: string;
  remediation_longterm?: string;
  references?: string[];
  cve_ids?: string[];
  disposition?: string;
  dismissed?: boolean;
}

const SOURCES = [
  { id: 'cisa', name: 'CISA ICS-CERT', color: '#3b82f6' },
  { id: 'siemens', name: 'Siemens ProductCERT', color: '#06b6d4' },
  { id: 'schneider', name: 'Schneider Electric', color: '#10b981' },
  { id: 'rockwell', name: 'Rockwell Automation', color: '#f97316' },
  { id: 'abb', name: 'ABB', color: '#ef4444' },
  { id: 'moxa', name: 'Moxa', color: '#8b5cf6' },
  { id: 'certvde', name: 'CERT@VDE', color: '#eab308' },
];

const SECTORS = ['energy', 'water', 'manufacturing', 'oil_gas', 'transportation', 'healthcare'];

const URGENCY_CONFIG = {
  act_now: { label: 'Act Now', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', icon: Zap },
  plan_patch: { label: 'Plan Patch', color: '#f97316', bg: 'rgba(249,115,22,0.15)', icon: Clock },
  monitor: { label: 'Monitor', color: '#eab308', bg: 'rgba(234,179,8,0.15)', icon: Eye },
  low_risk: { label: 'Low Risk', color: '#6b7280', bg: 'rgba(107,114,128,0.15)', icon: Info },
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#3b82f6', info: '#6b7280',
};

const DISPOSITION_OPTIONS = [
  { value: 'new', label: 'New', color: '#6b7280' },
  { value: 'not_applicable', label: 'Not Applicable', color: '#64748b' },
  { value: 'acknowledged', label: 'Acknowledged', color: '#3b82f6' },
  { value: 'in_progress', label: 'In Progress', color: '#f97316' },
  { value: 'remediated', label: 'Remediated', color: '#10b981' },
];

// ─── Component ────────────────────────────────────────────────

export default function VulnFeed() {
  const [advisories, setAdvisories] = useState<Advisory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [sectorFilter, setSectorFilter] = useState<string>('');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('');
  const [kevOnly, setKevOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'severity' | 'exploitable'>('severity');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAdvisories = () => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .get<Advisory[]>('/ics/advisories/')
      .then((res) => {
        if (!cancelled) {
          const data = Array.isArray(res.data) ? res.data : [];
          // Normalise: ensure each advisory has a dismissed field for local UI state
          setAdvisories(data.map((a) => ({ ...a, dismissed: a.dismissed ?? false, disposition: a.disposition ?? 'new' })));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.detail || 'Failed to load advisories');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  };

  useEffect(() => {
    return fetchAdvisories();
  }, []);

  const filtered = useMemo(() => {
    let result = advisories.filter(a => !a.dismissed || showDismissed);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(a =>
        a.title.toLowerCase().includes(s) ||
        (a.cve_id || '').toLowerCase().includes(s) ||
        (a.vendor || '').toLowerCase().includes(s) ||
        (a.description || '').toLowerCase().includes(s)
      );
    }
    if (severityFilter) result = result.filter(a => a.severity === severityFilter);
    if (sourceFilter) result = result.filter(a => a.source === sourceFilter);
    if (sectorFilter) result = result.filter(a => a.sector === sectorFilter);
    if (urgencyFilter) result = result.filter(a => a.urgency_tier === urgencyFilter);
    if (kevOnly) result = result.filter(a => a.kev_listed);

    if (sortBy === 'severity') {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      result.sort((a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4));
    } else if (sortBy === 'exploitable') {
      result.sort((a, b) => (b.epss_score ?? 0) - (a.epss_score ?? 0));
    } else {
      result.sort((a, b) => (b.published_date || '').localeCompare(a.published_date || ''));
    }
    return result;
  }, [advisories, search, severityFilter, sourceFilter, sectorFilter, urgencyFilter, kevOnly, sortBy, showDismissed]);

  // Stats
  const stats = useMemo(() => {
    const active = advisories.filter(a => !a.dismissed);
    return {
      total: active.length,
      critical: active.filter(a => a.severity === 'critical').length,
      actNow: active.filter(a => a.urgency_tier === 'act_now').length,
      kevCount: active.filter(a => a.kev_listed).length,
      avgEpss: active.length ? (active.reduce((s, a) => s + (a.epss_score ?? 0), 0) / active.length) : 0,
      patchAvail: active.filter(a => a.patch_available).length,
    };
  }, [advisories]);

  const handleDisposition = (id: string, disposition: string) => {
    setAdvisories(prev => prev.map(a => a.id === id ? { ...a, disposition } : a));
  };

  const handleDismiss = (id: string) => {
    setAdvisories(prev => prev.map(a => a.id === id ? { ...a, dismissed: !a.dismissed } : a));
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAdvisories();
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="text-blue-400" size={28} />
            ICS/OT Vulnerability Feed
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Real-time intelligence from 7 OT-specific advisory sources with CVSS + KEV + EPSS enrichment
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-sm">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh Feed
          </button>
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 text-sm">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: 'Total Advisories', value: stats.total, icon: Shield, color: '#3b82f6' },
          { label: 'Critical', value: stats.critical, icon: AlertTriangle, color: '#ef4444' },
          { label: 'Act Now', value: stats.actNow, icon: Zap, color: '#ef4444' },
          { label: 'CISA KEV Listed', value: stats.kevCount, icon: Bell, color: '#f97316' },
          { label: 'Avg EPSS', value: `${(stats.avgEpss * 100).toFixed(1)}%`, icon: TrendingUp, color: '#8b5cf6' },
          { label: 'Patches Available', value: stats.patchAvail, icon: CheckCircle2, color: '#10b981' },
        ].map((s, i) => (
          <div key={i} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-neutral-500">{s.label}</span>
              <s.icon size={14} style={{ color: s.color }} />
            </div>
            <div className="text-2xl font-bold text-white">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Sources Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-neutral-500">Sources:</span>
        {SOURCES.map(s => {
          const count = advisories.filter(a => a.source === s.id && !a.dismissed).length;
          return (
            <button
              key={s.id}
              onClick={() => setSourceFilter(sourceFilter === s.id ? '' : s.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${sourceFilter === s.id ? 'ring-1 ring-blue-500 bg-blue-500/10 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name} <span className="text-neutral-500">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search advisories by CVE, title, vendor, description..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-neutral-800 border border-neutral-700 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${showFilters ? 'bg-blue-500/20 text-blue-400' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}>
          <Filter size={14} /> Filters {(severityFilter || sectorFilter || urgencyFilter || kevOnly) && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
        </button>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="px-3 py-2.5 rounded-lg bg-neutral-800 border border-neutral-700 text-sm text-neutral-300">
          <option value="severity">Severity First</option>
          <option value="newest">Newest First</option>
          <option value="exploitable">Most Exploitable</option>
        </select>
      </div>

      {/* Expanded Filter Panel */}
      {showFilters && (
        <div className="grid grid-cols-5 gap-3 p-4 rounded-lg border border-neutral-800 bg-neutral-900/50">
          <div>
            <label className="text-xs text-neutral-500 mb-1 block">Severity</label>
            <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className="w-full px-2 py-1.5 rounded bg-neutral-800 border border-neutral-700 text-sm text-neutral-300">
              <option value="">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1 block">Urgency Tier</label>
            <select value={urgencyFilter} onChange={e => setUrgencyFilter(e.target.value)} className="w-full px-2 py-1.5 rounded bg-neutral-800 border border-neutral-700 text-sm text-neutral-300">
              <option value="">All</option>
              <option value="act_now">Act Now</option>
              <option value="plan_patch">Plan Patch</option>
              <option value="monitor">Monitor</option>
              <option value="low_risk">Low Risk</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1 block">Sector</label>
            <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)} className="w-full px-2 py-1.5 rounded bg-neutral-800 border border-neutral-700 text-sm text-neutral-300">
              <option value="">All Sectors</option>
              {SECTORS.map(s => <option key={s} value={s}>{s.replace('_', ' / ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
              <input type="checkbox" checked={kevOnly} onChange={e => setKevOnly(e.target.checked)} className="rounded bg-neutral-700 border-neutral-600" />
              KEV Only
            </label>
          </div>
          <div className="flex items-end">
            <button onClick={() => { setSeverityFilter(''); setSourceFilter(''); setSectorFilter(''); setUrgencyFilter(''); setKevOnly(false); }} className="text-xs text-blue-400 hover:text-blue-300">
              Clear All Filters
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Loader2 size={32} className="animate-spin text-blue-400" />
          <p className="text-sm text-neutral-400">Loading advisories...</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <AlertTriangle size={32} className="text-red-400" />
          <p className="text-sm text-neutral-400">{error}</p>
          <button onClick={handleRefresh} className="text-xs text-blue-400 hover:text-blue-300 underline">Retry</button>
        </div>
      )}

      {/* Empty (no data from backend yet) */}
      {!loading && !error && advisories.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Shield size={48} className="text-neutral-700" />
          <p className="text-neutral-400 font-medium">No advisories available</p>
          <p className="text-sm text-neutral-500">The advisory feed is empty. Data will populate as advisories are ingested.</p>
        </div>
      )}

      {/* Results Count */}
      {!loading && !error && advisories.length > 0 && (
      <div className="flex items-center justify-between text-sm text-neutral-400">
        <span>{filtered.length} advisories</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={showDismissed} onChange={e => setShowDismissed(e.target.checked)} className="rounded bg-neutral-700 border-neutral-600" />
          Show dismissed
        </label>
      </div>
      )}

      {/* Advisory List */}
      {!loading && !error && advisories.length > 0 && (
      <div className="space-y-2">
        {filtered.map(adv => {
          const isExpanded = expandedId === adv.id;
          const urgency = URGENCY_CONFIG[(adv.urgency_tier ?? '') as keyof typeof URGENCY_CONFIG] || URGENCY_CONFIG.low_risk;
          const UrgencyIcon = urgency.icon;
          const disp = DISPOSITION_OPTIONS.find(d => d.value === (adv.disposition ?? 'new')) || DISPOSITION_OPTIONS[0];

          return (
            <div key={adv.id} className={`rounded-lg border transition-colors ${adv.dismissed ? 'border-neutral-800/50 opacity-50' : 'border-neutral-800 hover:border-neutral-700'} bg-neutral-900/50`}>
              {/* Header Row */}
              <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : adv.id)}>
                {isExpanded ? <ChevronDown size={16} className="text-neutral-500 shrink-0" /> : <ChevronRight size={16} className="text-neutral-500 shrink-0" />}

                {/* Severity Badge */}
                <span className="px-2 py-0.5 rounded text-xs font-bold uppercase shrink-0" style={{ backgroundColor: `${SEVERITY_COLORS[adv.severity]}20`, color: SEVERITY_COLORS[adv.severity] }}>
                  {adv.severity}
                </span>

                {/* CVSS Score */}
                <span className="text-sm font-mono font-bold shrink-0" style={{ color: SEVERITY_COLORS[adv.severity] }}>
                  {adv.cvss_score != null ? adv.cvss_score.toFixed(1) : '—'}
                </span>

                {/* Title & CVE */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white truncate">{adv.title}</span>
                    {adv.kev_listed && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 shrink-0">KEV</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500">
                    <span className="font-mono">{adv.cve_id || (adv.cve_ids && adv.cve_ids[0]) || '—'}</span>
                    <span>•</span>
                    <span>{adv.vendor}</span>
                    <span>•</span>
                    <span>{adv.published_date}</span>
                  </div>
                </div>

                {/* Attack Path Icons */}
                <div className="flex items-center gap-1 shrink-0">
                  <div title={`Vector: ${adv.attack_vector}`} className="w-7 h-7 rounded flex items-center justify-center bg-neutral-800">
                    {adv.attack_vector === 'network' ? <Globe size={13} className="text-red-400" /> : adv.attack_vector === 'adjacent' ? <Activity size={13} className="text-orange-400" /> : <Lock size={13} className="text-yellow-400" />}
                  </div>
                  <div title={`Auth: ${adv.auth_required}`} className="w-7 h-7 rounded flex items-center justify-center bg-neutral-800">
                    {adv.auth_required === 'none' ? <Unlock size={13} className="text-red-400" /> : <Lock size={13} className="text-green-400" />}
                  </div>
                  <div title={`Complexity: ${adv.complexity}`} className="w-7 h-7 rounded flex items-center justify-center bg-neutral-800">
                    <Activity size={13} className={adv.complexity === 'low' ? 'text-red-400' : 'text-green-400'} />
                  </div>
                  <div title={`User interaction: ${adv.user_interaction}`} className="w-7 h-7 rounded flex items-center justify-center bg-neutral-800">
                    <User size={13} className={adv.user_interaction === 'none' ? 'text-red-400' : 'text-green-400'} />
                  </div>
                </div>

                {/* Urgency Tier */}
                <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium shrink-0" style={{ backgroundColor: urgency.bg, color: urgency.color }}>
                  <UrgencyIcon size={12} /> {urgency.label}
                </span>

                {/* EPSS */}
                <div className="text-right shrink-0 w-16">
                  <div className="text-xs text-neutral-500">EPSS</div>
                  <div className="text-sm font-bold" style={{ color: (adv.epss_score ?? 0) > 0.5 ? '#ef4444' : (adv.epss_score ?? 0) > 0.1 ? '#f97316' : '#6b7280' }}>
                    {adv.epss_score != null ? `${(adv.epss_score * 100).toFixed(1)}%` : '—'}
                  </div>
                </div>

                {/* Disposition Selector */}
                <select
                  value={adv.disposition ?? 'new'}
                  onClick={e => e.stopPropagation()}
                  onChange={e => { e.stopPropagation(); handleDisposition(adv.id, e.target.value); }}
                  className="px-2 py-1 rounded text-xs bg-neutral-800 border border-neutral-700 shrink-0"
                  style={{ color: disp.color }}
                >
                  {DISPOSITION_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>

                {/* Dismiss */}
                <button onClick={e => { e.stopPropagation(); handleDismiss(adv.id); }} className="p-1.5 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 shrink-0" title={adv.dismissed ? 'Restore' : 'Dismiss'}>
                  {adv.dismissed ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              </div>

              {/* Expanded Detail Panel */}
              {isExpanded && (
                <div className="border-t border-neutral-800 p-5 space-y-5">
                  {/* Description */}
                  <p className="text-sm text-neutral-300 leading-relaxed">{adv.description}</p>

                  {/* Product Table */}
                  <div>
                    <h4 className="text-xs font-semibold text-neutral-400 uppercase mb-2">Affected Products</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg bg-neutral-800/50 p-3">
                        <div className="text-xs text-neutral-500">Products</div>
                        <div className="text-sm text-white mt-1">{(adv.products || adv.affected_products || []).join(', ') || '—'}</div>
                      </div>
                      <div className="rounded-lg bg-neutral-800/50 p-3">
                        <div className="text-xs text-neutral-500">Affected Versions</div>
                        <div className="text-sm text-white mt-1">{adv.affected_versions || '—'}</div>
                      </div>
                      <div className="rounded-lg bg-neutral-800/50 p-3">
                        <div className="text-xs text-neutral-500">Fixed Version</div>
                        <div className="text-sm mt-1 flex items-center gap-1">
                          {adv.patch_available ? (
                            <><CheckCircle2 size={12} className="text-green-400" /> <span className="text-green-400">{adv.fixed_versions || 'Available'}</span></>
                          ) : (
                            <><XCircle size={12} className="text-red-400" /> <span className="text-red-400">No patch available</span></>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Enrichment Data */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="rounded-lg bg-neutral-800/50 p-3">
                      <div className="text-xs text-neutral-500">CVSS v3.1</div>
                      <div className="text-lg font-bold mt-1" style={{ color: SEVERITY_COLORS[adv.severity] }}>{adv.cvss_score ?? '—'}</div>
                      <div className="text-[10px] text-neutral-500 mt-1 font-mono break-all">{adv.cvss_vector || ''}</div>
                    </div>
                    <div className="rounded-lg bg-neutral-800/50 p-3">
                      <div className="text-xs text-neutral-500">CISA KEV</div>
                      <div className="text-lg font-bold mt-1">{adv.kev_listed ? <span className="text-red-400">Listed</span> : <span className="text-neutral-500">Not Listed</span>}</div>
                      {adv.kev_due_date && <div className="text-xs text-red-400 mt-1">Due: {adv.kev_due_date}</div>}
                    </div>
                    <div className="rounded-lg bg-neutral-800/50 p-3">
                      <div className="text-xs text-neutral-500">EPSS Score</div>
                      <div className="text-lg font-bold mt-1" style={{ color: (adv.epss_score ?? 0) > 0.5 ? '#ef4444' : (adv.epss_score ?? 0) > 0.1 ? '#f97316' : '#6b7280' }}>
                        {adv.epss_score != null ? `${(adv.epss_score * 100).toFixed(1)}%` : '—'}
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">
                        {adv.epss_percentile != null ? `Percentile: ${(adv.epss_percentile * 100).toFixed(0)}%` : ''}
                      </div>
                    </div>
                    <div className="rounded-lg bg-neutral-800/50 p-3">
                      <div className="text-xs text-neutral-500">Sector</div>
                      <div className="text-sm text-white mt-1 capitalize">{(adv.sector || '—').replace('_', ' / ')}</div>
                      <div className="text-xs text-neutral-500 mt-1">Source: {SOURCES.find(s => s.id === adv.source)?.name || adv.source || '—'}</div>
                    </div>
                  </div>

                  {/* Remediation Guidance */}
                  {(adv.remediation_immediate || adv.remediation_scheduled || adv.remediation_longterm) && (
                  <div>
                    <h4 className="text-xs font-semibold text-neutral-400 uppercase mb-3">Remediation Guidance</h4>
                    <div className="space-y-2">
                      {adv.remediation_immediate && (
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                        <Zap size={16} className="text-red-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-xs font-semibold text-red-400 mb-1">Do Now (Immediate)</div>
                          <div className="text-sm text-neutral-300">{adv.remediation_immediate}</div>
                        </div>
                      </div>
                      )}
                      {adv.remediation_scheduled && (
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                        <Clock size={16} className="text-orange-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-xs font-semibold text-orange-400 mb-1">Schedule (Maintenance Window)</div>
                          <div className="text-sm text-neutral-300">{adv.remediation_scheduled}</div>
                        </div>
                      </div>
                      )}
                      {adv.remediation_longterm && (
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                        <Shield size={16} className="text-blue-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-xs font-semibold text-blue-400 mb-1">Long-Term (Architecture)</div>
                          <div className="text-sm text-neutral-300">{adv.remediation_longterm}</div>
                        </div>
                      </div>
                      )}
                    </div>
                  </div>
                  )}

                  {/* References */}
                  {(adv.references || []).length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-neutral-400 uppercase mb-2">References</h4>
                      <div className="space-y-1">
                        {(adv.references || []).map((ref, i) => (
                          <a key={i} href={ref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                            <ExternalLink size={10} /> {ref}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <Shield size={48} className="mx-auto text-neutral-700 mb-4" />
            <p className="text-neutral-500">No advisories match your filters</p>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
