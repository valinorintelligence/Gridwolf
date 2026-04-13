import { useState, useEffect, useMemo } from 'react';
import { Shield, TrendingUp, AlertTriangle, CheckCircle, ChevronRight, Loader2, ShieldOff } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import ChartWidget from '@/components/dashboard/ChartWidget';
import { api } from '@/services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FindingsStats {
  total: number;
  by_severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  open: number;
  investigating: number;
  resolved: number;
}

interface DeviceStats {
  total_devices: number;
  by_type: Record<string, number>;
  by_vendor: Record<string, number>;
  by_protocol: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Score computation helpers
// ---------------------------------------------------------------------------

/** Compute an overall security score (0-100) from findings stats and device stats. */
function computeOverallScore(findings: FindingsStats, _devices: DeviceStats): number {
  if (findings.total === 0) return 100;

  // Weighted penalty per open finding by severity
  const openRatio = (findings.open + findings.investigating) / Math.max(findings.total, 1);
  const severityPenalty =
    findings.by_severity.critical * 10 +
    findings.by_severity.high * 5 +
    findings.by_severity.medium * 2 +
    findings.by_severity.low * 0.5;

  // Normalize: max penalty caps at 100
  const normalizedPenalty = Math.min(severityPenalty / Math.max(findings.total * 3, 1), 1);
  const resolutionBonus = findings.resolved / Math.max(findings.total, 1) * 15;

  const score = Math.round(100 - normalizedPenalty * 60 - openRatio * 25 + resolutionBonus);
  return Math.max(0, Math.min(100, score));
}

/** Build category scores from findings data. */
function buildCategoryScores(findings: FindingsStats) {
  const total = findings.total || 1;
  const resolved = findings.resolved || 0;
  const sev = findings.by_severity;

  // Vulnerability Management: penalised by critical + high findings
  const vulnScore = Math.max(0, Math.min(100, Math.round(
    100 - ((sev.critical * 12 + sev.high * 6) / total) * 50
  )));

  // Compliance: based on resolution rate
  const complianceScore = Math.max(0, Math.min(100, Math.round(
    (resolved / total) * 100
  )));

  // Network Security: penalised by medium + low findings remaining open
  const networkScore = Math.max(0, Math.min(100, Math.round(
    100 - ((sev.medium * 3 + sev.low) / total) * 40
  )));

  // Identity & Access: blend of overall posture
  const identityScore = Math.max(0, Math.min(100, Math.round(
    100 - ((findings.open + findings.investigating) / total) * 60
  )));

  return [
    { name: 'Vulnerability Management', score: vulnScore, icon: AlertTriangle, color: '#ef4444', maxScore: 100 },
    { name: 'Compliance', score: complianceScore, icon: CheckCircle, color: '#6366f1', maxScore: 100 },
    { name: 'Network Security', score: networkScore, icon: Shield, color: '#3b82f6', maxScore: 100 },
    { name: 'Identity & Access', score: identityScore, icon: Shield, color: '#a855f7', maxScore: 100 },
  ];
}

/** Build recommendations from findings data, sorted by severity. */
function buildRecommendations(findings: FindingsStats) {
  const recs: { id: number; priority: string; title: string; impact: string; category: string }[] = [];
  let id = 1;

  if (findings.by_severity.critical > 0) {
    recs.push({
      id: id++,
      priority: 'critical',
      title: `Remediate ${findings.by_severity.critical} critical finding${findings.by_severity.critical > 1 ? 's' : ''}`,
      impact: `+${Math.min(findings.by_severity.critical * 4, 20)} pts`,
      category: 'Vulnerability',
    });
  }
  if (findings.by_severity.high > 0) {
    recs.push({
      id: id++,
      priority: 'high',
      title: `Address ${findings.by_severity.high} high-severity finding${findings.by_severity.high > 1 ? 's' : ''}`,
      impact: `+${Math.min(findings.by_severity.high * 2, 15)} pts`,
      category: 'Vulnerability',
    });
  }
  if (findings.investigating > 0) {
    recs.push({
      id: id++,
      priority: 'high',
      title: `Resolve ${findings.investigating} finding${findings.investigating > 1 ? 's' : ''} under investigation`,
      impact: `+${Math.min(findings.investigating * 2, 10)} pts`,
      category: 'Compliance',
    });
  }
  if (findings.by_severity.medium > 0) {
    recs.push({
      id: id++,
      priority: 'medium',
      title: `Mitigate ${findings.by_severity.medium} medium-severity finding${findings.by_severity.medium > 1 ? 's' : ''}`,
      impact: `+${Math.min(findings.by_severity.medium, 8)} pts`,
      category: 'Network',
    });
  }
  if (findings.open > 0) {
    recs.push({
      id: id++,
      priority: 'medium',
      title: `Triage ${findings.open} open finding${findings.open > 1 ? 's' : ''}`,
      impact: `+${Math.min(findings.open, 10)} pts`,
      category: 'Compliance',
    });
  }
  if (findings.by_severity.low > 0) {
    recs.push({
      id: id++,
      priority: 'low',
      title: `Review ${findings.by_severity.low} low-severity finding${findings.by_severity.low > 1 ? 's' : ''}`,
      impact: `+${Math.min(findings.by_severity.low, 5)} pts`,
      category: 'Network',
    });
  }

  return recs;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ScoreRing({ score, size = 180 }: { score: number; size?: number }) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-border)" strokeWidth="8" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-bold text-content-primary">{score}</span>
        <span className="text-xs text-content-secondary uppercase tracking-wider mt-1">out of 100</span>
      </div>
    </div>
  );
}

function CategoryBar({ name, score, color, icon: Icon }: { name: string; score: number; color: string; icon: React.ElementType }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color }} />
          <span className="text-sm text-content-primary">{name}</span>
        </div>
        <span className="text-sm font-semibold text-content-primary">{score}/100</span>
      </div>
      <div className="h-2 w-full rounded-full bg-surface-hover">
        <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SecurityScorecard() {
  const [findingsStats, setFindingsStats] = useState<FindingsStats | null>(null);
  const [deviceStats, setDeviceStats] = useState<DeviceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      api.get<FindingsStats>('/ics/findings/stats'),
      api.get<DeviceStats>('/ics/devices/stats'),
    ])
      .then(([findingsRes, devicesRes]) => {
        if (!cancelled) {
          setFindingsStats(findingsRes.data);
          setDeviceStats(devicesRes.data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.detail || 'Failed to load security scorecard data');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const overallScore = useMemo(() => {
    if (!findingsStats || !deviceStats) return 0;
    return computeOverallScore(findingsStats, deviceStats);
  }, [findingsStats, deviceStats]);

  const categoryScores = useMemo(() => {
    if (!findingsStats) return [];
    return buildCategoryScores(findingsStats);
  }, [findingsStats]);

  const recommendations = useMemo(() => {
    if (!findingsStats) return [];
    return buildRecommendations(findingsStats);
  }, [findingsStats]);

  // Build a simple single-point trend (real trend would need historical data from backend)
  const trendData = useMemo(() => {
    if (!findingsStats) return [];
    // Show current score as the latest data point
    return [{ month: 'Now', score: overallScore }];
  }, [findingsStats, overallScore]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-content-primary">Security Scorecard</h1>
          <p className="text-sm text-content-secondary">Aggregated security posture assessment across all domains</p>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="flex items-center gap-3 text-content-secondary">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <span className="text-sm">Loading security scorecard...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-10 w-10 text-amber-400 mb-3" />
            <p className="text-sm text-content-secondary">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading && !error && findingsStats && findingsStats.total === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ShieldOff className="h-12 w-12 text-content-tertiary mb-4" />
            <h2 className="text-lg font-semibold text-content-primary mb-1">No findings data available</h2>
            <p className="text-sm text-content-secondary text-center max-w-md">
              Upload a PCAP or run a scan to generate findings. The security scorecard will be computed once data is available.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Main content */}
      {!loading && !error && findingsStats && findingsStats.total > 0 && (
        <>
          <div className="grid grid-cols-12 gap-4">
            {/* Score Ring */}
            <div className="col-span-4">
              <Card>
                <CardHeader title="Overall Security Score" />
                <CardContent className="flex flex-col items-center py-6">
                  <ScoreRing score={overallScore} />
                  <div className="mt-4 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm text-emerald-400 font-medium">
                      {findingsStats.resolved} of {findingsStats.total} findings resolved
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-content-secondary text-center">
                    Score reflects vulnerability posture, compliance adherence, network hygiene, and identity controls
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Category Scores */}
            <div className="col-span-4">
              <Card className="h-full">
                <CardHeader title="Category Breakdown" />
                <CardContent className="space-y-5">
                  {categoryScores.map((cat) => (
                    <CategoryBar key={cat.name} {...cat} />
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Trend Chart */}
            <div className="col-span-4">
              <ChartWidget
                type="area"
                title="Score Trend"
                data={trendData}
                dataKeys={[{ key: 'score', color: '#3b82f6', name: 'Security Score' }]}
                xAxisKey="month"
                height={260}
              />
            </div>
          </div>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <Card>
              <CardHeader title="Recommendations to Improve Score" action={<Badge variant="info">{recommendations.length} items</Badge>} />
              <CardContent className="p-0">
                <div className="divide-y divide-border-default">
                  {recommendations.map((rec) => (
                    <div key={rec.id} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-hover/50 transition-colors cursor-pointer">
                      <div className="shrink-0">
                        <Badge variant={rec.priority as 'critical' | 'high' | 'medium' | 'low'} dot>
                          {rec.priority}
                        </Badge>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-content-primary truncate">{rec.title}</p>
                        <span className="text-xs text-content-secondary">{rec.category}</span>
                      </div>
                      <span className="text-sm font-semibold text-emerald-400 shrink-0">{rec.impact}</span>
                      <ChevronRight className="h-4 w-4 text-content-tertiary shrink-0" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
