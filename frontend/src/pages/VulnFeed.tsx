import { useState, useEffect, useMemo } from 'react';
import {
  Shield, AlertTriangle, Clock, ChevronDown, ChevronRight, Search,
  Download, RefreshCw, Filter, ExternalLink, CheckCircle2, XCircle,
  Zap, Eye, EyeOff, ArrowUpDown, Globe, Lock, Unlock, User,
  Activity, TrendingUp, Bell, ChevronUp, Info
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

interface Advisory {
  id: string;
  cve_id: string;
  title: string;
  description: string;
  source: string;
  vendor: string;
  products: string[];
  affected_versions: string;
  fixed_versions: string;
  cvss_score: number;
  cvss_vector: string;
  severity: string;
  kev_listed: boolean;
  kev_due_date: string;
  epss_score: number;
  epss_percentile: number;
  urgency_tier: string;
  attack_vector: string;
  auth_required: string;
  complexity: string;
  user_interaction: string;
  sector: string;
  published_date: string;
  patch_available: boolean;
  remediation_immediate: string;
  remediation_scheduled: string;
  remediation_longterm: string;
  references: string[];
  disposition: string;
  dismissed: boolean;
}

// ─── Mock Data ────────────────────────────────────────────────

const ADVISORIES: Advisory[] = [
  {
    id: 'adv-001', cve_id: 'CVE-2024-38876',
    title: 'Siemens S7-1500 TLS Certificate Verification Bypass',
    description: 'A vulnerability in the TLS certificate verification of Siemens S7-1500 PLCs allows an unauthenticated attacker to perform man-in-the-middle attacks and execute arbitrary code on affected devices.',
    source: 'siemens', vendor: 'Siemens', products: ['S7-1500', 'S7-1500S', 'ET 200SP'],
    affected_versions: '< V3.1.0', fixed_versions: 'V3.1.0',
    cvss_score: 9.8, cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
    severity: 'critical', kev_listed: true, kev_due_date: '2024-09-15',
    epss_score: 0.42, epss_percentile: 0.97, urgency_tier: 'act_now',
    attack_vector: 'network', auth_required: 'none', complexity: 'low', user_interaction: 'none',
    sector: 'manufacturing', published_date: '2024-07-12', patch_available: true,
    remediation_immediate: 'Apply network segmentation to isolate S7-1500 devices. Block port 102 from untrusted networks.',
    remediation_scheduled: 'Update firmware to V3.1.0 during next maintenance window.',
    remediation_longterm: 'Implement TLS mutual authentication and certificate pinning for all S7 communications.',
    references: ['https://cert-portal.siemens.com/productcert/csaf/ssa-398330.json'],
    disposition: 'new', dismissed: false,
  },
  {
    id: 'adv-002', cve_id: 'CVE-2023-46280',
    title: 'Rockwell ControlLogix Firmware Manipulation via CIP',
    description: 'Improper input validation in Rockwell Automation ControlLogix 1756 controllers allows an unauthenticated attacker to send crafted CIP messages that manipulate controller firmware.',
    source: 'rockwell', vendor: 'Rockwell Automation', products: ['ControlLogix 1756-L8', 'GuardLogix 1756'],
    affected_versions: '< V33.016', fixed_versions: 'V33.016',
    cvss_score: 9.8, cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
    severity: 'critical', kev_listed: true, kev_due_date: '2024-01-15',
    epss_score: 0.67, epss_percentile: 0.99, urgency_tier: 'act_now',
    attack_vector: 'network', auth_required: 'none', complexity: 'low', user_interaction: 'none',
    sector: 'manufacturing', published_date: '2023-10-20', patch_available: true,
    remediation_immediate: 'Apply CIP firewall rules blocking unauthorized access to port 44818.',
    remediation_scheduled: 'Apply firmware patch V33.016 during next maintenance window.',
    remediation_longterm: 'Implement CIP Security with device-level authentication and encryption.',
    references: [], disposition: 'new', dismissed: false,
  },
  {
    id: 'adv-003', cve_id: 'CVE-2024-3400',
    title: 'Fortinet FortiGate SSL-VPN Command Injection (OT DMZ)',
    description: 'A critical command injection vulnerability in Fortinet FortiOS SSL-VPN, commonly deployed in OT DMZ architectures, allows unauthenticated remote code execution on firewall appliances.',
    source: 'cisa', vendor: 'Fortinet', products: ['FortiOS', 'FortiGate'],
    affected_versions: '6.x - 7.4.2', fixed_versions: '7.4.3',
    cvss_score: 9.8, cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
    severity: 'critical', kev_listed: true, kev_due_date: '2024-04-22',
    epss_score: 0.95, epss_percentile: 1.0, urgency_tier: 'act_now',
    attack_vector: 'network', auth_required: 'none', complexity: 'low', user_interaction: 'none',
    sector: 'energy', published_date: '2024-04-12', patch_available: true,
    remediation_immediate: 'Disable SSL-VPN if not critical. Apply emergency patch immediately.',
    remediation_scheduled: 'Upgrade FortiOS to 7.4.3+.',
    remediation_longterm: 'Implement zero-trust network access replacing traditional VPN for OT remote access.',
    references: ['https://www.fortiguard.com/psirt/FG-IR-24-015'],
    disposition: 'acknowledged', dismissed: false,
  },
  {
    id: 'adv-004', cve_id: 'CVE-2024-29104',
    title: 'Schneider Electric Magelis HMI Hardcoded Credentials',
    description: 'Hardcoded credentials in the web interface of Schneider Electric Magelis HMI panels allow an unauthenticated attacker to gain full administrative access.',
    source: 'schneider', vendor: 'Schneider Electric', products: ['Magelis GTU', 'Magelis GTO'],
    affected_versions: '< V4.0.2', fixed_versions: 'V4.0.2',
    cvss_score: 9.1, cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N',
    severity: 'critical', kev_listed: true, kev_due_date: '2024-06-30',
    epss_score: 0.38, epss_percentile: 0.96, urgency_tier: 'act_now',
    attack_vector: 'network', auth_required: 'none', complexity: 'low', user_interaction: 'none',
    sector: 'manufacturing', published_date: '2024-03-15', patch_available: true,
    remediation_immediate: 'Change default credentials immediately. Block web interface from untrusted networks.',
    remediation_scheduled: 'Update to firmware V4.0.2.',
    remediation_longterm: 'Implement network segmentation and role-based access control for HMI devices.',
    references: [], disposition: 'in_progress', dismissed: false,
  },
  {
    id: 'adv-005', cve_id: 'CVE-2023-6408',
    title: 'Schneider Modicon M340 Unauthenticated Safety Register Writes',
    description: 'Schneider Electric Modicon M340 PLCs allow unauthenticated Modbus TCP writes to safety-critical registers, potentially causing unsafe process conditions.',
    source: 'schneider', vendor: 'Schneider Electric', products: ['Modicon M340', 'Modicon M580'],
    affected_versions: 'All versions', fixed_versions: 'N/A',
    cvss_score: 9.1, cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H',
    severity: 'critical', kev_listed: true, kev_due_date: '2024-03-01',
    epss_score: 0.31, epss_percentile: 0.95, urgency_tier: 'act_now',
    attack_vector: 'network', auth_required: 'none', complexity: 'low', user_interaction: 'none',
    sector: 'energy', published_date: '2023-12-10', patch_available: false,
    remediation_immediate: 'Implement Modbus TCP firewall rules restricting write function codes.',
    remediation_scheduled: 'Deploy dedicated Modbus-aware IDS to monitor for unauthorized writes.',
    remediation_longterm: 'Enable ACLs on M340 and migrate to M580 with CyberSecure features.',
    references: [], disposition: 'new', dismissed: false,
  },
  {
    id: 'adv-006', cve_id: 'CVE-2023-3595',
    title: 'Rockwell EtherNet/IP Stack Remote Code Execution',
    description: 'Critical vulnerability in the Rockwell Automation EtherNet/IP communication stack enables remote code execution via specially crafted CIP messages.',
    source: 'cisa', vendor: 'Rockwell Automation', products: ['ControlLogix 1756-EN2T', 'GuardLogix'],
    affected_versions: '< V33.013', fixed_versions: 'V33.013',
    cvss_score: 9.8, cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
    severity: 'critical', kev_listed: true, kev_due_date: '2023-09-01',
    epss_score: 0.72, epss_percentile: 0.99, urgency_tier: 'act_now',
    attack_vector: 'network', auth_required: 'none', complexity: 'low', user_interaction: 'none',
    sector: 'manufacturing', published_date: '2023-07-12', patch_available: true,
    remediation_immediate: 'Block CIP traffic from untrusted networks immediately.',
    remediation_scheduled: 'Apply patch V33.013. Restrict EtherNet/IP access with ACLs.',
    remediation_longterm: 'Deploy defense-in-depth with IDS/IPS monitoring CIP traffic patterns.',
    references: ['https://www.cisa.gov/news-events/ics-advisories/icsa-23-193-01'],
    disposition: 'remediated', dismissed: false,
  },
  {
    id: 'adv-007', cve_id: 'CVE-2024-41203',
    title: 'GE D20 RTU DNP3 Buffer Overflow',
    description: 'A buffer overflow in the DNP3 protocol stack of GE Digital D20 RTUs allows remote code execution when processing malformed DNP3 application layer fragments.',
    source: 'cisa', vendor: 'GE Digital', products: ['D20MX RTU', 'D20ME RTU'],
    affected_versions: '< V7.20.1', fixed_versions: 'V7.20.1',
    cvss_score: 7.5, cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H',
    severity: 'high', kev_listed: false, kev_due_date: '',
    epss_score: 0.08, epss_percentile: 0.72, urgency_tier: 'plan_patch',
    attack_vector: 'network', auth_required: 'none', complexity: 'low', user_interaction: 'none',
    sector: 'energy', published_date: '2024-08-05', patch_available: true,
    remediation_immediate: 'Implement DNP3 Secure Authentication. Restrict port 20000 access.',
    remediation_scheduled: 'Apply firmware patch V7.20.1.',
    remediation_longterm: 'Migrate to DNP3-SA or IEC 62351 secured communications.',
    references: [], disposition: 'new', dismissed: false,
  },
  {
    id: 'adv-008', cve_id: 'CVE-2024-22039',
    title: 'Siemens SINEMA Remote Connect Path Traversal',
    description: 'Path traversal vulnerability in Siemens SINEMA Remote Connect Server allows authenticated attackers to read and write arbitrary files.',
    source: 'siemens', vendor: 'Siemens', products: ['SINEMA Remote Connect Server'],
    affected_versions: '< V3.2', fixed_versions: 'V3.2',
    cvss_score: 7.2, cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:N',
    severity: 'high', kev_listed: false, kev_due_date: '',
    epss_score: 0.05, epss_percentile: 0.61, urgency_tier: 'plan_patch',
    attack_vector: 'network', auth_required: 'high', complexity: 'low', user_interaction: 'none',
    sector: 'manufacturing', published_date: '2024-02-15', patch_available: true,
    remediation_immediate: 'Restrict management interface to trusted admin workstations.',
    remediation_scheduled: 'Update to SINEMA RC Server V3.2.',
    remediation_longterm: 'Implement zero-trust remote access with MFA.',
    references: [], disposition: 'new', dismissed: false,
  },
  {
    id: 'adv-009', cve_id: 'CVE-2023-27357',
    title: 'Moxa EDR-G9010 Industrial Router Command Injection',
    description: 'Moxa EDR-G9010 industrial secure routers are vulnerable to unauthenticated command injection through the web management interface.',
    source: 'moxa', vendor: 'Moxa', products: ['EDR-G9010', 'EDR-G9004'],
    affected_versions: '< V3.0', fixed_versions: 'V3.0',
    cvss_score: 8.8, cvss_vector: 'CVSS:3.1/AV:A/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
    severity: 'high', kev_listed: false, kev_due_date: '',
    epss_score: 0.12, epss_percentile: 0.83, urgency_tier: 'act_now',
    attack_vector: 'adjacent', auth_required: 'none', complexity: 'low', user_interaction: 'none',
    sector: 'energy', published_date: '2023-09-18', patch_available: true,
    remediation_immediate: 'Restrict management interface to dedicated management VLAN.',
    remediation_scheduled: 'Update firmware to V3.0+.',
    remediation_longterm: 'Implement out-of-band management for all industrial network devices.',
    references: [], disposition: 'new', dismissed: false,
  },
  {
    id: 'adv-010', cve_id: 'CVE-2024-50321',
    title: 'Siemens SCALANCE Industrial Switch DoS via PROFINET',
    description: 'Siemens SCALANCE XM-400 and XR-500 industrial switches are vulnerable to denial of service through crafted PROFINET DCP packets.',
    source: 'siemens', vendor: 'Siemens', products: ['SCALANCE XM-400', 'SCALANCE XR-500'],
    affected_versions: '< V6.6', fixed_versions: 'V6.6',
    cvss_score: 6.5, cvss_vector: 'CVSS:3.1/AV:A/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H',
    severity: 'medium', kev_listed: false, kev_due_date: '',
    epss_score: 0.02, epss_percentile: 0.38, urgency_tier: 'monitor',
    attack_vector: 'adjacent', auth_required: 'none', complexity: 'low', user_interaction: 'none',
    sector: 'manufacturing', published_date: '2024-11-12', patch_available: true,
    remediation_immediate: 'Monitor for anomalous PROFINET DCP traffic patterns.',
    remediation_scheduled: 'Update SCALANCE firmware to V6.6.',
    remediation_longterm: 'Implement PROFINET-aware IDS and network access control.',
    references: [], disposition: 'new', dismissed: false,
  },
  {
    id: 'adv-011', cve_id: 'CVE-2024-47901',
    title: 'ABB Ability Symphony Plus DCS Authentication Bypass',
    description: 'An authentication bypass in ABB Ability Symphony Plus DCS allows unauthenticated access to engineering functions.',
    source: 'abb', vendor: 'ABB', products: ['Ability Symphony Plus', 'S+ Operations'],
    affected_versions: '< 3.3 SP2', fixed_versions: '3.3 SP2',
    cvss_score: 9.1, cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N',
    severity: 'critical', kev_listed: false, kev_due_date: '',
    epss_score: 0.18, epss_percentile: 0.90, urgency_tier: 'act_now',
    attack_vector: 'network', auth_required: 'none', complexity: 'low', user_interaction: 'none',
    sector: 'energy', published_date: '2024-10-28', patch_available: true,
    remediation_immediate: 'Restrict engineering workstation access to authorized personnel only.',
    remediation_scheduled: 'Apply Service Pack 2 for Symphony Plus 3.3.',
    remediation_longterm: 'Implement RBAC and audit logging for all DCS configuration changes.',
    references: [], disposition: 'new', dismissed: false,
  },
  {
    id: 'adv-012', cve_id: 'CVE-2024-36527',
    title: 'CERT@VDE: WAGO PFC200 Controller Privilege Escalation',
    description: 'WAGO PFC200 controllers contain a local privilege escalation allowing an authenticated user to gain root access.',
    source: 'certvde', vendor: 'WAGO', products: ['PFC200', 'PFC100'],
    affected_versions: '< FW24', fixed_versions: 'FW24',
    cvss_score: 7.8, cvss_vector: 'CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H',
    severity: 'high', kev_listed: false, kev_due_date: '',
    epss_score: 0.04, epss_percentile: 0.55, urgency_tier: 'plan_patch',
    attack_vector: 'local', auth_required: 'low', complexity: 'low', user_interaction: 'none',
    sector: 'manufacturing', published_date: '2024-06-15', patch_available: true,
    remediation_immediate: 'Restrict physical and SSH access to PFC200 devices.',
    remediation_scheduled: 'Update to firmware FW24.',
    remediation_longterm: 'Implement least-privilege access for all controller management interfaces.',
    references: ['https://cert.vde.com/en/advisories/VDE-2024-032/'],
    disposition: 'new', dismissed: false,
  },
  {
    id: 'adv-013', cve_id: 'CVE-2024-28883',
    title: 'Schneider Electric EcoStruxure Control Expert RCE',
    description: 'Remote code execution in Schneider Electric EcoStruxure Control Expert via crafted project files.',
    source: 'schneider', vendor: 'Schneider Electric', products: ['EcoStruxure Control Expert', 'Unity Pro'],
    affected_versions: '< V16.0', fixed_versions: 'V16.0',
    cvss_score: 8.6, cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:H/I:H/A:N',
    severity: 'high', kev_listed: false, kev_due_date: '',
    epss_score: 0.09, epss_percentile: 0.75, urgency_tier: 'plan_patch',
    attack_vector: 'network', auth_required: 'none', complexity: 'low', user_interaction: 'required',
    sector: 'energy', published_date: '2024-05-18', patch_available: true,
    remediation_immediate: 'Do not open untrusted project files. Enable application whitelisting.',
    remediation_scheduled: 'Update to Control Expert V16.0.',
    remediation_longterm: 'Implement file integrity monitoring on engineering workstations.',
    references: [], disposition: 'new', dismissed: false,
  },
  {
    id: 'adv-014', cve_id: 'CVE-2024-32015',
    title: 'Modbus TCP Unauthenticated Register Read/Write',
    description: 'The Modbus TCP protocol by design lacks authentication, allowing any network-adjacent attacker to read and write PLC registers.',
    source: 'cisa', vendor: 'Multiple', products: ['Modbus TCP Devices'],
    affected_versions: 'All implementations', fixed_versions: 'N/A',
    cvss_score: 8.6, cvss_vector: 'CVSS:3.1/AV:A/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:N',
    severity: 'high', kev_listed: false, kev_due_date: '',
    epss_score: 0.15, epss_percentile: 0.88, urgency_tier: 'act_now',
    attack_vector: 'adjacent', auth_required: 'none', complexity: 'low', user_interaction: 'none',
    sector: 'manufacturing', published_date: '2024-04-20', patch_available: false,
    remediation_immediate: 'Implement Modbus-aware firewall rules. Restrict access to port 502.',
    remediation_scheduled: 'Deploy Modbus TCP security extensions where supported.',
    remediation_longterm: 'Migrate to OPC UA with built-in authentication and encryption.',
    references: [], disposition: 'new', dismissed: false,
  },
];

const SOURCES = [
  { id: 'cisa', name: 'CISA ICS-CERT', color: '#3b82f6' },
  { id: 'siemens', name: 'Siemens ProductCERT', color: '#06b6d4' },
  { id: 'schneider', name: 'Schneider Electric', color: '#10b981' },
  { id: 'rockwell', name: 'Rockwell Automation', color: '#f97316' },
  { id: 'abb', name: 'ABB', color: '#ef4444' },
  { id: 'moxa', name: 'Moxa', color: '#8b5cf6' },
  { id: 'certvde', name: 'CERT@VDE', color: '#eab308' },
];

const SECTORS = ['energy', 'water', 'manufacturing', 'oil_gas', 'transportation', 'healthcare'];

const URGENCY_CONFIG = {
  act_now: { label: 'Act Now', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', icon: Zap },
  plan_patch: { label: 'Plan Patch', color: '#f97316', bg: 'rgba(249,115,22,0.15)', icon: Clock },
  monitor: { label: 'Monitor', color: '#eab308', bg: 'rgba(234,179,8,0.15)', icon: Eye },
  low_risk: { label: 'Low Risk', color: '#6b7280', bg: 'rgba(107,114,128,0.15)', icon: Info },
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#3b82f6', info: '#6b7280',
};

const DISPOSITION_OPTIONS = [
  { value: 'new', label: 'New', color: '#6b7280' },
  { value: 'not_applicable', label: 'Not Applicable', color: '#64748b' },
  { value: 'acknowledged', label: 'Acknowledged', color: '#3b82f6' },
  { value: 'in_progress', label: 'In Progress', color: '#f97316' },
  { value: 'remediated', label: 'Remediated', color: '#10b981' },
];

// ─── Component ────────────────────────────────────────────────

export default function VulnFeed() {
  const [advisories, setAdvisories] = useState(ADVISORIES);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [sectorFilter, setSectorFilter] = useState<string>('');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('');
  const [kevOnly, setKevOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'severity' | 'exploitable'>('severity');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() => {
    let result = advisories.filter(a => !a.dismissed || showDismissed);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(a =>
        a.title.toLowerCase().includes(s) ||
        a.cve_id.toLowerCase().includes(s) ||
        a.vendor.toLowerCase().includes(s) ||
        a.description.toLowerCase().includes(s)
      );
    }
    if (severityFilter) result = result.filter(a => a.severity === severityFilter);
    if (sourceFilter) result = result.filter(a => a.source === sourceFilter);
    if (sectorFilter) result = result.filter(a => a.sector === sectorFilter);
    if (urgencyFilter) result = result.filter(a => a.urgency_tier === urgencyFilter);
    if (kevOnly) result = result.filter(a => a.kev_listed);

    if (sortBy === 'severity') {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      result.sort((a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4));
    } else if (sortBy === 'exploitable') {
      result.sort((a, b) => b.epss_score - a.epss_score);
    } else {
      result.sort((a, b) => b.published_date.localeCompare(a.published_date));
    }
    return result;
  }, [advisories, search, severityFilter, sourceFilter, sectorFilter, urgencyFilter, kevOnly, sortBy, showDismissed]);

  // Stats
  const stats = useMemo(() => {
    const active = advisories.filter(a => !a.dismissed);
    return {
      total: active.length,
      critical: active.filter(a => a.severity === 'critical').length,
      actNow: active.filter(a => a.urgency_tier === 'act_now').length,
      kevCount: active.filter(a => a.kev_listed).length,
      avgEpss: active.length ? (active.reduce((s, a) => s + a.epss_score, 0) / active.length) : 0,
      patchAvail: active.filter(a => a.patch_available).length,
    };
  }, [advisories]);

  const handleDisposition = (id: string, disposition: string) => {
    setAdvisories(prev => prev.map(a => a.id === id ? { ...a, disposition } : a));
  };

  const handleDismiss = (id: string) => {
    setAdvisories(prev => prev.map(a => a.id === id ? { ...a, dismissed: !a.dismissed } : a));
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="text-blue-400" size={28} />
            ICS/OT Vulnerability Feed
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Real-time intelligence from 7 OT-specific advisory sources with CVSS + KEV + EPSS enrichment
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-sm">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh Feed
          </button>
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 text-sm">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: 'Total Advisories', value: stats.total, icon: Shield, color: '#3b82f6' },
          { label: 'Critical', value: stats.critical, icon: AlertTriangle, color: '#ef4444' },
          { label: 'Act Now', value: stats.actNow, icon: Zap, color: '#ef4444' },
          { label: 'CISA KEV Listed', value: stats.kevCount, icon: Bell, color: '#f97316' },
          { label: 'Avg EPSS', value: `${(stats.avgEpss * 100).toFixed(1)}%`, icon: TrendingUp, color: '#8b5cf6' },
          { label: 'Patches Available', value: stats.patchAvail, icon: CheckCircle2, color: '#10b981' },
        ].map((s, i) => (
          <div key={i} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-neutral-500">{s.label}</span>
              <s.icon size={14} style={{ color: s.color }} />
            </div>
            <div className="text-2xl font-bold text-white">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Sources Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-neutral-500">Sources:</span>
        {SOURCES.map(s => {
          const count = advisories.filter(a => a.source === s.id && !a.dismissed).length;
          return (
            <button
              key={s.id}
              onClick={() => setSourceFilter(sourceFilter === s.id ? '' : s.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${sourceFilter === s.id ? 'ring-1 ring-blue-500 bg-blue-500/10 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name} <span className="text-neutral-500">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search advisories by CVE, title, vendor, description..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-neutral-800 border border-neutral-700 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${showFilters ? 'bg-blue-500/20 text-blue-400' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}>
          <Filter size={14} /> Filters {(severityFilter || sectorFilter || urgencyFilter || kevOnly) && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
        </button>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="px-3 py-2.5 rounded-lg bg-neutral-800 border border-neutral-700 text-sm text-neutral-300">
          <option value="severity">Severity First</option>
          <option value="newest">Newest First</option>
          <option value="exploitable">Most Exploitable</option>
        </select>
      </div>

      {/* Expanded Filter Panel */}
      {showFilters && (
        <div className="grid grid-cols-5 gap-3 p-4 rounded-lg border border-neutral-800 bg-neutral-900/50">
          <div>
            <label className="text-xs text-neutral-500 mb-1 block">Severity</label>
            <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className="w-full px-2 py-1.5 rounded bg-neutral-800 border border-neutral-700 text-sm text-neutral-300">
              <option value="">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1 block">Urgency Tier</label>
            <select value={urgencyFilter} onChange={e => setUrgencyFilter(e.target.value)} className="w-full px-2 py-1.5 rounded bg-neutral-800 border border-neutral-700 text-sm text-neutral-300">
              <option value="">All</option>
              <option value="act_now">Act Now</option>
              <option value="plan_patch">Plan Patch</option>
              <option value="monitor">Monitor</option>
              <option value="low_risk">Low Risk</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1 block">Sector</label>
            <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)} className="w-full px-2 py-1.5 rounded bg-neutral-800 border border-neutral-700 text-sm text-neutral-300">
              <option value="">All Sectors</option>
              {SECTORS.map(s => <option key={s} value={s}>{s.replace('_', ' / ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
              <input type="checkbox" checked={kevOnly} onChange={e => setKevOnly(e.target.checked)} className="rounded bg-neutral-700 border-neutral-600" />
              KEV Only
            </label>
          </div>
          <div className="flex items-end">
            <button onClick={() => { setSeverityFilter(''); setSourceFilter(''); setSectorFilter(''); setUrgencyFilter(''); setKevOnly(false); }} className="text-xs text-blue-400 hover:text-blue-300">
              Clear All Filters
            </button>
          </div>
        </div>
      )}

      {/* Results Count */}
      <div className="flex items-center justify-between text-sm text-neutral-400">
        <span>{filtered.length} advisories</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={showDismissed} onChange={e => setShowDismissed(e.target.checked)} className="rounded bg-neutral-700 border-neutral-600" />
          Show dismissed
        </label>
      </div>

      {/* Advisory List */}
      <div className="space-y-2">
        {filtered.map(adv => {
          const isExpanded = expandedId === adv.id;
          const urgency = URGENCY_CONFIG[adv.urgency_tier as keyof typeof URGENCY_CONFIG] || URGENCY_CONFIG.low_risk;
          const UrgencyIcon = urgency.icon;
          const disp = DISPOSITION_OPTIONS.find(d => d.value === adv.disposition) || DISPOSITION_OPTIONS[0];

          return (
            <div key={adv.id} className={`rounded-lg border transition-colors ${adv.dismissed ? 'border-neutral-800/50 opacity-50' : 'border-neutral-800 hover:border-neutral-700'} bg-neutral-900/50`}>
              {/* Header Row */}
              <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : adv.id)}>
                {isExpanded ? <ChevronDown size={16} className="text-neutral-500 shrink-0" /> : <ChevronRight size={16} className="text-neutral-500 shrink-0" />}

                {/* Severity Badge */}
                <span className="px-2 py-0.5 rounded text-xs font-bold uppercase shrink-0" style={{ backgroundColor: `${SEVERITY_COLORS[adv.severity]}20`, color: SEVERITY_COLORS[adv.severity] }}>
                  {adv.severity}
                </span>

                {/* CVSS Score */}
                <span className="text-sm font-mono font-bold shrink-0" style={{ color: SEVERITY_COLORS[adv.severity] }}>
                  {adv.cvss_score.toFixed(1)}
                </span>

                {/* Title & CVE */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white truncate">{adv.title}</span>
                    {adv.kev_listed && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 shrink-0">KEV</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500">
                    <span className="font-mono">{adv.cve_id}</span>
                    <span>•</span>
                    <span>{adv.vendor}</span>
                    <span>•</span>
                    <span>{adv.published_date}</span>
                  </div>
                </div>

                {/* Attack Path Icons */}
                <div className="flex items-center gap-1 shrink-0">
                  <div title={`Vector: ${adv.attack_vector}`} className="w-7 h-7 rounded flex items-center justify-center bg-neutral-800">
                    {adv.attack_vector === 'network' ? <Globe size={13} className="text-red-400" /> : adv.attack_vector === 'adjacent' ? <Activity size={13} className="text-orange-400" /> : <Lock size={13} className="text-yellow-400" />}
                  </div>
                  <div title={`Auth: ${adv.auth_required}`} className="w-7 h-7 rounded flex items-center justify-center bg-neutral-800">
                    {adv.auth_required === 'none' ? <Unlock size={13} className="text-red-400" /> : <Lock size={13} className="text-green-400" />}
                  </div>
                  <div title={`Complexity: ${adv.complexity}`} className="w-7 h-7 rounded flex items-center justify-center bg-neutral-800">
                    <Activity size={13} className={adv.complexity === 'low' ? 'text-red-400' : 'text-green-400'} />
                  </div>
                  <div title={`User interaction: ${adv.user_interaction}`} className="w-7 h-7 rounded flex items-center justify-center bg-neutral-800">
                    <User size={13} className={adv.user_interaction === 'none' ? 'text-red-400' : 'text-green-400'} />
                  </div>
                </div>

                {/* Urgency Tier */}
                <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium shrink-0" style={{ backgroundColor: urgency.bg, color: urgency.color }}>
                  <UrgencyIcon size={12} /> {urgency.label}
                </span>

                {/* EPSS */}
                <div className="text-right shrink-0 w-16">
                  <div className="text-xs text-neutral-500">EPSS</div>
                  <div className="text-sm font-bold" style={{ color: adv.epss_score > 0.5 ? '#ef4444' : adv.epss_score > 0.1 ? '#f97316' : '#6b7280' }}>
                    {(adv.epss_score * 100).toFixed(1)}%
                  </div>
                </div>

                {/* Disposition Selector */}
                <select
                  value={adv.disposition}
                  onClick={e => e.stopPropagation()}
                  onChange={e => { e.stopPropagation(); handleDisposition(adv.id, e.target.value); }}
                  className="px-2 py-1 rounded text-xs bg-neutral-800 border border-neutral-700 shrink-0"
                  style={{ color: disp.color }}
                >
                  {DISPOSITION_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>

                {/* Dismiss */}
                <button onClick={e => { e.stopPropagation(); handleDismiss(adv.id); }} className="p-1.5 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 shrink-0" title={adv.dismissed ? 'Restore' : 'Dismiss'}>
                  {adv.dismissed ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              </div>

              {/* Expanded Detail Panel */}
              {isExpanded && (
                <div className="border-t border-neutral-800 p-5 space-y-5">
                  {/* Description */}
                  <p className="text-sm text-neutral-300 leading-relaxed">{adv.description}</p>

                  {/* Product Table */}
                  <div>
                    <h4 className="text-xs font-semibold text-neutral-400 uppercase mb-2">Affected Products</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg bg-neutral-800/50 p-3">
                        <div className="text-xs text-neutral-500">Products</div>
                        <div className="text-sm text-white mt-1">{adv.products.join(', ')}</div>
                      </div>
                      <div className="rounded-lg bg-neutral-800/50 p-3">
                        <div className="text-xs text-neutral-500">Affected Versions</div>
                        <div className="text-sm text-white mt-1">{adv.affected_versions}</div>
                      </div>
                      <div className="rounded-lg bg-neutral-800/50 p-3">
                        <div className="text-xs text-neutral-500">Fixed Version</div>
                        <div className="text-sm mt-1 flex items-center gap-1">
                          {adv.patch_available ? (
                            <><CheckCircle2 size={12} className="text-green-400" /> <span className="text-green-400">{adv.fixed_versions}</span></>
                          ) : (
                            <><XCircle size={12} className="text-red-400" /> <span className="text-red-400">No patch available</span></>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Enrichment Data */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="rounded-lg bg-neutral-800/50 p-3">
                      <div className="text-xs text-neutral-500">CVSS v3.1</div>
                      <div className="text-lg font-bold mt-1" style={{ color: SEVERITY_COLORS[adv.severity] }}>{adv.cvss_score}</div>
                      <div className="text-[10px] text-neutral-500 mt-1 font-mono break-all">{adv.cvss_vector}</div>
                    </div>
                    <div className="rounded-lg bg-neutral-800/50 p-3">
                      <div className="text-xs text-neutral-500">CISA KEV</div>
                      <div className="text-lg font-bold mt-1">{adv.kev_listed ? <span className="text-red-400">Listed</span> : <span className="text-neutral-500">Not Listed</span>}</div>
                      {adv.kev_due_date && <div className="text-xs text-red-400 mt-1">Due: {adv.kev_due_date}</div>}
                    </div>
                    <div className="rounded-lg bg-neutral-800/50 p-3">
                      <div className="text-xs text-neutral-500">EPSS Score</div>
                      <div className="text-lg font-bold mt-1" style={{ color: adv.epss_score > 0.5 ? '#ef4444' : adv.epss_score > 0.1 ? '#f97316' : '#6b7280' }}>
                        {(adv.epss_score * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">Percentile: {(adv.epss_percentile * 100).toFixed(0)}%</div>
                    </div>
                    <div className="rounded-lg bg-neutral-800/50 p-3">
                      <div className="text-xs text-neutral-500">Sector</div>
                      <div className="text-sm text-white mt-1 capitalize">{adv.sector.replace('_', ' / ')}</div>
                      <div className="text-xs text-neutral-500 mt-1">Source: {SOURCES.find(s => s.id === adv.source)?.name}</div>
                    </div>
                  </div>

                  {/* Remediation Guidance */}
                  <div>
                    <h4 className="text-xs font-semibold text-neutral-400 uppercase mb-3">Remediation Guidance</h4>
                    <div className="space-y-2">
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                        <Zap size={16} className="text-red-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-xs font-semibold text-red-400 mb-1">Do Now (Immediate)</div>
                          <div className="text-sm text-neutral-300">{adv.remediation_immediate}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                        <Clock size={16} className="text-orange-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-xs font-semibold text-orange-400 mb-1">Schedule (Maintenance Window)</div>
                          <div className="text-sm text-neutral-300">{adv.remediation_scheduled}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                        <Shield size={16} className="text-blue-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-xs font-semibold text-blue-400 mb-1">Long-Term (Architecture)</div>
                          <div className="text-sm text-neutral-300">{adv.remediation_longterm}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* References */}
                  {adv.references.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-neutral-400 uppercase mb-2">References</h4>
                      <div className="space-y-1">
                        {adv.references.map((ref, i) => (
                          <a key={i} href={ref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                            <ExternalLink size={10} /> {ref}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Shield size={48} className="mx-auto text-neutral-700 mb-4" />
          <p className="text-neutral-500">No advisories match your filters</p>
        </div>
      )}
    </div>
  );
}
