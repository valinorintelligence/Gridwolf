import { useEffect, useMemo, useState } from 'react';
import {
  Fingerprint, Search, Plus, Save, Play, RotateCcw, Trash2,
  Check, X, ChevronRight, FileCode, Layers, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api } from '@/services/api';

interface Signature {
  id: string;
  name: string;
  protocol: string;
  vendor: string | null;
  category: string | null;
  confidence: number;
  enabled: boolean;
  matches: number;
  yaml_content: string;
  created_at: string;
  updated_at: string;
}

interface TestResult {
  valid_yaml: boolean;
  parse_error: string | null;
  matched: number;
  devices: string[];
}

const PROTOCOLS = ['all', 's7comm', 'ethernet-ip', 'modbus', 'dnp3', 'bacnet', 'profinet', 'iec104', 'snmp', 'lldp'];

const NEW_SIG_TEMPLATE = `name: "New Signature"
protocol: modbus
vendor: ""
category: "PLC"
confidence: 3
purdue_level: 2
match:
  port: 502
metadata:
  description: ""
`;

function timeAgo(iso: string): string {
  try {
    const delta = (Date.now() - new Date(iso).getTime()) / 1000;
    if (delta < 60) return `${Math.floor(delta)}s ago`;
    if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
    if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
    return `${Math.floor(delta / 86400)}d ago`;
  } catch {
    return iso;
  }
}

export default function SignatureEditor() {
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [selected, setSelected] = useState<Signature | null>(null);
  const [yamlDraft, setYamlDraft] = useState<string>('');
  const [search, setSearch] = useState('');
  const [protocolFilter, setProtocolFilter] = useState('all');
  const [testResults, setTestResults] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<Signature[]>('/signatures');
      setSignatures(data);
      if (data.length > 0 && !selected) {
        setSelected(data[0]);
        setYamlDraft(data[0].yaml_content);
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load signatures');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load();   }, []);

  const selectSig = (s: Signature) => {
    if (dirty && !confirm('Discard unsaved changes?')) return;
    setSelected(s);
    setYamlDraft(s.yaml_content);
    setTestResults(null);
    setDirty(false);
  };

  const onYamlChange = (v: string) => {
    setYamlDraft(v);
    setDirty(selected !== null && v !== selected.yaml_content);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const { data } = await api.put<Signature>(`/signatures/${selected.id}`, { yaml_content: yamlDraft });
      setSelected(data);
      setSignatures((prev) => prev.map((s) => (s.id === data.id ? data : s)));
      setDirty(false);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!selected) return;
    setYamlDraft(selected.yaml_content);
    setDirty(false);
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!confirm(`Delete signature "${selected.name}"?`)) return;
    try {
      await api.delete(`/signatures/${selected.id}`);
      const remaining = signatures.filter((s) => s.id !== selected.id);
      setSignatures(remaining);
      const next = remaining[0] ?? null;
      setSelected(next);
      setYamlDraft(next?.yaml_content ?? '');
      setDirty(false);
      setTestResults(null);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Delete failed');
    }
  };

  const handleNew = async () => {
    try {
      const { data } = await api.post<Signature>('/signatures', {
        name: 'New Signature',
        protocol: 'modbus',
        confidence: 3,
        yaml_content: NEW_SIG_TEMPLATE,
      });
      setSignatures((prev) => [data, ...prev]);
      setSelected(data);
      setYamlDraft(data.yaml_content);
      setDirty(false);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Create failed');
    }
  };

  const runTest = async () => {
    if (!selected) return;
    try {
      const { data } = await api.post<TestResult>(`/signatures/${selected.id}/test`);
      setTestResults(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Test failed');
    }
  };

  const filtered = useMemo(
    () => signatures.filter((s) => {
      if (protocolFilter !== 'all' && s.protocol !== protocolFilter) return false;
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }),
    [signatures, protocolFilter, search]
  );

  const grouped = useMemo(
    () => filtered.reduce<Record<string, Signature[]>>((acc, s) => {
      (acc[s.protocol] ??= []).push(s);
      return acc;
    }, {}),
    [filtered]
  );

  const stats = useMemo(() => {
    const avg = signatures.length > 0
      ? (signatures.reduce((sum, s) => sum + s.confidence, 0) / signatures.length).toFixed(1)
      : '–';
    const protocols = new Set(signatures.map((s) => s.protocol)).size;
    const lastUpdated = signatures.length > 0
      ? timeAgo([...signatures].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0].updated_at)
      : '–';
    return { total: signatures.length, protocols, avg, lastUpdated };
  }, [signatures]);

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left panel - signature list */}
      <div className="w-80 border-r border-border-default bg-surface-card flex flex-col">
        <div className="p-3 border-b border-border-default space-y-2">
          <div className="flex items-center gap-2">
            <Fingerprint size={18} className="text-accent" />
            <span className="text-sm font-bold text-content-primary">Signatures</span>
            <span className="ml-auto text-[10px] text-content-tertiary">{signatures.length}</span>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-tertiary" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search signatures..."
              className="w-full rounded border border-border-default bg-bg-secondary text-content-primary text-xs px-3 py-1.5 pl-8 placeholder:text-content-muted"
            />
          </div>
          <select
            value={protocolFilter}
            onChange={(e) => setProtocolFilter(e.target.value)}
            className="w-full rounded border border-border-default bg-bg-secondary text-content-primary text-xs px-2 py-1"
          >
            {PROTOCOLS.map((p) => <option key={p} value={p}>{p === 'all' ? 'All Protocols' : p}</option>)}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-4 text-xs text-content-tertiary text-center">Loading…</div>
          )}
          {!loading && signatures.length === 0 && (
            <div className="p-4 text-xs text-content-tertiary text-center">
              No signatures yet. Click “New Signature” below.
            </div>
          )}
          {Object.entries(grouped).map(([proto, sigs]) => (
            <div key={proto}>
              <div className="px-3 py-1.5 text-[10px] font-semibold text-content-tertiary uppercase bg-bg-primary sticky top-0">{proto}</div>
              {sigs.map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectSig(s)}
                  className={`w-full text-left px-3 py-2 border-b border-border-default hover:bg-surface-hover transition-colors ${selected?.id === s.id ? 'bg-accent/10 border-l-2 border-l-accent' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-content-primary truncate">{s.name}</span>
                    {s.matches > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] bg-emerald-500/15 text-emerald-400">{s.matches}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-content-tertiary">Confidence: </span>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map((n) => (
                        <div key={n} className={`w-1.5 h-1.5 rounded-full ${n <= s.confidence ? 'bg-accent' : 'bg-border-default'}`} />
                      ))}
                    </div>
                    <span className="text-[10px] text-content-tertiary ml-auto">{timeAgo(s.updated_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-border-default">
          <Button variant="outline" size="sm" className="w-full" onClick={handleNew}>
            <Plus size={14} /> New Signature
          </Button>
        </div>
      </div>

      {/* Right panel - editor */}
      <div className="flex-1 flex flex-col">
        {error && (
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-red-400 bg-red-500/10 border-b border-red-500/30">
            <AlertCircle size={12} /> {error}
            <button onClick={() => setError(null)} className="ml-auto text-content-tertiary hover:text-content-primary"><X size={12} /></button>
          </div>
        )}

        {selected ? (
          <>
            <div className="px-4 py-3 border-b border-border-default flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-content-primary">
                  {selected.name}
                  {dirty && <span className="ml-2 text-[10px] text-amber-400">(unsaved)</span>}
                </h2>
                <p className="text-[10px] text-content-tertiary">
                  Protocol: {selected.protocol} &middot; Confidence: {selected.confidence}/5 &middot; Matches: {selected.matches}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={runTest}><Play size={12} /> Test</Button>
                <Button variant="outline" size="sm" onClick={handleReset} disabled={!dirty}><RotateCcw size={12} /> Reset</Button>
                <Button variant="primary" size="sm" onClick={handleSave} disabled={!dirty || saving}>
                  <Save size={12} /> {saving ? 'Saving…' : 'Save'}
                </Button>
                <Button variant="danger" size="sm" onClick={handleDelete}><Trash2 size={12} /></Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="rounded-lg border border-border-default overflow-hidden">
                <div className="px-3 py-2 border-b border-border-default bg-bg-secondary flex items-center gap-2">
                  <FileCode size={14} className="text-content-tertiary" />
                  <span className="text-xs font-medium text-content-primary">signature.yaml</span>
                </div>
                <textarea
                  value={yamlDraft}
                  onChange={(e) => onYamlChange(e.target.value)}
                  className="w-full bg-bg-primary text-content-primary font-mono text-xs p-4 border-0 outline-none resize-none"
                  rows={20}
                  spellCheck={false}
                />
              </div>

              {testResults && (
                <div className="rounded-lg border border-border-default bg-surface-card p-4">
                  <p className="text-sm font-medium text-content-primary flex items-center gap-2 mb-3">
                    <Play size={14} className="text-accent" /> Test Results
                  </p>
                  {!testResults.valid_yaml && (
                    <div className="mb-3 px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                      YAML parse error: {testResults.parse_error}
                    </div>
                  )}
                  <div className="flex items-center gap-4 mb-3">
                    <span className={`text-xs font-medium ${testResults.matched > 0 ? 'text-emerald-400' : 'text-content-tertiary'}`}>
                      {testResults.matched > 0
                        ? <Check size={12} className="inline mr-1" />
                        : <X size={12} className="inline mr-1" />}
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

              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Total Signatures', value: String(stats.total), icon: Fingerprint },
                  { label: 'Protocols Covered', value: String(stats.protocols), icon: Layers },
                  { label: 'Avg Confidence', value: stats.avg, icon: ChevronRight },
                  { label: 'Last Updated', value: stats.lastUpdated, icon: FileCode },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-border-default bg-surface-card p-3">
                    <p className="text-[10px] text-content-tertiary flex items-center gap-1"><s.icon size={10} /> {s.label}</p>
                    <p className="text-lg font-bold text-content-primary mt-1">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-content-tertiary">
            {loading ? 'Loading signatures…' : 'Select a signature from the list or create a new one.'}
          </div>
        )}
      </div>
    </div>
  );
}
