import { useState, useMemo, useEffect } from 'react';
import { Route, AlertTriangle, Crosshair, Target } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import StatCard from '@/components/dashboard/StatCard';
import SeverityBadge from '@/components/shared/SeverityBadge';
import { api } from '@/services/api';
import { cn } from '@/lib/cn';

interface Finding {
  id: string;
  title: string;
  severity: string;
  finding_type: string;
  status: string;
  created_at: string;
  description?: string;
  cvss_score?: number;
  cve_id?: string;
}

export default function AttackPaths() {
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await api.get('/ics/findings/').catch(() => ({ data: [] }));
        const data = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
        setFindings(data);
      } catch {
        setFindings([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const attackPaths = useMemo(() => findings.map((f) => ({
    id: String(f.id),
    typeId: 'type-attack-path',
    typeName: 'Finding',
    title: f.title ?? 'Finding',
    status: f.status ?? 'active',
    severity: f.severity,
    properties: {
      riskScore: f.cvss_score ?? (f.severity === 'critical' ? 95 : f.severity === 'high' ? 75 : f.severity === 'medium' ? 50 : 25),
      steps: 0,
      blastRadius: 0,
      findingType: f.finding_type,
    },
    createdAt: f.created_at,
  })), [findings]);

  // No exploited vulns from API (flat findings list)
  const exploitedVulns: Record<string, unknown>[] = [];

  const selectedPath = attackPaths.find((ap) => ap.id === selectedPathId);

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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (attackPaths.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Route className="h-12 w-12 text-content-muted" />
        <h2 className="mt-4 text-lg font-semibold text-content-primary">No Data Yet</h2>
        <p className="mt-1 text-sm text-content-secondary">Security findings and attack paths will appear here after scanning your environment.</p>
      </div>
    );
  }

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
                    <span>{String(ap.properties.findingType ?? '')}</span>
                    <span>{ap.status}</span>
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

              {/* Finding details */}
              <Card>
                <CardHeader title="Finding Details" />
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-content-secondary">Type:</span>
                      <span className="text-content-primary">{String(selectedPath.properties.findingType ?? '--')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-content-secondary">Created:</span>
                      <span className="text-content-primary">{selectedPath.createdAt ? new Date(selectedPath.createdAt).toLocaleString() : '--'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-content-secondary">Status:</span>
                      <span className="text-content-primary">{selectedPath.status}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
