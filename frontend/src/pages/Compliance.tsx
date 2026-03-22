import { useState, useMemo } from 'react';
import { ClipboardCheck, CheckCircle, XCircle, AlertTriangle, BarChart3 } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import StatCard from '@/components/dashboard/StatCard';
import ChartWidget from '@/components/dashboard/ChartWidget';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { MOCK_OBJECTS } from '@/data/mock';
import { cn } from '@/lib/cn';

const FRAMEWORK_COLORS: Record<string, string> = {
  'IEC-62443': '#3b82f6',
  'NIST-800-82': '#10b981',
  'OWASP': '#f97316',
  'PCI-DSS': '#8b5cf6',
  'NERC-CIP': '#ef4444',
};

const STATUS_ICONS: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  pass: { icon: CheckCircle, color: 'text-emerald-400', label: 'Pass' },
  fail: { icon: XCircle, color: 'text-red-400', label: 'Fail' },
  partial: { icon: AlertTriangle, color: 'text-amber-400', label: 'Partial' },
  na: { icon: BarChart3, color: 'text-gray-400', label: 'N/A' },
};

export default function Compliance() {
  const [frameworkFilter, setFrameworkFilter] = useState<string>('all');

  const controls = useMemo(
    () => MOCK_OBJECTS.filter((o) => o.typeId === 'type-compliance'),
    []
  );

  // Status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { pass: 0, fail: 0, partial: 0, na: 0 };
    for (const c of controls) {
      const status = String(c.properties.status ?? 'na');
      counts[status] = (counts[status] ?? 0) + 1;
    }
    return counts;
  }, [controls]);

  // Framework counts
  const frameworkCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of controls) {
      const fw = String(c.properties.framework ?? 'Unknown');
      counts[fw] = (counts[fw] ?? 0) + 1;
    }
    return counts;
  }, [controls]);

  // Compliance score
  const complianceScore = useMemo(() => {
    if (controls.length === 0) return 0;
    const passWeight = statusCounts.pass * 1 + statusCounts.partial * 0.5;
    const total = statusCounts.pass + statusCounts.fail + statusCounts.partial;
    return total > 0 ? Math.round((passWeight / total) * 100) : 0;
  }, [controls.length, statusCounts]);

  // Chart data
  const chartData = useMemo(
    () => [
      { name: 'Pass', count: statusCounts.pass, fill: '#22c55e' },
      { name: 'Fail', count: statusCounts.fail, fill: '#ef4444' },
      { name: 'Partial', count: statusCounts.partial, fill: '#eab308' },
      { name: 'N/A', count: statusCounts.na, fill: '#6b7280' },
    ],
    [statusCounts]
  );

  // Framework chart data
  const fwChartData = useMemo(
    () =>
      Object.entries(frameworkCounts).map(([name, count]) => ({
        name,
        count,
      })),
    [frameworkCounts]
  );

  // Filtered controls
  const filtered = useMemo(() => {
    if (frameworkFilter === 'all') return controls;
    return controls.filter((c) => c.properties.framework === frameworkFilter);
  }, [controls, frameworkFilter]);

  // Unique frameworks
  const frameworks = useMemo(
    () => [...new Set(controls.map((c) => String(c.properties.framework ?? 'Unknown')))],
    [controls]
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/15">
          <ClipboardCheck className="h-5 w-5 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-content-primary">Compliance Dashboard</h1>
          <p className="text-xs text-content-secondary">
            Framework compliance status and control tracking
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<ClipboardCheck size={20} />}
          label="Compliance Score"
          value={`${complianceScore}%`}
          severity={complianceScore >= 70 ? 'low' : complianceScore >= 40 ? 'medium' : 'critical'}
        />
        <StatCard
          icon={<CheckCircle size={20} />}
          label="Controls Passing"
          value={statusCounts.pass}
        />
        <StatCard
          icon={<XCircle size={20} />}
          label="Controls Failing"
          value={statusCounts.fail}
          severity="critical"
        />
        <StatCard
          icon={<AlertTriangle size={20} />}
          label="Partial Compliance"
          value={statusCounts.partial}
          severity="medium"
        />
      </div>

      {/* Framework Badges */}
      <Card>
        <CardHeader title="Compliance Frameworks" />
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {frameworks.map((fw) => {
              const fwControls = controls.filter((c) => c.properties.framework === fw);
              const fwPass = fwControls.filter((c) => c.properties.status === 'pass').length;
              const fwScore = fwControls.length > 0 ? Math.round((fwPass / fwControls.length) * 100) : 0;

              return (
                <button
                  key={fw}
                  type="button"
                  onClick={() => setFrameworkFilter(frameworkFilter === fw ? 'all' : fw)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                    frameworkFilter === fw
                      ? 'border-accent bg-accent/10'
                      : 'border-border-default bg-surface-card hover:bg-surface-hover'
                  )}
                >
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: FRAMEWORK_COLORS[fw] ?? '#6b7280' }}
                  />
                  <div>
                    <p className="text-sm font-semibold text-content-primary">{fw}</p>
                    <p className="text-xs text-content-secondary">
                      {fwPass}/{fwControls.length} passing ({fwScore}%)
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-6">
          <ChartWidget
            type="donut"
            title="Control Status Distribution"
            data={chartData}
            dataKeys={[
              { key: 'count', color: '#22c55e', name: 'Pass' },
              { key: 'count', color: '#ef4444', name: 'Fail' },
              { key: 'count', color: '#eab308', name: 'Partial' },
              { key: 'count', color: '#6b7280', name: 'N/A' },
            ]}
            height={260}
          />
        </div>
        <div className="col-span-6">
          <ChartWidget
            type="bar"
            title="Controls by Framework"
            data={fwChartData}
            dataKeys={[{ key: 'count', color: '#6366f1', name: 'Controls' }]}
            xAxisKey="name"
            height={260}
          />
        </div>
      </div>

      {/* Control Details Table */}
      <Card>
        <CardHeader
          title="Compliance Controls"
          action={
            <div className="flex items-center gap-2">
              <Button
                variant={frameworkFilter === 'all' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setFrameworkFilter('all')}
              >
                All
              </Button>
              {frameworks.map((fw) => (
                <Button
                  key={fw}
                  variant={frameworkFilter === fw ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setFrameworkFilter(fw)}
                >
                  {fw}
                </Button>
              ))}
            </div>
          }
        />
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Control ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Framework</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((control) => {
                const status = String(control.properties.status ?? 'na');
                const statusConfig = STATUS_ICONS[status] ?? STATUS_ICONS.na;
                const StatusIcon = statusConfig.icon;

                return (
                  <TableRow key={control.id}>
                    <TableCell>
                      <span className="font-mono text-xs font-semibold text-content-secondary">
                        {String(control.properties.controlId)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-content-primary">{control.title}</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="border-0"
                      >
                        <span
                          className="mr-1.5 inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: FRAMEWORK_COLORS[String(control.properties.framework)] ?? '#6b7280' }}
                        />
                        {String(control.properties.framework)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', statusConfig.color)}>
                        <StatusIcon size={14} />
                        {statusConfig.label}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-content-tertiary">
                    No controls match the selected framework
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
