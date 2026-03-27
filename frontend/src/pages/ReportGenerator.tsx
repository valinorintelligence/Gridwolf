import { useState } from 'react';
import {
  FileText, Download, Eye, Trash2, FileSpreadsheet, Shield,
  Check, Loader2, Lock, Calendar, User, Building2,
  FileJson, Package, ClipboardList
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

const REPORT_TYPES = [
  { id: 'executive', label: 'Executive Summary', desc: 'High-level findings for management' },
  { id: 'full', label: 'Full Technical Assessment', desc: 'Comprehensive technical report' },
  { id: 'device', label: 'Device Inventory Report', desc: 'All discovered devices and properties' },
  { id: 'compliance', label: 'Compliance Report', desc: 'IEC 62443 / NIST 800-82 / NERC CIP' },
  { id: 'findings', label: 'Findings & Remediation', desc: 'Security findings with fix guidance' },
];

const SESSIONS = [
  'Plant Floor Assessment - Mar 2024',
  'SCADA Network Baseline - Feb 2024',
  'Substation ICS Audit - Jan 2024',
  'Quarterly Review Q4 2023',
];

const SECTIONS = [
  { id: 'exec', label: 'Executive Summary', locked: true },
  { id: 'topo', label: 'Network Topology Map' },
  { id: 'assets', label: 'Asset Inventory' },
  { id: 'protocols', label: 'Protocol Analysis Summary' },
  { id: 'purdue', label: 'Purdue Model Assessment' },
  { id: 'findings', label: 'Security Findings (ATT&CK Mapped)' },
  { id: 'cve', label: 'CVE Matches' },
  { id: 'compliance', label: 'Compliance Status' },
  { id: 'matrix', label: 'Communication Matrix' },
  { id: 'remediation', label: 'Recommendations & Remediation' },
  { id: 'appendix', label: 'Appendix: Raw Data Tables' },
];

const GENERATED_REPORTS = [
  { id: 1, name: 'Plant Floor Full Assessment', type: 'Full Technical', date: '2024-03-15', pages: 48, size: '4.2 MB', status: 'ready' as const },
  { id: 2, name: 'SCADA Executive Summary', type: 'Executive', date: '2024-03-10', pages: 12, size: '1.1 MB', status: 'ready' as const },
  { id: 3, name: 'IEC 62443 Compliance Audit', type: 'Compliance', date: '2024-03-08', pages: 32, size: '3.5 MB', status: 'ready' as const },
  { id: 4, name: 'Substation Device Inventory', type: 'Device Inventory', date: '2024-03-05', pages: 18, size: '2.0 MB', status: 'ready' as const },
  { id: 5, name: 'Q1 Findings Report', type: 'Findings', date: '2024-03-01', pages: 0, size: '-', status: 'generating' as const },
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
  const [session, setSession] = useState(SESSIONS[0]);
  const [sections, setSections] = useState<Record<string, boolean>>(
    Object.fromEntries(SECTIONS.map((s) => [s.id, true]))
  );
  const [clientName, setClientName] = useState('Acme Energy Corp');
  const [assessor, setAssessor] = useState('Jane Smith');
  const [classification, setClassification] = useState('confidential');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => setGenerating(false), 3000);
  };

  const handleDownload = (name: string) => {
    alert(`Downloading: ${name}.pdf`);
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
            <select value={session} onChange={(e) => setSession(e.target.value)} className="w-full rounded border border-border-default bg-bg-secondary text-content-primary text-sm px-3 py-1.5">
              {SESSIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* Sections */}
          <div className="rounded-lg border border-border-default bg-surface-card p-4 space-y-3">
            <p className="text-sm font-medium text-content-primary">Report Sections</p>
            <div className="space-y-1">
              {SECTIONS.map((s) => (
                <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-hover cursor-pointer">
                  <input type="checkbox" checked={sections[s.id]} disabled={s.locked} onChange={(e) => setSections({ ...sections, [s.id]: e.target.checked })}
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

          <Button variant="primary" size="lg" className="w-full" onClick={handleGenerate} loading={generating}>
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
                {SECTIONS.filter((s) => sections[s.id]).map((s, i) => (
                  <div key={s.id} className="flex items-center justify-between text-[11px]">
                    <span className="text-content-primary">{i + 1}. {s.label}</span>
                    <span className="text-content-tertiary">{(i + 1) * 3 + 1}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-border-default flex justify-between text-[10px] text-content-tertiary">
                <span>~{SECTIONS.filter((s) => sections[s.id]).length * 4 + 2} pages</span>
                <span>~{(SECTIONS.filter((s) => sections[s.id]).length * 0.4 + 0.5).toFixed(1)} MB</span>
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
            {GENERATED_REPORTS.map((r) => (
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
                    <button onClick={() => handleDownload(r.name)} disabled={r.status !== 'ready'} className="p-1 rounded hover:bg-surface-hover text-content-tertiary hover:text-accent disabled:opacity-30"><Download size={14} /></button>
                    <button className="p-1 rounded hover:bg-surface-hover text-content-tertiary hover:text-accent disabled:opacity-30" disabled={r.status !== 'ready'}><Eye size={14} /></button>
                    <button className="p-1 rounded hover:bg-surface-hover text-content-tertiary hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
