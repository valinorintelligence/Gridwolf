import { useState } from 'react';
import { Upload, FileUp, FileCheck, Clock, CheckCircle, XCircle, AlertCircle, File } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import StatCard from '@/components/dashboard/StatCard';
import { cn } from '@/lib/cn';

interface ImportRecord {
  id: string;
  filename: string;
  format: string;
  status: 'completed' | 'processing' | 'failed';
  findings: number;
  timestamp: string;
  size: string;
}

const SUPPORTED_FORMATS = [
  { name: 'Semgrep', ext: '.json', icon: '{}', description: 'Semgrep SAST JSON output' },
  { name: 'Trivy', ext: '.json', icon: '{}', description: 'Trivy SCA vulnerability report' },
  { name: 'SARIF', ext: '.sarif', icon: '<>', description: 'Static Analysis Results Interchange Format' },
  { name: 'Nessus', ext: '.nessus', icon: '##', description: 'Tenable Nessus XML export' },
  { name: 'Nuclei', ext: '.json', icon: '{}', description: 'ProjectDiscovery Nuclei results' },
  { name: 'Grype', ext: '.json', icon: '{}', description: 'Anchore Grype SCA output' },
];

const RECENT_IMPORTS: ImportRecord[] = [
  { id: 'imp-001', filename: 'semgrep-scan-2024-12-18.json', format: 'Semgrep', status: 'completed', findings: 47, timestamp: '2024-12-18T06:00:00Z', size: '2.4 MB' },
  { id: 'imp-002', filename: 'trivy-container-scan.json', format: 'Trivy', status: 'completed', findings: 128, timestamp: '2024-12-18T04:00:00Z', size: '5.1 MB' },
  { id: 'imp-003', filename: 'nuclei-dast-results.json', format: 'Nuclei', status: 'completed', findings: 23, timestamp: '2024-12-17T22:00:00Z', size: '1.8 MB' },
  { id: 'imp-004', filename: 'nessus-network-scan.nessus', format: 'Nessus', status: 'completed', findings: 86, timestamp: '2024-12-18T02:00:00Z', size: '12.7 MB' },
  { id: 'imp-005', filename: 'codeql-analysis.sarif', format: 'SARIF', status: 'processing', findings: 0, timestamp: '2024-12-18T14:30:00Z', size: '3.2 MB' },
  { id: 'imp-006', filename: 'grype-sbom-results.json', format: 'Grype', status: 'failed', findings: 0, timestamp: '2024-12-16T10:00:00Z', size: '0.8 MB' },
];

const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  completed: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  processing: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/15' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/15' },
};

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ScanImport() {
  const [isDragging, setIsDragging] = useState(false);

  const completedCount = RECENT_IMPORTS.filter((i) => i.status === 'completed').length;
  const totalFindings = RECENT_IMPORTS.reduce((sum, i) => sum + i.findings, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
          <Upload className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-content-primary">Scan Import</h1>
          <p className="text-sm text-content-secondary">Import scan results from security tools and vulnerability scanners</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={<FileUp className="h-5 w-5" />} label="Total Imports" value={RECENT_IMPORTS.length} />
        <StatCard icon={<FileCheck className="h-5 w-5" />} label="Successful" value={completedCount} />
        <StatCard icon={<AlertCircle className="h-5 w-5" />} label="Total Findings" value={totalFindings} severity="high" />
        <StatCard icon={<Clock className="h-5 w-5" />} label="Processing" value={RECENT_IMPORTS.filter((i) => i.status === 'processing').length} />
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Upload Zone */}
        <div className="col-span-8 space-y-4">
          <Card>
            <CardHeader title="Upload Scan Results" />
            <CardContent>
              <div
                className={cn(
                  'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors cursor-pointer',
                  isDragging
                    ? 'border-accent bg-accent/5'
                    : 'border-border-default hover:border-border-hover hover:bg-surface-hover/30'
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); }}
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 mb-4">
                  <FileUp className={cn('h-8 w-8', isDragging ? 'text-accent' : 'text-content-tertiary')} />
                </div>
                <p className="text-sm font-medium text-content-primary mb-1">
                  {isDragging ? 'Drop files here' : 'Drag and drop scan results here'}
                </p>
                <p className="text-xs text-content-secondary mb-4">or click to browse files</p>
                <Button variant="secondary" size="sm" icon={<Upload className="h-3.5 w-3.5" />}>
                  Browse Files
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Import History */}
          <Card>
            <CardHeader title="Recent Imports" action={<Badge variant="info">{RECENT_IMPORTS.length} imports</Badge>} />
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Findings</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Imported</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {RECENT_IMPORTS.map((imp) => {
                    const sc = statusConfig[imp.status];
                    const StatusIcon = sc.icon;
                    return (
                      <TableRow key={imp.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <File className="h-4 w-4 text-content-tertiary shrink-0" />
                            <span className="font-mono text-xs truncate max-w-[220px]">{imp.filename}</span>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{imp.format}</Badge></TableCell>
                        <TableCell>
                          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', sc.bg, sc.color)}>
                            <StatusIcon className="h-3 w-3" />
                            {imp.status}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{imp.findings > 0 ? imp.findings : '-'}</TableCell>
                        <TableCell className="text-xs text-content-secondary">{imp.size}</TableCell>
                        <TableCell className="text-xs text-content-secondary">{formatTimestamp(imp.timestamp)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Supported Formats */}
        <div className="col-span-4">
          <Card>
            <CardHeader title="Supported Formats" />
            <CardContent className="space-y-3">
              {SUPPORTED_FORMATS.map((fmt) => (
                <div key={fmt.name} className="flex items-start gap-3 rounded-lg border border-border-default p-3 hover:bg-surface-hover/50 transition-colors">
                  <div className="flex h-9 w-9 items-center justify-center rounded bg-surface-hover text-xs font-mono font-bold text-accent shrink-0">
                    {fmt.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-content-primary">{fmt.name}</span>
                      <span className="text-xs text-content-tertiary font-mono">{fmt.ext}</span>
                    </div>
                    <p className="text-xs text-content-secondary mt-0.5">{fmt.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
