import { useState, useEffect, useMemo } from 'react';
import { BarChart3, Server, ShieldAlert, Radio, Layers } from 'lucide-react';
import ChartWidget from '@/components/dashboard/ChartWidget';
import StatCard from '@/components/dashboard/StatCard';
import { WidgetGrid, WidgetWrapper } from '@/components/dashboard/WidgetGrid';
import { api } from '@/services/api';

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
  open: number;
  resolved: number;
}

const PURDUE_COLORS: Record<string, string> = {
  L0: '#ef4444',
  L1: '#f97316',
  L2: '#f59e0b',
  L3: '#3b82f6',
  L4: '#8b5cf6',
  L5: '#06b6d4',
  DMZ: '#10b981',
  UNKNOWN: '#6b7280',
};

export default function MetricsAnalytics() {
  const [deviceStats, setDeviceStats] = useState<DeviceStats | null>(null);
  const [findingStats, setFindingStats] = useState<FindingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [devRes, findRes] = await Promise.allSettled([
        api.get('/ics/devices/stats'),
        api.get('/ics/findings/stats'),
      ]);
      if (devRes.status === 'fulfilled') setDeviceStats(devRes.value.data);
      if (findRes.status === 'fulfilled') setFindingStats(findRes.value.data);
      setLoading(false);
    }
    load();
  }, []);

  // Purdue zone chart derived from real device data
  const purdueZoneData = useMemo(() => {
    if (!deviceStats?.by_purdue_level) return [];
    return Object.entries(deviceStats.by_purdue_level)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [deviceStats]);

  // Severity breakdown chart
  const severityData = useMemo(() => {
    if (!findingStats?.by_severity) return [];
    const order = ['critical', 'high', 'medium', 'low', 'info'];
    const colors: Record<string, string> = {
      critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#3b82f6', info: '#6b7280',
    };
    return order
      .filter((s) => (findingStats.by_severity[s] ?? 0) > 0)
      .map((s) => ({
        name: s.charAt(0).toUpperCase() + s.slice(1),
        count: findingStats.by_severity[s],
        fill: colors[s],
      }));
  }, [findingStats]);

  // Device type chart
  const deviceTypeData = useMemo(() => {
    if (!deviceStats?.by_type) return [];
    return Object.entries(deviceStats.by_type)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, value]) => ({ name, count: value }));
  }, [deviceStats]);

  // Protocol chart
  const protocolData = useMemo(() => {
    if (!deviceStats?.by_protocol) return [];
    return Object.entries(deviceStats.by_protocol)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, value]) => ({ name, count: value }));
  }, [deviceStats]);

  const hasData = (deviceStats?.total_devices ?? 0) > 0 || (findingStats?.total ?? 0) > 0;
  const purdueViolations = findingStats?.by_type?.purdue_violation ?? 0;
  const protocolCount = Object.keys(deviceStats?.by_protocol ?? {}).length;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-content-primary">OT Metrics & Analytics</h1>
          <p className="text-sm text-content-secondary">Operational technology security trends, device discovery, and protocol analytics</p>
        </div>
      </div>

      {/* Key Metrics Summary */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<ShieldAlert className="h-5 w-5" />}
          label="Total Findings"
          value={findingStats?.total ?? 0}
          severity={(findingStats?.by_severity?.critical ?? 0) > 0 ? 'critical' : (findingStats?.by_severity?.high ?? 0) > 0 ? 'high' : undefined}
        />
        <StatCard
          icon={<Server className="h-5 w-5" />}
          label="OT Devices Discovered"
          value={deviceStats?.total_devices ?? 0}
        />
        <StatCard
          icon={<Radio className="h-5 w-5" />}
          label="ICS Protocols Seen"
          value={protocolCount}
        />
        <StatCard
          icon={<Layers className="h-5 w-5" />}
          label="Purdue Violations"
          value={purdueViolations}
          severity={purdueViolations > 0 ? 'high' : undefined}
        />
      </div>

      {!hasData ? (
        <div className="rounded-lg border border-border-default bg-surface-card p-12 text-center">
          <BarChart3 className="mx-auto h-12 w-12 text-content-tertiary mb-4" />
          <h2 className="text-lg font-semibold text-content-primary mb-2">No Analytics Data Yet</h2>
          <p className="text-sm text-content-secondary mb-4">
            Upload PCAP files to generate real metrics and analytics for your OT environment.
          </p>
          <a href="/pcap" className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors">
            Go to PCAP Analysis
          </a>
        </div>
      ) : (
        <WidgetGrid cols={12} gap={4}>
          {/* Severity Breakdown */}
          {severityData.length > 0 && (
            <WidgetWrapper colSpan={6}>
              <ChartWidget
                type="bar"
                title="Finding Severity Breakdown"
                data={severityData}
                dataKeys={[{ key: 'count', color: '#ef4444', name: 'Findings' }]}
                xAxisKey="name"
                height={280}
                colorByData
              />
            </WidgetWrapper>
          )}

          {/* Purdue Zone Distribution */}
          {purdueZoneData.length > 0 && (
            <WidgetWrapper colSpan={6}>
              <ChartWidget
                type="donut"
                title="Devices by Purdue Zone"
                data={purdueZoneData}
                dataKeys={purdueZoneData.map((d) => ({
                  key: 'value',
                  color: PURDUE_COLORS[d.name] ?? '#6b7280',
                }))}
                height={280}
              />
            </WidgetWrapper>
          )}

          {/* Device Types */}
          {deviceTypeData.length > 0 && (
            <WidgetWrapper colSpan={6}>
              <ChartWidget
                type="bar"
                title="Device Types"
                data={deviceTypeData}
                dataKeys={[{ key: 'count', color: '#8b5cf6', name: 'Devices' }]}
                xAxisKey="name"
                height={260}
              />
            </WidgetWrapper>
          )}

          {/* Protocol Distribution */}
          {protocolData.length > 0 && (
            <WidgetWrapper colSpan={6}>
              <ChartWidget
                type="bar"
                title="Protocols by Device Count"
                data={protocolData}
                dataKeys={[{ key: 'count', color: '#06b6d4', name: 'Devices' }]}
                xAxisKey="name"
                height={260}
              />
            </WidgetWrapper>
          )}
        </WidgetGrid>
      )}
    </div>
  );
}
