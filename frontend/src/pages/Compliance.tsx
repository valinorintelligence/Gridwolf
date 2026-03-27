import { useState } from 'react';
import {
  ClipboardCheck, Check, X, AlertTriangle, ChevronDown,
  ChevronRight, Download, Minus
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

const IEC_ZONES = [
  { name: 'Process Control (L1-L2)', slTarget: 3, slAchieved: 2, status: 'gap' as const },
  { name: 'Supervisory (L3)', slTarget: 2, slAchieved: 2, status: 'pass' as const },
  { name: 'Enterprise DMZ', slTarget: 3, slAchieved: 1, status: 'critical' as const },
  { name: 'Safety (SIS)', slTarget: 4, slAchieved: 3, status: 'gap' as const },
  { name: 'Remote Access', slTarget: 3, slAchieved: 2, status: 'gap' as const },
];

const IEC_FRS = [
  { id: 'FR 1', name: 'Identification & Authentication', met: 4, total: 7, reqs: [
    { id: 'SR 1.1', name: 'Human user identification', status: 'pass' }, { id: 'SR 1.2', name: 'Software process ID', status: 'fail' },
    { id: 'SR 1.3', name: 'Account management', status: 'pass' }, { id: 'SR 1.5', name: 'Authenticator management', status: 'fail' },
    { id: 'SR 1.7', name: 'Password strength', status: 'pass' },
  ]},
  { id: 'FR 2', name: 'Use Control', met: 3, total: 5, reqs: [
    { id: 'SR 2.1', name: 'Authorization enforcement', status: 'pass' }, { id: 'SR 2.3', name: 'Portable device control', status: 'fail' },
    { id: 'SR 2.5', name: 'Session lock', status: 'pass' },
  ]},
  { id: 'FR 3', name: 'System Integrity', met: 5, total: 8, reqs: [
    { id: 'SR 3.1', name: 'Communication integrity', status: 'fail' }, { id: 'SR 3.2', name: 'Malicious code protection', status: 'pass' },
    { id: 'SR 3.5', name: 'Input validation', status: 'pass' },
  ]},
  { id: 'FR 4', name: 'Data Confidentiality', met: 2, total: 4, reqs: [
    { id: 'SR 4.1', name: 'Information confidentiality', status: 'fail' }, { id: 'SR 4.3', name: 'Use of cryptography', status: 'fail' },
  ]},
  { id: 'FR 5', name: 'Restricted Data Flow', met: 3, total: 6, reqs: [
    { id: 'SR 5.1', name: 'Network segmentation', status: 'partial' }, { id: 'SR 5.2', name: 'Zone boundary protection', status: 'fail' },
  ]},
  { id: 'FR 6', name: 'Timely Response to Events', met: 4, total: 5, reqs: [
    { id: 'SR 6.1', name: 'Audit log accessibility', status: 'pass' }, { id: 'SR 6.4', name: 'Event correlation', status: 'fail' },
  ]},
  { id: 'FR 7', name: 'Resource Availability', met: 3, total: 4, reqs: [
    { id: 'SR 7.1', name: 'DoS protection', status: 'pass' }, { id: 'SR 7.3', name: 'System backup', status: 'fail' },
  ]},
];

const NERC_CIP = [
  { id: 'CIP-002', name: 'BES Cyber System Categorization', status: 'pass', pct: 100 },
  { id: 'CIP-003', name: 'Security Management Controls', status: 'partial', pct: 75 },
  { id: 'CIP-005', name: 'Electronic Security Perimeters', status: 'fail', pct: 45 },
  { id: 'CIP-007', name: 'System Security Management', status: 'partial', pct: 68 },
  { id: 'CIP-010', name: 'Configuration Change Management', status: 'fail', pct: 40 },
  { id: 'CIP-013', name: 'Supply Chain Risk Management', status: 'fail', pct: 30 },
];

const TABS = ['IEC 62443', 'NIST SP 800-82', 'NERC CIP'] as const;
const statusIcon = (s: string) => s === 'pass' ? <Check size={12} className="text-emerald-400" /> : s === 'fail' ? <X size={12} className="text-red-400" /> : s === 'partial' ? <Minus size={12} className="text-amber-400" /> : <span className="text-[10px] text-content-tertiary">N/A</span>;

export default function Compliance() {
  const [tab, setTab] = useState<typeof TABS[number]>('IEC 62443');
  const [expandedFR, setExpandedFR] = useState<string | null>('FR 1');
  const iecScore = Math.round(IEC_FRS.reduce((s, f) => s + f.met, 0) / IEC_FRS.reduce((s, f) => s + f.total, 0) * 100);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2"><ClipboardCheck size={24} className="text-accent" /> Compliance Mapping</h1>
          <p className="text-sm text-content-secondary mt-1">Automated compliance assessment against ICS/OT security frameworks</p>
        </div>
        <Button variant="outline" size="sm"><Download size={14} /> Export Report</Button>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-3 gap-4">
        {[{ name: 'IEC 62443', score: iecScore }, { name: 'NIST SP 800-82', score: 68 }, { name: 'NERC CIP', score: 60 }].map((f) => (
          <div key={f.name} className="rounded-lg border border-border-default bg-surface-card p-4 flex items-center gap-4">
            <div className="relative w-16 h-16">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90"><circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className="text-border-default" strokeWidth="8" /><circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className={f.score >= 75 ? 'text-emerald-400' : f.score >= 50 ? 'text-amber-400' : 'text-red-400'} strokeWidth="8" strokeDasharray={`${f.score * 2.51} 251`} strokeLinecap="round" /></svg>
              <div className="absolute inset-0 flex items-center justify-center"><span className="text-sm font-bold text-content-primary">{f.score}%</span></div>
            </div>
            <div><p className="text-sm font-medium text-content-primary">{f.name}</p><p className={`text-xs ${f.score >= 75 ? 'text-emerald-400' : f.score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{f.score >= 75 ? 'Good' : f.score >= 50 ? 'Needs improvement' : 'Below threshold'}</p></div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 rounded-lg bg-surface-card border border-border-default p-1 w-fit">
        {TABS.map((t) => (<button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === t ? 'bg-accent text-white' : 'text-content-secondary hover:bg-surface-hover'}`}>{t}</button>))}
      </div>

      {tab === 'IEC 62443' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border-default bg-surface-card p-4">
            <p className="text-sm font-medium text-content-primary mb-3">Zone / Conduit Assessment</p>
            <div className="grid grid-cols-5 gap-2">
              {IEC_ZONES.map((z) => (
                <div key={z.name} className={`rounded-lg border p-3 ${z.status === 'critical' ? 'border-red-500/30 bg-red-500/5' : z.status === 'gap' ? 'border-amber-500/30 bg-amber-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}>
                  <p className="text-xs font-medium text-content-primary">{z.name}</p>
                  <div className="flex gap-2 mt-1 text-[10px] text-content-tertiary"><span>SL-T:{z.slTarget}</span><span>SL-A:{z.slAchieved}</span></div>
                  <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${z.status === 'pass' ? 'bg-emerald-500/15 text-emerald-400' : z.status === 'gap' ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400'}`}>{z.status === 'pass' ? 'PASS' : z.status === 'gap' ? 'GAP' : 'CRITICAL'}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
            {IEC_FRS.map((fr) => (
              <div key={fr.id}>
                <button onClick={() => setExpandedFR(expandedFR === fr.id ? null : fr.id)} className="w-full flex items-center justify-between px-4 py-2.5 border-b border-border-default hover:bg-surface-hover">
                  <div className="flex items-center gap-3">{expandedFR === fr.id ? <ChevronDown size={12} className="text-content-tertiary" /> : <ChevronRight size={12} className="text-content-tertiary" />}<span className="text-xs font-medium text-accent">{fr.id}</span><span className="text-xs text-content-primary">{fr.name}</span></div>
                  <div className="flex items-center gap-2"><div className="w-20 h-1.5 rounded-full bg-bg-secondary overflow-hidden"><div className={`h-full rounded-full ${fr.met/fr.total >= 0.75 ? 'bg-emerald-500' : fr.met/fr.total >= 0.5 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${(fr.met/fr.total)*100}%` }} /></div><span className="text-[10px] text-content-tertiary">{fr.met}/{fr.total}</span></div>
                </button>
                {expandedFR === fr.id && <div className="bg-bg-secondary border-b border-border-default">{fr.reqs.map((r) => (<div key={r.id} className="flex items-center gap-3 px-8 py-1.5 text-xs">{statusIcon(r.status)}<span className="font-mono text-content-tertiary w-12">{r.id}</span><span className="text-content-primary">{r.name}</span></div>))}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'NIST SP 800-82' && (
        <div className="rounded-lg border border-border-default bg-surface-card p-4 space-y-3">
          <p className="text-sm font-medium text-content-primary">NIST SP 800-82 Rev. 3</p>
          {['5.1 Risk Management', '5.2 Security Architecture', '5.3 Network Segmentation', '5.4 Access Control', '5.5 Monitoring', '6.1 Assessment', '6.2 Patch Management', '6.3 Incident Response'].map((s, i) => {
            const pct = [85, 60, 45, 72, 80, 68, 40, 75][i];
            return (<div key={s} className="flex items-center gap-3">{statusIcon(pct >= 70 ? 'pass' : pct >= 50 ? 'partial' : 'fail')}<span className="text-xs text-content-primary w-48">{s}</span><div className="flex-1 h-2 rounded-full bg-bg-secondary overflow-hidden"><div className={`h-full rounded-full ${pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} /></div><span className="text-[10px] text-content-tertiary w-8 text-right">{pct}%</span></div>);
          })}
        </div>
      )}

      {tab === 'NERC CIP' && (
        <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border-default text-content-tertiary"><th className="text-left px-4 py-2 font-medium">Standard</th><th className="text-left px-4 py-2 font-medium">Name</th><th className="text-left px-4 py-2 font-medium">Status</th><th className="text-left px-4 py-2 font-medium">Compliance</th></tr></thead>
            <tbody>{NERC_CIP.map((c) => (
              <tr key={c.id} className="border-b border-border-default last:border-0 hover:bg-surface-hover">
                <td className="px-4 py-2 font-mono text-accent">{c.id}</td><td className="px-4 py-2 text-content-primary">{c.name}</td>
                <td className="px-4 py-2">{statusIcon(c.status)}</td>
                <td className="px-4 py-2"><div className="flex items-center gap-2"><div className="w-20 h-1.5 rounded-full bg-bg-secondary overflow-hidden"><div className={`h-full rounded-full ${c.pct >= 70 ? 'bg-emerald-500' : c.pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${c.pct}%` }} /></div><span className="text-content-tertiary">{c.pct}%</span></div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
