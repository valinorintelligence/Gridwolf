import { useEffect, useState } from 'react';
import {
  Cpu, HardDrive, Database, Settings, RefreshCw, Shield, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api } from '@/services/api';

interface SystemStats {
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  disk_total_gb: number;
  disk_free_gb: number;
  uptime_seconds: number;
  version: string;
  database_bytes: number;
  active_users: number;
}

interface DatabaseBreakdown {
  tables: { table: string; rows: number }[];
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 ? 2 : 1)} ${units[i]}`;
}

function formatRows(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

export default function SystemAdmin() {
  const [activeTab, setActiveTab] = useState<'overview' | 'database'>('overview');
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [dbInfo, setDbInfo] = useState<DatabaseBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, dbRes] = await Promise.all([
        api.get<SystemStats>('/system/stats'),
        api.get<DatabaseBreakdown>('/system/database'),
      ]);
      setStats(statsRes.data);
      setDbInfo(dbRes.data);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load system stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 15000); // auto-refresh every 15s
    return () => clearInterval(id);
  }, []);

  const alerts: { severity: 'warning' | 'info'; msg: string }[] = [];
  if (stats) {
    if (stats.disk_percent > 75) alerts.push({ severity: 'warning', msg: `Disk usage approaching capacity (${stats.disk_percent}%)` });
    if (stats.memory_percent > 85) alerts.push({ severity: 'warning', msg: `Memory pressure high (${stats.memory_percent}%)` });
    if (stats.cpu_percent > 80) alerts.push({ severity: 'warning', msg: `CPU load elevated (${stats.cpu_percent}%)` });
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2">
            <Settings size={24} className="text-accent" /> System Administration
          </h1>
          <p className="text-sm text-content-secondary mt-1">
            Real-time resource monitoring
            {stats && ` | Version ${stats.version}`}
            {` | Last refresh ${lastRefresh.toLocaleTimeString()}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </Button>
          <Button variant="outline" size="sm"><Shield size={14} /> Diagnostics</Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs bg-red-500/10 text-red-400 border border-red-500/30">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {stats && (
        <>
          {/* System Health Cards */}
          <div className="grid grid-cols-6 gap-3">
            {[
              { label: 'CPU', value: stats.cpu_percent, unit: '%', icon: Cpu, color: 'text-blue-400', threshold: 80 },
              { label: 'Memory', value: stats.memory_percent, unit: '%', icon: Database, color: 'text-cyan-400', threshold: 85 },
              { label: 'Disk', value: stats.disk_percent, unit: '%', icon: HardDrive, color: stats.disk_percent > 75 ? 'text-amber-400' : 'text-emerald-400', threshold: 90 },
            ].map((s) => {
              const isWarning = s.value > s.threshold;
              return (
                <div key={s.label} className={`rounded-lg border ${isWarning ? 'border-amber-500/30 bg-amber-500/5' : 'border-border-default bg-surface-card'} p-3`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-content-tertiary font-medium">{s.label}</span>
                    <s.icon size={14} className={s.color} />
                  </div>
                  <div className="w-full h-2 rounded-full bg-bg-secondary overflow-hidden mb-1">
                    <div className={`h-full rounded-full ${isWarning ? 'bg-amber-500' : s.color}`} style={{ width: `${Math.min(100, s.value)}%` }} />
                  </div>
                  <p className={`text-lg font-bold ${isWarning ? 'text-amber-400' : 'text-content-primary'}`}>{s.value}{s.unit}</p>
                </div>
              );
            })}
            <div className="rounded-lg border border-border-default bg-surface-card p-3">
              <p className="text-[10px] text-content-tertiary mb-1">Uptime</p>
              <p className="text-lg font-bold text-content-primary">{formatUptime(stats.uptime_seconds)}</p>
              <p className="text-[10px] text-content-tertiary mt-1">Process lifetime</p>
            </div>
            <div className="rounded-lg border border-border-default bg-surface-card p-3">
              <p className="text-[10px] text-content-tertiary mb-1">DB Size</p>
              <p className="text-lg font-bold text-content-primary">{formatBytes(stats.database_bytes)}</p>
              <p className="text-[10px] text-content-tertiary mt-1">{stats.active_users} active users</p>
            </div>
            <div className="rounded-lg border border-border-default bg-surface-card p-3">
              <p className="text-[10px] text-content-tertiary mb-1">Disk Free</p>
              <p className="text-lg font-bold text-content-primary">{stats.disk_free_gb} GB</p>
              <p className="text-[10px] text-content-tertiary mt-1">of {stats.disk_total_gb} GB</p>
            </div>
          </div>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${a.severity === 'warning' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'}`}>
                  <AlertCircle size={14} />
                  <span>{a.msg}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-lg bg-surface-card border border-border-default p-1 w-fit">
        {(['overview', 'database'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === t ? 'bg-accent text-white' : 'text-content-secondary hover:bg-surface-hover'}`}
          >
            {t === 'overview' ? 'Overview' : 'Database'}
          </button>
        ))}
      </div>

      {activeTab === 'database' && dbInfo && (
        <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border-default">
            <p className="text-sm font-medium text-content-primary flex items-center gap-2">
              <Database size={14} className="text-accent" />Database Tables ({dbInfo.tables.length})
            </p>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-default text-content-tertiary">
                <th className="text-left px-4 py-2 font-medium">Table</th>
                <th className="text-right px-4 py-2 font-medium">Rows</th>
              </tr>
            </thead>
            <tbody>
              {dbInfo.tables.length === 0 && (
                <tr><td colSpan={2} className="px-4 py-6 text-center text-content-tertiary">No tables found.</td></tr>
              )}
              {dbInfo.tables.map((d) => (
                <tr key={d.table} className="border-b border-border-default last:border-0 hover:bg-surface-hover">
                  <td className="px-4 py-2 font-mono text-accent">{d.table}</td>
                  <td className="px-4 py-2 text-right text-content-primary">{formatRows(d.rows)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'overview' && !stats && !error && (
        <div className="rounded-lg border border-border-default bg-surface-card p-8 text-center text-xs text-content-tertiary">
          Loading system stats…
        </div>
      )}
    </div>
  );
}
