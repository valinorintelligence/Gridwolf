import { useState, useEffect } from 'react';
import {
  Shield, AlertTriangle, ArrowLeft, CheckCircle2, XCircle, Globe,
  Lock, Unlock, User, Activity, Clock, Zap, ExternalLink, Copy,
  ChevronDown, ChevronRight, Eye, Info
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/services/api';

// ─── Types ────────────────────────────────────────────────────

interface Advisory {
  id: string;
  cve_id?: string;
  title: string;
  description?: string;
  source?: string;
  vendor?: string;
  products?: Array<{ name: string; version: string; patched: boolean; patchVersion?: string }>;
  cvss_score?: number;
  cvss_vector?: string;
  severity?: string;
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
  last_modified?: string;
  cwe?: string;
  patch_available?: boolean;
  remediation_immediate?: string;
  remediation_scheduled?: string;
  remediation_longterm?: string;
  mitre_techniques?: string[];
  references?: Array<{ title: string; url: string }>;
  disposition?: string;
}

interface DeviceMatch {
  ip_address?: string;
  vendor?: string;
  device_type?: string;
  model?: string;
  protocols?: string[];
  match_reason?: string;
}

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  tier: 'immediate' | 'scheduled' | 'longterm';
}

const SEV_COLORS: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#3b82f6', info: '#6b7280',
};

const URGENCY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  act_now:    { label: 'Act Now',     color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  plan_patch: { label: 'Plan Patch',  color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
  monitor:    { label: 'Monitor',     color: '#eab308', bg: 'rgba(234,179,8,0.15)' },
  low_risk:   { label: 'Low Risk',    color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
};

const DISPOSITION_OPTIONS = [
  { value: 'new',            label: 'New',            color: '#6b7280' },
  { value: 'not_applicable', label: 'Not Applicable', color: '#64748b' },
  { value: 'acknowledged',   label: 'Acknowledged',   color: '#3b82f6' },
  { value: 'in_progress',    label: 'In Progress',    color: '#f97316' },
  { value: 'remediated',     label: 'Remediated',     color: '#10b981' },
];

/** Generate a flat checklist from free-text remediation steps. */
function buildChecklist(immediate = '', scheduled = '', longterm = ''): ChecklistItem[] {
  let idx = 0;
  const split = (text: string, tier: ChecklistItem['tier']): ChecklistItem[] => {
    if (!text.trim()) return [];
    return text
      .split(/\.\s+/)
      .map((s) => s.replace(/\.$/, '').trim())
      .filter((s) => s.length > 10)
      .map((s) => ({ id: `c${++idx}`, text: s, checked: false, tier }));
  };
  return [
    ...split(immediate, 'immediate'),
    ...split(scheduled, 'scheduled'),
    ...split(longterm, 'longterm'),
  ];
}

// ─── Component ────────────────────────────────────────────────

export default function AdvisoryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [advisory, setAdvisory] = useState<Advisory | null>(null);
  const [deviceMatches, setDeviceMatches] = useState<DeviceMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [disposition, setDisposition] = useState('new');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['products', 'enrichment', 'remediation', 'checklist', 'devices', 'mitre'])
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return; }
    async function load() {
      const [advRes, matchRes] = await Promise.allSettled([
        api.get(`/ics/advisories/${id}`),
        api.get('/ics/advisories/matched'),
      ]);
      if (advRes.status === 'fulfilled') {
        const adv: Advisory = advRes.value.data;
        setAdvisory(adv);
        setDisposition(adv.disposition ?? 'new');
        setChecklist(buildChecklist(
          adv.remediation_immediate,
          adv.remediation_scheduled,
          adv.remediation_longterm,
        ));
      } else {
        setNotFound(true);
      }
      if (matchRes.status === 'fulfilled') {
        const matches = matchRes.value.data?.matches ?? [];
        // Find matches for this advisory
        const thisAdv = matches.find((m: Record<string, unknown>) => m.advisory_id === id || m.id === id);
        setDeviceMatches(thisAdv?.matched_devices ?? []);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  const handleDispositionChange = async (value: string) => {
    setDisposition(value);
    try {
      await api.patch(`/ics/advisories/${id}/disposition`, { disposition: value });
    } catch {
      // Revert on failure
    }
  };

  const toggleSection = (s: string) => {
    const next = new Set(expandedSections);
    next.has(s) ? next.delete(s) : next.add(s);
    setExpandedSections(next);
  };

  const toggleCheck = (cid: string) => {
    setChecklist((prev) => prev.map((c) => (c.id === cid ? { ...c, checked: !c.checked } : c)));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(advisory?.cve_id ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (notFound || !advisory) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12">
        <AlertTriangle size={40} className="text-content-tertiary" />
        <h2 className="text-lg font-semibold text-content-primary">Advisory not found</h2>
        <p className="text-sm text-content-secondary">The advisory with ID <code className="font-mono">{id}</code> does not exist in the feed.</p>
        <button onClick={() => navigate('/vuln-feed')} className="flex items-center gap-2 text-sm text-accent hover:underline">
          <ArrowLeft size={14} /> Back to Feed
        </button>
      </div>
    );
  }

  const urgency = URGENCY_CONFIG[advisory.urgency_tier ?? 'low_risk'] ?? URGENCY_CONFIG.low_risk;
  const severity = advisory.severity ?? 'info';
  const severityColor = SEV_COLORS[severity] ?? '#6b7280';

  const totalProgress = checklist.filter((c) => c.checked).length;
  const totalItems = checklist.length;
  const progress = {
    immediate: { total: checklist.filter((c) => c.tier === 'immediate').length, done: checklist.filter((c) => c.tier === 'immediate' && c.checked).length },
    scheduled: { total: checklist.filter((c) => c.tier === 'scheduled').length, done: checklist.filter((c) => c.tier === 'scheduled' && c.checked).length },
    longterm:  { total: checklist.filter((c) => c.tier === 'longterm').length,  done: checklist.filter((c) => c.tier === 'longterm' && c.checked).length },
  };

  const SectionHeader = ({ sid, title, badge }: { sid: string; title: string; badge?: React.ReactNode }) => (
    <button onClick={() => toggleSection(sid)} className="flex items-center gap-2 w-full text-left py-2">
      {expandedSections.has(sid) ? <ChevronDown size={16} className="text-neutral-500" /> : <ChevronRight size={16} className="text-neutral-500" />}
      <span className="text-sm font-semibold text-neutral-300 uppercase tracking-wide">{title}</span>
      {badge}
    </button>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back Nav */}
      <button onClick={() => navigate('/vuln-feed')} className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-300">
        <ArrowLeft size={14} /> Back to Feed
      </button>

      {/* Header Card */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${severityColor}15` }}>
            <span className="text-2xl font-bold" style={{ color: severityColor }}>{advisory.cvss_score ?? '?'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="px-2 py-0.5 rounded text-xs font-bold uppercase" style={{ backgroundColor: `${severityColor}20`, color: severityColor }}>
                {severity}
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: urgency.bg, color: urgency.color }}>
                <Zap size={10} /> {urgency.label}
              </span>
              {advisory.kev_listed && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-400">
                  🚨 CISA KEV{advisory.kev_due_date ? ` — Due ${advisory.kev_due_date}` : ''}
                </span>
              )}
              {advisory.patch_available && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-500/20 text-green-400 flex items-center gap-1">
                  <CheckCircle2 size={10} /> Patch Available
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-white">{advisory.title}</h1>
            <div className="flex items-center gap-3 mt-2 text-xs text-neutral-500 flex-wrap">
              {advisory.cve_id && (
                <button onClick={handleCopy} className="flex items-center gap-1 font-mono hover:text-neutral-300">
                  {advisory.cve_id} <Copy size={10} className={copied ? 'text-green-400' : ''} />
                </button>
              )}
              {advisory.vendor && <><span>•</span><span>{advisory.vendor}</span></>}
              {advisory.published_date && <><span>•</span><span>Published: {advisory.published_date}</span></>}
              {advisory.cwe && <><span>•</span><span>{advisory.cwe}</span></>}
            </div>
          </div>
          <div className="shrink-0">
            <label className="text-xs text-neutral-500 block mb-1">Disposition</label>
            <select
              value={disposition}
              onChange={(e) => handleDispositionChange(e.target.value)}
              className="px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm"
              style={{ color: DISPOSITION_OPTIONS.find((d) => d.value === disposition)?.color }}
            >
              {DISPOSITION_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
        </div>

        {/* Attack vector row */}
        {(advisory.attack_vector || advisory.auth_required) && (
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-neutral-800 flex-wrap">
            <span className="text-xs text-neutral-500">Attack Path:</span>
            {[
              { label: 'Vector',      value: advisory.attack_vector,    icon: Globe,  danger: advisory.attack_vector === 'network' },
              { label: 'Auth',        value: advisory.auth_required,     icon: advisory.auth_required === 'none' ? Unlock : Lock, danger: advisory.auth_required === 'none' },
              { label: 'Complexity',  value: advisory.complexity,        icon: Activity, danger: advisory.complexity === 'low' },
              { label: 'Interaction', value: advisory.user_interaction,  icon: User,   danger: advisory.user_interaction === 'none' },
            ].filter((x) => x.value).map((item, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800">
                <item.icon size={14} className={item.danger ? 'text-red-400' : 'text-green-400'} />
                <div>
                  <div className="text-[10px] text-neutral-500">{item.label}</div>
                  <div className={`text-xs font-medium capitalize ${item.danger ? 'text-red-400' : 'text-green-400'}`}>{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {advisory.description && (
          <p className="text-sm text-neutral-300 leading-relaxed mt-4">{advisory.description}</p>
        )}
      </div>

      {/* Affected Products */}
      {advisory.products && advisory.products.length > 0 && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
          <SectionHeader sid="products" title="Affected Products" badge={<span className="text-xs text-neutral-500 ml-2">{advisory.products.length} products</span>} />
          {expandedSections.has('products') && (
            <div className="mt-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-neutral-500 border-b border-neutral-800">
                    <th className="pb-2 pr-4">Product</th><th className="pb-2 pr-4">Affected Versions</th>
                    <th className="pb-2 pr-4">Patch Status</th><th className="pb-2">Fixed Version</th>
                  </tr>
                </thead>
                <tbody>
                  {advisory.products.map((p, i) => (
                    <tr key={i} className="border-b border-neutral-800/50">
                      <td className="py-2.5 pr-4 text-white font-medium">{p.name}</td>
                      <td className="py-2.5 pr-4 text-neutral-400 font-mono text-xs">{p.version}</td>
                      <td className="py-2.5 pr-4">
                        {p.patched
                          ? <span className="flex items-center gap-1 text-green-400 text-xs"><CheckCircle2 size={12} /> Available</span>
                          : <span className="flex items-center gap-1 text-red-400 text-xs"><XCircle size={12} /> No Patch</span>}
                      </td>
                      <td className="py-2.5 text-neutral-300 font-mono text-xs">{p.patchVersion ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Enrichment */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
        <SectionHeader sid="enrichment" title="Enrichment Data" />
        {expandedSections.has('enrichment') && (
          <div className="grid grid-cols-4 gap-4 mt-3">
            {advisory.cvss_score != null && (
              <div className="p-4 rounded-lg bg-neutral-800/50">
                <div className="text-xs text-neutral-500 mb-2">CVSS v3.1 Score</div>
                <div className="text-3xl font-bold" style={{ color: severityColor }}>{advisory.cvss_score}</div>
                {advisory.cvss_vector && <div className="text-[10px] text-neutral-500 mt-2 font-mono break-all">{advisory.cvss_vector}</div>}
              </div>
            )}
            <div className="p-4 rounded-lg bg-neutral-800/50">
              <div className="text-xs text-neutral-500 mb-2">CISA KEV Status</div>
              {advisory.kev_listed
                ? <><div className="text-lg font-bold text-red-400">🚨 Listed</div>{advisory.kev_due_date && <div className="text-xs text-red-400 mt-1">Due: {advisory.kev_due_date}</div>}</>
                : <div className="text-lg font-bold text-neutral-400">Not Listed</div>}
            </div>
            {advisory.epss_score != null && (
              <div className="p-4 rounded-lg bg-neutral-800/50">
                <div className="text-xs text-neutral-500 mb-2">EPSS Score</div>
                <div className="text-3xl font-bold text-orange-400">{(advisory.epss_score * 100).toFixed(1)}%</div>
                {advisory.epss_percentile != null && <div className="text-xs text-neutral-500 mt-1">{(advisory.epss_percentile * 100).toFixed(0)}th percentile</div>}
              </div>
            )}
            <div className="p-4 rounded-lg bg-neutral-800/50">
              <div className="text-xs text-neutral-500 mb-2">Source</div>
              <div className="text-sm text-white font-medium capitalize">{advisory.source ?? 'Unknown'}</div>
              {advisory.sector && <div className="text-xs text-neutral-500 mt-2">Sector: {advisory.sector}</div>}
              {advisory.cwe && <div className="text-xs text-neutral-500 mt-1">{advisory.cwe}</div>}
            </div>
          </div>
        )}
      </div>

      {/* Matched Devices */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
        <SectionHeader
          sid="devices"
          title="Matched Devices in Your Network"
          badge={deviceMatches.length > 0 ? <span className="px-2 py-0.5 rounded text-xs bg-red-500/10 text-red-400 ml-2">{deviceMatches.length} affected</span> : null}
        />
        {expandedSections.has('devices') && (
          <div className="mt-3 space-y-2">
            {deviceMatches.length === 0 ? (
              <div className="flex items-center gap-2 py-4 text-sm text-neutral-500">
                <Eye size={14} /> No matched devices. Upload a PCAP and run device matching to identify affected assets.
              </div>
            ) : deviceMatches.map((d, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-neutral-800/50 border border-neutral-800">
                <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle size={16} className="text-red-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-white">{d.ip_address ?? '-'}</span>
                    <span className="text-xs text-neutral-400">{d.vendor} {d.model}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-neutral-500">{d.device_type}</span>
                    {(d.protocols ?? []).map((p) => (
                      <span key={p} className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400">{p}</span>
                    ))}
                  </div>
                </div>
                {d.match_reason && <span className="text-xs text-neutral-500">{d.match_reason}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Remediation Checklist */}
      {checklist.length > 0 && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
          <SectionHeader
            sid="checklist"
            title="Remediation Checklist"
            badge={<span className="text-xs text-neutral-500 ml-2">{totalProgress}/{totalItems} completed</span>}
          />
          {expandedSections.has('checklist') && (
            <div className="mt-3 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-neutral-800 overflow-hidden">
                  <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${totalItems > 0 ? (totalProgress / totalItems) * 100 : 0}%` }} />
                </div>
                <span className="text-xs text-neutral-400">{totalItems > 0 ? Math.round((totalProgress / totalItems) * 100) : 0}%</span>
              </div>

              {(['immediate', 'scheduled', 'longterm'] as const).map((tier) => {
                const tierItems = checklist.filter((c) => c.tier === tier);
                if (tierItems.length === 0) return null;
                const colors = { immediate: 'text-red-400', scheduled: 'text-orange-400', longterm: 'text-blue-400' };
                const icons = { immediate: <Zap size={14} />, scheduled: <Clock size={14} />, longterm: <Shield size={14} /> };
                const labels = { immediate: 'Immediate', scheduled: 'Scheduled', longterm: 'Long-Term' };
                const p = progress[tier];
                return (
                  <div key={tier}>
                    <div className={`flex items-center gap-2 mb-2 ${colors[tier]}`}>
                      {icons[tier]}
                      <span className="text-xs font-semibold">{labels[tier]} ({p.done}/{p.total})</span>
                    </div>
                    {tierItems.map((item) => (
                      <label key={item.id} className="flex items-center gap-2 py-1.5 pl-5 cursor-pointer hover:bg-neutral-800/30 rounded">
                        <input type="checkbox" checked={item.checked} onChange={() => toggleCheck(item.id)} className="rounded bg-neutral-700 border-neutral-600" />
                        <span className={`text-sm ${item.checked ? 'text-neutral-500 line-through' : 'text-neutral-300'}`}>{item.text}</span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MITRE ATT&CK */}
      {advisory.mitre_techniques && advisory.mitre_techniques.length > 0 && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
          <SectionHeader sid="mitre" title="MITRE ATT&CK for ICS" />
          {expandedSections.has('mitre') && (
            <div className="mt-3 flex flex-wrap gap-2">
              {advisory.mitre_techniques.map((t, i) => (
                <span key={i} className="px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-sm text-purple-400">{t}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* References */}
      {advisory.references && advisory.references.length > 0 && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
          <SectionHeader sid="refs" title="References" />
          {expandedSections.has('refs') && (
            <div className="mt-3 space-y-2">
              {advisory.references.map((ref, i) => (
                <a key={i} href={ref.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 rounded-lg bg-neutral-800/50 hover:bg-neutral-800 transition-colors text-sm text-blue-400"
                >
                  <ExternalLink size={14} />
                  <span>{ref.title}</span>
                  <span className="text-neutral-600 text-xs truncate flex-1">{ref.url}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
