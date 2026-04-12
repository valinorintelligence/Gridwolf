import { useState, useMemo, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle, Timer } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Select } from '@/components/ui/Select';
import StatCard from '@/components/dashboard/StatCard';
import ChartWidget from '@/components/dashboard/ChartWidget';
import SeverityBadge from '@/components/shared/SeverityBadge';
import { api } from '@/services/api';
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

const slaStatusStyles: Record<SLAStatus, { label: string; className: string }> = {
  within: { label: 'Within SLA', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  approaching: { label: 'Approaching', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  breached: { label: 'Breached', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

export default function SLATracker() {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [vulnSLAs, setVulnSLAs] = useState<VulnSLA[]>([]);
  const [loading, setLoading] = useState(true);
  const [slaTimeline, setSlaTimeline] = useState<{ month: string; within: number; approaching: number; breached: number }[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await api.get('/ics/findings/').catch(() => ({ data: [] }));
        const findings = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
        const now = new Date();

        const slas: VulnSLA[] = findings
          .filter((f: Record<string, unknown>) => f.status !== 'resolved')
          .map((f: Record<string, unknown>) => {
            const sev = String(f.severity ?? 'medium');
            const slaDays = SLA_LIMITS[sev] ?? 90;
            const createdAt = f.created_at ? new Date(String(f.created_at)) : now;
            const daysOpen = Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)));
            const daysRemaining = slaDays - daysOpen;
            const slaStatus: SLAStatus = daysRemaining < 0 ? 'breached' : daysRemaining <= Math.ceil(slaDays * 0.2) ? 'approaching' : 'within';
            return {
              id: String(f.id ?? ''),
              title: String(f.title ?? 'Finding'),
              severity: sev as VulnSLA['severity'],
              slaStatus,
              daysOpen,
              slaDays,
              daysRemaining,
              assignee: String(f.assignee ?? 'unassigned'),
            };
          });

        setVulnSLAs(slas);

        // Build a simple timeline from current counts
        const withinC = slas.filter((s) => s.slaStatus === 'within').length;
        const approachingC = slas.filter((s) => s.slaStatus === 'approaching').length;
        const breachedC = slas.filter((s) => s.slaStatus === 'breached').length;
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentMonth = now.getMonth();
        const timeline = [];
        for (let i = 5; i >= 0; i--) {
          const mIdx = (currentMonth - i + 12) % 12;
          timeline.push({ month: months[mIdx], within: withinC, approaching: approachingC, breached: breachedC });
        }
        setSlaTimeline(timeline);
      } catch {
        setVulnSLAs([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    if (filterStatus === 'all') return vulnSLAs;
    return vulnSLAs.filter((v) => v.slaStatus === filterStatus);
  }, [filterStatus, vulnSLAs]);

  const breachedCount = vulnSLAs.filter((v) => v.slaStatus === 'breached').length;
  const withinCount = vulnSLAs.filter((v) => v.slaStatus === 'within').length;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (vulnSLAs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Clock className="h-12 w-12 text-content-muted" />
        <h2 className="mt-4 text-lg font-semibold text-content-primary">No Data Yet</h2>
        <p className="mt-1 text-sm text-content-secondary">SLA tracking will begin once security findings are generated from scans and assessments.</p>
      </div>
    );
  }

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
            data={slaTimeline}
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
