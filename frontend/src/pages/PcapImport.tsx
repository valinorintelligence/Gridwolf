import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSearch, Upload, Radio, Play, Pause, Square, ChevronRight,
  Check, Trash2, Eye, RefreshCw, Filter,
  Download, AlertTriangle, Zap, Server, Activity, Shield, Network, XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api } from '@/services/api';

const PIPELINE_STAGES = [
  { name: 'Ingest', desc: 'PCAP validation & metadata extraction', icon: Upload },
  { name: 'Dissect', desc: 'Protocol dissection & flow extraction', icon: Activity },
  { name: 'Topology', desc: 'Graph assembly & device fingerprinting', icon: Server },
  { name: 'Risk', desc: 'Security findings & ATT&CK mapping', icon: AlertTriangle },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function PcapImport() {
  const [tab, setTab] = useState<'import' | 'live'>('import');
  const [files, setFiles] = useState<{ name: string; size: string; raw?: File }[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(-1);
  const [analysisError, setAnalysisError] = useState('');
  const [realResult, setRealResult] = useState<null | {
    sessionId: string; devices: any[]; findings: any[]; protocols: string[]; packets: number;
  }>(null);
  const [liveCapturing, setLiveCapturing] = useState(false);
  const [livePaused, setLivePaused] = useState(false);
  const [liveIface, setLiveIface] = useState('eth0');
  const [liveBpf, setLiveBpf] = useState('');
  const [liveDuration, setLiveDuration] = useState('15min');
  const [liveStats, setLiveStats] = useState<null | {
    packets: number; bytes: number; elapsed_seconds: number;
    devices: number; protocols: number; findings: number;
  }>(null);
  const [dragOver, setDragOver] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollErrorCount = useRef(0);
  const navigate = useNavigate();
  const [recentImports, setRecentImports] = useState<any[]>([]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Fetch recent imports from backend
  useEffect(() => {
    api.get('/ics/pcap/list')
      .then(({ data }) => setRecentImports(Array.isArray(data) ? data : []))
      .catch(() => setRecentImports([]));
  }, []);

  const startAnalysis = async () => {
    setAnalyzing(true);
    setRealResult(null);
    setAnalysisError('');
    setPipelineStep(0);

    const rawFile = files[0]?.raw;
    if (!rawFile) { setAnalyzing(false); return; }

    try {
      setPipelineStep(0); // Ingest
      const formData = new FormData();
      formData.append('file', rawFile);
      // Use undefined Content-Type so the browser sets multipart/form-data
      // with the correct boundary (the api instance defaults to JSON).
      const { data: upload } = await api.post('/ics/pcap/upload', formData, {
        headers: { 'Content-Type': undefined },
      });

      const pcapId: string = upload.pcap_id;
      const sessionId: string = upload.session_id;
      setPipelineStep(1); // Dissect

      // Poll for completion (retry up to 90 times = ~3 min for large PCAPs)
      const MAX_POLL_ERRORS = 5;
      const MAX_POLL_ATTEMPTS = 90;
      let pollAttempts = 0;
      pollErrorCount.current = 0;
      let completionHandled = false;

      pollRef.current = setInterval(async () => {
        if (completionHandled) return;
        pollAttempts++;

        if (pollAttempts > MAX_POLL_ATTEMPTS) {
          clearInterval(pollRef.current!);
          setAnalysisError('Analysis timed out — the PCAP may be too large. Check backend logs.');
          setAnalyzing(false);
          return;
        }

        try {
          const { data: status } = await api.get(`/ics/pcap/status/${pcapId}`);
          pollErrorCount.current = 0; // reset on success

          if (status.status === 'completed' && !completionHandled) {
            completionHandled = true;
            clearInterval(pollRef.current!);
            setPipelineStep(2); // Topology
            setTimeout(async () => {
              setPipelineStep(3); // Risk
              // Fetch devices and findings for this session
              const [devRes, findRes] = await Promise.all([
                api.get(`/ics/devices/?session_id=${sessionId}`),
                api.get(`/ics/findings/?session_id=${sessionId}`),
              ]);
              const protocols = Object.keys(status.protocol_summary || {});
              setRealResult({
                sessionId,
                devices: devRes.data,
                findings: findRes.data,
                protocols,
                packets: status.packet_count || 0,
              });
              setPipelineStep(4);
              setAnalyzing(false);
            }, 1000);
          } else if (status.status === 'failed') {
            completionHandled = true;
            clearInterval(pollRef.current!);
            setAnalysisError(status.error_message || 'Analysis failed');
            setAnalyzing(false);
          }
        } catch {
          pollErrorCount.current++;
          // Only give up after multiple consecutive failures
          if (pollErrorCount.current >= MAX_POLL_ERRORS) {
            clearInterval(pollRef.current!);
            setAnalysisError('Lost connection to backend after multiple retries');
            setAnalyzing(false);
          }
        }
      }, 2000);
    } catch (err: any) {
      setAnalysisError(err?.response?.data?.detail || 'Upload failed');
      setAnalyzing(false);
    }
  };

  // ── Live capture controls ────────────────────────────────────────────────
  const startLiveCapture = async () => {
    setAnalysisError('');
    try {
      await api.post('/ics/pcap/live/start', {
        interface: liveIface,
        bpf_filter: liveBpf || undefined,
        duration: liveDuration,
      });
      setLiveCapturing(true);
      setLivePaused(false);
    } catch (err: any) {
      setAnalysisError(err?.response?.data?.detail || 'Failed to start live capture');
    }
  };

  const stopLiveCapture = async () => {
    try { await api.post('/ics/pcap/live/stop'); } catch { /* ignore */ }
    setLiveCapturing(false);
    setLivePaused(false);
    setLiveStats(null);
  };

  // Poll live capture stats from backend while capturing
  useEffect(() => {
    if (!liveCapturing || livePaused) return;
    const iv = setInterval(async () => {
      try {
        const { data } = await api.get('/ics/pcap/live/stats');
        setLiveStats(data);
      } catch { /* ignore transient errors */ }
    }, 2000);
    return () => clearInterval(iv);
  }, [liveCapturing, livePaused]);

  const tabs = [
    { id: 'import' as const, label: 'Import PCAP', icon: Upload },
    { id: 'live' as const, label: 'Live Capture', icon: Radio },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2">
          <FileSearch size={24} className="text-accent" /> PCAP Analysis Engine
        </h1>
        <p className="text-sm text-content-secondary mt-1">
          Import packet captures or start live capture for passive ICS/SCADA network discovery
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-surface-card border border-border-default p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-accent text-white' : 'text-content-secondary hover:text-content-primary hover:bg-surface-hover'
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* ============ IMPORT TAB ============ */}
      {tab === 'import' && (
        <div className="space-y-6">

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const dropped = Array.from(e.dataTransfer.files).map((f) => ({ name: f.name, size: (f.size / 1024 / 1024).toFixed(1) + ' MB', raw: f }));
              setFiles((prev) => [...prev, ...dropped]);
            }}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
              dragOver ? 'border-accent bg-accent/10' : 'border-border-default bg-surface-card hover:border-border-hover'
            }`}
          >
            <Upload size={40} className="mx-auto text-content-tertiary mb-3" />
            <p className="text-content-primary font-medium">Drop PCAP/PCAPNG files here</p>
            <p className="text-xs text-content-tertiary mt-1">or click to browse &middot; up to 500 MB per file &middot; multiple files supported</p>
            <input
              type="file"
              accept=".pcap,.pcapng"
              multiple
              className="hidden"
              id="pcap-input"
              onChange={(e) => {
                const selected = Array.from(e.target.files || []).map((f) => ({ name: f.name, size: (f.size / 1024 / 1024).toFixed(1) + ' MB', raw: f }));
                setFiles((prev) => [...prev, ...selected]);
              }}
            />
            <label htmlFor="pcap-input">
              <Button type="button" variant="outline" size="md" className="mt-4 pointer-events-none">
                Browse Files
              </Button>
            </label>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="rounded-lg border border-border-default bg-surface-card p-4 space-y-2">
              <p className="text-xs font-medium text-content-secondary mb-2">Queued Files ({files.length})</p>
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded bg-bg-secondary">
                  <span className="text-sm text-content-primary">{f.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-content-tertiary">{f.size}</span>
                    <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-content-tertiary hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
              <Button variant="primary" size="lg" className="w-full mt-3" onClick={startAnalysis} loading={analyzing}>
                <Zap size={16} /> Start Analysis Pipeline
              </Button>
            </div>
          )}

          {/* Pipeline stages */}
          {(analyzing || pipelineStep >= 0) && (
            <div className="rounded-lg border border-border-default bg-surface-card p-5">
              <p className="text-sm font-medium text-content-primary mb-4">Analysis Pipeline</p>
              <div className="flex items-center gap-2">
                {PIPELINE_STAGES.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-2 flex-1">
                    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 flex-1 border ${
                      i < pipelineStep ? 'border-emerald-500/30 bg-emerald-500/10' :
                      i === pipelineStep && analyzing ? 'border-accent/50 bg-accent/10 animate-pulse' :
                      'border-border-default bg-bg-secondary'
                    }`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        i < pipelineStep ? 'bg-emerald-500 text-white' :
                        i === pipelineStep && analyzing ? 'bg-accent text-white' :
                        'bg-surface-card text-content-tertiary'
                      }`}>
                        {i < pipelineStep ? <Check size={12} /> : i + 1}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-content-primary">{s.name}</p>
                        <p className="text-[10px] text-content-tertiary">{s.desc}</p>
                      </div>
                    </div>
                    {i < 3 && <ChevronRight size={14} className="text-content-tertiary shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Analysis error */}
          {analysisError && (
            <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
              <XCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-red-400">Analysis Failed</p>
                <p className="text-[11px] text-red-400/80 mt-0.5">{analysisError}</p>
              </div>
            </div>
          )}

          {/* Real backend results */}
          {realResult && (
            <div className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check size={18} className="text-emerald-400" />
                  <p className="text-sm font-semibold text-content-primary">Analysis Complete</p>
                </div>
                <div className="flex gap-3 text-[11px] text-content-tertiary">
                  <span>{realResult.packets.toLocaleString()} packets</span>
                  <span>·</span>
                  <span>Session {realResult.sessionId.slice(0, 8)}</span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Devices Found', value: String(realResult.devices.length), color: 'text-accent' },
                  { label: 'Protocols', value: String(realResult.protocols.length), color: 'text-blue-400' },
                  { label: 'Findings', value: String(realResult.findings.length), color: 'text-amber-400' },
                  { label: 'Critical', value: String(realResult.findings.filter((f: any) => f.severity === 'critical').length), color: 'text-red-400' },
                ].map(s => (
                  <div key={s.label} className="rounded-lg border border-border-default bg-surface-card p-3 text-center">
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-content-tertiary mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
                  <div className="px-3 py-2 border-b border-border-default flex items-center gap-1.5">
                    <Server size={13} className="text-accent" />
                    <p className="text-xs font-semibold text-content-primary">Discovered Devices</p>
                  </div>
                  <div className="divide-y divide-border-default max-h-64 overflow-y-auto">
                    {realResult.devices.length === 0
                      ? <p className="px-3 py-4 text-xs text-content-tertiary text-center">No devices discovered</p>
                      : realResult.devices.map((d: any) => (
                        <div key={d.id} className="px-3 py-2">
                          <p className="text-xs font-medium text-content-primary">{d.ip_address} <span className="text-content-tertiary font-normal">— {d.device_type}</span></p>
                          <p className="text-[10px] text-content-tertiary">{d.vendor || 'Unknown'} · {d.purdue_level}</p>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {(d.protocols || []).map((p: string) => (
                              <span key={p} className="px-1.5 py-0.5 rounded text-[9px] bg-accent/15 text-accent">{p}</span>
                            ))}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>

                <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
                  <div className="px-3 py-2 border-b border-border-default flex items-center gap-1.5">
                    <Shield size={13} className="text-amber-400" />
                    <p className="text-xs font-semibold text-content-primary">Security Findings</p>
                  </div>
                  <div className="divide-y divide-border-default max-h-64 overflow-y-auto">
                    {realResult.findings.length === 0
                      ? <p className="px-3 py-4 text-xs text-content-tertiary text-center">No findings detected</p>
                      : realResult.findings.map((f: any) => (
                        <div key={f.id} className="px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs text-content-primary leading-snug">{f.title}</p>
                            <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              f.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                              f.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                              f.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>{f.severity}</span>
                          </div>
                          {f.mitre_technique && <p className="text-[10px] text-content-tertiary mt-0.5">MITRE {f.mitre_technique}</p>}
                        </div>
                      ))
                    }
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="primary" size="md" onClick={() => navigate('/network')} icon={<Network size={14} />}>View Network Topology</Button>
                <Button variant="outline" size="md" onClick={() => navigate('/vulnerabilities')} icon={<Shield size={14} />}>View Findings</Button>
                <Button variant="outline" size="md" onClick={() => navigate('/reports')} icon={<Download size={14} />}>Download Report</Button>
              </div>
            </div>
          )}

          {/* Recent imports */}
          <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border-default">
              <p className="text-sm font-medium text-content-primary">Recent Imports</p>
            </div>
            {recentImports.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-content-tertiary">No imports yet</p>
                <p className="text-xs text-content-tertiary mt-1">Upload a PCAP file above to get started</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default text-xs text-content-tertiary">
                    <th className="text-left px-4 py-2 font-medium">File</th>
                    <th className="text-left px-4 py-2 font-medium">Date</th>
                    <th className="text-right px-4 py-2 font-medium">Packets</th>
                    <th className="text-left px-4 py-2 font-medium">Protocols</th>
                    <th className="text-left px-4 py-2 font-medium">Status</th>
                    <th className="text-right px-4 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentImports.map((r) => (
                    <tr key={r.id} className="border-b border-border-default last:border-0 hover:bg-surface-hover">
                      <td className="px-4 py-2.5">
                        <div className="text-content-primary font-medium">{r.filename}</div>
                        <div className="text-[10px] text-content-tertiary">{r.file_size ? `${(r.file_size / 1024 / 1024).toFixed(1)} MB` : ''}</div>
                      </td>
                      <td className="px-4 py-2.5 text-content-secondary">{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</td>
                      <td className="px-4 py-2.5 text-right text-content-secondary">{(r.packet_count || 0).toLocaleString()}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {Object.keys(r.protocol_summary || {}).map((p) => (
                            <span key={p} className="px-1.5 py-0.5 rounded text-[10px] bg-accent/15 text-accent">{p}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          r.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' :
                          r.status === 'failed' ? 'bg-red-500/15 text-red-400' :
                          'bg-amber-500/15 text-amber-400'
                        }`}>
                          {r.status === 'completed' ? <Check size={10} /> : r.status === 'failed' ? <AlertTriangle size={10} /> : <RefreshCw size={10} />}
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <button className="p-1 rounded hover:bg-surface-hover text-content-tertiary hover:text-accent"><Eye size={14} /></button>
                          <button className="p-1 rounded hover:bg-surface-hover text-content-tertiary hover:text-accent"><RefreshCw size={14} /></button>
                          <button className="p-1 rounded hover:bg-surface-hover text-content-tertiary hover:text-red-400"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ============ LIVE CAPTURE TAB ============ */}
      {tab === 'live' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {/* Config */}
            <div className="col-span-1 space-y-4 rounded-lg border border-border-default bg-surface-card p-4">
              <p className="text-sm font-medium text-content-primary">Capture Configuration</p>
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1">Network Interface</label>
                <input
                  value={liveIface}
                  onChange={(e) => setLiveIface(e.target.value)}
                  placeholder="e.g. eth0, ens192, any"
                  className="w-full rounded border border-border-default bg-bg-secondary text-content-primary text-sm px-3 py-1.5 placeholder:text-content-muted"
                />
                <p className="text-[10px] text-content-tertiary mt-1">Interface name as reported by the backend host (must exist on the server).</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1">BPF Filter</label>
                <input value={liveBpf} onChange={(e) => setLiveBpf(e.target.value)} placeholder="e.g. port 502 or host 10.1.0.0/24" className="w-full rounded border border-border-default bg-bg-secondary text-content-primary text-sm px-3 py-1.5 placeholder:text-content-muted" />
                <p className="text-[10px] text-content-tertiary mt-1 flex items-center gap-1"><Filter size={10} /> Examples: port 502, tcp port 44818, host 10.1.0.0/24</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1">Duration</label>
                <select value={liveDuration} onChange={(e) => setLiveDuration(e.target.value)} className="w-full rounded border border-border-default bg-bg-secondary text-content-primary text-sm px-3 py-1.5">
                  <option value="5min">5 minutes</option>
                  <option value="15min">15 minutes</option>
                  <option value="30min">30 minutes</option>
                  <option value="1hr">1 hour</option>
                  <option value="continuous">Continuous</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                {!liveCapturing ? (
                  <Button variant="primary" size="md" className="flex-1" onClick={startLiveCapture}>
                    <Play size={14} /> Start
                  </Button>
                ) : (
                  <>
                    <Button variant={livePaused ? 'primary' : 'outline'} size="md" className="flex-1" onClick={() => setLivePaused(!livePaused)}>
                      {livePaused ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause</>}
                    </Button>
                    <Button variant="danger" size="md" className="flex-1" onClick={stopLiveCapture}>
                      <Square size={14} /> Stop
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Live stats — populated from /ics/pcap/live/stats backend poll */}
            <div className="col-span-2 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Packets Captured', value: liveStats ? liveStats.packets.toLocaleString() : '—', color: 'text-accent' },
                  { label: 'Bytes', value: liveStats ? `${(liveStats.bytes / 1024 / 1024).toFixed(1)} MB` : '—', color: 'text-content-primary' },
                  { label: 'Elapsed', value: liveStats ? formatElapsed(liveStats.elapsed_seconds) : '—', color: 'text-content-primary' },
                  { label: 'Devices Discovered', value: liveStats ? String(liveStats.devices) : '—', color: 'text-emerald-400' },
                  { label: 'Protocols', value: liveStats ? String(liveStats.protocols) : '—', color: 'text-blue-400' },
                  { label: 'Findings', value: liveStats ? String(liveStats.findings) : '—', color: 'text-amber-400' },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-border-default bg-surface-card p-3">
                    <p className="text-[10px] text-content-tertiary">{s.label}</p>
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {!liveCapturing && (
                <div className="rounded-lg border border-border-default bg-surface-card p-8 text-center">
                  <Radio size={32} className="mx-auto text-content-tertiary mb-2" />
                  <p className="text-sm text-content-tertiary">Configure an interface and click Start to begin live capture.</p>
                  <p className="text-xs text-content-tertiary mt-1">The backend host must have raw-packet capture privileges (CAP_NET_RAW) on the selected interface.</p>
                </div>
              )}

              {liveCapturing && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => api.get('/ics/pcap/live/download', { responseType: 'blob' })
                    .then(({ data }) => {
                      const url = URL.createObjectURL(new Blob([data]));
                      const a = document.createElement('a');
                      a.href = url; a.download = `live-capture-${Date.now()}.pcap`; a.click();
                      URL.revokeObjectURL(url);
                    })}>
                    <Download size={14} /> Save PCAP
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate('/network')}><Eye size={14} /> View Full Topology</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
