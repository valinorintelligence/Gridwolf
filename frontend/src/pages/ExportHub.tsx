import { useState } from 'react';
import {
  Download, FileText, FileSpreadsheet, FileJson, Package, Shield,
  Filter, ListChecks, ChevronDown, Copy, Check, ExternalLink,
  Flame, Target, AlertTriangle,
} from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FirewallFormat = 'cisco_acl' | 'iptables' | 'windows_firewall';

interface ExportCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  format: string;
  color: string;
}

interface RemediationItem {
  id: string;
  rank: number;
  finding: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  attackTechnique: string;
  remediation: string;
  effort: 'Low' | 'Medium' | 'High';
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const FIREWALL_RULES: Record<FirewallFormat, string[]> = {
  cisco_acl: [
    'access-list 100 permit tcp host 10.10.3.10 host 10.10.2.100 eq 102',
    'access-list 100 permit tcp host 10.10.3.45 host 10.10.2.100 eq 102',
    'access-list 100 permit udp host 10.10.3.5 host 10.10.4.1 eq 53',
    'access-list 100 permit tcp host 10.10.2.100 host 10.10.4.200 eq 443',
    'access-list 100 permit tcp host 10.10.3.90 host 10.10.3.10 eq 502',
    'access-list 100 deny ip any any log',
  ],
  iptables: [
    'iptables -A FORWARD -s 10.10.3.10 -d 10.10.2.100 -p tcp --dport 102 -j ACCEPT',
    'iptables -A FORWARD -s 10.10.3.45 -d 10.10.2.100 -p tcp --dport 102 -j ACCEPT',
    'iptables -A FORWARD -s 10.10.3.5 -d 10.10.4.1 -p udp --dport 53 -j ACCEPT',
    'iptables -A FORWARD -s 10.10.2.100 -d 10.10.4.200 -p tcp --dport 443 -j ACCEPT',
    'iptables -A FORWARD -s 10.10.3.90 -d 10.10.3.10 -p tcp --dport 502 -j ACCEPT',
    'iptables -A FORWARD -j DROP',
  ],
  windows_firewall: [
    'netsh advfirewall firewall add rule name="S7comm-PLC1" dir=out action=allow protocol=tcp remoteip=10.10.2.100 remoteport=102 localip=10.10.3.10',
    'netsh advfirewall firewall add rule name="S7comm-PLC2" dir=out action=allow protocol=tcp remoteip=10.10.2.100 remoteport=102 localip=10.10.3.45',
    'netsh advfirewall firewall add rule name="DNS-WAP" dir=out action=allow protocol=udp remoteip=10.10.4.1 remoteport=53 localip=10.10.3.5',
    'netsh advfirewall firewall add rule name="HTTPS-Historian" dir=out action=allow protocol=tcp remoteip=10.10.4.200 remoteport=443 localip=10.10.2.100',
    'netsh advfirewall firewall add rule name="Modbus-Polling" dir=out action=allow protocol=tcp remoteip=10.10.3.10 remoteport=502 localip=10.10.3.90',
    'netsh advfirewall firewall add rule name="BlockAll" dir=out action=block protocol=any remoteip=any',
  ],
};

const FIREWALL_FORMAT_LABELS: Record<FirewallFormat, string> = {
  cisco_acl: 'Cisco ACL',
  iptables: 'iptables',
  windows_firewall: 'Windows Firewall',
};

const REMEDIATION_LIST: RemediationItem[] = [
  { id: 'rem-1', rank: 1, finding: 'Unencrypted Modbus TCP on OT segment', severity: 'critical', attackTechnique: 'T0801 - Monitor Process State', remediation: 'Deploy Modbus/TCP deep packet inspection firewall; segment Modbus devices onto dedicated VLAN', effort: 'High' },
  { id: 'rem-2', rank: 2, finding: 'Default credentials on S7-1200 PLCs', severity: 'critical', attackTechnique: 'T0812 - Default Credentials', remediation: 'Change all PLC passwords to unique strong values; enable PLC access protection level 3', effort: 'Low' },
  { id: 'rem-3', rank: 3, finding: 'HMI server with unpatched CVE-2025-3104', severity: 'high', attackTechnique: 'T0866 - Exploitation of Remote Services', remediation: 'Apply WinCC patch KB5034210; schedule quarterly patching window', effort: 'Medium' },
  { id: 'rem-4', rank: 4, finding: 'Cross-zone DNS traffic to enterprise network', severity: 'high', attackTechnique: 'T0884 - Connection Proxy', remediation: 'Deploy OT DNS resolver in DMZ; block direct enterprise DNS from OT zone', effort: 'Medium' },
  { id: 'rem-5', rank: 5, finding: 'Unauthorized MQTT broker on plant floor', severity: 'high', attackTechnique: 'T0830 - Man in the Middle', remediation: 'Identify MQTT broker owner; enforce TLS on port 8883 or remove', effort: 'Medium' },
  { id: 'rem-6', rank: 6, finding: 'OPC UA without certificate validation', severity: 'medium', attackTechnique: 'T0869 - Standard Application Layer Protocol', remediation: 'Enable OPC UA certificate trust lists; reject anonymous connections', effort: 'Medium' },
  { id: 'rem-7', rank: 7, finding: 'Unnecessary HTTP on SCALANCE switches', severity: 'medium', attackTechnique: 'T0886 - Remote Services', remediation: 'Disable HTTP management interface; enforce HTTPS-only with valid certs', effort: 'Low' },
  { id: 'rem-8', rank: 8, finding: 'Broadcast storm potential from flat L2 topology', severity: 'low', attackTechnique: 'T0814 - Denial of Service', remediation: 'Implement VLANs per Purdue level; enable storm control on managed switches', effort: 'High' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function triggerBlobDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const severityBadge: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ExportHub() {
  const [fwFormat, setFwFormat] = useState<FirewallFormat>('cisco_acl');
  const [copied, setCopied] = useState(false);
  const [filterIp, setFilterIp] = useState('');
  const [filterPort, setFilterPort] = useState('');

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCsvExport = (type: string) => {
    const mockCsv = `# Gridwolf ${type} Export\n# Generated: ${new Date().toISOString()}\n# Project: Acme Power Plant Assessment\nid,name,ip,type,purdue_level,vendor,firmware\nDEV-001,S7-1200 CPU 1215C,10.10.3.10,PLC,L1,Siemens,V4.6\nDEV-002,SCALANCE W788,10.10.3.5,WAP,L2,Siemens,V6.5\n`;
    triggerBlobDownload(`gridwolf_${type.toLowerCase()}_export.csv`, mockCsv, 'text/csv');
  };

  const handleJsonExport = () => {
    const mockJson = JSON.stringify({
      gridwolf_version: '1.0.0',
      project: 'Acme Power Plant Assessment',
      exported_at: new Date().toISOString(),
      device_count: 142,
      connection_count: 312,
      finding_count: 67,
      sessions: ['Initial Baseline', 'Post-Maintenance Rescan'],
    }, null, 2);
    triggerBlobDownload('gridwolf_session_export.json', mockJson, 'application/json');
  };

  const handleSbomExport = () => {
    const mockSbom = JSON.stringify({
      bomFormat: 'CycloneDX',
      specVersion: '1.5',
      metadata: { timestamp: new Date().toISOString(), component: { type: 'application', name: 'Acme Power Plant OT Network', version: '2026-03' } },
      components: [
        { type: 'firmware', name: 'S7-1200 CPU Firmware', version: 'V4.6', supplier: { name: 'Siemens AG' } },
        { type: 'firmware', name: 'SCALANCE W788 Firmware', version: 'V6.5', supplier: { name: 'Siemens AG' } },
      ],
    }, null, 2);
    triggerBlobDownload('gridwolf_sbom.json', mockSbom, 'application/json');
  };

  const handleStixExport = () => {
    const mockStix = JSON.stringify({
      type: 'bundle',
      id: 'bundle--a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      spec_version: '2.1',
      objects: [
        { type: 'identity', id: 'identity--gridwolf', name: 'Gridwolf ICS Discovery', identity_class: 'system' },
        { type: 'infrastructure', id: 'infrastructure--plant-ot', name: 'Acme Plant OT Network', infrastructure_types: ['industrial-control-system'] },
      ],
    }, null, 2);
    triggerBlobDownload('gridwolf_stix_bundle.json', mockStix, 'application/json');
  };

  const handleRemediationExport = () => {
    const header = 'Rank,Finding,Severity,MITRE ATT&CK,Remediation,Effort\n';
    const rows = REMEDIATION_LIST.map((r) =>
      `${r.rank},"${r.finding}",${r.severity},"${r.attackTechnique}","${r.remediation}",${r.effort}`
    ).join('\n');
    triggerBlobDownload('gridwolf_remediation_priority.csv', header + rows, 'text/csv');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/15 text-teal-400">
          <Download className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-content-primary">Export Hub</h1>
          <p className="text-sm text-content-secondary">Generate reports, compliance artifacts, and machine-readable exports</p>
        </div>
      </div>

      {/* Export option cards — top row */}
      <div className="grid grid-cols-4 gap-4">
        {/* PDF Report */}
        <Card className="flex flex-col">
          <CardContent className="flex-1 space-y-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/15 text-red-400">
              <FileText className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-content-primary">PDF Assessment Report</h3>
            <p className="text-xs text-content-secondary">Full ICS/SCADA assessment report with executive summary, findings, and topology diagrams.</p>
            <Badge variant="outline">PDF</Badge>
          </CardContent>
          <CardFooter>
            <Button variant="secondary" size="sm" className="w-full" icon={<ExternalLink className="h-3.5 w-3.5" />}>
              Go to Reports
            </Button>
          </CardFooter>
        </Card>

        {/* CSV Export */}
        <Card className="flex flex-col">
          <CardContent className="flex-1 space-y-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-content-primary">CSV Export</h3>
            <p className="text-xs text-content-secondary">Export assets, connections, and findings as CSV spreadsheets for offline analysis.</p>
            <Badge variant="outline">CSV</Badge>
          </CardContent>
          <CardFooter>
            <div className="flex gap-1.5 w-full">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => handleCsvExport('Assets')}>Assets</Button>
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => handleCsvExport('Connections')}>Connections</Button>
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => handleCsvExport('Findings')}>Findings</Button>
            </div>
          </CardFooter>
        </Card>

        {/* JSON Export */}
        <Card className="flex flex-col">
          <CardContent className="flex-1 space-y-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
              <FileJson className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-content-primary">JSON Export</h3>
            <p className="text-xs text-content-secondary">Full session data in structured JSON format for integration with other tools and pipelines.</p>
            <Badge variant="outline">JSON</Badge>
          </CardContent>
          <CardFooter>
            <Button variant="secondary" size="sm" className="w-full" icon={<Download className="h-3.5 w-3.5" />} onClick={handleJsonExport}>
              Download JSON
            </Button>
          </CardFooter>
        </Card>

        {/* SBOM */}
        <Card className="flex flex-col">
          <CardContent className="flex-1 space-y-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
              <Package className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-content-primary">SBOM</h3>
            <p className="text-xs text-content-secondary">CISA BOD 23-01 aligned Software Bill of Materials in CycloneDX format for OT firmware inventory.</p>
            <Badge variant="outline">CycloneDX JSON</Badge>
          </CardContent>
          <CardFooter>
            <Button variant="secondary" size="sm" className="w-full" icon={<Download className="h-3.5 w-3.5" />} onClick={handleSbomExport}>
              Download SBOM
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Second row */}
      <div className="grid grid-cols-2 gap-4">
        {/* STIX 2.1 */}
        <Card>
          <CardContent className="space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/15 text-purple-400">
                <Shield className="h-5 w-5" />
              </div>
              <Badge variant="outline">STIX 2.1 JSON</Badge>
            </div>
            <h3 className="text-sm font-semibold text-content-primary">STIX 2.1 Bundle</h3>
            <p className="text-xs text-content-secondary">Threat intelligence bundle with infrastructure objects, observed-data, and indicator SDOs for TAXII sharing.</p>
          </CardContent>
          <CardFooter>
            <Button variant="secondary" size="sm" className="w-full" icon={<Download className="h-3.5 w-3.5" />} onClick={handleStixExport}>
              Download STIX Bundle
            </Button>
          </CardFooter>
        </Card>

        {/* Filtered PCAP */}
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
                <Filter className="h-5 w-5" />
              </div>
              <Badge variant="outline">PCAP</Badge>
            </div>
            <h3 className="text-sm font-semibold text-content-primary">Filtered PCAP Export</h3>
            <p className="text-xs text-content-secondary">Export only packets matching specific IP/port filters from the loaded capture.</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-content-tertiary mb-1">IP Filter</label>
                <input
                  type="text"
                  placeholder="e.g. 10.10.3.0/24"
                  value={filterIp}
                  onChange={(e) => setFilterIp(e.target.value)}
                  className="w-full rounded border border-border-default bg-surface-hover px-2 py-1 text-xs font-mono text-content-primary placeholder:text-content-tertiary focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-content-tertiary mb-1">Port Filter</label>
                <input
                  type="text"
                  placeholder="e.g. 502,102,44818"
                  value={filterPort}
                  onChange={(e) => setFilterPort(e.target.value)}
                  className="w-full rounded border border-border-default bg-surface-hover px-2 py-1 text-xs font-mono text-content-primary placeholder:text-content-tertiary focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="secondary" size="sm" className="w-full" icon={<Download className="h-3.5 w-3.5" />}>
              Export Filtered PCAP
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Communication Allowlist */}
      <Card>
        <CardHeader
          title={
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-accent" />
              <span>Communication Allowlist</span>
            </div>
          }
          action={
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-content-tertiary">Format:</span>
              {(Object.entries(FIREWALL_FORMAT_LABELS) as [FirewallFormat, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFwFormat(key)}
                  className={cn(
                    'px-2 py-0.5 rounded text-[11px] font-medium transition-colors',
                    fwFormat === key
                      ? 'bg-accent/15 text-accent'
                      : 'text-content-tertiary hover:text-content-secondary hover:bg-surface-hover'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        />
        <CardContent>
          <p className="text-xs text-content-secondary mb-3">
            Generated firewall rules based on observed legitimate communication flows. Review and customize before deploying to production firewalls.
          </p>
          <div className="rounded-lg border border-border-default bg-[#0d1117] p-3 font-mono text-xs text-emerald-400 overflow-x-auto">
            {FIREWALL_RULES[fwFormat].map((rule, i) => (
              <div key={i} className="py-0.5">
                <span className="text-content-tertiary select-none mr-3">{String(i + 1).padStart(2, ' ')}</span>
                {rule}
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              onClick={() => handleCopy(FIREWALL_RULES[fwFormat].join('\n'))}
            >
              {copied ? 'Copied!' : 'Copy Rules'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="h-3.5 w-3.5" />}
              onClick={() => triggerBlobDownload(
                `gridwolf_allowlist_${fwFormat}.txt`,
                FIREWALL_RULES[fwFormat].join('\n'),
                'text/plain'
              )}
            >
              Download
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Remediation Priority List */}
      <Card>
        <CardHeader
          title={
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-accent" />
              <span>Remediation Priority List</span>
            </div>
          }
          action={
            <Button variant="secondary" size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={handleRemediationExport}>
              Export CSV
            </Button>
          }
        />
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="border-b border-border-default">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-content-secondary uppercase tracking-wider w-12">#</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-content-secondary uppercase tracking-wider">Finding</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-content-secondary uppercase tracking-wider w-24">Severity</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-content-secondary uppercase tracking-wider">MITRE ATT&amp;CK</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-content-secondary uppercase tracking-wider">Remediation</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-content-secondary uppercase tracking-wider w-20">Effort</th>
                </tr>
              </thead>
              <tbody>
                {REMEDIATION_LIST.map((item) => (
                  <tr key={item.id} className="border-b border-border-default hover:bg-surface-hover/50 transition-colors">
                    <td className="px-3 py-2 text-xs font-bold text-content-tertiary">{item.rank}</td>
                    <td className="px-3 py-2 text-xs text-content-primary">{item.finding}</td>
                    <td className="px-3 py-2">
                      <Badge variant={severityBadge[item.severity]}>{item.severity}</Badge>
                    </td>
                    <td className="px-3 py-2 text-[11px] font-mono text-content-secondary">{item.attackTechnique}</td>
                    <td className="px-3 py-2 text-xs text-content-secondary">{item.remediation}</td>
                    <td className="px-3 py-2">
                      <span className={cn(
                        'text-[10px] font-medium px-1.5 py-0.5 rounded',
                        item.effort === 'Low' && 'bg-emerald-500/15 text-emerald-400',
                        item.effort === 'Medium' && 'bg-amber-500/15 text-amber-400',
                        item.effort === 'High' && 'bg-red-500/15 text-red-400',
                      )}>
                        {item.effort}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
