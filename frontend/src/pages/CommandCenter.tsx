import { useState, useEffect, useMemo } from 'react';
import { LayoutDashboard, Server, ShieldAlert, Skull, Activity } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import ChartWidget from '@/components/dashboard/ChartWidget';
import TableWidget from '@/components/dashboard/TableWidget';
import TimelineWidget from '@/components/dashboard/TimelineWidget';
import GraphWidget from '@/components/dashboard/GraphWidget';
import { WidgetGrid, WidgetWrapper } from '@/components/dashboard/WidgetGrid';
import { Badge } from '@/components/ui/Badge';
import { SEVERITY_COLORS } from '@/lib/constants';
import { api } from '@/services/api';
import type { GraphData } from '@/types/ontology';

interface DeviceStats {
  total_devices: number;
  by_type: Record<string, number>;
  by_purdue_level: Record<string, number>;
  by_vendor: Record<string, number>;
  by_protocol: Record<string, number>;
}

interface FindingStats {
  total: number;
  by_severity: Record<string, number>;
  by_type: Record<string, number>;
  open_count: number;
  investigating_count: number;
  resolved_count: number;
}

interface Finding {
  id: string;
  finding_type: string;
  severity: string;
  title: string;
  description: string;
  src_ip: string | null;
  dst_ip: string | null;
  protocol: string | null;
  confidence: number;
  status: string;
  created_at: string;
}

interface Session {
  id: string;
  name: string;
  status: string;
  device_count: number;
  connection_count: number;
  finding_count: number;
  created_at: string;
}

export default function CommandCenter() {
  const [deviceStats, setDeviceStats] = useState<DeviceStats | null>(null);
  const [findingStats, setFindingStats] = useState<FindingStats | null>(null);
  const [recentFindings, setRecentFindings] = useState<Finding[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [topology, setTopology] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [devRes, findRes, findListRes, sessRes, topoRes] = await Promise.allSettled([
          api.get('/ics/devices/stats'),
          api.get('/ics/findings/stats'),
          api.get('/ics/findings/', { params: { limit: 10 } }),
          api.get('/ics/sessions/'),
          api.get('/ics/devices/topology'),
        ]);
        if (devRes.status === 'fulfilled') setDeviceStats(devRes.value.data);
        if (findRes.status === 'fulfilled') setFindingStats(findRes.value.data);
        if (findListRes.status === 'fulfilled') setRecentFindings(findListRes.value.data.slice(0, 10));
        if (sessRes.status === 'fulfilled') setSessions(sessRes.value.data);
        if (topoRes.status === 'fulfilled') {
          const d = topoRes.value.data;
          if (d.nodes?.length > 0) {
            setTopology({
              nodes: d.nodes.map((n: Record<string, unknown>) => ({
                id: n.id as string,
                label: (n.label || n.ip || n.id) as string,
                type: (n.type || 'default') as string,
                color: '#8b5cf6',
              })),
              edges: (d.edges ?? []).map((e: Record<string, unknown>) => ({
                id: `${e.source}-${e.target}`,
                source: e.source as string,
                target: e.target as string,
                label: (e.protocol || '') as string,
              })),
            });
          }
        }
      } catch {
        // Individual requests handled via allSettled
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const totalDevices = deviceStats?.total_devices ?? 0;
  const totalFindings = findingStats?.total ?? 0;
  const openFindings = findingStats?.open_count ?? 0;
  const criticalCount = findingStats?.by_severity?.critical ?? 0;
  const highCount = findingStats?.by_severity?.high ?? 0;

  const threatLevel = criticalCount > 0 ? 'critical' : highCount > 0 ? 'high' : totalFindings > 0 ? 'medium' : 'low';

  const severityChartData = useMemo(() => {
    if (!findingStats?.by_severity) return [];
    return Object.entries(findingStats.by_severity).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      count: value,
      fill: SEVERITY_COLORS[name] ?? '#6b7280',
    }));
  }, [findingStats]);

  const findingsTableData = useMemo(
    () =>
      recentFindings.map((f) => ({
        title: f.title,
        protocol: f.protocol ?? '--',
        severity: f.severity,
        status: f.status,
      })),
    [recentFindings]
  );

  const timelineEvents = useMemo(
    () =>
      sessions.map((s) => ({
        id: s.id,
        timestamp: s.created_at,
        action: `Session: ${s.name}`,
        objectType: 'session',
        objectTitle: `${s.device_count} devices, ${s.finding_count} findings`,
      })),
    [sessions]
  );

  const hasData = totalDevices > 0 || totalFindings > 0;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

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
        {hasData && (
          <Badge variant={threatLevel === 'critical' ? 'critical' : threatLevel === 'high' ? 'critical' : 'medium'} dot className="ml-auto">
            Threat Level: {threatLevel.toUpperCase()}
          </Badge>
        )}
      </div>

      {!hasData ? (
        <div className="rounded-lg border border-border-default bg-surface-card p-12 text-center">
          <Activity className="mx-auto h-12 w-12 text-content-tertiary mb-4" />
          <h2 className="text-lg font-semibold text-content-primary mb-2">No Data Yet</h2>
          <p className="text-sm text-content-secondary mb-4">
            Upload a PCAP file to discover devices, connections, and security findings.
          </p>
          <a href="/pcap" className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors">
            Go to PCAP Analysis
          </a>
        </div>
      ) : (
        <>
          {/* Stats Row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<Server size={20} />}
              label="Discovered Devices"
              value={totalDevices}
            />
            <StatCard
              icon={<ShieldAlert size={20} />}
              label="Open Findings"
              value={openFindings}
              severity={openFindings > 0 ? 'high' : undefined}
            />
            <StatCard
              icon={<Skull size={20} />}
              label="Critical/High"
              value={criticalCount + highCount}
              severity={criticalCount > 0 ? 'critical' : highCount > 0 ? 'high' : undefined}
            />
            <StatCard
              icon={<Activity size={20} />}
              label="Analysis Sessions"
              value={sessions.length}
            />
          </div>

          {/* Widget Grid */}
          <WidgetGrid cols={12} gap={4}>
            {/* Severity Breakdown Chart */}
            {severityChartData.length > 0 && (
              <WidgetWrapper colSpan={6}>
                <ChartWidget
                  type="bar"
                  title="Finding Severity Breakdown"
                  data={severityChartData}
                  dataKeys={[
                    { key: 'count', color: '#ef4444', name: 'Findings' },
                  ]}
                  xAxisKey="name"
                  height={280}
                  colorByData
                />
              </WidgetWrapper>
            )}

            {/* Recent Findings Table */}
            {recentFindings.length > 0 && (
              <WidgetWrapper colSpan={6}>
                <TableWidget
                  title="Recent Security Findings"
                  columns={[
                    { key: 'title', label: 'Finding' },
                    { key: 'protocol', label: 'Protocol' },
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
                  data={findingsTableData}
                  maxRows={5}
                />
              </WidgetWrapper>
            )}

            {/* Sessions Timeline */}
            {sessions.length > 0 && (
              <WidgetWrapper colSpan={5}>
                <TimelineWidget events={timelineEvents} maxEvents={6} />
              </WidgetWrapper>
            )}

            {/* Network Topology Preview */}
            {topology && (
              <WidgetWrapper colSpan={7}>
                <GraphWidget
                  data={topology}
                  title="Network Topology Preview"
                  height={320}
                />
              </WidgetWrapper>
            )}
          </WidgetGrid>
        </>
      )}
    </div>
  );
}
