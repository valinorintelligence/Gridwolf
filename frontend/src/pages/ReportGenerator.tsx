import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Download, Eye, Trash2, FileSpreadsheet, Shield,
  Check, Loader2, Lock, Calendar, User, Building2,
  FileJson, Package, ClipboardList, AlertCircle, CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api } from '@/services/api';

interface Session {
  id: string;
  name: string;
}

interface GeneratedReport {
  id: string | number;
  name: string;
  type: string;
  date: string;
  pages: number;
  size: string;
  status: 'ready' | 'generating' | 'error';
}

// report_type values MUST match backend ReportRequest enum exactly:
// full | executive | technical | compliance | delta
const REPORT_TYPES = [
  { id: 'executive', label: 'Executive Summary', desc: 'High-level findings for management' },
  { id: 'full', label: 'Full Technical Assessment', desc: 'Comprehensive technical report' },
  { id: 'technical', label: 'Technical Deep-Dive', desc: 'Engineering-detail report with raw data' },
  { id: 'compliance', label: 'Compliance Report', desc: 'IEC 62443 / NIST 800-82 / NERC CIP' },
  { id: 'delta', label: 'Delta / Drift Report', desc: 'Change from prior assessment baseline' },
];

// Section ids MUST match backend Valid list exactly:
// all | compliance | cves | devices | executive_summary | findings | recommendations | topology
const SECTIONS = [
  { id: 'executive_summary', label: 'Executive Summary', locked: true },
  { id: 'topology', label: 'Network Topology Map' },
  { id: 'devices', label: 'Asset Inventory' },
  { id: 'findings', label: 'Security Findings (ATT&CK Mapped)' },
  { id: 'cves', label: 'CVE Matches' },
  { id: 'compliance', label: 'Compliance Status' },
  { id: 'recommendations', label: 'Recommendations & Remediation' },
];

const EXPORTS = [
  { icon: FileText, label: 'PDF Assessment Report', desc: 'Professional multi-section report with charts and topology maps', primary: true },
  { icon: FileSpreadsheet, label: 'CSV Data Export', desc: 'Assets, connections, and findings as spreadsheets' },
  { icon: Package, label: 'SBOM Export', desc: 'SPDX/CycloneDX software bill of materials (CISA BOD 23-01)' },
  { icon: Shield, label: 'STIX 2.1 Bundle', desc: 'Threat intelligence bundle for sharing with ISACs' },
  { icon: FileJson, label: 'Filtered PCAP Export', desc: 'Export packets matching IP/port/protocol filters' },
  { icon: ClipboardList, label: 'Communication Allowlist', desc: 'Flow classification with firewall rule generation' },
];

export default function ReportGenerator() {
  const [reportType, setReportType] = useState('full');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState('');
  const [sectionChecks, setSectionChecks] = useState<Record<string, boolean>>(
    Object.fromEntries(SECTIONS.map((s) => [s.id, true]))
  );
  const [clientName, setClientName] = useState('');
  const [assessor, setAssessor] = useState('');
  const [classification, setClassification] = useState('confidential');
  const [generating, setGenerating] = useState(false);
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const fetchReports = useCallback(async () => {
    try {
      setReportsLoading(true);
      const res = await api.get('/ics/findings/reports/list');
      setReports(res.data ?? []);
    } catch {
      // silently handle — table will show empty state
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch sessions
    (async () => {
      try {
        setSessionsLoading(true);
        const res = await api.get('/ics/sessions/');
        const data: Session[] = res.data ?? [];
        setSessions(data);
        if (data.length > 0) {
          setSelectedSession(data[0].id);
        }
      } catch {
        // silently handle — dropdown will show empty state
      } finally {
        setSessionsLoading(false);
      }
    })();

    // Fetch existing reports
    fetchReports();
  }, [fetchReports]);

  const handleGenerate = async () => {
    setFeedback(null);
    if (!selectedSession) {
      setFeedback({
        ok: false,
        message: 'No source session selected. Upload a PCAP to create a session first.',
      });
      return;
    }
    setGenerating(true);
    try {
      // Field names and section/report_type enums must match the backend
      // ReportRequest schema exactly; otherwise the endpoint 422s silently.
      const payload = {
        session_id: selectedSession,
        report_type: reportType,
        client_name: clientName,
        assessor_name: assessor,
        sections: Object.entries(sectionChecks)
          .filter(([, v]) => v)
          .map(([k]) => k),
      };
      await api.post('/ics/findings/reports/generate', payload);
      setFeedback({ ok: true, message: 'Report generation started. Refreshing list...' });
      await fetchReports();
    } catch (err: unknown) {
      let message = 'Report generation failed.';
      if (err && typeof err === 'object' && 'response' in err) {
        const resp = (err as { response?: { data?: unknown } }).response;
        const detail = (resp?.data as { detail?: unknown })?.detail;
        if (typeof detail === 'string') {
          message = detail;
        } else if (Array.isArray(detail) && detail.length > 0) {
          // Pydantic validation errors
          message = detail
            .map((d: { loc?: unknown[]; msg?: string }) =>
              `${(d.loc ?? []).slice(-1)[0] ?? 'field'}: ${d.msg ?? 'invalid'}`,
            )
            .join('; ');
        }
      }
      setFeedback({ ok: false, message });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (reportId: string | number) => {
    try {
      const res = await api.get(`/ics/findings/reports/${reportId}/download`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Try to extract filename from Content-Disposition header
      const disposition = res.headers['content-disposition'];
      const match = disposition?.match(/filename="?([^"]+)"?/);
      a.download = match?.[1] ?? `report_${reportId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      // download failed
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2">
          <FileText size={24} className="text-accent" /> Assessment Reports
        </h1>
        <p className="text-sm text-content-secondary mt-1">Generate professional PDF reports from passive network analysis</p>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Left: Report Builder */}
        <div className="col-span-3 space-y-4">
          {/* Report Type */}
          <div className="rounded-lg border border-border-default bg-surface-card p-4 space-y-3">
            <p className="text-sm font-medium text-content-primary">Report Type</p>
            <div className="grid grid-cols-2 gap-2">
              {REPORT_TYPES.map((rt) => (
                <button key={rt.id} onClick={() => setReportType(rt.id)} className={`text-left rounded-md border p-2.5 transition-all ${reportType === rt.id ? 'border-accent bg-accent/10 ring-1 ring-accent/30' : 'border-border-default bg-bg-secondary hover:border-border-hover'}`}>
                  <span className={`text-xs font-semibold ${reportType === rt.id ? 'text-accent' : 'text-content-primary'}`}>{rt.label}</span>
                  <span className="block text-[10px] text-content-tertiary mt-0.5">{rt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Source Session */}
          <div className="rounded-lg border border-border-default bg-surface-card p-4 space-y-3">
            <p className="text-sm font-medium text-content-primary">Source Session</p>
            {sessionsLoading ? (
              <div className="flex items-center gap-2 text-xs text-content-tertiary py-1.5">
                <Loader2 size={14} className="animate-spin" /> Loading sessions...
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-content-tertiary py-1.5">No sessions available. Upload a PCAP to create one.</p>
            ) : (
              <select value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)} className="w-full rounded border border-border-default bg-bg-secondary text-content-primary text-sm px-3 py-1.5">
                {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>

          {/* Sections */}
          <div className="rounded-lg border border-border-default bg-surface-card p-4 space-y-3">
            <p className="text-sm font-medium text-content-primary">Report Sections</p>
            <div className="space-y-1">
              {SECTIONS.map((s) => (
                <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-hover cursor-pointer">
                  <input type="checkbox" checked={sectionChecks[s.id]} disabled={s.locked} onChange={(e) => setSectionChecks({ ...sectionChecks, [s.id]: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-border-default text-accent" />
                  <span className="text-xs text-content-primary flex-1">{s.label}</span>
                  {s.locked && <Lock size={10} className="text-content-tertiary" />}
                </label>
              ))}
            </div>
          </div>

          {/* Client Info */}
          <div className="rounded-lg border border-border-default bg-surface-card p-4 space-y-3">
            <p className="text-sm font-medium text-content-primary">Report Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-content-tertiary mb-1"><Building2 size={10} className="inline mr-1" />Client Name</label>
                <input value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full rounded border border-border-default bg-bg-secondary text-content-primary text-xs px-2.5 py-1.5" />
              </div>
              <div>
                <label className="block text-[10px] text-content-tertiary mb-1"><User size={10} className="inline mr-1" />Assessor</label>
                <input value={assessor} onChange={(e) => setAssessor(e.target.value)} className="w-full rounded border border-border-default bg-bg-secondary text-content-primary text-xs px-2.5 py-1.5" />
              </div>
              <div>
                <label className="block text-[10px] text-content-tertiary mb-1"><Calendar size={10} className="inline mr-1" />Assessment Date</label>
                <input type="date" defaultValue="2024-03-15" className="w-full rounded border border-border-default bg-bg-secondary text-content-primary text-xs px-2.5 py-1.5" />
              </div>
              <div>
                <label className="block text-[10px] text-content-tertiary mb-1"><Lock size={10} className="inline mr-1" />Classification</label>
                <select value={classification} onChange={(e) => setClassification(e.target.value)} className="w-full rounded border border-border-default bg-bg-secondary text-content-primary text-xs px-2.5 py-1.5">
                  <option value="confidential">Confidential</option>
                  <option value="internal">Internal</option>
                  <option value="public">Public</option>
                </select>
              </div>
            </div>
          </div>

          {feedback && (
            <div
              className={`flex items-start gap-2 rounded-md border p-3 text-xs ${
                feedback.ok
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-red-500/30 bg-red-500/10 text-red-300'
              }`}
            >
              {feedback.ok ? (
                <CheckCircle size={14} className="flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleGenerate}
            loading={generating}
            disabled={!selectedSession || generating}
          >
            <FileText size={16} /> Generate Report
          </Button>
        </div>

        {/* Right: Preview */}
        <div className="col-span-2 space-y-4">
          <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
            <div className="bg-bg-secondary p-6 text-center border-b border-border-default relative">
              {classification === 'confidential' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-4xl font-bold text-red-500/10 rotate-[-30deg]">CONFIDENTIAL</span>
                </div>
              )}
              <div className="w-12 h-12 rounded-xl bg-accent/15 mx-auto flex items-center justify-center mb-3">
                <Shield size={24} className="text-accent" />
              </div>
              <p className="text-lg font-bold text-content-primary">Gridwolf</p>
              <p className="text-xs text-content-secondary mt-1">{REPORT_TYPES.find((r) => r.id === reportType)?.label}</p>
              <div className="mt-4 space-y-1">
                <p className="text-xs text-content-primary font-medium">{clientName}</p>
                <p className="text-[10px] text-content-tertiary">Assessor: {assessor}</p>
                <p className="text-[10px] text-content-tertiary">March 15, 2024</p>
                <span className={`inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-medium ${
                  classification === 'confidential' ? 'bg-red-500/15 text-red-400' :
                  classification === 'internal' ? 'bg-amber-500/15 text-amber-400' :
                  'bg-emerald-500/15 text-emerald-400'
                }`}>{classification.toUpperCase()}</span>
              </div>
            </div>
            <div className="p-4">
              <p className="text-xs font-medium text-content-secondary mb-2">Table of Contents</p>
              <div className="space-y-1">
                {SECTIONS.filter((s) => sectionChecks[s.id]).map((s, i) => (
                  <div key={s.id} className="flex items-center justify-between text-[11px]">
                    <span className="text-content-primary">{i + 1}. {s.label}</span>
                    <span className="text-content-tertiary">{(i + 1) * 3 + 1}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-border-default flex justify-between text-[10px] text-content-tertiary">
                <span>~{SECTIONS.filter((s) => sectionChecks[s.id]).length * 4 + 2} pages</span>
                <span>~{(SECTIONS.filter((s) => sectionChecks[s.id]).length * 0.4 + 0.5).toFixed(1)} MB</span>
              </div>
            </div>
          </div>

          {/* Export Options */}
          <div className="rounded-lg border border-border-default bg-surface-card p-4 space-y-2">
            <p className="text-sm font-medium text-content-primary mb-2">Export Formats</p>
            {EXPORTS.map((ex) => (
              <button key={ex.label} className={`w-full flex items-start gap-3 p-2.5 rounded-md text-left transition-colors ${ex.primary ? 'bg-accent/10 border border-accent/30' : 'hover:bg-surface-hover border border-transparent'}`}>
                <ex.icon size={16} className={ex.primary ? 'text-accent mt-0.5' : 'text-content-tertiary mt-0.5'} />
                <div>
                  <span className={`text-xs font-medium ${ex.primary ? 'text-accent' : 'text-content-primary'}`}>{ex.label}</span>
                  <p className="text-[10px] text-content-tertiary">{ex.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Generated Reports Table */}
      <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border-default">
          <p className="text-sm font-medium text-content-primary">Generated Reports</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default text-xs text-content-tertiary">
              <th className="text-left px-4 py-2 font-medium">Report</th>
              <th className="text-left px-4 py-2 font-medium">Type</th>
              <th className="text-left px-4 py-2 font-medium">Date</th>
              <th className="text-right px-4 py-2 font-medium">Pages</th>
              <th className="text-right px-4 py-2 font-medium">Size</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-right px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reportsLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-content-tertiary text-xs">
                  <Loader2 size={16} className="animate-spin inline mr-2" />Loading reports...
                </td>
              </tr>
            ) : reports.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-content-tertiary text-xs">
                  No reports generated yet. Configure a report above and click Generate.
                </td>
              </tr>
            ) : (
              reports.map((r) => (
                <tr key={r.id} className="border-b border-border-default last:border-0 hover:bg-surface-hover">
                  <td className="px-4 py-2.5 text-content-primary font-medium">{r.name}</td>
                  <td className="px-4 py-2.5"><span className="px-1.5 py-0.5 rounded text-[10px] bg-accent/15 text-accent">{r.type}</span></td>
                  <td className="px-4 py-2.5 text-content-secondary">{r.date}</td>
                  <td className="px-4 py-2.5 text-right text-content-secondary">{r.pages || '-'}</td>
                  <td className="px-4 py-2.5 text-right text-content-secondary">{r.size}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      r.status === 'ready' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                    }`}>
                      {r.status === 'ready' ? <Check size={10} /> : <Loader2 size={10} className="animate-spin" />}
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => handleDownload(r.id)} disabled={r.status !== 'ready'} className="p-1 rounded hover:bg-surface-hover text-content-tertiary hover:text-accent disabled:opacity-30"><Download size={14} /></button>
                      <button className="p-1 rounded hover:bg-surface-hover text-content-tertiary hover:text-accent disabled:opacity-30" disabled={r.status !== 'ready'}><Eye size={14} /></button>
                      <button className="p-1 rounded hover:bg-surface-hover text-content-tertiary hover:text-red-400"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
