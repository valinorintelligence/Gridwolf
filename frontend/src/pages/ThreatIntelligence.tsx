import { useState, useEffect, useMemo } from 'react';
import {
  Skull, Shield, AlertTriangle, Eye, ChevronDown, ChevronRight,
  Crosshair, Zap, Target, Search, Bug, Info
} from 'lucide-react';
import { api } from '@/services/api';

// ─── Static ATT&CK for ICS matrix structure ───────────────────────
// Technique counts are populated from real findings at runtime.
const TACTICS_BASE = [
  { name: 'Initial Access', techniques: [{ id: 'T0819', name: 'Exploit Public-Facing App' }, { id: 'T0866', name: 'Exploitation of Remote Services' }] },
  { name: 'Execution', techniques: [{ id: 'T0855', name: 'Unauthorized Command Message' }, { id: 'T0821', name: 'Modify Controller Tasking' }] },
  { name: 'Persistence', techniques: [{ id: 'T0839', name: 'Module Firmware' }, { id: 'T0873', name: 'Project File Infection' }] },
  { name: 'Evasion', techniques: [{ id: 'T0856', name: 'Spoof Reporting Message' }, { id: 'T0872', name: 'Indicator Removal' }] },
  { name: 'Discovery', techniques: [{ id: 'T0846', name: 'Remote System Discovery' }, { id: 'T0840', name: 'Network Sniffing' }] },
  { name: 'Lateral Movement', techniques: [{ id: 'T0886', name: 'Remote Services' }, { id: 'T0812', name: 'Default Credentials' }] },
  { name: 'Collection', techniques: [{ id: 'T0811', name: 'Data from Info Repositories' }, { id: 'T0852', name: 'Screen Capture' }] },
  { name: 'Command & Control', techniques: [{ id: 'T0869', name: 'Standard Application Layer' }, { id: 'T0885', name: 'Commonly Used Port' }] },
  { name: 'Inhibit Response', techniques: [{ id: 'T0816', name: 'Device Restart/Shutdown' }, { id: 'T0814', name: 'Denial of Service' }, { id: 'T0838', name: 'Modify Alarm Settings' }] },
  { name: 'Impair Process', techniques: [{ id: 'T0836', name: 'Modify Parameter' }, { id: 'T0843', name: 'Program Download' }, { id: 'T0845', name: 'Program Upload' }] },
  { name: 'Impact', techniques: [{ id: 'T0831', name: 'Manipulation of Control' }, { id: 'T0882', name: 'Theft of Operational Info' }] },
];

// ─── finding_type → ATT&CK technique mapping ─────────────────────
const TYPE_TO_TECHNIQUE: Record<string, string> = {
  unauthorized_command:  'T0855',
  program_download:      'T0843',
  program_upload:        'T0845',
  modify_parameter:      'T0836',
  default_credential:    'T0812',
  cleartext_protocol:    'T0885',
  purdue_violation:      'T0886',
  network_scan:          'T0846',
  firmware_manipulation: 'T0839',
  device_restart:        'T0816',
  s7_exploitation:       'T0821',
  data_historian:        'T0811',
  remote_services:       'T0866',
};

// ─── ICS Malware heuristic definitions (static, scan-agnostic) ───
const MALWARE = [
  { name: 'FrostyGoop', indicators: ['Modbus TCP targeting', 'Setpoint manipulation', 'L1 device targeting', 'Temperature control interference'] },
  { name: 'PIPEDREAM / INCONTROLLER', indicators: ['CIP scanning', 'S7comm exploitation', 'OPC UA abuse', 'Codesys manipulation', 'Multi-protocol orchestration'] },
  { name: 'Industroyer2', indicators: ['IEC 104 manipulation', 'Breaker control commands', 'Sequential tripping', 'Wiper component'] },
  { name: 'TRITON / TRISIS', indicators: ['TriStation protocol', 'SIS controller access', 'Safety logic modification'] },
];

// ─── Helpers ──────────────────────────────────────────────────────
const sevColor = (s: string) =>
  s === 'critical' ? 'bg-red-500/15 text-red-400' :
  s === 'high' ? 'bg-orange-500/15 text-orange-400' :
  s === 'medium' ? 'bg-amber-500/15 text-amber-400' :
  'bg-blue-500/15 text-blue-400';

// ─── Types ────────────────────────────────────────────────────────
interface Finding {
  id: string;
  finding_type: string;
  severity: string;
  title: string;
  src_ip: string | null;
  dst_ip: string | null;
  protocol: string | null;
  mitre_technique: string | null;
  confidence: number | null;
  created_at: string | null;
}

// ─── Component ────────────────────────────────────────────────────
export default function ThreatIntelligence() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [malwareOpen, setMalwareOpen] = useState(true);
  const [ruleFilter, setRuleFilter] = useState('');

  useEffect(() => {
    api.get('/ics/findings/', { params: { limit: 2000 } })
      .then((r) => setFindings(Array.isArray(r.data) ? r.data : []))
      .catch(() => setFindings([]))
      .finally(() => setLoading(false));
  }, []);

  // Derive technique hit counts from real findings
  const techniqueCounts = useMemo(() => {
    const counts: Record<string, { count: number; severity: string }> = {};
    for (const f of findings) {
      // Use mitre_technique field if present, else map from finding_type
      const tech = f.mitre_technique ?? TYPE_TO_TECHNIQUE[f.finding_type] ?? null;
      if (!tech) continue;
      if (!counts[tech]) counts[tech] = { count: 0, severity: 'low' };
      counts[tech].count += 1;
      // Escalate severity (critical > high > medium > low)
      const order = ['critical', 'high', 'medium', 'low'];
      if (order.indexOf(f.severity) < order.indexOf(counts[tech].severity)) {
        counts[tech].severity = f.severity;
      }
    }
    return counts;
  }, [findings]);

  // Build tactics with real counts
  const tactics = useMemo(() =>
    TACTICS_BASE.map((tac) => ({
      ...tac,
      techniques: tac.techniques.map((t) => ({
        ...t,
        count: techniqueCounts[t.id]?.count ?? 0,
        severity: techniqueCounts[t.id]?.severity,
      })),
    })),
  [techniqueCounts]);

  // Heuristic malware matches based on finding types present
  const findingTypeSet = useMemo(() => new Set(findings.map((f) => f.finding_type)), [findings]);

  const malwareMatches = useMemo(() => {
    const typeToIndicator: Record<string, string[]> = {
      FrostyGoop: ['modify_parameter', 'unauthorized_command'],
      'PIPEDREAM / INCONTROLLER': ['program_download', 'purdue_violation', 's7_exploitation'],
      Industroyer2: [],
      'TRITON / TRISIS': [],
    };
    return MALWARE.map((m) => {
      const matchTypes = typeToIndicator[m.name] ?? [];
      const matched = matchTypes.filter((t) => findingTypeSet.has(t)).length;
      const status = matched === 0 ? 'no-match' : matched < matchTypes.length ? 'partial' : 'match';
      return { ...m, matched, total: m.indicators.length, status };
    });
  }, [findingTypeSet]);

  // Detection table — use real findings
  const detectionRows = useMemo(() =>
    findings.map((f, i) => ({
      id: `GW-${String(i + 1).padStart(3, '0')}`,
      technique: f.mitre_technique ?? TYPE_TO_TECHNIQUE[f.finding_type] ?? '—',
      tactic: TACTICS_BASE.find((tac) =>
        tac.techniques.some((t) => t.id === (f.mitre_technique ?? TYPE_TO_TECHNIQUE[f.finding_type]))
      )?.name ?? '—',
      desc: f.title,
      severity: f.severity as 'critical' | 'high' | 'medium' | 'low',
      source: f.src_ip ?? '—',
      target: f.dst_ip ?? '—',
      protocol: f.protocol ?? '—',
      lastTriggered: f.created_at ? new Date(f.created_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—',
    })),
  [findings]);

  const filteredRows = useMemo(() =>
    detectionRows.filter((r) => !ruleFilter || r.desc.toLowerCase().includes(ruleFilter.toLowerCase())),
  [detectionRows, ruleFilter]);

  const totalDetections = findings.length;
  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const highCount = findings.filter((f) => f.severity === 'high').length;
  const techniqueCount = Object.keys(techniqueCounts).length;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  const hasData = findings.length > 0;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2">
          <Skull size={24} className="text-accent" /> MITRE ATT&CK for ICS
        </h1>
        <p className="text-sm text-content-secondary mt-1">
          Automated threat detection mapped to ATT&CK for ICS framework
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Detection Rules', value: '40+', icon: Shield, color: 'text-accent' },
          { label: 'Active Detections', value: String(totalDetections), icon: Zap, color: 'text-amber-400' },
          { label: 'Techniques Matched', value: String(techniqueCount), icon: Target, color: 'text-blue-400' },
          { label: 'Critical Findings', value: String(criticalCount), icon: AlertTriangle, color: 'text-red-400' },
          { label: 'High Findings', value: String(highCount), icon: Crosshair, color: 'text-orange-400' },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border-default bg-surface-card p-3">
            <p className="text-[10px] text-content-tertiary flex items-center gap-1">
              <s.icon size={10} /> {s.label}
            </p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* No data banner */}
      {!hasData && (
        <div className="rounded-lg border border-border-default bg-surface-card p-6 flex items-start gap-3">
          <Info size={16} className="text-accent mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-content-primary">No findings in database</p>
            <p className="text-xs text-content-secondary mt-1">
              Upload a PCAP file to automatically detect ICS threats and populate the ATT&CK matrix with real findings.
            </p>
          </div>
        </div>
      )}

      {/* ATT&CK Matrix */}
      <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border-default">
          <p className="text-sm font-medium text-content-primary">ATT&CK for ICS Matrix</p>
        </div>
        <div className="overflow-x-auto p-4">
          <div className="flex gap-2 min-w-[1200px]">
            {tactics.map((tac) => (
              <div key={tac.name} className="flex-1 min-w-[100px]">
                <div className="text-[10px] font-bold text-content-secondary uppercase text-center py-2 bg-bg-secondary rounded-t border border-border-default">
                  {tac.name}
                </div>
                <div className="space-y-1 mt-1">
                  {tac.techniques.map((t) => {
                    const hasDet = t.count > 0;
                    return (
                      <div
                        key={t.id}
                        className={`rounded border px-2 py-1.5 text-center transition-colors ${
                          hasDet
                            ? t.severity === 'critical' ? 'border-red-500/40 bg-red-500/10'
                            : t.severity === 'high' ? 'border-orange-500/40 bg-orange-500/10'
                            : 'border-amber-500/40 bg-amber-500/10'
                            : 'border-border-default bg-bg-secondary hover:bg-surface-hover'
                        }`}
                      >
                        <p className="text-[9px] font-mono text-content-tertiary">{t.id}</p>
                        <p className="text-[10px] text-content-primary leading-tight mt-0.5">{t.name}</p>
                        {hasDet && (
                          <span className={`inline-block mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${sevColor(t.severity ?? 'medium')}`}>
                            {t.count}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detection Events Table (real findings) */}
      <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border-default flex items-center justify-between">
          <p className="text-sm font-medium text-content-primary">
            Detection Events ({detectionRows.length})
          </p>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-tertiary" />
            <input
              value={ruleFilter}
              onChange={(e) => setRuleFilter(e.target.value)}
              placeholder="Filter events…"
              className="rounded border border-border-default bg-bg-secondary text-xs px-3 py-1 pl-8 text-content-primary placeholder:text-content-muted w-56"
            />
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <p className="p-6 text-center text-xs text-content-muted">
            {hasData ? 'No events match filter' : 'No detection events — upload a PCAP to begin analysis'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-default text-content-tertiary">
                  <th className="text-left px-3 py-2 font-medium">ID</th>
                  <th className="text-left px-3 py-2 font-medium">Technique</th>
                  <th className="text-left px-3 py-2 font-medium">Tactic</th>
                  <th className="text-left px-3 py-2 font-medium">Description</th>
                  <th className="text-left px-3 py-2 font-medium">Severity</th>
                  <th className="text-left px-3 py-2 font-medium">Source</th>
                  <th className="text-left px-3 py-2 font-medium">Target</th>
                  <th className="text-left px-3 py-2 font-medium">Protocol</th>
                  <th className="text-left px-3 py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={r.id} className="border-b border-border-default last:border-0 hover:bg-surface-hover">
                    <td className="px-3 py-2 font-mono text-content-tertiary">{r.id}</td>
                    <td className="px-3 py-2">
                      <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent text-[10px]">{r.technique}</span>
                    </td>
                    <td className="px-3 py-2 text-content-secondary">{r.tactic}</td>
                    <td className="px-3 py-2 text-content-primary font-medium">{r.desc}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sevColor(r.severity)}`}>{r.severity}</span>
                    </td>
                    <td className="px-3 py-2 font-mono text-content-secondary text-[10px]">{r.source}</td>
                    <td className="px-3 py-2 font-mono text-content-secondary text-[10px]">{r.target}</td>
                    <td className="px-3 py-2 text-content-secondary">{r.protocol}</td>
                    <td className="px-3 py-2 text-content-tertiary">{r.lastTriggered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ICS Malware Behavioral Detection (heuristic) */}
      <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
        <button
          onClick={() => setMalwareOpen(!malwareOpen)}
          className="w-full px-4 py-3 border-b border-border-default flex items-center justify-between hover:bg-surface-hover"
        >
          <p className="text-sm font-medium text-content-primary flex items-center gap-2">
            <Bug size={14} className="text-red-400" /> ICS Malware Behavioral Detection
            <span className="text-[10px] text-content-tertiary font-normal">(heuristic — based on observed finding types)</span>
          </p>
          {malwareOpen ? (
            <ChevronDown size={14} className="text-content-tertiary" />
          ) : (
            <ChevronRight size={14} className="text-content-tertiary" />
          )}
        </button>
        {malwareOpen && (
          <div className="p-4 grid grid-cols-2 gap-3">
            {malwareMatches.map((m) => (
              <div
                key={m.name}
                className={`rounded-lg border p-4 ${
                  m.status === 'partial' ? 'border-amber-500/30 bg-amber-500/5' :
                  m.status === 'match' ? 'border-red-500/30 bg-red-500/5' :
                  'border-border-default bg-bg-secondary'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-content-primary">{m.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    m.status === 'no-match' ? 'bg-emerald-500/15 text-emerald-400' :
                    m.status === 'partial' ? 'bg-amber-500/15 text-amber-400' :
                    'bg-red-500/15 text-red-400'
                  }`}>
                    {m.status === 'no-match' ? 'No Match' : m.status === 'partial' ? 'Partial Match' : 'MATCH'}
                  </span>
                </div>
                <div className="space-y-1">
                  {m.indicators.map((ind, i) => (
                    <div key={ind} className={`flex items-center gap-2 text-xs ${i < m.matched ? 'text-amber-400' : 'text-content-tertiary'}`}>
                      {i < m.matched ? <AlertTriangle size={10} /> : <Eye size={10} />}
                      {ind}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-content-tertiary mt-2">
                  Confidence: {m.matched}/{m.total} indicators matched
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
