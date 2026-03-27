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
    group: 'Capture',
    items: [
      { label: 'PCAP Analysis', path: '/pcap', icon: 'FileSearch' },
      { label: 'Tool Import', path: '/scans/import', icon: 'Upload' },
      { label: 'External Tools', path: '/integrations', icon: 'Plug' },
    ],
  },
  {
    group: 'Discovery',
    items: [
      { label: 'Topology', path: '/network', icon: 'Network' },
      { label: 'Device Inventory', path: '/assets', icon: 'Server' },
      { label: 'Protocol Analysis', path: '/protocols', icon: 'Activity' },
      { label: 'Purdue Model', path: '/purdue', icon: 'Layers' },
      { label: 'Signatures', path: '/signatures', icon: 'Fingerprint' },
    ],
  },
  {
    group: 'Security',
    items: [
      { label: 'MITRE ATT&CK', path: '/threats', icon: 'Skull' },
      { label: 'CVE Matching', path: '/vulnerabilities', icon: 'ShieldAlert' },
      { label: 'Attack Paths', path: '/attack-paths', icon: 'Route' },
      { label: 'Baseline Drift', path: '/baseline', icon: 'GitCompare' },
    ],
  },
  {
    group: 'Compliance',
    items: [
      { label: 'IEC/NIST/NERC', path: '/compliance', icon: 'ClipboardCheck' },
      { label: 'SBOM', path: '/sbom', icon: 'Package' },
    ],
  },
  {
    group: 'Analytics',
    items: [
      { label: 'Scorecard', path: '/scorecard', icon: 'Gauge' },
      { label: 'Metrics', path: '/metrics', icon: 'BarChart3' },
      { label: 'Timeline', path: '/timeline', icon: 'CalendarClock' },
    ],
  },
  {
    group: 'Operations',
    items: [
      { label: 'Sessions & Projects', path: '/sessions', icon: 'FolderOpen' },
      { label: 'Workshop', path: '/workshop', icon: 'Wrench' },
    ],
  },
  {
    group: 'Reporting',
    items: [
      { label: 'Assessment Reports', path: '/reports', icon: 'FileText' },
      { label: 'Export & STIX', path: '/exports', icon: 'Download' },
    ],
  },
  {
    group: 'AI',
    items: [
      { label: 'AI Copilot', path: '/copilot', icon: 'Bot' },
    ],
  },
];
