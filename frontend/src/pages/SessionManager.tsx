import { useState } from 'react';
import {
  FolderOpen, Plus, Archive, Trash2, Download, Eye, GitCompare,
  Calendar, User, Building2, FileArchive, Database, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

const SESSIONS = [
  { id: 1, name: 'Plant Floor Assessment', status: 'active' as const, pcaps: 3, devices: 20, findings: 23, created: '2024-03-01', modified: '2024-03-15', baseline: false, drift: null },
  { id: 2, name: 'SCADA Network Baseline', status: 'baseline' as const, pcaps: 2, devices: 18, findings: 15, created: '2024-01-15', modified: '2024-01-20', baseline: true, drift: null },
  { id: 3, name: 'Substation ICS Audit', status: 'archived' as const, pcaps: 1, devices: 12, findings: 8, created: '2023-11-10', modified: '2023-11-15', baseline: false, drift: '12%' },
  { id: 4, name: 'Quarterly Review Q1', status: 'active' as const, pcaps: 4, devices: 22, findings: 28, created: '2024-03-10', modified: '2024-03-15', baseline: false, drift: '23%' },
  { id: 5, name: 'Emergency Investigation', status: 'active' as const, pcaps: 1, devices: 5, findings: 3, created: '2024-03-14', modified: '2024-03-14', baseline: false, drift: null },
];

const PROJECTS = [
  { id: 1, name: 'Acme Energy OT Assessment', client: 'Acme Energy Corp', assessor: 'Jane Smith', start: '2024-01-15', end: '2024-03-31', sessions: 3, status: 'active' as const },
  { id: 2, name: 'Metro Water Authority', client: 'Metro Water', assessor: 'Bob Chen', start: '2023-11-01', end: '2023-12-15', sessions: 2, status: 'completed' as const },
  { id: 3, name: 'National Grid Substation', client: 'National Grid', assessor: 'Jane Smith', start: '2023-10-01', end: '2023-10-31', sessions: 1, status: 'archived' as const },
];

export default function SessionManager() {
  const [tab, setTab] = useState<'sessions' | 'projects'>('sessions');

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2"><FolderOpen size={24} className="text-accent" /> Sessions & Projects</h1>
          <p className="text-sm text-content-secondary mt-1">Manage assessment sessions, .kkj archives, and project engagements</p>
        </div>
        <Button variant="primary" size="md"><Plus size={16} /> {tab === 'sessions' ? 'New Session' : 'New Project'}</Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex gap-1 rounded-lg bg-surface-card border border-border-default p-1">
          {(['sessions', 'projects'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${tab === t ? 'bg-accent text-white' : 'text-content-secondary hover:bg-surface-hover'}`}>{t}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-content-tertiary">
          <Database size={12} /> Sessions stored in SQLite &middot; <FileArchive size={12} /> Export as .kkj (portable ZIP archive)
        </div>
      </div>

      {tab === 'sessions' && (
        <div className="space-y-3">
          {SESSIONS.map((s) => (
            <div key={s.id} className={`rounded-lg border bg-surface-card p-4 hover:border-border-hover transition-colors ${s.baseline ? 'border-blue-500/30' : 'border-border-default'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-bold text-content-primary">{s.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    s.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' :
                    s.status === 'baseline' ? 'bg-blue-500/15 text-blue-400' :
                    'bg-border-default text-content-tertiary'
                  }`}>{s.status === 'baseline' ? 'Baseline' : s.status}</span>
                  {s.drift && <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/15 text-amber-400">Drift: {s.drift}</span>}
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-1.5 rounded hover:bg-surface-hover text-content-tertiary hover:text-accent" title="Open"><Eye size={14} /></button>
                  <button className="p-1.5 rounded hover:bg-surface-hover text-content-tertiary hover:text-accent" title="Export .kkj"><Download size={14} /></button>
                  {!s.baseline && <button className="p-1.5 rounded hover:bg-surface-hover text-content-tertiary hover:text-blue-400" title="Set as Baseline"><GitCompare size={14} /></button>}
                  <button className="p-1.5 rounded hover:bg-surface-hover text-content-tertiary hover:text-accent" title="Archive"><Archive size={14} /></button>
                  <button className="p-1.5 rounded hover:bg-surface-hover text-content-tertiary hover:text-red-400" title="Delete"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="flex items-center gap-6 text-xs text-content-secondary">
                <span>{s.pcaps} PCAPs</span>
                <span className="text-content-primary font-medium">{s.devices} devices</span>
                <span>{s.findings} findings</span>
                <span className="text-content-tertiary flex items-center gap-1"><Calendar size={10} /> {s.created}</span>
                <span className="text-content-tertiary flex items-center gap-1"><Clock size={10} /> Modified: {s.modified}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'projects' && (
        <div className="space-y-3">
          {PROJECTS.map((p) => (
            <div key={p.id} className="rounded-lg border border-border-default bg-surface-card p-4 hover:border-border-hover transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-bold text-content-primary">{p.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    p.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' :
                    p.status === 'completed' ? 'bg-blue-500/15 text-blue-400' :
                    'bg-border-default text-content-tertiary'
                  }`}>{p.status}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm"><Plus size={12} /> Add Session</Button>
                  <button className="p-1.5 rounded hover:bg-surface-hover text-content-tertiary hover:text-accent"><Eye size={14} /></button>
                  <button className="p-1.5 rounded hover:bg-surface-hover text-content-tertiary hover:text-accent"><Archive size={14} /></button>
                </div>
              </div>
              <div className="flex items-center gap-6 text-xs text-content-secondary">
                <span className="flex items-center gap-1"><Building2 size={10} /> {p.client}</span>
                <span className="flex items-center gap-1"><User size={10} /> {p.assessor}</span>
                <span className="flex items-center gap-1"><Calendar size={10} /> {p.start} - {p.end}</span>
                <span className="font-medium text-content-primary">{p.sessions} sessions</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
