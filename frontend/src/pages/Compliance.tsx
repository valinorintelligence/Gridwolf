import { useState, useEffect, useMemo } from 'react';
import {
  ClipboardCheck, Check, X, AlertTriangle, ChevronDown,
  ChevronRight, Download, Minus
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api } from '@/services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Finding {
  id: string;
  finding_type: string;
  severity: string;
  title: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Static framework structure (requirement IDs, names, and how each maps to
// finding_types from the backend).
// ---------------------------------------------------------------------------

const IEC_FRS = [
  {
    id: 'FR 1', name: 'Identification & Authentication',
    reqs: [
      { id: 'SR 1.1', name: 'Human user identification', failTypes: ['default_credential'] },
      { id: 'SR 1.2', name: 'Software process authentication', failTypes: ['unauthenticated_protocol'] },
      { id: 'SR 1.3', name: 'Account management', failTypes: ['default_credential'] },
      { id: 'SR 1.5', name: 'Authenticator management', failTypes: ['weak_authentication'] },
      { id: 'SR 1.7', name: 'Password strength', failTypes: ['weak_password', 'default_credential'] },
    ],
  },
  {
    id: 'FR 2', name: 'Use Control',
    reqs: [
      { id: 'SR 2.1', name: 'Authorization enforcement', failTypes: ['unauthorized_access'] },
      { id: 'SR 2.3', name: 'Portable device control', failTypes: [] },
      { id: 'SR 2.5', name: 'Session lock', failTypes: [] },
    ],
  },
  {
    id: 'FR 3', name: 'System Integrity',
    reqs: [
      { id: 'SR 3.1', name: 'Communication integrity', failTypes: ['unencrypted_protocol'] },
      { id: 'SR 3.2', name: 'Malicious code protection', failTypes: ['malware_indicator'] },
      { id: 'SR 3.5', name: 'Input validation', failTypes: ['command_injection'] },
    ],
  },
  {
    id: 'FR 4', name: 'Data Confidentiality',
    reqs: [
      { id: 'SR 4.1', name: 'Information confidentiality', failTypes: ['unencrypted_protocol'] },
      { id: 'SR 4.3', name: 'Use of cryptography', failTypes: ['weak_crypto'] },
    ],
  },
  {
    id: 'FR 5', name: 'Restricted Data Flow',
    reqs: [
      { id: 'SR 5.1', name: 'Network segmentation', failTypes: ['purdue_violation'] },
      { id: 'SR 5.2', name: 'Zone boundary protection', failTypes: ['purdue_violation', 'firewall_bypass'] },
    ],
  },
  {
    id: 'FR 6', name: 'Timely Response to Events',
    reqs: [
      { id: 'SR 6.1', name: 'Audit log accessibility', failTypes: [] },
      { id: 'SR 6.4', name: 'Event correlation', failTypes: [] },
    ],
  },
  {
    id: 'FR 7', name: 'Resource Availability',
    reqs: [
      { id: 'SR 7.1', name: 'DoS protection', failTypes: ['dos_indicator'] },
      { id: 'SR 7.3', name: 'System backup', failTypes: [] },
    ],
  },
];

const NIST_SECTIONS = [
  { name: '5.1 Risk Management', failTypes: ['critical', 'high'] as string[], usesSeverity: true },
  { name: '5.2 Security Architecture', failTypes: ['purdue_violation'] },
  { name: '5.3 Network Segmentation', failTypes: ['purdue_violation'] },
  { name: '5.4 Access Control', failTypes: ['default_credential', 'unauthorized_access', 'unauthenticated_protocol'] },
  { name: '5.5 Monitoring', failTypes: [] },
  { name: '6.1 Assessment', failTypes: [] },
  { name: '6.2 Patch Management', failTypes: ['vulnerable_firmware', 'outdated_software'] },
  { name: '6.3 Incident Response', failTypes: [] },
];

const NERC_CIP_ITEMS = [
  { id: 'CIP-002', name: 'BES Cyber System Categorization', failTypes: [] },
  { id: 'CIP-003', name: 'Security Management Controls', failTypes: ['default_credential', 'weak_password'] },
  { id: 'CIP-005', name: 'Electronic Security Perimeters', failTypes: ['purdue_violation', 'firewall_bypass'] },
  { id: 'CIP-007', name: 'System Security Management', failTypes: ['unencrypted_protocol', 'vulnerable_firmware'] },
  { id: 'CIP-010', name: 'Configuration Change Management', failTypes: ['unauthorized_write', 'write_path'] },
  { id: 'CIP-013', name: 'Supply Chain Risk Management', failTypes: ['vulnerable_firmware'] },
];

const TABS = ['IEC 62443', 'NIST SP 800-82', 'NERC CIP'] as const;

const statusIcon = (s: string) =>
  s === 'pass' ? <Check size={12} className="text-emerald-400" /> :
  s === 'fail' ? <X size={12} className="text-red-400" /> :
  s === 'partial' ? <Minus size={12} className="text-amber-400" /> :
  <span className="text-[10px] text-content-tertiary">N/A</span>;

// ---------------------------------------------------------------------------
// Score derivation helpers
// ---------------------------------------------------------------------------

function reqStatus(failTypes: string[], findingTypeSet: Set<string>): 'pass' | 'fail' {
  if (failTypes.length === 0) return 'pass'; // No findings map to this; assume pass
  return failTypes.some((t) => findingTypeSet.has(t)) ? 'fail' : 'pass';
}

function nistScore(
  section: typeof NIST_SECTIONS[0],
  findingTypeSet: Set<string>,
  totalFindings: number,
): number {
  if (section.usesSeverity) {
    // For risk management, score inversely proportional to total findings
    if (totalFindings === 0) return 90;
    if (totalFindings <= 3) return 75;
    if (totalFindings <= 8) return 55;
    return 35;
  }
  if (section.failTypes.length === 0) return 80; // No mapping, assume adequate
  const failCount = section.failTypes.filter((t) => findingTypeSet.has(t)).length;
  return failCount === 0 ? 85 : failCount === 1 ? 50 : 30;
}

function nercStatus(failTypes: string[], findingTypeSet: Set<string>): { status: string; pct: number } {
  if (failTypes.length === 0) return { status: 'pass', pct: 95 };
  const fails = failTypes.filter((t) => findingTypeSet.has(t)).length;
  if (fails === 0) return { status: 'pass', pct: 90 };
  if (fails < failTypes.length) return { status: 'partial', pct: 55 };
  return { status: 'fail', pct: 30 };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Compliance() {
  const [tab, setTab] = useState<typeof TABS[number]>('IEC 62443');
  const [expandedFR, setExpandedFR] = useState<string | null>('FR 1');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/ics/findings/', { params: { limit: 2000 } })
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        setFindings(data);
      })
      .catch(() => setFindings([]))
      .finally(() => setLoading(false));
  }, []);

  // Build a set of active finding_types for O(1) lookup
  const findingTypeSet = useMemo(
    () => new Set(findings.map((f) => f.finding_type)),
    [findings]
  );

  const hasData = findings.length > 0;

  // Derive IEC scores
  const iecFRsWithStatus = useMemo(() =>
    IEC_FRS.map((fr) => {
      const reqs = fr.reqs.map((r) => ({
        ...r,
        status: reqStatus(r.failTypes, findingTypeSet),
      }));
      const met = reqs.filter((r) => r.status === 'pass').length;
      return { ...fr, reqs, met, total: reqs.length };
    }),
  [findingTypeSet]);

  const iecScore = useMemo(() => {
    const met = iecFRsWithStatus.reduce((s, f) => s + f.met, 0);
    const total = iecFRsWithStatus.reduce((s, f) => s + f.total, 0);
    return total > 0 ? Math.round((met / total) * 100) : hasData ? 50 : 0;
  }, [iecFRsWithStatus, hasData]);

  // Derive NIST scores
  const nistSectionsWithScore = useMemo(() =>
    NIST_SECTIONS.map((s) => ({
      ...s,
      pct: nistScore(s, findingTypeSet, findings.length),
    })),
  [findingTypeSet, findings.length]);

  const nistScore_ = useMemo(() => {
    if (!hasData) return 0;
    return Math.round(nistSectionsWithScore.reduce((s, x) => s + x.pct, 0) / nistSectionsWithScore.length);
  }, [nistSectionsWithScore, hasData]);

  // Derive NERC CIP scores
  const nercItemsWithStatus = useMemo(() =>
    NERC_CIP_ITEMS.map((item) => ({
      ...item,
      ...nercStatus(item.failTypes, findingTypeSet),
    })),
  [findingTypeSet]);

  const nercScore_ = useMemo(() => {
    if (!hasData) return 0;
    return Math.round(nercItemsWithStatus.reduce((s, x) => s + x.pct, 0) / nercItemsWithStatus.length);
  }, [nercItemsWithStatus, hasData]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2">
            <ClipboardCheck size={24} className="text-accent" /> Compliance Mapping
          </h1>
          <p className="text-sm text-content-secondary mt-1">
            Automated compliance assessment against ICS/OT security frameworks
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Download size={14} /> Export Report
        </Button>
      </div>

      {!hasData && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          <AlertTriangle size={14} className="inline mr-2" />
          No findings data available. Upload a PCAP file to generate real compliance scores.
          Scores below reflect baseline assumptions with no findings present.
        </div>
      )}

      {/* Scores */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { name: 'IEC 62443', score: iecScore },
          { name: 'NIST SP 800-82', score: nistScore_ },
          { name: 'NERC CIP', score: nercScore_ },
        ].map((f) => (
          <div key={f.name} className="rounded-lg border border-border-default bg-surface-card p-4 flex items-center gap-4">
            <div className="relative w-16 h-16">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className="text-border-default" strokeWidth="8" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor"
                  className={f.score >= 75 ? 'text-emerald-400' : f.score >= 50 ? 'text-amber-400' : 'text-red-400'}
                  strokeWidth="8"
                  strokeDasharray={`${f.score * 2.51} 251`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-content-primary">{f.score}%</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-content-primary">{f.name}</p>
              <p className={`text-xs ${f.score >= 75 ? 'text-emerald-400' : f.score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                {f.score >= 75 ? 'Good' : f.score >= 50 ? 'Needs improvement' : 'Below threshold'}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 rounded-lg bg-surface-card border border-border-default p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === t ? 'bg-accent text-white' : 'text-content-secondary hover:bg-surface-hover'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'IEC 62443' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
            {iecFRsWithStatus.map((fr) => (
              <div key={fr.id}>
                <button
                  onClick={() => setExpandedFR(expandedFR === fr.id ? null : fr.id)}
                  className="w-full flex items-center justify-between px-4 py-2.5 border-b border-border-default hover:bg-surface-hover"
                >
                  <div className="flex items-center gap-3">
                    {expandedFR === fr.id
                      ? <ChevronDown size={12} className="text-content-tertiary" />
                      : <ChevronRight size={12} className="text-content-tertiary" />}
                    <span className="text-xs font-medium text-accent">{fr.id}</span>
                    <span className="text-xs text-content-primary">{fr.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full bg-bg-secondary overflow-hidden">
                      <div
                        className={`h-full rounded-full ${fr.met / fr.total >= 0.75 ? 'bg-emerald-500' : fr.met / fr.total >= 0.5 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${(fr.met / fr.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-content-tertiary">{fr.met}/{fr.total}</span>
                  </div>
                </button>
                {expandedFR === fr.id && (
                  <div className="bg-bg-secondary border-b border-border-default">
                    {fr.reqs.map((r) => (
                      <div key={r.id} className="flex items-center gap-3 px-8 py-1.5 text-xs">
                        {statusIcon(r.status)}
                        <span className="font-mono text-content-tertiary w-12">{r.id}</span>
                        <span className="text-content-primary">{r.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'NIST SP 800-82' && (
        <div className="rounded-lg border border-border-default bg-surface-card p-4 space-y-3">
          <p className="text-sm font-medium text-content-primary">NIST SP 800-82 Rev. 3</p>
          {nistSectionsWithScore.map((s) => (
            <div key={s.name} className="flex items-center gap-3">
              {statusIcon(s.pct >= 70 ? 'pass' : s.pct >= 50 ? 'partial' : 'fail')}
              <span className="text-xs text-content-primary w-48">{s.name}</span>
              <div className="flex-1 h-2 rounded-full bg-bg-secondary overflow-hidden">
                <div
                  className={`h-full rounded-full ${s.pct >= 70 ? 'bg-emerald-500' : s.pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${s.pct}%` }}
                />
              </div>
              <span className="text-[10px] text-content-tertiary w-8 text-right">{s.pct}%</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'NERC CIP' && (
        <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-default text-content-tertiary">
                <th className="text-left px-4 py-2 font-medium">Standard</th>
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Compliance</th>
              </tr>
            </thead>
            <tbody>
              {nercItemsWithStatus.map((c) => (
                <tr key={c.id} className="border-b border-border-default last:border-0 hover:bg-surface-hover">
                  <td className="px-4 py-2 font-mono text-accent">{c.id}</td>
                  <td className="px-4 py-2 text-content-primary">{c.name}</td>
                  <td className="px-4 py-2">{statusIcon(c.status)}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-bg-secondary overflow-hidden">
                        <div
                          className={`h-full rounded-full ${c.pct >= 70 ? 'bg-emerald-500' : c.pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${c.pct}%` }}
                        />
                      </div>
                      <span className="text-content-tertiary">{c.pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
