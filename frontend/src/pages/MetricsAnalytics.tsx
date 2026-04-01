import { BarChart3, TrendingUp, Server, ShieldAlert, Radio, Layers } from 'lucide-react';
import ChartWidget from '@/components/dashboard/ChartWidget';
import StatCard from '@/components/dashboard/StatCard';
import { WidgetGrid, WidgetWrapper } from '@/components/dashboard/WidgetGrid';

const VULN_TREND_DATA = [
  { month: 'Oct', critical: 5, high: 8, medium: 12, low: 3 },
  { month: 'Nov', critical: 4, high: 9, medium: 14, low: 4 },
  { month: 'Dec', critical: 6, high: 7, medium: 11, low: 5 },
  { month: 'Jan', critical: 3, high: 10, medium: 15, low: 4 },
  { month: 'Feb', critical: 4, high: 6, medium: 13, low: 3 },
  { month: 'Mar', critical: 3, high: 4, medium: 3, low: 1 },
];

const DEVICE_DISCOVERY_DATA = [
  { month: 'Oct', plcs: 4, hmis: 3, switches: 6, rtus: 2 },
  { month: 'Nov', plcs: 5, hmis: 4, switches: 7, rtus: 2 },
  { month: 'Dec', plcs: 6, hmis: 4, switches: 8, rtus: 3 },
  { month: 'Jan', plcs: 6, hmis: 5, switches: 9, rtus: 3 },
  { month: 'Feb', plcs: 7, hmis: 5, switches: 10, rtus: 4 },
  { month: 'Mar', plcs: 8, hmis: 6, switches: 12, rtus: 4 },
];

const PROTOCOL_TRAFFIC_DATA = [
  { week: 'W9', modbus: 1240, s7comm: 890, dnp3: 340, opcua: 560 },
  { week: 'W10', modbus: 1180, s7comm: 920, dnp3: 380, opcua: 610 },
  { week: 'W11', modbus: 1310, s7comm: 870, dnp3: 350, opcua: 580 },
  { week: 'W12', modbus: 1150, s7comm: 950, dnp3: 400, opcua: 640 },
  { week: 'W13', modbus: 1280, s7comm: 910, dnp3: 370, opcua: 600 },
  { week: 'W14', modbus: 1350, s7comm: 940, dnp3: 410, opcua: 670 },
];

const REMEDIATION_DATA = [
  { month: 'Oct', patched: 3, mitigated: 5, unresolved: 14 },
  { month: 'Nov', patched: 5, mitigated: 7, unresolved: 11 },
  { month: 'Dec', patched: 4, mitigated: 8, unresolved: 10 },
  { month: 'Jan', patched: 6, mitigated: 9, unresolved: 8 },
  { month: 'Feb', patched: 7, mitigated: 10, unresolved: 6 },
  { month: 'Mar', patched: 9, mitigated: 11, unresolved: 4 },
];

const PURDUE_ZONE_DATA = [
  { name: 'L0 - Process', value: 4 },
  { name: 'L1 - Control', value: 8 },
  { name: 'L2 - Supervisory', value: 6 },
  { name: 'L3 - Operations', value: 5 },
  { name: 'DMZ', value: 3 },
  { name: 'L4 - Enterprise', value: 4 },
];

const CAPTURE_SESSION_DATA = [
  { month: 'Oct', sessions: 4, packets: 12400, duration: 48 },
  { month: 'Nov', sessions: 6, packets: 18600, duration: 72 },
  { month: 'Dec', sessions: 5, packets: 15200, duration: 60 },
  { month: 'Jan', sessions: 7, packets: 21800, duration: 84 },
  { month: 'Feb', sessions: 8, packets: 24100, duration: 96 },
  { month: 'Mar', sessions: 9, packets: 28400, duration: 108 },
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
          <h1 className="text-xl font-bold text-content-primary">OT Metrics & Analytics</h1>
          <p className="text-sm text-content-secondary">Operational technology security trends, device discovery, and protocol analytics</p>
        </div>
      </div>

      {/* Key Metrics Summary */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={<ShieldAlert className="h-5 w-5" />} label="Open Advisories" value={24} severity="high" />
        <StatCard icon={<Server className="h-5 w-5" />} label="OT Devices Discovered" value={30} trend={{ value: 12, direction: 'up' }} />
        <StatCard icon={<Radio className="h-5 w-5" />} label="ICS Protocols Seen" value={7} trend={{ value: 2, direction: 'up' }} />
        <StatCard icon={<Layers className="h-5 w-5" />} label="Purdue Violations" value={3} trend={{ value: 25, direction: 'down' }} />
      </div>

      {/* Charts Grid */}
      <WidgetGrid cols={12} gap={4}>
        <WidgetWrapper colSpan={8}>
          <ChartWidget
            type="area"
            title="Vulnerability Trends (ICS Advisories)"
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
            title="Devices by Purdue Zone"
            data={PURDUE_ZONE_DATA}
            dataKeys={[
              { key: 'value', color: '#ef4444' },
              { key: 'value', color: '#f97316' },
              { key: 'value', color: '#f59e0b' },
              { key: 'value', color: '#3b82f6' },
              { key: 'value', color: '#8b5cf6' },
              { key: 'value', color: '#10b981' },
            ]}
            height={300}
          />
        </WidgetWrapper>

        <WidgetWrapper colSpan={6}>
          <ChartWidget
            type="bar"
            title="ICS Protocol Traffic (Sessions/Week)"
            data={PROTOCOL_TRAFFIC_DATA}
            dataKeys={[
              { key: 'modbus', color: '#8b5cf6', name: 'Modbus TCP' },
              { key: 's7comm', color: '#06b6d4', name: 'S7comm' },
              { key: 'dnp3', color: '#f59e0b', name: 'DNP3' },
              { key: 'opcua', color: '#10b981', name: 'OPC UA' },
            ]}
            xAxisKey="week"
            height={280}
          />
        </WidgetWrapper>

        <WidgetWrapper colSpan={6}>
          <ChartWidget
            type="line"
            title="Remediation Progress"
            data={REMEDIATION_DATA}
            dataKeys={[
              { key: 'patched', color: '#10b981', name: 'Patched' },
              { key: 'mitigated', color: '#f59e0b', name: 'Mitigated' },
              { key: 'unresolved', color: '#ef4444', name: 'Unresolved' },
            ]}
            xAxisKey="month"
            height={280}
          />
        </WidgetWrapper>

        <WidgetWrapper colSpan={6}>
          <ChartWidget
            type="area"
            title="Device Discovery Over Time"
            data={DEVICE_DISCOVERY_DATA}
            dataKeys={[
              { key: 'plcs', color: '#3b82f6', name: 'PLCs' },
              { key: 'hmis', color: '#10b981', name: 'HMIs' },
              { key: 'switches', color: '#14b8a6', name: 'Switches' },
              { key: 'rtus', color: '#f59e0b', name: 'RTUs' },
            ]}
            xAxisKey="month"
            height={260}
          />
        </WidgetWrapper>

        <WidgetWrapper colSpan={6}>
          <ChartWidget
            type="bar"
            title="Capture Sessions & Packets"
            data={CAPTURE_SESSION_DATA}
            dataKeys={[
              { key: 'sessions', color: '#8b5cf6', name: 'Sessions' },
              { key: 'duration', color: '#06b6d4', name: 'Duration (hrs)' },
            ]}
            xAxisKey="month"
            height={260}
          />
        </WidgetWrapper>
      </WidgetGrid>
    </div>
  );
}
