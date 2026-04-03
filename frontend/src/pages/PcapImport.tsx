import { useState } from 'react';
import {
  FileSearch, Upload, Radio, BookOpen, Play, Pause, Square, ChevronRight,
  Check, Trash2, Eye, RefreshCw, HardDrive, Filter,
  Download, AlertTriangle, Zap, Server, Activity
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------
const RECENT_IMPORTS = [
  { id: 1, name: 'plant_floor_modbus_capture.pcap', date: '2024-03-15 14:32', packets: 245_300, devices: 18, protocols: ['Modbus TCP', 'S7comm', 'LLDP'], status: 'complete' as const, size: '48.2 MB' },
  { id: 2, name: 'scada_network_20240310.pcapng', date: '2024-03-10 09:15', packets: 1_230_400, devices: 24, protocols: ['EtherNet/IP', 'CIP', 'DNP3', 'Modbus'], status: 'complete' as const, size: '312 MB' },
  { id: 3, name: 'substation_iec104.pcap', date: '2024-03-08 16:45', packets: 89_200, devices: 8, protocols: ['IEC 104', 'LLDP', 'SNMP'], status: 'complete' as const, size: '12.6 MB' },
  { id: 4, name: 'building_automation_bacnet.pcap', date: '2024-03-05 11:20', packets: 156_800, devices: 32, protocols: ['BACnet', 'LLDP'], status: 'complete' as const, size: '28.4 MB' },
  { id: 5, name: 'profinet_line3_capture.pcapng', date: '2024-03-01 08:00', packets: 67_500, devices: 12, protocols: ['PROFINET', 'LLDP', 'SNMP'], status: 'failed' as const, size: '9.8 MB' },
];

const PIPELINE_STAGES = [
  { name: 'Ingest', desc: 'PCAP validation & metadata extraction', icon: Upload },
  { name: 'Dissect', desc: 'Protocol dissection & flow extraction', icon: Activity },
  { name: 'Topology', desc: 'Graph assembly & device fingerprinting', icon: Server },
  { name: 'Risk', desc: 'Security findings & ATT&CK mapping', icon: AlertTriangle },
];

const SAMPLE_LIBRARY = [
  { category: 'ICS/OT Protocols', items: [
    { name: 'Modbus TCP', desc: 'Master/slave polling with register reads & writes', size: '4.2 MB', packets: 12_500, protocol: 'Modbus' },
    { name: 'EtherNet/IP + CIP', desc: 'CIP identity enumeration and I/O messaging', size: '8.1 MB', packets: 24_300, protocol: 'EtherNet/IP' },
    { name: 'S7comm', desc: 'Siemens S7 PLC read/write with SZL queries', size: '3.8 MB', packets: 9_800, protocol: 'S7comm' },
    { name: 'DNP3', desc: 'Master/outstation with unsolicited responses', size: '5.5 MB', packets: 15_200, protocol: 'DNP3' },
    { name: 'BACnet/IP', desc: 'Building automation I-Am broadcasts and reads', size: '2.9 MB', packets: 8_400, protocol: 'BACnet' },
    { name: 'IEC 60870-5-104', desc: 'Telecontrol with I/S/U frames and ASDUs', size: '6.3 MB', packets: 18_700, protocol: 'IEC 104' },
    { name: 'PROFINET DCP', desc: 'Device discovery and name assignment', size: '1.8 MB', packets: 4_200, protocol: 'PROFINET' },
  ]},
  { category: 'IT Reference', items: [
    { name: 'HTTP/DNS Baseline', desc: 'Standard enterprise web traffic pattern', size: '12.4 MB', packets: 45_000, protocol: 'HTTP/DNS' },
    { name: 'SSH/TLS Encrypted', desc: 'Encrypted management sessions', size: '3.2 MB', packets: 8_900, protocol: 'TLS' },
    { name: 'Mixed Enterprise', desc: 'SMB, LDAP, Kerberos, SMTP mix', size: '18.6 MB', packets: 62_000, protocol: 'Mixed' },
  ]},
  { category: 'Digital Bond S4', items: [
    { name: 'S4x15 ICS Village', desc: 'ICS village captures from S4 conference', size: '45.2 MB', packets: 234_000, protocol: 'Mixed ICS' },
  ]},
  { category: 'CTF Challenges', items: [
    { name: 'ICS CTF - Modbus', desc: 'Find the rogue write operations', size: '2.1 MB', packets: 5_600, protocol: 'Modbus' },
    { name: 'ICS CTF - S7 Exfil', desc: 'Identify data exfiltration via S7comm', size: '4.8 MB', packets: 11_200, protocol: 'S7comm' },
  ]},
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function PcapImport() {
  const [tab, setTab] = useState<'import' | 'live' | 'library'>('import');
  const [files, setFiles] = useState<{ name: string; size: string }[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(-1);
  const [liveCapturing, setLiveCapturing] = useState(false);
  const [livePaused, setLivePaused] = useState(false);
  const [liveIface, setLiveIface] = useState('eth0');
  const [liveBpf, setLiveBpf] = useState('');
  const [liveDuration, setLiveDuration] = useState('15min');
  const [dragOver, setDragOver] = useState(false);

  const startAnalysis = () => {
    setAnalyzing(true);
    setPipelineStep(0);
    let step = 0;
    const iv = setInterval(() => {
      step++;
      if (step >= 4) { clearInterval(iv); setAnalyzing(false); }
      setPipelineStep(step);
    }, 1500);
  };

  const tabs = [
    { id: 'import' as const, label: 'Import PCAP', icon: Upload },
    { id: 'live' as const, label: 'Live Capture', icon: Radio },
    { id: 'library' as const, label: 'Sample Library', icon: BookOpen },
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
              const dropped = Array.from(e.dataTransfer.files).map((f) => ({ name: f.name, size: (f.size / 1024 / 1024).toFixed(1) + ' MB' }));
              setFiles((prev) => [...prev, ...dropped]);
            }}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
              dragOver ? 'border-accent bg-accent/10' : 'border-border-default bg-surface-card hover:border-border-hover'
            }`}
          >
            <Upload size={40} className="mx-auto text-content-tertiary mb-3" />
            <p className="text-content-primary font-medium">Drop PCAP/PCAPNG files here</p>
            <p className="text-xs text-content-tertiary mt-1">or click to browse &middot; up to 500 MB per file &middot; multiple files supported</p>
            <a href={`${import.meta.env.BASE_URL}sample-capture.pcap`} download="gridwolf-sample-ics-capture.pcap" className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-md border border-accent/30 bg-accent/10 text-xs font-medium text-accent hover:bg-accent/20 transition-colors">
              <Download size={12} /> Download Sample ICS PCAP (163 packets &middot; Modbus, S7comm, DNP3, CIP)
            </a>
            <input
              type="file"
              accept=".pcap,.pcapng"
              multiple
              className="hidden"
              id="pcap-input"
              onChange={(e) => {
                const selected = Array.from(e.target.files || []).map((f) => ({ name: f.name, size: (f.size / 1024 / 1024).toFixed(1) + ' MB' }));
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

          {/* Recent imports */}
          <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border-default">
              <p className="text-sm font-medium text-content-primary">Recent Imports</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default text-xs text-content-tertiary">
                  <th className="text-left px-4 py-2 font-medium">File</th>
                  <th className="text-left px-4 py-2 font-medium">Date</th>
                  <th className="text-right px-4 py-2 font-medium">Packets</th>
                  <th className="text-right px-4 py-2 font-medium">Devices</th>
                  <th className="text-left px-4 py-2 font-medium">Protocols</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-right px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {RECENT_IMPORTS.map((r) => (
                  <tr key={r.id} className="border-b border-border-default last:border-0 hover:bg-surface-hover">
                    <td className="px-4 py-2.5">
                      <div className="text-content-primary font-medium">{r.name}</div>
                      <div className="text-[10px] text-content-tertiary">{r.size}</div>
                    </td>
                    <td className="px-4 py-2.5 text-content-secondary">{r.date}</td>
                    <td className="px-4 py-2.5 text-right text-content-secondary">{r.packets.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-content-primary font-medium">{r.devices}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {r.protocols.map((p) => (
                          <span key={p} className="px-1.5 py-0.5 rounded text-[10px] bg-accent/15 text-accent">{p}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        r.status === 'complete' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                      }`}>
                        {r.status === 'complete' ? <Check size={10} /> : <AlertTriangle size={10} />}
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
                <select value={liveIface} onChange={(e) => setLiveIface(e.target.value)} className="w-full rounded border border-border-default bg-bg-secondary text-content-primary text-sm px-3 py-1.5">
                  <option value="eth0">eth0 (Primary)</option>
                  <option value="ens192">ens192 (SPAN Port)</option>
                  <option value="any">any (All Interfaces)</option>
                </select>
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
              <div className="flex items-center justify-between">
                <span className="text-xs text-content-secondary">Ring Buffer</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-9 h-5 bg-border-default rounded-full peer peer-checked:bg-accent transition-colors" />
                </label>
              </div>
              <div className="flex gap-2 pt-2">
                {!liveCapturing ? (
                  <Button variant="primary" size="md" className="flex-1" onClick={() => { setLiveCapturing(true); setLivePaused(false); }}>
                    <Play size={14} /> Start
                  </Button>
                ) : (
                  <>
                    <Button variant={livePaused ? 'primary' : 'outline'} size="md" className="flex-1" onClick={() => setLivePaused(!livePaused)}>
                      {livePaused ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause</>}
                    </Button>
                    <Button variant="danger" size="md" className="flex-1" onClick={() => { setLiveCapturing(false); setLivePaused(false); }}>
                      <Square size={14} /> Stop
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Live stats */}
            <div className="col-span-2 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Packets Captured', value: liveCapturing ? '34,521' : '0', color: 'text-accent' },
                  { label: 'Bytes', value: liveCapturing ? '4.8 MB' : '0 B', color: 'text-content-primary' },
                  { label: 'Elapsed', value: liveCapturing ? '02:34' : '00:00', color: 'text-content-primary' },
                  { label: 'Devices Discovered', value: liveCapturing ? '12' : '0', color: 'text-emerald-400' },
                  { label: 'Protocols', value: liveCapturing ? '5' : '0', color: 'text-blue-400' },
                  { label: 'Findings', value: liveCapturing ? '3' : '0', color: 'text-amber-400' },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-border-default bg-surface-card p-3">
                    <p className="text-[10px] text-content-tertiary">{s.label}</p>
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Mini topology placeholder */}
              <div className="rounded-lg border border-border-default bg-surface-card p-4 h-52 flex items-center justify-center">
                {liveCapturing ? (
                  <div className="text-center space-y-2">
                    <div className="flex items-center justify-center gap-4">
                      {['PLC', 'HMI', 'RTU', 'Switch', 'SCADA'].slice(0, liveCapturing ? 5 : 0).map((d, i) => (
                        <div key={d} className="flex flex-col items-center gap-1 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            i < 2 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                            i < 4 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>{d[0]}</div>
                          <span className="text-[9px] text-content-tertiary">{d}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-content-tertiary">Topology building in real-time...</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Radio size={32} className="mx-auto text-content-tertiary mb-2" />
                    <p className="text-sm text-content-tertiary">Start capture to see live topology</p>
                  </div>
                )}
              </div>

              {liveCapturing && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm"><Download size={14} /> Save PCAP</Button>
                  <Button variant="outline" size="sm"><Eye size={14} /> View Full Topology</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============ SAMPLE LIBRARY TAB ============ */}
      {tab === 'library' && (
        <div className="space-y-6">
          {SAMPLE_LIBRARY.map((cat) => (
            <div key={cat.category}>
              <h3 className="text-sm font-semibold text-content-primary mb-3">{cat.category}</h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {cat.items.map((item) => (
                  <div key={item.name} className="rounded-lg border border-border-default bg-surface-card p-3 hover:border-border-hover transition-colors group">
                    <div className="flex items-start justify-between mb-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-accent/15 text-accent font-medium">{item.protocol}</span>
                      <HardDrive size={14} className="text-content-tertiary" />
                    </div>
                    <p className="text-sm font-medium text-content-primary">{item.name}</p>
                    <p className="text-[11px] text-content-tertiary mt-1 line-clamp-2">{item.desc}</p>
                    <div className="flex items-center justify-between mt-3">
                      <div className="text-[10px] text-content-tertiary">
                        {item.size} &middot; {item.packets.toLocaleString()} pkts
                      </div>
                      <Button variant="primary" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Zap size={12} /> Analyze
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
