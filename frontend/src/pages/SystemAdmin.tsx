import { useState } from 'react';
import {
  Cpu, HardDrive, Database, Zap, Users, Settings,
  BarChart3, TrendingUp, RefreshCw, Shield, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

const SYSTEM_STATS = {
  cpu: 34,
  memory: 62,
  disk: 48,
  dbSize: '2.4 GB',
  uptime: '18d 5h 23m',
  version: '0.9.2-alpha',
};

const PERFORMANCE_METRICS = [
  { label: 'API Latency (p95)', value: '124ms', change: '+8%', trend: 'up' as const },
  { label: 'PCAP Ingest Rate', value: '142 MB/s', change: '-2%', trend: 'down' as const },
  { label: 'Topology Queries', value: '4.2k/hr', change: '+15%', trend: 'up' as const },
  { label: 'Detection Latency', value: '2.3s avg', change: '-5%', trend: 'down' as const },
];

const ACTIVE_SESSIONS = [
  { id: '001', user: 'alice@org', role: 'Administrator', loginTime: '2024-03-20 09:00:22', activity: 'Analyzing PCAP', lastSeen: '2m ago', status: 'active' as const },
  { id: '002', user: 'bob@org', role: 'OT Engineer', loginTime: '2024-03-20 08:30:15', activity: 'Reviewing violations', lastSeen: '45s ago', status: 'active' as const },
  { id: '003', user: 'charlie@org', role: 'Security Analyst', loginTime: '2024-03-19 14:45:00', activity: 'Idle', lastSeen: '6h ago', status: 'idle' as const },
];

const SYSTEM_TASKS = [
  { id: 'TASK-001', name: 'PCAP Ingestion Queue', progress: 65, status: 'running' as const, files: '1,248 / 1,924', duration: '2h 34m' },
  { id: 'TASK-002', name: 'Baseline Drift Calculation', progress: 100, status: 'completed' as const, files: 'All sessions', duration: '18m' },
  { id: 'TASK-003', name: 'C2 Detection Analysis', progress: 42, status: 'running' as const, files: '24/57 sessions', duration: '45m elapsed' },
  { id: 'TASK-004', name: 'CVE Database Update', progress: 100, status: 'completed' as const, files: '+287 CVEs added', duration: '3m' },
];

const DATABASE_INFO = [
  { table: 'packets', rows: '124.5M', size: '892 MB', growth: '+2.3 MB/hr' },
  { table: 'devices', rows: '2,847', size: '45 MB', growth: '+12 rows/hr' },
  { table: 'flows', rows: '18.2M', size: '621 MB', growth: '+1.8 MB/hr' },
  { table: 'findings', rows: '142.8k', size: '78 MB', growth: '+450/hr' },
  { table: 'reports', rows: '234', size: '12 MB', growth: '+0.8 MB/day' },
];

const ALERTS = [
  { severity: 'warning' as const, msg: 'Disk usage approaching 75% threshold (currently 68%)' },
  { severity: 'info' as const, msg: 'PCAP ingest rate above baseline (avg 102 MB/s, current 142 MB/s)' },
  { severity: 'info' as const, msg: 'Detection engine processing increased load (4/8 cores active)' },
];

export default function SystemAdmin() {
  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'tasks' | 'database'>('overview');

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2"><Settings size={24} className="text-accent" /> System Administration</h1>
          <p className="text-sm text-content-secondary mt-1">Real-time CPU, memory, disk, DB stats monitoring | Version {SYSTEM_STATS.version}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><RefreshCw size={14} /> Refresh</Button>
          <Button variant="outline" size="sm"><Shield size={14} /> Diagnostics</Button>
        </div>
      </div>

      {/* System Health Cards */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: 'CPU', value: SYSTEM_STATS.cpu, unit: '%', icon: Cpu, color: 'text-blue-400', threshold: 80 },
          { label: 'Memory', value: SYSTEM_STATS.memory, unit: '%', icon: Database, color: 'text-cyan-400', threshold: 85 },
          { label: 'Disk', value: SYSTEM_STATS.disk, unit: '%', icon: HardDrive, color: SYSTEM_STATS.disk > 75 ? 'text-amber-400' : 'text-emerald-400', threshold: 90 },
        ].map((s) => {
          const isWarning = s.value > s.threshold;
          return (
            <div key={s.label} className={`rounded-lg border ${isWarning ? 'border-amber-500/30 bg-amber-500/5' : 'border-border-default bg-surface-card'} p-3`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-content-tertiary font-medium">{s.label}</span>
                <s.icon size={14} className={s.color} />
              </div>
              <div className="w-full h-2 rounded-full bg-bg-secondary overflow-hidden mb-1">
                <div className={`h-full rounded-full ${isWarning ? 'bg-amber-500' : s.color}`} style={{ width: `${s.value}%` }} />
              </div>
              <p className={`text-lg font-bold ${isWarning ? 'text-amber-400' : 'text-content-primary'}`}>{s.value}{s.unit}</p>
            </div>
          );
        })}
        <div className="rounded-lg border border-border-default bg-surface-card p-3">
          <p className="text-[10px] text-content-tertiary mb-1">Uptime</p>
          <p className="text-lg font-bold text-content-primary">{SYSTEM_STATS.uptime}</p>
          <p className="text-[10px] text-content-tertiary mt-1">Last restart: 18 days ago</p>
        </div>
        <div className="rounded-lg border border-border-default bg-surface-card p-3">
          <p className="text-[10px] text-content-tertiary mb-1">DB Size</p>
          <p className="text-lg font-bold text-content-primary">{SYSTEM_STATS.dbSize}</p>
          <p className="text-[10px] text-content-tertiary mt-1">+2.1 MB/hr</p>
        </div>
      </div>

      {/* Performance Trend Cards */}
      <div className="grid grid-cols-4 gap-3">
        {PERFORMANCE_METRICS.map((m) => (
          <div key={m.label} className="rounded-lg border border-border-default bg-surface-card p-3">
            <p className="text-[10px] text-content-tertiary mb-1">{m.label}</p>
            <p className="text-lg font-bold text-content-primary">{m.value}</p>
            <p className={`text-[10px] mt-1 flex items-center gap-1 ${m.trend === 'up' ? 'text-orange-400' : 'text-emerald-400'}`}>
              <TrendingUp size={10} /> {m.change}
            </p>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {ALERTS.length > 0 && (
        <div className="space-y-2">
          {ALERTS.map((a, i) => (
            <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${a.severity === 'warning' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'}`}>
              <AlertCircle size={14} />
              <span>{a.msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-lg bg-surface-card border border-border-default p-1 w-fit">
        {(['overview', 'sessions', 'tasks', 'database'] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === t ? 'bg-accent text-white' : 'text-content-secondary hover:bg-surface-hover'}`}>
            {t === 'overview' ? 'Performance' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Content Panels */}
      {activeTab === 'sessions' && (
        <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border-default flex items-center justify-between">
            <p className="text-sm font-medium text-content-primary flex items-center gap-2"><Users size={14} className="text-accent" />Active Sessions</p>
            <span className="text-xs text-content-tertiary">{ACTIVE_SESSIONS.filter((s) => s.status === 'active').length} active</span>
          </div>
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border-default text-content-tertiary">
              <th className="text-left px-4 py-2 font-medium">User</th><th className="text-left px-4 py-2 font-medium">Role</th>
              <th className="text-left px-4 py-2 font-medium">Login Time</th><th className="text-left px-4 py-2 font-medium">Current Activity</th>
              <th className="text-left px-4 py-2 font-medium">Last Seen</th><th className="text-left px-4 py-2 font-medium">Status</th>
            </tr></thead>
            <tbody>{ACTIVE_SESSIONS.map((s) => (
              <tr key={s.id} className="border-b border-border-default last:border-0 hover:bg-surface-hover">
                <td className="px-4 py-2 text-content-primary font-medium">{s.user}</td>
                <td className="px-4 py-2 text-content-secondary">{s.role}</td>
                <td className="px-4 py-2 text-content-tertiary">{s.loginTime}</td>
                <td className="px-4 py-2 text-content-secondary">{s.activity}</td>
                <td className="px-4 py-2 text-content-tertiary text-[10px]">{s.lastSeen}</td>
                <td className="px-4 py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${s.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-gray-500/15 text-gray-400'}`}>{s.status}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="space-y-2">
          {SYSTEM_TASKS.map((t) => (
            <div key={t.id} className="rounded-lg border border-border-default bg-surface-card p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-content-primary">{t.name}</p>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${t.status === 'running' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'}`}>{t.status}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-bg-secondary overflow-hidden mb-1">
                <div className={`h-full rounded-full ${t.status === 'running' ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${t.progress}%` }} />
              </div>
              <div className="flex items-center justify-between text-[10px] text-content-tertiary">
                <span>{t.progress}%</span>
                <div className="flex gap-4">
                  <span>{t.files}</span>
                  <span>{t.duration}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'database' && (
        <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border-default">
            <p className="text-sm font-medium text-content-primary flex items-center gap-2"><Database size={14} className="text-accent" />Database Tables</p>
          </div>
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border-default text-content-tertiary">
              <th className="text-left px-4 py-2 font-medium">Table</th><th className="text-right px-4 py-2 font-medium">Rows</th>
              <th className="text-right px-4 py-2 font-medium">Size</th><th className="text-right px-4 py-2 font-medium">Growth Rate</th>
            </tr></thead>
            <tbody>{DATABASE_INFO.map((d) => (
              <tr key={d.table} className="border-b border-border-default last:border-0 hover:bg-surface-hover">
                <td className="px-4 py-2 font-mono text-accent">{d.table}</td>
                <td className="px-4 py-2 text-right text-content-primary">{d.rows}</td>
                <td className="px-4 py-2 text-right text-content-primary">{d.size}</td>
                <td className="px-4 py-2 text-right text-content-secondary">{d.growth}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
