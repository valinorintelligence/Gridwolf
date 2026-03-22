import { useState, useMemo } from 'react';
import { Clock, AlertTriangle, CheckCircle, Timer } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Select } from '@/components/ui/Select';
import StatCard from '@/components/dashboard/StatCard';
import ChartWidget from '@/components/dashboard/ChartWidget';
import SeverityBadge from '@/components/shared/SeverityBadge';
import { MOCK_OBJECTS } from '@/data/mock';
import { cn } from '@/lib/cn';

type SLAStatus = 'within' | 'approaching' | 'breached';

interface VulnSLA {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  slaStatus: SLAStatus;
  daysOpen: number;
  slaDays: number;
  daysRemaining: number;
  assignee: string;
}

const SLA_LIMITS: Record<string, number> = { critical: 7, high: 30, medium: 90, low: 180 };

const vulns = MOCK_OBJECTS.filter((o) => o.typeId === 'type-vuln' && o.status !== 'resolved');

const VULN_SLAS: VulnSLA[] = vulns.map((v, i) => {
  const sev = (v.severity as string) || 'medium';
  const slaDays = SLA_LIMITS[sev] || 90;
  const daysOpen = [5, 74, 91, 118, 173, 189, 196, 267, 22][i] ?? 30;
  const daysRemaining = slaDays - daysOpen;
  const slaStatus: SLAStatus = daysRemaining < 0 ? 'breached' : daysRemaining <= Math.ceil(slaDays * 0.2) ? 'approaching' : 'within';
  const assignees = ['jchen', 'asmith', 'jchen', 'asmith', 'jchen', 'asmith', 'jchen', 'asmith', 'jchen'];
  return {
    id: v.id,
    title: v.title,
    severity: sev as VulnSLA['severity'],
    slaStatus,
    daysOpen,
    slaDays,
    daysRemaining,
    assignee: assignees[i] || 'unassigned',
  };
});

const SLA_TIMELINE = [
  { month: 'Jul', within: 82, approaching: 12, breached: 6 },
  { month: 'Aug', within: 78, approaching: 14, breached: 8 },
  { month: 'Sep', within: 75, approaching: 16, breached: 9 },
  { month: 'Oct', within: 80, approaching: 13, breached: 7 },
  { month: 'Nov', within: 77, approaching: 15, breached: 8 },
  { month: 'Dec', within: 74, approaching: 17, breached: 9 },
];

const slaStatusStyles: Record<SLAStatus, { label: string; className: string }> = {
  within: { label: 'Within SLA', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  approaching: { label: 'Approaching', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  breached: { label: 'Breached', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

export default function SLATracker() {
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filtered = useMemo(() => {
    if (filterStatus === 'all') return VULN_SLAS;
    return VULN_SLAS.filter((v) => v.slaStatus === filterStatus);
  }, [filterStatus]);

  const breachedCount = VULN_SLAS.filter((v) => v.slaStatus === 'breached').length;
  const approachingCount = VULN_SLAS.filter((v) => v.slaStatus === 'approaching').length; void approachingCount;
  const withinCount = VULN_SLAS.filter((v) => v.slaStatus === 'within').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-content-primary">SLA Tracker</h1>
          <p className="text-sm text-content-secondary">Monitor remediation SLA compliance across all vulnerabilities</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={<Timer className="h-5 w-5" />} label="Mean Time to Remediate" value="18.4d" trend={{ value: 12, direction: 'down' }} />
        <StatCard icon={<AlertTriangle className="h-5 w-5" />} label="Mean Time to Detect" value="2.1d" trend={{ value: 8, direction: 'down' }} />
        <StatCard icon={<Clock className="h-5 w-5" />} label="Breached SLA" value={breachedCount} severity="critical" />
        <StatCard icon={<CheckCircle className="h-5 w-5" />} label="Within SLA" value={withinCount} severity="low" />
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* SLA Table */}
        <div className="col-span-8">
          <Card>
            <CardHeader
              title="Vulnerabilities by SLA Status"
              action={
                <Select
                  options={[
                    { value: 'all', label: 'All Statuses' },
                    { value: 'within', label: 'Within SLA' },
                    { value: 'approaching', label: 'Approaching' },
                    { value: 'breached', label: 'Breached' },
                  ]}
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-40"
                />
              }
            />
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vulnerability</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>SLA Status</TableHead>
                    <TableHead>Days Open</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Assignee</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((vuln) => (
                    <TableRow key={vuln.id}>
                      <TableCell className="font-medium text-xs max-w-[200px] truncate">{vuln.title}</TableCell>
                      <TableCell>
                        <SeverityBadge severity={vuln.severity} />
                      </TableCell>
                      <TableCell>
                        <span className={cn('inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium', slaStatusStyles[vuln.slaStatus].className)}>
                          {slaStatusStyles[vuln.slaStatus].label}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{vuln.daysOpen}d / {vuln.slaDays}d</TableCell>
                      <TableCell>
                        <span className={cn('font-mono text-xs font-semibold', vuln.daysRemaining < 0 ? 'text-red-400' : vuln.daysRemaining <= 7 ? 'text-amber-400' : 'text-content-secondary')}>
                          {vuln.daysRemaining < 0 ? `${Math.abs(vuln.daysRemaining)}d overdue` : `${vuln.daysRemaining}d`}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-content-secondary">{vuln.assignee}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* SLA Timeline */}
        <div className="col-span-4">
          <ChartWidget
            type="bar"
            title="SLA Performance Trend"
            data={SLA_TIMELINE}
            dataKeys={[
              { key: 'within', color: '#10b981', name: 'Within SLA' },
              { key: 'approaching', color: '#f59e0b', name: 'Approaching' },
              { key: 'breached', color: '#ef4444', name: 'Breached' },
            ]}
            xAxisKey="month"
            height={340}
          />
        </div>
      </div>
    </div>
  );
}
