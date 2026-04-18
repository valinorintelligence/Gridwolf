import { useState } from 'react';
import {
  Radio, Play, Square, Activity, Server, Network,
  Clock, Cpu, HardDrive, Info, Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api } from '@/services/api';

const INTERFACES = ['eth0 (Management)', 'eth1 (SPAN Port)', 'eth2 (ICS Network)', 'br0 (Bridge)'];

export default function LiveCapture() {
  const [capturing, setCapturing] = useState(false);
  const [iface, setIface] = useState(INTERFACES[1]);
  const [bpfFilter, setBpfFilter] = useState('');
  const [duration, setDuration] = useState('60');
  const [startLoading, setStartLoading] = useState(false);
  const [elapsed, setElapsed] = useState('00:00:00');
  const [elapsedTimer, setElapsedTimer] = useState<ReturnType<typeof setInterval> | null>(null);

  function startElapsedTimer() {
    let seconds = 0;
    const id = setInterval(() => {
      seconds += 1;
      const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
      const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
      const s = String(seconds % 60).padStart(2, '0');
      setElapsed(`${h}:${m}:${s}`);
    }, 1000);
    setElapsedTimer(id);
  }

  function stopElapsedTimer() {
    if (elapsedTimer) {
      clearInterval(elapsedTimer);
      setElapsedTimer(null);
    }
    setElapsed('00:00:00');
  }

  async function handleStart() {
    setStartLoading(true);
    try {
      await api.post('/capture/start', {
        interface: iface,
        bpf_filter: bpfFilter || undefined,
        duration: parseInt(duration, 10) || undefined,
      });
      setCapturing(true);
      startElapsedTimer();
    } catch {
      // Could not start — backend may not be available or interface not configured
    } finally {
      setStartLoading(false);
    }
  }

  async function handleStop() {
    try {
      await api.post('/capture/stop', {});
    } catch {
      // Best-effort
    } finally {
      setCapturing(false);
      stopElapsedTimer();
    }
  }

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2">
            <Radio size={24} className="text-accent" /> Live Capture
          </h1>
          <p className="text-sm text-content-secondary mt-1">
            Real-time topology rendering during active packet capture
          </p>
        </div>
        <div className="flex items-center gap-2">
          {capturing && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              CAPTURING
            </span>
          )}
          {!capturing ? (
            <Button
              variant="primary"
              size="sm"
              disabled={startLoading}
              onClick={handleStart}
            >
              {startLoading
                ? <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Starting…</>
                : <><Play size={14} /> Start Capture</>}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleStop}>
              <Square size={14} /> Stop
            </Button>
          )}
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3.5">
        <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-300">
          Live capture requires the appliance to have a network interface connected to a SPAN/mirror port.
          Configure your switch to mirror traffic to the appliance&apos;s monitoring interface.
        </p>
      </div>

      {/* Capture Configuration + Stats */}
      <div className="grid grid-cols-4 gap-3">
        {/* Configuration card */}
        <div className="rounded-lg border border-border-default bg-surface-card p-3 space-y-2">
          <p className="text-[10px] text-content-tertiary font-medium uppercase tracking-wide">Interface</p>
          <select
            value={iface}
            onChange={(e) => setIface(e.target.value)}
            disabled={capturing}
            className="w-full bg-bg-secondary border border-border-default rounded px-2 py-1 text-xs text-content-primary disabled:opacity-60"
          >
            {INTERFACES.map((i) => <option key={i}>{i}</option>)}
          </select>
          <div className="flex items-center gap-2 text-[10px] text-content-tertiary">
            <Clock size={10} /><span>Elapsed: {elapsed}</span>
          </div>
        </div>

        {/* Stat: Packets */}
        <div className="rounded-lg border border-border-default bg-surface-card p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-content-tertiary">Packets Captured</p>
            <Activity size={14} className="text-accent" />
          </div>
          <p className="text-xl font-bold text-content-primary mt-1">0</p>
          <p className="text-[10px] text-content-tertiary">{capturing ? 'Waiting for traffic…' : 'Not capturing'}</p>
        </div>

        {/* Stat: Devices */}
        <div className="rounded-lg border border-border-default bg-surface-card p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-content-tertiary">Devices Found</p>
            <Server size={14} className="text-emerald-400" />
          </div>
          <p className="text-xl font-bold text-content-primary mt-1">0</p>
          <p className="text-[10px] text-content-tertiary">{capturing ? 'Discovering…' : 'Not capturing'}</p>
        </div>

        {/* Stat: Connections */}
        <div className="rounded-lg border border-border-default bg-surface-card p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-content-tertiary">Active Flows</p>
            <Network size={14} className="text-blue-400" />
          </div>
          <p className="text-xl font-bold text-content-primary mt-1">0</p>
          <p className="text-[10px] text-content-tertiary">{capturing ? 'Tracking…' : 'Not capturing'}</p>
        </div>
      </div>

      {/* Capture Settings */}
      <div className="rounded-lg border border-border-default bg-surface-card p-4 space-y-3">
        <p className="text-sm font-medium text-content-primary">Capture Settings</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] text-content-tertiary block mb-1">BPF Filter (optional)</label>
            <input
              type="text"
              value={bpfFilter}
              onChange={(e) => setBpfFilter(e.target.value)}
              disabled={capturing}
              placeholder="e.g. port 102 or host 10.0.1.10"
              className="w-full bg-bg-secondary border border-border-default rounded px-3 py-1.5 text-xs text-content-primary placeholder:text-content-tertiary disabled:opacity-60"
            />
            <p className="text-[10px] text-content-tertiary mt-1">Leave blank to capture all traffic on the selected interface.</p>
          </div>
          <div>
            <label className="text-[10px] text-content-tertiary block mb-1">Duration (seconds, 0 = unlimited)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              disabled={capturing}
              min="0"
              className="w-full bg-bg-secondary border border-border-default rounded px-3 py-1.5 text-xs text-content-primary disabled:opacity-60"
            />
          </div>
        </div>
      </div>

      {/* Empty state for topology / flows — only shown when not capturing */}
      {!capturing && (
        <div className="rounded-lg border border-dashed border-border-default bg-surface-card/50 flex flex-col items-center justify-center py-20 text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
            <Wifi size={24} className="text-accent" />
          </div>
          <p className="text-sm font-medium text-content-primary">No active capture session</p>
          <p className="text-xs text-content-secondary max-w-sm">
            Select an interface and click <strong>Start Capture</strong> to begin discovering devices and mapping network topology in real time.
          </p>
        </div>
      )}

      {/* Capture resources (shown while capturing, all zeros until backend provides data) */}
      {capturing && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Buffer Usage', value: '—', icon: HardDrive },
            { label: 'CPU Load', value: '—', icon: Cpu },
            { label: 'Capture Size', value: '—', icon: Activity },
          ].map((r) => (
            <div key={r.label} className="rounded-lg border border-border-default bg-surface-card p-3 flex items-center justify-between">
              <span className="text-xs text-content-secondary flex items-center gap-1.5">
                <r.icon size={12} className="text-content-tertiary" />
                {r.label}
              </span>
              <span className="text-xs text-content-primary font-medium">{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
