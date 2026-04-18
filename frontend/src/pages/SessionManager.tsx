import { useState, useEffect } from 'react';
import {
  FolderOpen, Plus, Archive, Trash2, Download, Eye, GitCompare,
  Calendar, User, Building2, FileArchive, Database, Clock, Loader2, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api } from '@/services/api';

// ─── Types ────────────────────────────────────────────────────

interface Session {
  id: string | number;
  name: string;
  status: string;
  device_count?: number;
  connection_count?: number;
  finding_count?: number;
  pcaps?: number;
  devices?: number;
  findings?: number;
  created_at?: string;
  modified_at?: string;
  baseline?: boolean;
  drift?: string | null;
}

interface Project {
  id: string | number;
  name: string;
  client?: string;
  assessor?: string;
  start_date?: string;
  end_date?: string;
  session_count?: number;
  sessions?: number;
  status: string;
}

// ─── Component ────────────────────────────────────────────────

export default function SessionManager() {
  const [tab, setTab] = useState<'sessions' | 'projects'>('sessions');

  const [sessions, setSessions] = useState<Session[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [errorSessions, setErrorSessions] = useState<string | null>(null);
  const [errorProjects, setErrorProjects] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingSessions(true);
    setErrorSessions(null);

    api
      .get<Session[]>('/ics/sessions/')
      .then((res) => {
        if (!cancelled) {
          setSessions(Array.isArray(res.data) ? res.data : []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorSessions(err?.response?.data?.detail || 'Failed to load sessions');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSessions(false);
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingProjects(true);
    setErrorProjects(null);

    api
      .get<Project[]>('/ics/sessions/projects/list')
      .then((res) => {
        if (!cancelled) {
          setProjects(Array.isArray(res.data) ? res.data : []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorProjects(err?.response?.data?.detail || 'Failed to load projects');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingProjects(false);
      });

    return () => { cancelled = true; };
  }, []);

  const handleNewSession = () => {
    const name = window.prompt('Session name:');
    if (!name) return;
    api
      .post('/ics/sessions/', { name })
      .then((res) => {
        setSessions((prev) => [res.data, ...prev]);
      })
      .catch(() => {
        // ignore — in production replace with toast notification
      });
  };

  const handleNewProject = () => {
    const name = window.prompt('Project name:');
    if (!name) return;
    api
      .post('/ics/sessions/projects', { name })
      .then((res) => {
        setProjects((prev) => [res.data, ...prev]);
      })
      .catch(() => {
        // ignore — in production replace with toast notification
      });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2">
            <FolderOpen size={24} className="text-accent" /> Sessions &amp; Projects
          </h1>
          <p className="text-sm text-content-secondary mt-1">Manage assessment sessions, .kkj archives, and project engagements</p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={tab === 'sessions' ? handleNewSession : handleNewProject}
        >
          <Plus size={16} /> {tab === 'sessions' ? 'New Session' : 'New Project'}
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex gap-1 rounded-lg bg-surface-card border border-border-default p-1">
          {(['sessions', 'projects'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${tab === t ? 'bg-accent text-white' : 'text-content-secondary hover:bg-surface-hover'}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-content-tertiary">
          <Database size={12} /> Sessions stored in SQLite &middot; <FileArchive size={12} /> Export as .kkj (portable ZIP archive)
        </div>
      </div>

      {/* Sessions Tab */}
      {tab === 'sessions' && (
        <>
          {loadingSessions && (
            <div className="rounded-lg border border-border-default bg-surface-card py-14 flex flex-col items-center justify-center gap-3">
              <Loader2 size={28} className="animate-spin text-accent" />
              <p className="text-sm text-content-secondary">Loading sessions...</p>
            </div>
          )}
          {!loadingSessions && errorSessions && (
            <div className="rounded-lg border border-red-500/30 bg-surface-card py-12 flex flex-col items-center justify-center gap-3">
              <AlertTriangle size={28} className="text-red-400" />
              <p className="text-sm text-content-secondary">{errorSessions}</p>
            </div>
          )}
          {!loadingSessions && !errorSessions && sessions.length === 0 && (
            <div className="rounded-lg border border-border-default bg-surface-card py-14 flex flex-col items-center justify-center gap-3">
              <FolderOpen size={36} className="text-content-muted" />
              <p className="text-sm font-medium text-content-secondary">No sessions yet</p>
              <p className="text-xs text-content-tertiary">Create a new session to start an assessment</p>
            </div>
          )}
          {!loadingSessions && !errorSessions && sessions.length > 0 && (
            <div className="space-y-3">
              {sessions.map((s) => {
                const deviceCount = s.device_count ?? s.devices ?? 0;
                const findingCount = s.finding_count ?? s.findings ?? 0;
                const pcapCount = s.pcaps ?? 0;
                const createdAt = s.created_at ?? '';
                const modifiedAt = s.modified_at ?? '';

                return (
                  <div
                    key={String(s.id)}
                    className={`rounded-lg border bg-surface-card p-4 hover:border-border-hover transition-colors ${s.baseline ? 'border-blue-500/30' : 'border-border-default'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <h3 className="text-sm font-bold text-content-primary">{s.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          s.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' :
                          s.status === 'baseline' ? 'bg-blue-500/15 text-blue-400' :
                          'bg-border-default text-content-tertiary'
                        }`}>
                          {s.status === 'baseline' ? 'Baseline' : s.status}
                        </span>
                        {s.drift && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/15 text-amber-400">
                            Drift: {s.drift}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button className="p-1.5 rounded hover:bg-surface-hover text-content-tertiary hover:text-accent" title="Open"><Eye size={14} /></button>
                        <button className="p-1.5 rounded hover:bg-surface-hover text-content-tertiary hover:text-accent" title="Export .kkj"><Download size={14} /></button>
                        {!s.baseline && (
                          <button className="p-1.5 rounded hover:bg-surface-hover text-content-tertiary hover:text-blue-400" title="Set as Baseline"><GitCompare size={14} /></button>
                        )}
                        <button className="p-1.5 rounded hover:bg-surface-hover text-content-tertiary hover:text-accent" title="Archive"><Archive size={14} /></button>
                        <button className="p-1.5 rounded hover:bg-surface-hover text-content-tertiary hover:text-red-400" title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-xs text-content-secondary">
                      {pcapCount > 0 && <span>{pcapCount} PCAPs</span>}
                      <span className="text-content-primary font-medium">{deviceCount} devices</span>
                      <span>{findingCount} findings</span>
                      {createdAt && (
                        <span className="text-content-tertiary flex items-center gap-1">
                          <Calendar size={10} /> {createdAt.slice(0, 10)}
                        </span>
                      )}
                      {modifiedAt && (
                        <span className="text-content-tertiary flex items-center gap-1">
                          <Clock size={10} /> Modified: {modifiedAt.slice(0, 10)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Projects Tab */}
      {tab === 'projects' && (
        <>
          {loadingProjects && (
            <div className="rounded-lg border border-border-default bg-surface-card py-14 flex flex-col items-center justify-center gap-3">
              <Loader2 size={28} className="animate-spin text-accent" />
              <p className="text-sm text-content-secondary">Loading projects...</p>
            </div>
          )}
          {!loadingProjects && errorProjects && (
            <div className="rounded-lg border border-red-500/30 bg-surface-card py-12 flex flex-col items-center justify-center gap-3">
              <AlertTriangle size={28} className="text-red-400" />
              <p className="text-sm text-content-secondary">{errorProjects}</p>
            </div>
          )}
          {!loadingProjects && !errorProjects && projects.length === 0 && (
            <div className="rounded-lg border border-border-default bg-surface-card py-14 flex flex-col items-center justify-center gap-3">
              <Building2 size={36} className="text-content-muted" />
              <p className="text-sm font-medium text-content-secondary">No projects yet</p>
              <p className="text-xs text-content-tertiary">Create a new project to organise your assessments</p>
            </div>
          )}
          {!loadingProjects && !errorProjects && projects.length > 0 && (
            <div className="space-y-3">
              {projects.map((p) => {
                const sessionCount = p.session_count ?? p.sessions ?? 0;
                const startDate = p.start_date ?? '';
                const endDate = p.end_date ?? '';

                return (
                  <div key={String(p.id)} className="rounded-lg border border-border-default bg-surface-card p-4 hover:border-border-hover transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <h3 className="text-sm font-bold text-content-primary">{p.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          p.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' :
                          p.status === 'completed' ? 'bg-blue-500/15 text-blue-400' :
                          'bg-border-default text-content-tertiary'
                        }`}>
                          {p.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm"><Plus size={12} /> Add Session</Button>
                        <button className="p-1.5 rounded hover:bg-surface-hover text-content-tertiary hover:text-accent"><Eye size={14} /></button>
                        <button className="p-1.5 rounded hover:bg-surface-hover text-content-tertiary hover:text-accent"><Archive size={14} /></button>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-xs text-content-secondary">
                      {p.client && <span className="flex items-center gap-1"><Building2 size={10} /> {p.client}</span>}
                      {p.assessor && <span className="flex items-center gap-1"><User size={10} /> {p.assessor}</span>}
                      {(startDate || endDate) && (
                        <span className="flex items-center gap-1">
                          <Calendar size={10} />
                          {startDate ? startDate.slice(0, 10) : '?'} – {endDate ? endDate.slice(0, 10) : 'ongoing'}
                        </span>
                      )}
                      <span className="font-medium text-content-primary">{sessionCount} sessions</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
