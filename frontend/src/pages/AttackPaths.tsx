import { useState, useMemo } from 'react';
import { Route, AlertTriangle, Crosshair, Target, ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import StatCard from '@/components/dashboard/StatCard';
import SeverityBadge from '@/components/shared/SeverityBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { MOCK_OBJECTS, MOCK_LINKS } from '@/data/mock';
import { cn } from '@/lib/cn';

// Simulated attack path step details
const ATTACK_PATH_STEPS: Record<string, { step: number; label: string; nodeId: string; technique: string }[]> = {
  'ap-001': [
    { step: 1, label: 'External Reconnaissance', nodeId: 'h-006', technique: 'T0883 - Internet Scanning' },
    { step: 2, label: 'Exploit DMZ Firewall', nodeId: 'h-006', technique: 'T0866 - Exploitation of Remote Services' },
    { step: 3, label: 'Pivot to SCADA Server', nodeId: 'h-007', technique: 'T0867 - Lateral Tool Transfer' },
    { step: 4, label: 'Exploit Auth Bypass (CVE-2024-38876)', nodeId: 'h-001', technique: 'T0819 - Exploit Public-Facing App' },
    { step: 5, label: 'PLC Takeover via Modbus', nodeId: 'h-001', technique: 'T0831 - Manipulation of Control' },
  ],
  'ap-002': [
    { step: 1, label: 'Compromise Engineering Workstation', nodeId: 'h-003', technique: 'T0886 - Remote Services' },
    { step: 2, label: 'Exploit Insecure Deserialization', nodeId: 'h-004', technique: 'T0891 - Hardcoded Credentials' },
    { step: 3, label: 'Exfiltrate Historian Data', nodeId: 'h-004', technique: 'T0882 - Theft of Operational Info' },
  ],
  'ap-003': [
    { step: 1, label: 'Rogue IoT Device on L0', nodeId: 'h-008', technique: 'T0848 - Rogue Master' },
    { step: 2, label: 'SNMP Reconnaissance', nodeId: 'h-006', technique: 'T0846 - Remote System Discovery' },
    { step: 3, label: 'Exploit Default SNMP Community', nodeId: 'h-006', technique: 'T0859 - Valid Accounts' },
    { step: 4, label: 'Lateral Movement to L2', nodeId: 'h-007', technique: 'T0867 - Lateral Tool Transfer' },
  ],
};

export default function AttackPaths() {
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);

  const attackPaths = useMemo(
    () => MOCK_OBJECTS.filter((o) => o.typeId === 'type-attack-path'),
    []
  );

  // Exploited vulns for selected path
  const exploitedVulns = useMemo(() => {
    if (!selectedPathId) return [];
    const exploitLinks = MOCK_LINKS.filter(
      (l) => l.sourceId === selectedPathId && l.linkType === 'EXPLOITS'
    );
    const vulnIds = new Set(exploitLinks.map((l) => l.targetId));
    return MOCK_OBJECTS.filter((o) => vulnIds.has(o.id));
  }, [selectedPathId]);

  const selectedPath = attackPaths.find((ap) => ap.id === selectedPathId);
  const steps = selectedPathId ? ATTACK_PATH_STEPS[selectedPathId] ?? [] : [];

  // Stats
  const avgRiskScore = useMemo(() => {
    const scores = attackPaths.map((ap) => Number(ap.properties.riskScore ?? 0));
    return scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
  }, [attackPaths]);

  const totalBlastRadius = useMemo(
    () => attackPaths.reduce((sum, ap) => sum + Number(ap.properties.blastRadius ?? 0), 0),
    [attackPaths]
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/15">
          <Route className="h-5 w-5 text-red-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-content-primary">Attack Paths</h1>
          <p className="text-xs text-content-secondary">
            Modeled attack paths through the OT environment
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Route size={20} />}
          label="Attack Paths"
          value={attackPaths.length}
          severity="high"
        />
        <StatCard
          icon={<AlertTriangle size={20} />}
          label="Avg Risk Score"
          value={avgRiskScore}
          severity={avgRiskScore >= 80 ? 'critical' : 'high'}
        />
        <StatCard
          icon={<Target size={20} />}
          label="Total Blast Radius"
          value={`${totalBlastRadius} assets`}
          severity="high"
        />
        <StatCard
          icon={<Crosshair size={20} />}
          label="Critical Paths"
          value={attackPaths.filter((ap) => ap.severity === 'critical').length}
          severity="critical"
        />
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Attack path list */}
        <div className="col-span-5 space-y-2">
          <h2 className="text-sm font-semibold text-content-primary">Identified Paths</h2>
          {attackPaths.map((ap) => {
            const isSelected = selectedPathId === ap.id;
            const riskScore = Number(ap.properties.riskScore ?? 0);

            return (
              <button
                key={ap.id}
                type="button"
                onClick={() => setSelectedPathId(isSelected ? null : ap.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left transition-colors',
                  isSelected
                    ? 'border-accent bg-accent/10'
                    : 'border-border-default bg-surface-card hover:bg-surface-hover'
                )}
              >
                {/* Risk score badge */}
                <div
                  className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg text-center"
                  style={{
                    backgroundColor: riskScore >= 90 ? '#ef444425' : riskScore >= 70 ? '#f9731625' : '#eab30825',
                    color: riskScore >= 90 ? '#ef4444' : riskScore >= 70 ? '#f97316' : '#eab308',
                  }}
                >
                  <span className="text-lg font-bold leading-none">{riskScore}</span>
                  <span className="text-[8px] uppercase">risk</span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-content-primary">{ap.title}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-content-secondary">
                    <span>{String(ap.properties.steps)} steps</span>
                    <span>Blast: {String(ap.properties.blastRadius)} assets</span>
                  </div>
                </div>

                {ap.severity && (
                  <SeverityBadge severity={ap.severity as 'critical' | 'high' | 'medium' | 'low' | 'info'} />
                )}
              </button>
            );
          })}
        </div>

        {/* Selected path detail */}
        <div className="col-span-7">
          {selectedPath ? (
            <div className="space-y-4">
              {/* Path header */}
              <Card>
                <CardHeader
                  title={selectedPath.title}
                  action={
                    selectedPath.severity && (
                      <SeverityBadge severity={selectedPath.severity as 'critical' | 'high' | 'medium' | 'low' | 'info'} />
                    )
                  }
                />
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-content-primary">
                        {String(selectedPath.properties.riskScore)}
                      </p>
                      <p className="text-xs text-content-secondary">Risk Score</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-content-primary">
                        {String(selectedPath.properties.steps)}
                      </p>
                      <p className="text-xs text-content-secondary">Steps</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-content-primary">
                        {String(selectedPath.properties.blastRadius)}
                      </p>
                      <p className="text-xs text-content-secondary">Blast Radius</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Steps visualization */}
              <Card>
                <CardHeader title="Attack Steps" />
                <CardContent className="space-y-0">
                  {steps.map((step, idx) => {
                    const targetHost = MOCK_OBJECTS.find((o) => o.id === step.nodeId);
                    return (
                      <div key={step.step} className="relative flex items-start gap-3 pb-4 last:pb-0">
                        {/* Connector line */}
                        {idx < steps.length - 1 && (
                          <div className="absolute left-[15px] top-8 h-full w-px bg-border-default" />
                        )}
                        {/* Step number */}
                        <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-red-500/50 bg-red-500/20 text-xs font-bold text-red-400">
                          {step.step}
                        </div>
                        {/* Step content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-content-primary">{step.label}</p>
                          <p className="text-xs text-content-tertiary">{step.technique}</p>
                          {targetHost && (
                            <div className="mt-1 flex items-center gap-1.5 text-xs text-content-secondary">
                              <ChevronRight size={10} />
                              <span>{targetHost.title}</span>
                              <span className="text-content-muted">({String(targetHost.properties.ip)})</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Exploited vulnerabilities */}
              {exploitedVulns.length > 0 && (
                <Card>
                  <CardHeader title="Exploited Vulnerabilities" />
                  <CardContent className="space-y-2">
                    {exploitedVulns.map((vuln) => (
                      <div
                        key={vuln.id}
                        className="flex items-center gap-3 rounded-md border border-border-default bg-surface-hover px-3 py-2"
                      >
                        <span className="font-mono text-xs text-content-secondary">
                          {String(vuln.properties.cveId ?? '--')}
                        </span>
                        <span className="flex-1 text-sm font-medium text-content-primary">
                          {vuln.title}
                        </span>
                        <span className="font-mono text-xs font-semibold text-orange-400">
                          CVSS {String(vuln.properties.cvssScore ?? '--')}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card className="flex flex-col items-center justify-center py-20">
              <Route size={40} className="text-content-muted" />
              <p className="mt-4 text-sm text-content-secondary">
                Select an attack path to view details
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
