import { useState, useEffect } from 'react';
import {
  Download, FileText, FileSpreadsheet, FileJson, Package, Shield,
  Filter, ListChecks, ChevronDown, Copy, Check, ExternalLink,
  Flame, Target, AlertTriangle, Loader2,
} from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { api } from '@/services/api';

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
// Constants
// ---------------------------------------------------------------------------

const FIREWALL_FORMAT_LABELS: Record<FirewallFormat, string> = {
  cisco_acl: 'Cisco ACL',
  iptables: 'iptables',
  windows_firewall: 'Windows Firewall',
};

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

  // Remediation findings from the backend
  const [remediationList, setRemediationList] = useState<RemediationItem[]>([]);
  const [remediationLoading, setRemediationLoading] = useState(true);

  useEffect(() => {
    async function fetchFindings() {
      try {
        const res = await api.get('/ics/findings/').catch(() => ({ data: [] }));
        const raw = Array.isArray(res.data) ? res.data : res.data?.results ?? [];

        // Map backend findings to RemediationItem shape, sorted by severity
        const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        const mapped: RemediationItem[] = raw
          .sort((a: any, b: any) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4))
          .map((f: any, idx: number) => ({
            id: String(f.id),
            rank: idx + 1,
            finding: f.title ?? 'Untitled finding',
            severity: f.severity ?? 'medium',
            attackTechnique: f.attack_technique ?? f.cve_id ?? '-',
            remediation: f.remediation ?? f.description ?? '-',
            effort: f.effort ?? 'Medium',
          }));

        setRemediationList(mapped);
      } catch {
        setRemediationList([]);
      } finally {
        setRemediationLoading(false);
      }
    }
    fetchFindings();
  }, []);

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
    const rows = remediationList.map((r) =>
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
          <div className="rounded-lg border border-border-default bg-[#0d1117] p-4 font-mono text-xs text-content-tertiary text-center">
            Firewall rules will be generated from real findings data once a PCAP capture has been analyzed.
          </div>
        </CardContent>
        <CardFooter>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              disabled
            >
              Copy Rules
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="h-3.5 w-3.5" />}
              disabled
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
                {remediationLoading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center">
                      <div className="flex items-center justify-center gap-2 text-content-tertiary text-xs">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading findings...
                      </div>
                    </td>
                  </tr>
                ) : remediationList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-content-tertiary text-xs">
                      No findings available. Upload and analyze a PCAP capture to generate remediation priorities.
                    </td>
                  </tr>
                ) : (
                  remediationList.map((item) => (
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
