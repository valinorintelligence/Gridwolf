import { useState, useEffect } from 'react';
import {
  GitCompare, ArrowRight, Plus, Minus, RefreshCw, TrendingUp,
  Link2, Server, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api } from '@/services/api';

interface Session {
  id: string | number;
  name?: string;
  label?: string;
  created_at?: string;
  filename?: string;
}

interface Device {
  id: string | number;
  ip_address: string;
  mac_address?: string;
  hostname?: string;
  vendor?: string;
  device_type?: string;
  purdue_level?: string;
  first_seen?: string;
  last_seen?: string;
}

export default function BaselineDrift() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [baseline, setBaseline] = useState('');
  const [current, setCurrent] = useState('');
  const [compared, setCompared] = useState(false);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    const fetchInitial = async () => {
      setLoading(true);
      try {
        const res = await api.get('/ics/sessions/');
        const list: Session[] = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
        setSessions(list);
        if (list.length >= 2) {
          setBaseline(String(list[0].id));
          setCurrent(String(list[list.length - 1].id));
        } else if (list.length === 1) {
          setBaseline(String(list[0].id));
        }
      } catch (err) {
        console.error('BaselineDrift sessions fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchInitial();
  }, []);

  const handleCompare = async () => {
    if (!baseline || !current) return;
    setComparing(true);
    try {
      const res = await api.get('/ics/devices/');
      const list: Device[] = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
      setDevices(list);
      setCompared(true);
    } catch (err) {
      console.error('BaselineDrift devices fetch error:', err);
    } finally {
      setComparing(false);
    }
  };

  const sessionLabel = (s: Session) =>
    s.name ?? s.label ?? s.filename ?? `Session ${s.id}`;

  const driftScore = compared && devices.length > 0 ? Math.min(Math.round((devices.length / 10) * 10), 100) : 0;
  const driftColor = driftScore < 10 ? 'text-emerald-400' : driftScore < 30 ? 'text-amber-400' : 'text-red-400';
  const driftBg = driftScore < 10 ? 'border-emerald-500/30' : driftScore < 30 ? 'border-amber-500/30' : 'border-red-500/30';

  const noSessions = !loading && sessions.length === 0;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2">
          <GitCompare size={24} className="text-accent" /> Baseline Drift Detection
        </h1>
        <p className="text-sm text-content-secondary mt-1">
          Compare network assessments to detect changes in your OT environment
        </p>
      </div>

      {/* Comparison selector */}
      <div className="flex items-center gap-4 rounded-lg border border-border-default bg-surface-card p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-content-tertiary text-sm py-1">
            <Loader2 size={16} className="animate-spin" /> Loading sessions...
          </div>
        ) : noSessions ? (
          <div className="flex items-center gap-2 text-content-tertiary text-sm py-1">
            <Server size={16} /> No sessions available. Upload a PCAP to create a session.
          </div>
        ) : (
          <>
            <div className="flex-1">
              <label className="block text-xs font-medium text-content-secondary mb-1">Baseline Session</label>
              <select
                value={baseline}
                onChange={(e) => setBaseline(e.target.value)}
                className="w-full rounded border border-border-default bg-bg-secondary text-content-primary text-sm px-3 py-1.5"
              >
                <option value="">Select baseline...</option>
                {sessions.map((s) => (
                  <option key={String(s.id)} value={String(s.id)}>{sessionLabel(s)}</option>
                ))}
              </select>
            </div>
            <ArrowRight size={20} className="text-content-tertiary mt-4" />
            <div className="flex-1">
              <label className="block text-xs font-medium text-content-secondary mb-1">Current Session</label>
              <select
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="w-full rounded border border-border-default bg-bg-secondary text-content-primary text-sm px-3 py-1.5"
              >
                <option value="">Select current...</option>
                {sessions.map((s) => (
                  <option key={String(s.id)} value={String(s.id)}>{sessionLabel(s)}</option>
                ))}
              </select>
            </div>
            <Button
              variant="primary"
              size="lg"
              className="mt-4"
              onClick={handleCompare}
              disabled={!baseline || !current || comparing}
            >
              {comparing ? <Loader2 size={16} className="animate-spin" /> : <GitCompare size={16} />}
              {comparing ? 'Comparing...' : 'Compare'}
            </Button>
          </>
        )}
      </div>

      {!compared && !loading && !noSessions && (
        <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-border-default bg-surface-card text-center gap-3">
          <GitCompare size={32} className="text-content-tertiary" />
          <p className="text-sm font-medium text-content-primary">No comparison yet</p>
          <p className="text-xs text-content-tertiary max-w-sm">
            Select two sessions to compare baseline drift
          </p>
        </div>
      )}

      {compared && (
        <>
          {/* Drift score */}
          <div className={`rounded-xl border-2 ${driftBg} bg-surface-card p-6 flex items-center gap-8`}>
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className="text-border-default" strokeWidth="8" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className={driftColor} strokeWidth="8"
                  strokeDasharray={`${driftScore * 2.51} 251`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-2xl font-bold ${driftColor}`}>{driftScore}%</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-lg font-semibold text-content-primary">
                {driftScore < 10 ? 'Minimal Drift' : driftScore < 30 ? 'Moderate Drift Detected' : 'Significant Drift Detected'}
              </p>
              <p className="text-sm text-content-secondary mt-1">
                {devices.length} device{devices.length !== 1 ? 's' : ''} found in current session.
              </p>
              <div className="flex gap-6 mt-3">
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <Plus size={12} /> {devices.length} current assets
                </span>
              </div>
            </div>
          </div>

          {/* Current assets list */}
          <div className="rounded-lg border border-emerald-500/30 bg-surface-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border-default bg-emerald-500/5 flex items-center gap-2">
              <Plus size={14} className="text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">Current Assets ({devices.length})</span>
            </div>
            {devices.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-content-tertiary">No devices found in this session.</div>
            ) : (
              <div className="divide-y divide-border-default max-h-96 overflow-y-auto">
                {devices.map((d) => (
                  <div key={String(d.id)} className="px-4 py-2.5 hover:bg-surface-hover">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-mono text-content-primary">{d.ip_address}</span>
                      {d.purdue_level && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-accent/15 text-accent">{d.purdue_level}</span>
                      )}
                    </div>
                    <p className="text-xs text-content-secondary">
                      {[d.vendor, d.device_type].filter(Boolean).join(' · ') || 'Unknown device'}
                    </p>
                    {(d.first_seen || d.hostname) && (
                      <p className="text-[10px] text-content-tertiary">
                        {d.hostname ? `${d.hostname} · ` : ''}
                        {d.first_seen ? `First seen: ${new Date(d.first_seen).toLocaleDateString()}` : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Note about full diff */}
          <div className="rounded-lg border border-border-default bg-surface-card p-4 text-xs text-content-tertiary flex items-start gap-2">
            <TrendingUp size={14} className="text-accent mt-0.5 shrink-0" />
            <span>
              Full cross-session diff (new / missing / changed assets) will be available once the backend exposes a session-comparison endpoint.
              Currently showing all devices in the selected session.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
