import { useState } from 'react';
import { Shield, TrendingUp, AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import ChartWidget from '@/components/dashboard/ChartWidget';
import StatCard from '@/components/dashboard/StatCard';
import { cn } from '@/lib/cn';

const OVERALL_SCORE = 68;

const CATEGORY_SCORES = [
  { name: 'Vulnerability Management', score: 54, icon: AlertTriangle, color: '#ef4444', maxScore: 100 },
  { name: 'Compliance', score: 72, icon: CheckCircle, color: '#6366f1', maxScore: 100 },
  { name: 'Network Security', score: 78, icon: Shield, color: '#3b82f6', maxScore: 100 },
  { name: 'Identity & Access', score: 65, icon: Shield, color: '#a855f7', maxScore: 100 },
];

const TREND_DATA = [
  { month: 'Jul', score: 52 },
  { month: 'Aug', score: 55 },
  { month: 'Sep', score: 58 },
  { month: 'Oct', score: 61 },
  { month: 'Nov', score: 64 },
  { month: 'Dec', score: 68 },
];

const RECOMMENDATIONS = [
  { id: 1, priority: 'critical', title: 'Patch critical PLC authentication bypass', impact: '+8 pts', category: 'Vulnerability' },
  { id: 2, priority: 'critical', title: 'Remove hardcoded credentials from HMI config', impact: '+6 pts', category: 'Vulnerability' },
  { id: 3, priority: 'high', title: 'Enforce access control per NIST 800-82 AC-3', impact: '+5 pts', category: 'Compliance' },
  { id: 4, priority: 'high', title: 'Fix NERC CIP electronic security perimeter controls', impact: '+4 pts', category: 'Compliance' },
  { id: 5, priority: 'high', title: 'Change default SNMP community strings', impact: '+3 pts', category: 'Network' },
  { id: 6, priority: 'medium', title: 'Upgrade OpenSSL to 3.x on engineering workstation', impact: '+2 pts', category: 'Vulnerability' },
  { id: 7, priority: 'medium', title: 'Disable TLS 1.0/1.1 on SCADA server', impact: '+2 pts', category: 'Network' },
  { id: 8, priority: 'low', title: 'Implement Content-Security-Policy headers', impact: '+1 pt', category: 'Network' },
];

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

export default function SecurityScorecard() {
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

      <div className="grid grid-cols-12 gap-4">
        {/* Score Ring */}
        <div className="col-span-4">
          <Card>
            <CardHeader title="Overall Security Score" />
            <CardContent className="flex flex-col items-center py-6">
              <ScoreRing score={OVERALL_SCORE} />
              <div className="mt-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <span className="text-sm text-emerald-400 font-medium">+4 pts from last month</span>
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
              {CATEGORY_SCORES.map((cat) => (
                <CategoryBar key={cat.name} {...cat} />
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Trend Chart */}
        <div className="col-span-4">
          <ChartWidget
            type="area"
            title="Score Trend (6 Months)"
            data={TREND_DATA}
            dataKeys={[{ key: 'score', color: '#3b82f6', name: 'Security Score' }]}
            xAxisKey="month"
            height={260}
          />
        </div>
      </div>

      {/* Recommendations */}
      <Card>
        <CardHeader title="Recommendations to Improve Score" action={<Badge variant="info">{RECOMMENDATIONS.length} items</Badge>} />
        <CardContent className="p-0">
          <div className="divide-y divide-border-default">
            {RECOMMENDATIONS.map((rec) => (
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
    </div>
  );
}
