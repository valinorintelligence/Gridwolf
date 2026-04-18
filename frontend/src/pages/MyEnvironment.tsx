import { useState, useEffect } from 'react';
import {
  Settings, Shield, CheckCircle2, Factory, Zap, Droplets, Fuel,
  Train, Heart, Search, Save, AlertTriangle, Globe, Server, Loader
} from 'lucide-react';
import { api } from '@/services/api';

// ─── Types ────────────────────────────────────────────────────────

interface VendorOption {
  id: string;
  name: string;
  products: string[];
  logo: string;
}

interface SectorOption {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  description: string;
}

interface MatchedAdvisory {
  id: string;
  cve_id: string | null;
  title: string;
  severity: string;
  cvss_score: number | null;
  vendor: string | null;
}

// ─── Static Domain Data ──────────────────────────────────────────

const VENDORS: VendorOption[] = [
  { id: 'siemens', name: 'Siemens', products: ['S7-1500', 'S7-1200', 'S7-300', 'SCALANCE', 'SINEMA', 'WinCC', 'TIA Portal'], logo: '🏭' },
  { id: 'schneider', name: 'Schneider Electric', products: ['Modicon M340', 'Modicon M580', 'Magelis HMI', 'EcoStruxure', 'Unity Pro', 'Triconex'], logo: '⚡' },
  { id: 'rockwell', name: 'Rockwell Automation', products: ['ControlLogix', 'CompactLogix', 'GuardLogix', 'FactoryTalk', 'Studio 5000', 'PanelView'], logo: '🔧' },
  { id: 'abb', name: 'ABB', products: ['Ability Symphony Plus', 'AC800M', 'ASPECT BMS', '800xA', 'Freelance'], logo: '🔴' },
  { id: 'moxa', name: 'Moxa', products: ['EDR-G9010', 'EDS Series', 'ioLogik', 'NPort', 'AWK Series'], logo: '📡' },
  { id: 'ge', name: 'GE Digital', products: ['D20 RTU', 'Mark VIe', 'iFIX', 'Proficy', 'CIMPLICITY'], logo: '🌐' },
  { id: 'honeywell', name: 'Honeywell', products: ['Experion PKS', 'C300', 'Safety Manager', 'Uniformance', 'PlantCruise'], logo: '🛡️' },
  { id: 'emerson', name: 'Emerson', products: ['DeltaV', 'Ovation', 'ROC800', 'AMS Device Manager', 'Plantweb'], logo: '📊' },
  { id: 'yokogawa', name: 'Yokogawa', products: ['CENTUM VP', 'ProSafe-RS', 'STARDOM', 'Vnet/IP', 'Plant Resource Manager'], logo: '🔬' },
  { id: 'fortinet', name: 'Fortinet', products: ['FortiGate', 'FortiOS', 'FortiManager', 'FortiAnalyzer'], logo: '🔐' },
  { id: 'wago', name: 'WAGO', products: ['PFC200', 'PFC100', 'Touch Panel 600', '750 Series'], logo: '🔌' },
  { id: 'phoenix', name: 'Phoenix Contact', products: ['PLCnext', 'mGuard', 'FL Switch', 'QUINT Power'], logo: '🦅' },
];

const SECTORS: SectorOption[] = [
  { id: 'energy', name: 'Energy & Utilities', icon: Zap, color: '#f97316', description: 'Power generation, transmission, distribution, solar, wind, nuclear' },
  { id: 'water', name: 'Water & Wastewater', icon: Droplets, color: '#3b82f6', description: 'Water treatment, distribution, wastewater processing, SCADA systems' },
  { id: 'manufacturing', name: 'Manufacturing', icon: Factory, color: '#10b981', description: 'Discrete & process manufacturing, automotive, pharma, food & beverage' },
  { id: 'oil_gas', name: 'Oil & Gas', icon: Fuel, color: '#eab308', description: 'Upstream, midstream, downstream operations, pipeline SCADA, refining' },
  { id: 'transportation', name: 'Transportation', icon: Train, color: '#8b5cf6', description: 'Rail, aviation, maritime, traffic management, fleet systems' },
  { id: 'healthcare', name: 'Healthcare', icon: Heart, color: '#ef4444', description: 'BMS in hospitals, medical device networks, HVAC control systems' },
];

const SEV_COLORS: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#3b82f6',
};

const STORAGE_KEY = 'gridwolf_environment';

// ─── Component ────────────────────────────────────────────────────

export default function MyEnvironment() {
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set(['siemens', 'schneider', 'rockwell']));
  const [selectedSectors, setSelectedSectors] = useState<Set<string>>(new Set(['manufacturing', 'energy']));
  const [vendorSearch, setVendorSearch] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const [matchedAdvisories, setMatchedAdvisories] = useState<MatchedAdvisory[]>([]);
  const [matchedLoading, setMatchedLoading] = useState(true);

  // Load saved environment from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.vendors) setSelectedVendors(new Set(parsed.vendors));
        if (parsed.sectors) setSelectedSectors(new Set(parsed.sectors));
      } catch {
        // ignore corrupt storage
      }
    }
  }, []);

  // Fetch matched advisories from real API
  useEffect(() => {
    api.get('/ics/advisories/matched')
      .then((r) => {
        const items = r.data?.matches ?? r.data ?? [];
        setMatchedAdvisories(Array.isArray(items) ? items : []);
      })
      .catch(() => setMatchedAdvisories([]))
      .finally(() => setMatchedLoading(false));
  }, []);

  const toggleVendor = (id: string) => {
    const next = new Set(selectedVendors);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedVendors(next);
    setSaved(false);
  };

  const toggleSector = (id: string) => {
    const next = new Set(selectedSectors);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedSectors(next);
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      vendors: [...selectedVendors],
      sectors: [...selectedSectors],
    };
    // Persist locally always
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    // Also push to backend (best-effort)
    try {
      await api.post('/ics/advisories/environment', payload);
    } catch {
      // Backend endpoint may not be wired yet; local save is sufficient
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const filteredVendors = VENDORS.filter(
    (v) => !vendorSearch || v.name.toLowerCase().includes(vendorSearch.toLowerCase()),
  );

  // Filter matched advisories by selected vendors
  const visibleMatched = matchedAdvisories.filter((m) => {
    if (!m.vendor) return true;
    const vendorLower = m.vendor.toLowerCase();
    return [...selectedVendors].some((id) => vendorLower.includes(id) || id.includes(vendorLower));
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="text-blue-400" size={28} />
            My Environment
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Configure your ICS/OT environment for personalized vulnerability alerts and prioritization
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-60 ${
            saved
              ? 'bg-green-500/20 text-green-400'
              : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
          }`}
        >
          {saving ? (
            <><Loader size={14} className="animate-spin" /> Saving…</>
          ) : saved ? (
            <><CheckCircle2 size={14} /> Saved!</>
          ) : (
            <><Save size={14} /> Save Environment</>
          )}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-neutral-400">Selected Vendors</span>
            <Server size={16} className="text-blue-400" />
          </div>
          <div className="text-3xl font-bold text-white">{selectedVendors.size}</div>
          <div className="text-xs text-neutral-500 mt-1">of {VENDORS.length} available</div>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-neutral-400">Selected Sectors</span>
            <Globe size={16} className="text-green-400" />
          </div>
          <div className="text-3xl font-bold text-white">{selectedSectors.size}</div>
          <div className="text-xs text-neutral-500 mt-1">of {SECTORS.length} available</div>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-neutral-400">Matched Advisories</span>
            <AlertTriangle size={16} className="text-orange-400" />
          </div>
          <div className="text-3xl font-bold text-orange-400">
            {matchedLoading ? '…' : visibleMatched.length}
          </div>
          <div className="text-xs text-neutral-500 mt-1">affecting your environment</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Vendors */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">ICS/OT Vendors</h2>
            <button
              onClick={() => setSelectedVendors(new Set(VENDORS.map((v) => v.id)))}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Select All
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={14} />
            <input
              type="text"
              value={vendorSearch}
              onChange={(e) => setVendorSearch(e.target.value)}
              placeholder="Search vendors…"
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {filteredVendors.map((vendor) => {
              const selected = selectedVendors.has(vendor.id);
              return (
                <div
                  key={vendor.id}
                  onClick={() => toggleVendor(vendor.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selected
                      ? 'border-blue-500/50 bg-blue-500/5'
                      : 'border-neutral-800 bg-neutral-900/50 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${selected ? 'bg-blue-500/20' : 'bg-neutral-800'}`}>
                        {vendor.logo}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{vendor.name}</div>
                        <div className="text-xs text-neutral-500">
                          {vendor.products.slice(0, 3).join(', ')}
                          {vendor.products.length > 3 ? ` +${vendor.products.length - 3} more` : ''}
                        </div>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selected ? 'border-blue-500 bg-blue-500' : 'border-neutral-600'}`}>
                      {selected && <CheckCircle2 size={12} className="text-white" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sectors + Matched Preview */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Industry Sectors</h2>

          <div className="space-y-2">
            {SECTORS.map((sector) => {
              const selected = selectedSectors.has(sector.id);
              const Icon = sector.icon;
              return (
                <div
                  key={sector.id}
                  onClick={() => toggleSector(sector.id)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selected
                      ? 'border-blue-500/50 bg-blue-500/5'
                      : 'border-neutral-800 bg-neutral-900/50 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selected ? 'bg-blue-500/20' : 'bg-neutral-800'}`}>
                        <Icon size={20} style={{ color: sector.color }} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{sector.name}</div>
                        <div className="text-xs text-neutral-500 mt-0.5">{sector.description}</div>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selected ? 'border-blue-500 bg-blue-500' : 'border-neutral-600'}`}>
                      {selected && <CheckCircle2 size={12} className="text-white" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Matched Advisories Preview */}
          <div className="mt-2">
            <h3 className="text-sm font-semibold text-neutral-400 uppercase mb-3 flex items-center gap-2">
              <Shield size={12} /> Matched Advisories Preview
            </h3>

            {matchedLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              </div>
            ) : visibleMatched.length === 0 ? (
              <div className="text-center py-6 text-neutral-500 text-sm">
                {selectedVendors.size === 0
                  ? 'Select vendors to see matching advisories'
                  : 'No advisories matched for selected vendors'}
              </div>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto">
                {visibleMatched.slice(0, 20).map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-neutral-800/50 border border-neutral-800"
                  >
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0"
                      style={{
                        backgroundColor: `${SEV_COLORS[m.severity] ?? '#6b7280'}20`,
                        color: SEV_COLORS[m.severity] ?? '#6b7280',
                      }}
                    >
                      {m.cvss_score != null ? m.cvss_score.toFixed(1) : m.severity.toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white truncate">{m.title}</div>
                      {m.cve_id && (
                        <div className="text-[10px] text-neutral-500 font-mono">{m.cve_id}</div>
                      )}
                    </div>
                    {m.vendor && (
                      <span className="text-[10px] text-neutral-500 shrink-0">{m.vendor}</span>
                    )}
                  </div>
                ))}
                {visibleMatched.length > 20 && (
                  <p className="text-center text-xs text-neutral-500 py-1">
                    +{visibleMatched.length - 20} more — see Vuln Feed
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
