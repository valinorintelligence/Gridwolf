export const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
  info: '#6b7280',
};

export const OBJECT_TYPE_COLORS: Record<string, string> = {
  vulnerability: 'var(--color-vuln)',
  asset: 'var(--color-asset)',
  threat: 'var(--color-threat)',
  network: 'var(--color-network)',
  compliance: 'var(--color-compliance)',
  identity: 'var(--color-identity)',
  application: 'var(--color-application)',
  alert: 'var(--color-alert)',
};

export const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'] as const;

export const PURDUE_LEVELS = [
  { level: 0, name: 'L0 - Physical Process' },
  { level: 1, name: 'L1 - Basic Control' },
  { level: 2, name: 'L2 - Area Supervisory' },
  { level: 3, name: 'L3 - Site Operations' },
  { level: 3.5, name: 'DMZ' },
  { level: 4, name: 'L4 - Enterprise Network' },
  { level: 5, name: 'L5 - Enterprise Zone' },
] as const;

export interface NavItem {
  label: string;
  path: string;
  icon: string;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    group: 'Overview',
    items: [
      { label: 'Command Center', path: '/', icon: 'LayoutDashboard' },
    ],
  },
  {
    group: 'Ontology',
    items: [
      { label: 'Explorer', path: '/ontology', icon: 'Boxes' },
      { label: 'Relationship Graph', path: '/graph', icon: 'GitFork' },
    ],
  },
  {
    group: 'Network',
    items: [
      { label: 'Topology', path: '/network', icon: 'Network' },
      { label: 'Asset Inventory', path: '/assets', icon: 'Server' },
      { label: 'Protocol Analyzer', path: '/protocols', icon: 'Activity' },
      { label: 'Purdue Model', path: '/purdue', icon: 'Layers' },
    ],
  },
  {
    group: 'Security',
    items: [
      { label: 'Vulnerabilities', path: '/vulnerabilities', icon: 'ShieldAlert' },
      { label: 'Threats', path: '/threats', icon: 'Skull' },
      { label: 'Attack Paths', path: '/attack-paths', icon: 'Route' },
    ],
  },
  {
    group: 'Compliance',
    items: [
      { label: 'Compliance', path: '/compliance', icon: 'ClipboardCheck' },
      { label: 'SBOM', path: '/sbom', icon: 'Package' },
    ],
  },
  {
    group: 'Analytics',
    items: [
      { label: 'Scorecard', path: '/scorecard', icon: 'Gauge' },
      { label: 'SLA Tracker', path: '/sla', icon: 'Timer' },
      { label: 'Metrics', path: '/metrics', icon: 'BarChart3' },
      { label: 'Timeline', path: '/timeline', icon: 'CalendarClock' },
    ],
  },
  {
    group: 'Operations',
    items: [
      { label: 'Scan Import', path: '/scans/import', icon: 'Upload' },
      { label: 'Integrations', path: '/integrations', icon: 'Plug' },
      { label: 'Workshop', path: '/workshop', icon: 'Wrench' },
    ],
  },
  {
    group: 'AI',
    items: [
      { label: 'AI Copilot', path: '/copilot', icon: 'Bot' },
    ],
  },
];
