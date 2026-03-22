import { useMemo } from 'react';
import { LayoutDashboard, Server, ShieldAlert, Skull, CheckCircle } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import ChartWidget from '@/components/dashboard/ChartWidget';
import TableWidget from '@/components/dashboard/TableWidget';
import TimelineWidget from '@/components/dashboard/TimelineWidget';
import GraphWidget from '@/components/dashboard/GraphWidget';
import { WidgetGrid, WidgetWrapper } from '@/components/dashboard/WidgetGrid';
import { Badge } from '@/components/ui/Badge';
import { MOCK_DASHBOARD_STATS, MOCK_OBJECTS, MOCK_GRAPH_DATA } from '@/data/mock';
import { SEVERITY_COLORS } from '@/lib/constants';

export default function CommandCenter() {
  const stats = MOCK_DASHBOARD_STATS;

  // Build severity breakdown chart data
  const severityChartData = useMemo(
    () =>
      Object.entries(stats.severityBreakdown).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        count: value,
        fill: SEVERITY_COLORS[name] ?? '#6b7280',
      })),
    [stats.severityBreakdown]
  );

  // Recent vulns table data
  const recentVulns = useMemo(
    () =>
      MOCK_OBJECTS.filter((o) => o.typeId === 'type-vuln')
        .slice(0, 8)
        .map((v) => ({
          title: v.title,
          cve: v.properties.cveId ?? '--',
          cvss: v.properties.cvssScore ?? '--',
          severity: v.severity ?? 'info',
          status: v.status,
        })),
    []
  );

  // Timeline events
  const timelineEvents = useMemo(
    () =>
      stats.recentEvents.map((evt) => ({
        id: evt.id,
        timestamp: evt.timestamp,
        action: evt.action.replace(/_/g, ' '),
        objectType: evt.objectType?.toLowerCase(),
        objectTitle: evt.objectTitle,
      })),
    [stats.recentEvents]
  );

  // Compliance score derived from compliance controls
  const complianceControls = MOCK_OBJECTS.filter((o) => o.typeId === 'type-compliance');
  const passCount = complianceControls.filter((c) => c.properties.status === 'pass').length;
  const complianceScore = complianceControls.length > 0
    ? Math.round((passCount / complianceControls.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15">
          <LayoutDashboard className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-content-primary">Command Center</h1>
          <p className="text-xs text-content-secondary">Real-time operational security overview</p>
        </div>
        <Badge variant={stats.threatLevel === 'high' ? 'critical' : 'medium'} dot className="ml-auto">
          Threat Level: {stats.threatLevel.toUpperCase()}
        </Badge>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Server size={20} />}
          label="Total Assets"
          value={stats.objectTypeCounts.Host ?? 0}
          trend={{ value: 12, direction: 'up' }}
        />
        <StatCard
          icon={<ShieldAlert size={20} />}
          label="Open Vulnerabilities"
          value={stats.severityBreakdown.critical + stats.severityBreakdown.high + stats.severityBreakdown.medium + stats.severityBreakdown.low}
          severity="high"
          trend={{ value: 8, direction: 'up' }}
        />
        <StatCard
          icon={<Skull size={20} />}
          label="Active Threats"
          value={stats.activeAlerts}
          severity="critical"
          trend={{ value: 3, direction: 'up' }}
        />
        <StatCard
          icon={<CheckCircle size={20} />}
          label="Compliance Score"
          value={`${complianceScore}%`}
          trend={{ value: 5, direction: 'down' }}
        />
      </div>

      {/* Widget Grid */}
      <WidgetGrid cols={12} gap={4}>
        {/* Severity Breakdown Chart */}
        <WidgetWrapper colSpan={6}>
          <ChartWidget
            type="bar"
            title="Vulnerability Severity Breakdown"
            data={severityChartData}
            dataKeys={[
              { key: 'count', color: '#ef4444', name: 'Vulnerabilities' },
            ]}
            xAxisKey="name"
            height={280}
            colorByData
          />
        </WidgetWrapper>

        {/* Recent Vulnerabilities Table */}
        <WidgetWrapper colSpan={6}>
          <TableWidget
            title="Recent Vulnerabilities"
            columns={[
              { key: 'title', label: 'Title' },
              { key: 'cve', label: 'CVE' },
              {
                key: 'cvss',
                label: 'CVSS',
                render: (val) => (
                  <span className={`font-mono font-semibold ${Number(val) >= 9 ? 'text-red-400' : Number(val) >= 7 ? 'text-orange-400' : 'text-amber-400'}`}>
                    {String(val)}
                  </span>
                ),
              },
              {
                key: 'severity',
                label: 'Severity',
                render: (val) => (
                  <Badge variant={val as 'critical' | 'high' | 'medium' | 'low'}>
                    {String(val)}
                  </Badge>
                ),
              },
            ]}
            data={recentVulns}
            maxRows={5}
          />
        </WidgetWrapper>

        {/* Timeline */}
        <WidgetWrapper colSpan={5}>
          <TimelineWidget events={timelineEvents} maxEvents={6} />
        </WidgetWrapper>

        {/* Network Graph Preview */}
        <WidgetWrapper colSpan={7}>
          <GraphWidget
            data={MOCK_GRAPH_DATA}
            title="Network Topology Preview"
            height={320}
          />
        </WidgetWrapper>
      </WidgetGrid>
    </div>
  );
}
