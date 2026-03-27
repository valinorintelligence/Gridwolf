import { useState } from 'react';
import {
  Fingerprint, Search, Plus, Save, Play, RotateCcw, Trash2,
  Check, X, ChevronRight, FileCode, Layers
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

const SIGNATURES = [
  { id: 1, name: 'Siemens S7-1500 PLC', protocol: 's7comm', matches: 3, confidence: 5, updated: '2h ago' },
  { id: 2, name: 'Siemens S7-300 PLC', protocol: 's7comm', matches: 2, confidence: 5, updated: '2h ago' },
  { id: 3, name: 'Siemens S7-1200 PLC', protocol: 's7comm', matches: 0, confidence: 4, updated: '1d ago' },
  { id: 4, name: 'Rockwell ControlLogix', protocol: 'ethernet-ip', matches: 2, confidence: 5, updated: '3h ago' },
  { id: 5, name: 'Rockwell CompactLogix', protocol: 'ethernet-ip', matches: 1, confidence: 4, updated: '1d ago' },
  { id: 6, name: 'Allen-Bradley MicroLogix', protocol: 'ethernet-ip', matches: 0, confidence: 3, updated: '5d ago' },
  { id: 7, name: 'Schneider Modicon M340', protocol: 'modbus', matches: 1, confidence: 5, updated: '4h ago' },
  { id: 8, name: 'Schneider Quantum PLC', protocol: 'modbus', matches: 0, confidence: 4, updated: '2d ago' },
  { id: 9, name: 'ABB RTU560', protocol: 'dnp3', matches: 1, confidence: 4, updated: '6h ago' },
  { id: 10, name: 'ABB RTU520', protocol: 'dnp3', matches: 0, confidence: 3, updated: '3d ago' },
  { id: 11, name: 'Honeywell Experion', protocol: 'modbus', matches: 1, confidence: 4, updated: '1d ago' },
  { id: 12, name: 'BACnet Controller', protocol: 'bacnet', matches: 4, confidence: 3, updated: '5h ago' },
  { id: 13, name: 'Siemens SCALANCE Switch', protocol: 'profinet', matches: 2, confidence: 5, updated: '1h ago' },
  { id: 14, name: 'Cisco IE Industrial Switch', protocol: 'lldp', matches: 1, confidence: 3, updated: '2d ago' },
  { id: 15, name: 'Generic Modbus Slave', protocol: 'modbus', matches: 5, confidence: 2, updated: '1d ago' },
  { id: 16, name: 'IEC 104 RTU', protocol: 'iec104', matches: 2, confidence: 4, updated: '8h ago' },
  { id: 17, name: 'PROFINET IO Device', protocol: 'profinet', matches: 3, confidence: 3, updated: '4h ago' },
  { id: 18, name: 'SNMP Managed Device', protocol: 'snmp', matches: 8, confidence: 2, updated: '1h ago' },
];

const YAML_CONTENT = `name: "Siemens S7-1500 PLC"
protocol: s7comm
vendor: "Siemens"
category: "PLC"
confidence: 5
purdue_level: 1
match:
  port: 102
  payload_signature: "0x32"
  transport:
    tpkt: true
    cotp: true
  s7_header:
    protocol_id: 0x32
    rosctr: [0x01, 0x03, 0x07]  # Job, UserData, Upload
  szl:
    id: "0x0011"
    module_type_name: "S7-1500"
  function_codes:
    - read_var
    - write_var
    - setup_communication
metadata:
  description: "Siemens S7-1500 series PLC"
  firmware_pattern: "V\\\\d+\\\\.\\\\d+"
  critical: true
  cve_product: "siemens:simatic_s7-1500"`;

const PROTOCOLS = ['all', 's7comm', 'ethernet-ip', 'modbus', 'dnp3', 'bacnet', 'profinet', 'iec104', 'snmp', 'lldp'];

export default function SignatureEditor() {
  const [selected, setSelected] = useState(SIGNATURES[0]);
  const [search, setSearch] = useState('');
  const [protocolFilter, setProtocolFilter] = useState('all');
  const [yaml, setYaml] = useState(YAML_CONTENT);
  const [testResults, setTestResults] = useState<null | { matched: number; devices: string[] }>(null);

  const filtered = SIGNATURES.filter((s) => {
    if (protocolFilter !== 'all' && s.protocol !== protocolFilter) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const grouped = filtered.reduce<Record<string, typeof SIGNATURES>>((acc, s) => {
    (acc[s.protocol] ??= []).push(s);
    return acc;
  }, {});

  const runTest = () => {
    setTestResults({ matched: selected.matches, devices: ['10.1.1.10 (Siemens S7-1500)', '10.1.1.15 (Siemens S7-1500)', '10.1.1.99 (Siemens S7-1500)'].slice(0, selected.matches) });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left panel - signature list */}
      <div className="w-80 border-r border-border-default bg-surface-card flex flex-col">
        <div className="p-3 border-b border-border-default space-y-2">
          <div className="flex items-center gap-2">
            <Fingerprint size={18} className="text-accent" />
            <span className="text-sm font-bold text-content-primary">Signatures</span>
            <span className="ml-auto text-[10px] text-content-tertiary">{SIGNATURES.length}</span>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-tertiary" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search signatures..." className="w-full rounded border border-border-default bg-bg-secondary text-content-primary text-xs px-3 py-1.5 pl-8 placeholder:text-content-muted" />
          </div>
          <select value={protocolFilter} onChange={(e) => setProtocolFilter(e.target.value)} className="w-full rounded border border-border-default bg-bg-secondary text-content-primary text-xs px-2 py-1">
            {PROTOCOLS.map((p) => <option key={p} value={p}>{p === 'all' ? 'All Protocols' : p}</option>)}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto">
          {Object.entries(grouped).map(([proto, sigs]) => (
            <div key={proto}>
              <div className="px-3 py-1.5 text-[10px] font-semibold text-content-tertiary uppercase bg-bg-primary sticky top-0">{proto}</div>
              {sigs.map((s) => (
                <button key={s.id} onClick={() => setSelected(s)} className={`w-full text-left px-3 py-2 border-b border-border-default hover:bg-surface-hover transition-colors ${selected.id === s.id ? 'bg-accent/10 border-l-2 border-l-accent' : ''}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-content-primary truncate">{s.name}</span>
                    {s.matches > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] bg-emerald-500/15 text-emerald-400">{s.matches}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-content-tertiary">Confidence: </span>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map((n) => <div key={n} className={`w-1.5 h-1.5 rounded-full ${n <= s.confidence ? 'bg-accent' : 'bg-border-default'}`} />)}
                    </div>
                    <span className="text-[10px] text-content-tertiary ml-auto">{s.updated}</span>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-border-default">
          <Button variant="outline" size="sm" className="w-full"><Plus size={14} /> New Signature</Button>
        </div>
      </div>

      {/* Right panel - editor */}
      <div className="flex-1 flex flex-col">
        <div className="px-4 py-3 border-b border-border-default flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-content-primary">{selected.name}</h2>
            <p className="text-[10px] text-content-tertiary">Protocol: {selected.protocol} &middot; Confidence: {selected.confidence}/5 &middot; Matches: {selected.matches}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={runTest}><Play size={12} /> Test</Button>
            <Button variant="outline" size="sm"><RotateCcw size={12} /> Reset</Button>
            <Button variant="primary" size="sm"><Save size={12} /> Save</Button>
            <Button variant="danger" size="sm"><Trash2 size={12} /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* YAML Editor */}
          <div className="rounded-lg border border-border-default overflow-hidden">
            <div className="px-3 py-2 border-b border-border-default bg-bg-secondary flex items-center gap-2">
              <FileCode size={14} className="text-content-tertiary" />
              <span className="text-xs font-medium text-content-primary">signature.yaml</span>
            </div>
            <textarea
              value={yaml}
              onChange={(e) => setYaml(e.target.value)}
              className="w-full bg-bg-primary text-content-primary font-mono text-xs p-4 border-0 outline-none resize-none"
              rows={20}
              spellCheck={false}
            />
          </div>

          {/* Test results */}
          {testResults && (
            <div className="rounded-lg border border-border-default bg-surface-card p-4">
              <p className="text-sm font-medium text-content-primary flex items-center gap-2 mb-3">
                <Play size={14} className="text-accent" /> Test Results
              </p>
              <div className="flex items-center gap-4 mb-3">
                <span className={`text-xs font-medium ${testResults.matched > 0 ? 'text-emerald-400' : 'text-content-tertiary'}`}>
                  {testResults.matched > 0 ? <Check size={12} className="inline mr-1" /> : <X size={12} className="inline mr-1" />}
                  {testResults.matched} device{testResults.matched !== 1 ? 's' : ''} matched
                </span>
              </div>
              {testResults.devices.length > 0 && (
                <div className="space-y-1">
                  {testResults.devices.map((d) => (
                    <div key={d} className="flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-500/5 border border-emerald-500/20 text-xs text-content-primary">
                      <Check size={12} className="text-emerald-400" /> {d}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total Signatures', value: '30', icon: Fingerprint },
              { label: 'Protocols Covered', value: '10', icon: Layers },
              { label: 'Avg Confidence', value: '3.8', icon: ChevronRight },
              { label: 'Last Updated', value: '1h ago', icon: FileCode },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border-default bg-surface-card p-3">
                <p className="text-[10px] text-content-tertiary flex items-center gap-1"><s.icon size={10} /> {s.label}</p>
                <p className="text-lg font-bold text-content-primary mt-1">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
