import { BarChart3, TrendingUp, Scan, Server, ShieldAlert } from 'lucide-react';
// Card available for future use
import ChartWidget from '@/components/dashboard/ChartWidget';
import StatCard from '@/components/dashboard/StatCard';
import { WidgetGrid, WidgetWrapper } from '@/components/dashboard/WidgetGrid';
import { MOCK_DASHBOARD_STATS } from '@/data/mock';

const VULN_TREND_DATA = [
  { month: 'Jul', critical: 5, high: 8, medium: 12, low: 3 },
  { month: 'Aug', critical: 4, high: 9, medium: 14, low: 4 },
  { month: 'Sep', critical: 6, high: 7, medium: 11, low: 5 },
  { month: 'Oct', critical: 3, high: 10, medium: 15, low: 4 },
  { month: 'Nov', critical: 4, high: 6, medium: 13, low: 3 },
  { month: 'Dec', critical: 3, high: 4, medium: 3, low: 1 },
];

const SCAN_FREQ_DATA = [
  { week: 'W47', sast: 12, dast: 4, sca: 8 },
  { week: 'W48', sast: 14, dast: 5, sca: 9 },
  { week: 'W49', sast: 11, dast: 6, sca: 7 },
  { week: 'W50', sast: 15, dast: 4, sca: 10 },
  { week: 'W51', sast: 13, dast: 7, sca: 8 },
  { week: 'W52', sast: 16, dast: 5, sca: 11 },
];

const ASSET_GROWTH_DATA = [
  { month: 'Jul', hosts: 32, products: 8, components: 42 },
  { month: 'Aug', hosts: 35, products: 10, components: 48 },
  { month: 'Sep', hosts: 38, products: 11, components: 55 },
  { month: 'Oct', hosts: 40, products: 12, components: 61 },
  { month: 'Nov', hosts: 43, products: 14, components: 68 },
  { month: 'Dec', hosts: 46, products: 16, components: 72 },
];

const REMEDIATION_DATA = [
  { month: 'Jul', resolved: 8, opened: 12 },
  { month: 'Aug', resolved: 11, opened: 9 },
  { month: 'Sep', resolved: 7, opened: 14 },
  { month: 'Oct', resolved: 13, opened: 8 },
  { month: 'Nov', resolved: 10, opened: 11 },
  { month: 'Dec', resolved: 15, opened: 6 },
];

const SEVERITY_PIE_DATA = [
  { name: 'Critical', value: MOCK_DASHBOARD_STATS.severityBreakdown.critical },
  { name: 'High', value: MOCK_DASHBOARD_STATS.severityBreakdown.high },
  { name: 'Medium', value: MOCK_DASHBOARD_STATS.severityBreakdown.medium },
  { name: 'Low', value: MOCK_DASHBOARD_STATS.severityBreakdown.low },
];

export default function MetricsAnalytics() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-content-primary">Metrics & Analytics</h1>
          <p className="text-sm text-content-secondary">Comprehensive security metrics, trends, and operational analytics</p>
        </div>
      </div>

      {/* Key Metrics Summary */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={<ShieldAlert className="h-5 w-5" />} label="Total Vulnerabilities" value={MOCK_DASHBOARD_STATS.severityBreakdown.critical + MOCK_DASHBOARD_STATS.severityBreakdown.high + MOCK_DASHBOARD_STATS.severityBreakdown.medium + MOCK_DASHBOARD_STATS.severityBreakdown.low} severity="high" />
        <StatCard icon={<Server className="h-5 w-5" />} label="Monitored Assets" value={MOCK_DASHBOARD_STATS.totalObjects} trend={{ value: 7, direction: 'up' }} />
        <StatCard icon={<Scan className="h-5 w-5" />} label="Scans This Week" value={284} trend={{ value: 15, direction: 'up' }} />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Fix Rate" value="71%" trend={{ value: 4, direction: 'up' }} />
      </div>

      {/* Charts Grid */}
      <WidgetGrid cols={12} gap={4}>
        <WidgetWrapper colSpan={8}>
          <ChartWidget
            type="area"
            title="Vulnerability Trends"
            data={VULN_TREND_DATA}
            dataKeys={[
              { key: 'critical', color: '#ef4444', name: 'Critical' },
              { key: 'high', color: '#f97316', name: 'High' },
              { key: 'medium', color: '#f59e0b', name: 'Medium' },
              { key: 'low', color: '#3b82f6', name: 'Low' },
            ]}
            xAxisKey="month"
            height={300}
          />
        </WidgetWrapper>

        <WidgetWrapper colSpan={4}>
          <ChartWidget
            type="donut"
            title="Current Severity Distribution"
            data={SEVERITY_PIE_DATA}
            dataKeys={[
              { key: 'value', color: '#ef4444' },
              { key: 'value', color: '#f97316' },
              { key: 'value', color: '#f59e0b' },
              { key: 'value', color: '#3b82f6' },
            ]}
            height={300}
          />
        </WidgetWrapper>

        <WidgetWrapper colSpan={6}>
          <ChartWidget
            type="bar"
            title="Scan Frequency by Type"
            data={SCAN_FREQ_DATA}
            dataKeys={[
              { key: 'sast', color: '#8b5cf6', name: 'SAST' },
              { key: 'dast', color: '#06b6d4', name: 'DAST' },
              { key: 'sca', color: '#10b981', name: 'SCA' },
            ]}
            xAxisKey="week"
            height={280}
          />
        </WidgetWrapper>

        <WidgetWrapper colSpan={6}>
          <ChartWidget
            type="line"
            title="Remediation Velocity"
            data={REMEDIATION_DATA}
            dataKeys={[
              { key: 'resolved', color: '#10b981', name: 'Resolved' },
              { key: 'opened', color: '#ef4444', name: 'Opened' },
            ]}
            xAxisKey="month"
            height={280}
          />
        </WidgetWrapper>

        <WidgetWrapper colSpan={12}>
          <ChartWidget
            type="area"
            title="Asset Inventory Growth"
            data={ASSET_GROWTH_DATA}
            dataKeys={[
              { key: 'hosts', color: '#3b82f6', name: 'Hosts' },
              { key: 'products', color: '#10b981', name: 'Products' },
              { key: 'components', color: '#14b8a6', name: 'Components' },
            ]}
            xAxisKey="month"
            height={260}
          />
        </WidgetWrapper>
      </WidgetGrid>
    </div>
  );
}
