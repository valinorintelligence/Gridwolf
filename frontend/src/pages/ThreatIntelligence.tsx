import { useMemo } from 'react';
import { Skull, Shield, Crosshair, Activity } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import StatCard from '@/components/dashboard/StatCard';
import ChartWidget from '@/components/dashboard/ChartWidget';
import TimelineWidget from '@/components/dashboard/TimelineWidget';
import { Badge } from '@/components/ui/Badge';
import SeverityBadge from '@/components/shared/SeverityBadge';
import { MOCK_OBJECTS, MOCK_DASHBOARD_STATS, MOCK_LINKS } from '@/data/mock';
import { SEVERITY_COLORS } from '@/lib/constants';
import { cn } from '@/lib/cn';

// Simplified MITRE ATT&CK tactics
const MITRE_TACTICS = [
  { id: 'TA0001', name: 'Initial Access', techniques: 3 },
  { id: 'TA0002', name: 'Execution', techniques: 2 },
  { id: 'TA0003', name: 'Persistence', techniques: 1 },
  { id: 'TA0004', name: 'Privilege Escalation', techniques: 2 },
  { id: 'TA0005', name: 'Defense Evasion', techniques: 1 },
  { id: 'TA0006', name: 'Credential Access', techniques: 3 },
  { id: 'TA0007', name: 'Discovery', techniques: 2 },
  { id: 'TA0008', name: 'Lateral Movement', techniques: 4 },
  { id: 'TA0009', name: 'Collection', techniques: 1 },
  { id: 'TA0011', name: 'Command & Control', techniques: 2 },
  { id: 'TA0040', name: 'Impact', techniques: 3 },
];

// Simplified techniques per tactic (mock)
const TECHNIQUE_MAP: Record<string, { id: string; name: string; severity: string }[]> = {
  TA0001: [
    { id: 'T0819', name: 'Exploit Public-Facing Application', severity: 'critical' },
    { id: 'T0866', name: 'Exploitation of Remote Services', severity: 'high' },
    { id: 'T0886', name: 'Remote Services (RDP)', severity: 'medium' },
  ],
  TA0006: [
    { id: 'T0859', name: 'Valid Accounts (Default Creds)', severity: 'critical' },
    { id: 'T0891', name: 'Hardcoded Credentials', severity: 'critical' },
    { id: 'T0811', name: 'Data from Information Repositories', severity: 'high' },
  ],
  TA0008: [
    { id: 'T0812', name: 'Default Credentials', severity: 'high' },
    { id: 'T0867', name: 'Lateral Tool Transfer', severity: 'high' },
    { id: 'T0843', name: 'Program Download', severity: 'critical' },
    { id: 'T0886b', name: 'Remote Services', severity: 'medium' },
  ],
  TA0040: [
    { id: 'T0831', name: 'Manipulation of Control', severity: 'critical' },
    { id: 'T0882', name: 'Theft of Operational Info', severity: 'high' },
    { id: 'T0813', name: 'Denial of Control', severity: 'critical' },
  ],
};

export default function ThreatIntelligence() {
  const stats = MOCK_DASHBOARD_STATS;

  const attackPaths = useMemo(
    () => MOCK_OBJECTS.filter((o) => o.typeId === 'type-attack-path'),
    []
  );

  const vulns = useMemo(
    () => MOCK_OBJECTS.filter((o) => o.typeId === 'type-vuln'),
    []
  );

  // Severity distribution for chart
  const severityChartData = useMemo(
    () => [
      { name: 'Critical', count: stats.severityBreakdown.critical, fill: SEVERITY_COLORS.critical },
      { name: 'High', count: stats.severityBreakdown.high, fill: SEVERITY_COLORS.high },
      { name: 'Medium', count: stats.severityBreakdown.medium, fill: SEVERITY_COLORS.medium },
      { name: 'Low', count: stats.severityBreakdown.low, fill: SEVERITY_COLORS.low },
    ],
    [stats.severityBreakdown]
  );

  // Timeline events from recent events
  const threatEvents = useMemo(
    () =>
      stats.recentEvents.map((evt) => ({
        id: evt.id,
        timestamp: evt.timestamp,
        action: evt.action.replace(/_/g, ' '),
        objectType: evt.objectType?.toLowerCase(),
        objectTitle: evt.objectTitle,
        severity: 'high' as const,
      })),
    [stats.recentEvents]
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/15">
          <Skull className="h-5 w-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-content-primary">Threat Intelligence</h1>
          <p className="text-xs text-content-secondary">
            MITRE ATT&CK for ICS mapping and threat analysis
          </p>
        </div>
        <Badge variant="critical" dot className="ml-auto">
          {stats.activeAlerts} Active Alerts
        </Badge>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Skull size={20} />}
          label="Active Threats"
          value={stats.activeAlerts}
          severity="critical"
        />
        <StatCard
          icon={<Crosshair size={20} />}
          label="Attack Paths"
          value={attackPaths.length}
          severity="high"
        />
        <StatCard
          icon={<Shield size={20} />}
          label="Critical Vulns"
          value={stats.criticalVulns}
          severity="critical"
        />
        <StatCard
          icon={<Activity size={20} />}
          label="Threat Level"
          value={stats.threatLevel.toUpperCase()}
          severity="high"
        />
      </div>

      {/* MITRE ATT&CK Matrix */}
      <Card>
        <CardHeader
          title="MITRE ATT&CK for ICS - Tactic Coverage"
          action={<Badge variant="outline">ICS Framework</Badge>}
        />
        <CardContent className="overflow-x-auto">
          <div className="flex gap-1 min-w-[900px]">
            {MITRE_TACTICS.map((tactic) => {
              const techniques = TECHNIQUE_MAP[tactic.id];
              return (
                <div
                  key={tactic.id}
                  className="flex-1 rounded border border-border-default bg-bg-primary"
                >
                  {/* Tactic header */}
                  <div className="border-b border-border-default bg-surface-hover px-2 py-2 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-content-primary">
                      {tactic.name}
                    </p>
                    <p className="text-[9px] text-content-tertiary">{tactic.id}</p>
                  </div>
                  {/* Techniques */}
                  <div className="space-y-1 p-1.5">
                    {techniques ? (
                      techniques.map((tech) => (
                        <div
                          key={tech.id}
                          className={cn(
                            'rounded px-1.5 py-1 text-[10px]',
                            tech.severity === 'critical' && 'bg-red-500/20 text-red-400',
                            tech.severity === 'high' && 'bg-orange-500/20 text-orange-400',
                            tech.severity === 'medium' && 'bg-amber-500/20 text-amber-400',
                          )}
                        >
                          <p className="font-medium leading-tight">{tech.name}</p>
                          <p className="text-[8px] opacity-70">{tech.id}</p>
                        </div>
                      ))
                    ) : (
                      <div className="px-1.5 py-2 text-center text-[10px] text-content-muted">
                        {tactic.techniques} technique{tactic.techniques !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-12 gap-4">
        {/* Threat severity distribution */}
        <div className="col-span-5">
          <ChartWidget
            type="donut"
            title="Threat Severity Distribution"
            data={severityChartData}
            dataKeys={[
              { key: 'count', color: SEVERITY_COLORS.critical, name: 'Critical' },
              { key: 'count', color: SEVERITY_COLORS.high, name: 'High' },
              { key: 'count', color: SEVERITY_COLORS.medium, name: 'Medium' },
              { key: 'count', color: SEVERITY_COLORS.low, name: 'Low' },
            ]}
            height={260}
          />
        </div>

        {/* Recent threat events */}
        <div className="col-span-7">
          <TimelineWidget events={threatEvents} maxEvents={5} />
        </div>
      </div>

      {/* Active Attack Paths */}
      <Card>
        <CardHeader title="Active Attack Paths" />
        <CardContent className="space-y-2">
          {attackPaths.map((ap) => (
            <div
              key={ap.id}
              className="flex items-center gap-4 rounded-md border border-border-default bg-surface-card px-4 py-3"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg font-bold"
                style={{
                  backgroundColor:
                    Number(ap.properties.riskScore) >= 90
                      ? '#ef444430'
                      : Number(ap.properties.riskScore) >= 70
                        ? '#f9731630'
                        : '#eab30830',
                  color:
                    Number(ap.properties.riskScore) >= 90
                      ? '#ef4444'
                      : Number(ap.properties.riskScore) >= 70
                        ? '#f97316'
                        : '#eab308',
                }}
              >
                {String(ap.properties.riskScore)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-content-primary">{ap.title}</p>
                <p className="text-xs text-content-secondary">
                  {String(ap.properties.steps)} steps | Blast radius: {String(ap.properties.blastRadius)} assets
                </p>
              </div>
              {ap.severity && (
                <SeverityBadge severity={ap.severity as 'critical' | 'high' | 'medium' | 'low' | 'info'} />
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
