import { useState } from 'react';
import {
  Shield, AlertTriangle, ArrowLeft, CheckCircle2, XCircle, Globe,
  Lock, Unlock, User, Activity, Clock, Zap, ExternalLink, Copy,
  ChevronDown, ChevronRight, Eye, Info
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

interface DeviceMatch {
  ip: string;
  vendor: string;
  type: string;
  model: string;
  protocols: string[];
  matchReason: string;
}

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  tier: 'immediate' | 'scheduled' | 'longterm';
}

// ─── Mock Data ────────────────────────────────────────────────

const ADVISORY = {
  id: 'adv-001', cve_id: 'CVE-2024-38876',
  title: 'Siemens S7-1500 TLS Certificate Verification Bypass',
  description: 'A vulnerability in the TLS certificate verification of Siemens S7-1500 PLCs allows an unauthenticated attacker to perform man-in-the-middle attacks and execute arbitrary code on affected devices. The vulnerability exists in the web server component used for configuration and diagnostics. When exploited, the attacker can intercept and modify communications between engineering tools (TIA Portal) and the PLC, potentially allowing unauthorized firmware modifications, program downloads, or process manipulation. This vulnerability is particularly critical in OT environments where PLCs directly control physical processes.',
  source: 'siemens', vendor: 'Siemens',
  products: [
    { name: 'S7-1500', version: '< V3.1.0', patched: true, patchVersion: 'V3.1.0' },
    { name: 'S7-1500S', version: '< V3.1.0', patched: true, patchVersion: 'V3.1.0' },
    { name: 'ET 200SP', version: '< V3.1.0', patched: true, patchVersion: 'V3.1.0' },
    { name: 'S7-1500T', version: '< V3.1.0', patched: true, patchVersion: 'V3.1.0' },
    { name: 'S7-1500F', version: '< V3.1.0', patched: true, patchVersion: 'V3.1.0' },
  ],
  cvss_score: 9.8, cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
  severity: 'critical', kev_listed: true, kev_due_date: '2024-09-15',
  epss_score: 0.42, epss_percentile: 0.97, urgency_tier: 'act_now',
  attack_vector: 'network', auth_required: 'none', complexity: 'low', user_interaction: 'none',
  sector: 'manufacturing', published_date: '2024-07-12', last_modified: '2024-08-20',
  cwe: 'CWE-295 (Improper Certificate Validation)',
  patch_available: true,
  remediation_immediate: 'Apply network segmentation to isolate S7-1500 devices from untrusted networks. Block TCP port 102 (S7comm) and HTTPS port 443 from all non-engineering workstations. Implement firewall rules that restrict access to known engineering station IPs only.',
  remediation_scheduled: 'Update S7-1500 firmware to V3.1.0 or later during the next planned maintenance window. Verify TLS certificate validation is enabled in TIA Portal project settings after firmware update.',
  remediation_longterm: 'Implement TLS mutual authentication and certificate pinning for all S7 communications. Deploy an ICS-aware intrusion detection system to monitor for MitM attempts on port 102. Consider implementing a dedicated OT PKI for certificate management.',
  mitre_techniques: ['T0834 - Native API', 'T0843 - Program Download', 'T0831 - Manipulation of Control'],
  references: [
    { title: 'Siemens ProductCERT Advisory SSA-398330', url: 'https://cert-portal.siemens.com/productcert/csaf/ssa-398330.json' },
    { title: 'CISA ICS Advisory ICSA-24-193-01', url: 'https://www.cisa.gov/news-events/ics-advisories/icsa-24-193-01' },
    { title: 'NVD Entry', url: 'https://nvd.nist.gov/vuln/detail/CVE-2024-38876' },
  ],
  disposition: 'in_progress',
};

const DEVICE_MATCHES: DeviceMatch[] = [
  { ip: '10.1.1.10', vendor: 'Siemens', type: 'PLC', model: 'S7-1500', protocols: ['s7comm'], matchReason: 'Vendor + Product match' },
  { ip: '10.1.1.11', vendor: 'Siemens', type: 'PLC', model: 'S7-1500F', protocols: ['s7comm'], matchReason: 'Vendor + Product match' },
  { ip: '10.1.1.15', vendor: 'Siemens', type: 'PLC', model: 'ET 200SP', protocols: ['s7comm', 'profinet'], matchReason: 'Vendor + Product match' },
  { ip: '10.1.2.20', vendor: 'Siemens', type: 'HMI', model: 'TP1900', protocols: ['s7comm'], matchReason: 'Vendor match' },
];

const INITIAL_CHECKLIST: ChecklistItem[] = [
  { id: 'c1', text: 'Verify network segmentation of affected S7-1500 PLCs', checked: true, tier: 'immediate' },
  { id: 'c2', text: 'Block TCP 102 from untrusted networks at firewall', checked: true, tier: 'immediate' },
  { id: 'c3', text: 'Restrict HTTPS 443 access to engineering workstations only', checked: false, tier: 'immediate' },
  { id: 'c4', text: 'Document all affected S7-1500 devices and current firmware versions', checked: false, tier: 'immediate' },
  { id: 'c5', text: 'Schedule maintenance window for firmware update', checked: false, tier: 'scheduled' },
  { id: 'c6', text: 'Download V3.1.0 firmware from Siemens support portal', checked: false, tier: 'scheduled' },
  { id: 'c7', text: 'Test firmware update on non-production PLC first', checked: false, tier: 'scheduled' },
  { id: 'c8', text: 'Apply firmware V3.1.0 to all affected PLCs', checked: false, tier: 'scheduled' },
  { id: 'c9', text: 'Verify TLS validation enabled post-update', checked: false, tier: 'scheduled' },
  { id: 'c10', text: 'Evaluate OT PKI deployment for certificate management', checked: false, tier: 'longterm' },
  { id: 'c11', text: 'Deploy ICS-aware IDS for MitM detection on S7comm traffic', checked: false, tier: 'longterm' },
  { id: 'c12', text: 'Implement certificate pinning in TIA Portal projects', checked: false, tier: 'longterm' },
];

const SEV_COLORS: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#3b82f6', info: '#6b7280' };

const URGENCY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  act_now: { label: 'Act Now', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  plan_patch: { label: 'Plan Patch', color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
  monitor: { label: 'Monitor', color: '#eab308', bg: 'rgba(234,179,8,0.15)' },
  low_risk: { label: 'Low Risk', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
};

const DISPOSITION_OPTIONS = [
  { value: 'new', label: 'New', color: '#6b7280' },
  { value: 'not_applicable', label: 'Not Applicable', color: '#64748b' },
  { value: 'acknowledged', label: 'Acknowledged', color: '#3b82f6' },
  { value: 'in_progress', label: 'In Progress', color: '#f97316' },
  { value: 'remediated', label: 'Remediated', color: '#10b981' },
];

// ─── Component ────────────────────────────────────────────────

export default function AdvisoryDetail() {
  const [checklist, setChecklist] = useState(INITIAL_CHECKLIST);
  const [disposition, setDisposition] = useState(ADVISORY.disposition);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['products', 'enrichment', 'remediation', 'checklist', 'devices', 'mitre']));
  const [copied, setCopied] = useState(false);

  const toggleSection = (s: string) => {
    const next = new Set(expandedSections);
    next.has(s) ? next.delete(s) : next.add(s);
    setExpandedSections(next);
  };

  const toggleCheck = (id: string) => {
    setChecklist(prev => prev.map(c => c.id === id ? { ...c, checked: !c.checked } : c));
  };

  const progress = {
    immediate: { total: checklist.filter(c => c.tier === 'immediate').length, done: checklist.filter(c => c.tier === 'immediate' && c.checked).length },
    scheduled: { total: checklist.filter(c => c.tier === 'scheduled').length, done: checklist.filter(c => c.tier === 'scheduled' && c.checked).length },
    longterm: { total: checklist.filter(c => c.tier === 'longterm').length, done: checklist.filter(c => c.tier === 'longterm' && c.checked).length },
  };
  const totalProgress = checklist.filter(c => c.checked).length;
  const totalItems = checklist.length;

  const urgency = URGENCY_CONFIG[ADVISORY.urgency_tier] || URGENCY_CONFIG.low_risk;

  const handleCopy = () => {
    navigator.clipboard.writeText(ADVISORY.cve_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const SectionHeader = ({ id, title, badge }: { id: string; title: string; badge?: React.ReactNode }) => (
    <button onClick={() => toggleSection(id)} className="flex items-center gap-2 w-full text-left py-2">
      {expandedSections.has(id) ? <ChevronDown size={16} className="text-neutral-500" /> : <ChevronRight size={16} className="text-neutral-500" />}
      <span className="text-sm font-semibold text-neutral-300 uppercase tracking-wide">{title}</span>
      {badge}
    </button>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back Nav */}
      <button className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-300">
        <ArrowLeft size={14} /> Back to Feed
      </button>

      {/* Header Card */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
        <div className="flex items-start gap-4">
          {/* Severity Circle */}
          <div className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${SEV_COLORS[ADVISORY.severity]}15` }}>
            <span className="text-2xl font-bold" style={{ color: SEV_COLORS[ADVISORY.severity] }}>{ADVISORY.cvss_score}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="px-2 py-0.5 rounded text-xs font-bold uppercase" style={{ backgroundColor: `${SEV_COLORS[ADVISORY.severity]}20`, color: SEV_COLORS[ADVISORY.severity] }}>
                {ADVISORY.severity}
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: urgency.bg, color: urgency.color }}>
                <Zap size={10} /> {urgency.label}
              </span>
              {ADVISORY.kev_listed && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-400">🚨 CISA KEV — Due {ADVISORY.kev_due_date}</span>
              )}
              {ADVISORY.patch_available && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-500/20 text-green-400 flex items-center gap-1">
                  <CheckCircle2 size={10} /> Patch Available
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-white">{ADVISORY.title}</h1>
            <div className="flex items-center gap-3 mt-2 text-xs text-neutral-500">
              <button onClick={handleCopy} className="flex items-center gap-1 font-mono hover:text-neutral-300">
                {ADVISORY.cve_id} <Copy size={10} className={copied ? 'text-green-400' : ''} />
              </button>
              <span>•</span>
              <span>{ADVISORY.vendor}</span>
              <span>•</span>
              <span>Published: {ADVISORY.published_date}</span>
              <span>•</span>
              <span>Modified: {ADVISORY.last_modified}</span>
              <span>•</span>
              <span>CWE: {ADVISORY.cwe}</span>
            </div>
          </div>

          {/* Disposition */}
          <div className="shrink-0">
            <label className="text-xs text-neutral-500 block mb-1">Disposition</label>
            <select
              value={disposition}
              onChange={e => setDisposition(e.target.value)}
              className="px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm"
              style={{ color: DISPOSITION_OPTIONS.find(d => d.value === disposition)?.color }}
            >
              {DISPOSITION_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
        </div>

        {/* Attack Path Icons */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-neutral-800">
          <span className="text-xs text-neutral-500">Attack Path:</span>
          {[
            { label: 'Vector', value: ADVISORY.attack_vector, icon: Globe, danger: ADVISORY.attack_vector === 'network' },
            { label: 'Auth', value: ADVISORY.auth_required, icon: ADVISORY.auth_required === 'none' ? Unlock : Lock, danger: ADVISORY.auth_required === 'none' },
            { label: 'Complexity', value: ADVISORY.complexity, icon: Activity, danger: ADVISORY.complexity === 'low' },
            { label: 'Interaction', value: ADVISORY.user_interaction, icon: User, danger: ADVISORY.user_interaction === 'none' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800">
              <item.icon size={14} className={item.danger ? 'text-red-400' : 'text-green-400'} />
              <div>
                <div className="text-[10px] text-neutral-500">{item.label}</div>
                <div className={`text-xs font-medium capitalize ${item.danger ? 'text-red-400' : 'text-green-400'}`}>{item.value}</div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-sm text-neutral-300 leading-relaxed mt-4">{ADVISORY.description}</p>
      </div>

      {/* Affected Products */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
        <SectionHeader id="products" title="Affected Products" badge={<span className="text-xs text-neutral-500 ml-2">{ADVISORY.products.length} products</span>} />
        {expandedSections.has('products') && (
          <div className="mt-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500 border-b border-neutral-800">
                  <th className="pb-2 pr-4">Product</th>
                  <th className="pb-2 pr-4">Affected Versions</th>
                  <th className="pb-2 pr-4">Patch Status</th>
                  <th className="pb-2">Fixed Version</th>
                </tr>
              </thead>
              <tbody>
                {ADVISORY.products.map((p, i) => (
                  <tr key={i} className="border-b border-neutral-800/50">
                    <td className="py-2.5 pr-4 text-white font-medium">{p.name}</td>
                    <td className="py-2.5 pr-4 text-neutral-400 font-mono text-xs">{p.version}</td>
                    <td className="py-2.5 pr-4">
                      {p.patched ? (
                        <span className="flex items-center gap-1 text-green-400 text-xs"><CheckCircle2 size={12} /> Available</span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-400 text-xs"><XCircle size={12} /> No Patch</span>
                      )}
                    </td>
                    <td className="py-2.5 text-neutral-300 font-mono text-xs">{p.patchVersion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Enrichment Data */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
        <SectionHeader id="enrichment" title="Enrichment Data" />
        {expandedSections.has('enrichment') && (
          <div className="grid grid-cols-4 gap-4 mt-3">
            <div className="p-4 rounded-lg bg-neutral-800/50">
              <div className="text-xs text-neutral-500 mb-2">CVSS v3.1 Score</div>
              <div className="text-3xl font-bold" style={{ color: SEV_COLORS[ADVISORY.severity] }}>{ADVISORY.cvss_score}</div>
              <div className="text-[10px] text-neutral-500 mt-2 font-mono break-all">{ADVISORY.cvss_vector}</div>
            </div>
            <div className="p-4 rounded-lg bg-neutral-800/50">
              <div className="text-xs text-neutral-500 mb-2">CISA KEV Status</div>
              <div className="text-lg font-bold text-red-400">🚨 Listed</div>
              <div className="text-xs text-red-400 mt-1">Remediation due: {ADVISORY.kev_due_date}</div>
              <div className="text-[10px] text-neutral-500 mt-2">Known to be actively exploited</div>
            </div>
            <div className="p-4 rounded-lg bg-neutral-800/50">
              <div className="text-xs text-neutral-500 mb-2">EPSS Score</div>
              <div className="text-3xl font-bold text-orange-400">{(ADVISORY.epss_score * 100).toFixed(1)}%</div>
              <div className="text-xs text-neutral-500 mt-1">
                {(ADVISORY.epss_percentile * 100).toFixed(0)}th percentile
              </div>
              <div className="text-[10px] text-neutral-500 mt-1">Probability of exploitation in next 30 days</div>
            </div>
            <div className="p-4 rounded-lg bg-neutral-800/50">
              <div className="text-xs text-neutral-500 mb-2">Source</div>
              <div className="text-sm text-white font-medium">Siemens ProductCERT</div>
              <div className="text-xs text-neutral-500 mt-2">Sector: Manufacturing</div>
              <div className="text-xs text-neutral-500 mt-1">{ADVISORY.cwe}</div>
            </div>
          </div>
        )}
      </div>

      {/* Matched Devices from Session */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
        <SectionHeader id="devices" title="Matched Devices in Your Network" badge={<span className="px-2 py-0.5 rounded text-xs bg-red-500/10 text-red-400 ml-2">{DEVICE_MATCHES.length} affected</span>} />
        {expandedSections.has('devices') && (
          <div className="mt-3 space-y-2">
            {DEVICE_MATCHES.map((d, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-neutral-800/50 border border-neutral-800">
                <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle size={16} className="text-red-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-white">{d.ip}</span>
                    <span className="text-xs text-neutral-500">•</span>
                    <span className="text-xs text-neutral-400">{d.vendor} {d.model}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-neutral-500">{d.type}</span>
                    <span className="text-[10px] text-neutral-600">|</span>
                    {d.protocols.map(p => (
                      <span key={p} className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400">{p}</span>
                    ))}
                  </div>
                </div>
                <span className="text-xs text-neutral-500">{d.matchReason}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Remediation + Checklist */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
        <SectionHeader
          id="checklist"
          title="Remediation Checklist"
          badge={
            <span className="text-xs text-neutral-500 ml-2">{totalProgress}/{totalItems} completed</span>
          }
        />
        {expandedSections.has('checklist') && (
          <div className="mt-3 space-y-4">
            {/* Progress Bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-neutral-800 overflow-hidden">
                <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${(totalProgress / totalItems) * 100}%` }} />
              </div>
              <span className="text-xs text-neutral-400">{Math.round((totalProgress / totalItems) * 100)}%</span>
            </div>

            {/* Immediate */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Zap size={14} className="text-red-400" />
                <span className="text-xs font-semibold text-red-400">Immediate ({progress.immediate.done}/{progress.immediate.total})</span>
              </div>
              <div className="text-xs text-neutral-400 mb-2 pl-5">{ADVISORY.remediation_immediate}</div>
              {checklist.filter(c => c.tier === 'immediate').map(item => (
                <label key={item.id} className="flex items-center gap-2 py-1.5 pl-5 cursor-pointer hover:bg-neutral-800/30 rounded">
                  <input type="checkbox" checked={item.checked} onChange={() => toggleCheck(item.id)} className="rounded bg-neutral-700 border-neutral-600" />
                  <span className={`text-sm ${item.checked ? 'text-neutral-500 line-through' : 'text-neutral-300'}`}>{item.text}</span>
                </label>
              ))}
            </div>

            {/* Scheduled */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock size={14} className="text-orange-400" />
                <span className="text-xs font-semibold text-orange-400">Scheduled ({progress.scheduled.done}/{progress.scheduled.total})</span>
              </div>
              <div className="text-xs text-neutral-400 mb-2 pl-5">{ADVISORY.remediation_scheduled}</div>
              {checklist.filter(c => c.tier === 'scheduled').map(item => (
                <label key={item.id} className="flex items-center gap-2 py-1.5 pl-5 cursor-pointer hover:bg-neutral-800/30 rounded">
                  <input type="checkbox" checked={item.checked} onChange={() => toggleCheck(item.id)} className="rounded bg-neutral-700 border-neutral-600" />
                  <span className={`text-sm ${item.checked ? 'text-neutral-500 line-through' : 'text-neutral-300'}`}>{item.text}</span>
                </label>
              ))}
            </div>

            {/* Long-term */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield size={14} className="text-blue-400" />
                <span className="text-xs font-semibold text-blue-400">Long-Term ({progress.longterm.done}/{progress.longterm.total})</span>
              </div>
              <div className="text-xs text-neutral-400 mb-2 pl-5">{ADVISORY.remediation_longterm}</div>
              {checklist.filter(c => c.tier === 'longterm').map(item => (
                <label key={item.id} className="flex items-center gap-2 py-1.5 pl-5 cursor-pointer hover:bg-neutral-800/30 rounded">
                  <input type="checkbox" checked={item.checked} onChange={() => toggleCheck(item.id)} className="rounded bg-neutral-700 border-neutral-600" />
                  <span className={`text-sm ${item.checked ? 'text-neutral-500 line-through' : 'text-neutral-300'}`}>{item.text}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MITRE ATT&CK */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
        <SectionHeader id="mitre" title="MITRE ATT&CK for ICS" />
        {expandedSections.has('mitre') && (
          <div className="mt-3 flex flex-wrap gap-2">
            {ADVISORY.mitre_techniques.map((t, i) => (
              <span key={i} className="px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-sm text-purple-400">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* References */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
        <SectionHeader id="refs" title="References" />
        {expandedSections.has('refs') && (
          <div className="mt-3 space-y-2">
            {ADVISORY.references.map((ref, i) => (
              <a key={i} href={ref.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 rounded-lg bg-neutral-800/50 hover:bg-neutral-800 transition-colors text-sm text-blue-400">
                <ExternalLink size={14} />
                <span>{ref.title}</span>
                <span className="text-neutral-600 text-xs truncate flex-1">{ref.url}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
