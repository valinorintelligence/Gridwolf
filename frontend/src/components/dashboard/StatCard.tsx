import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/cn';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: { value: number; direction: 'up' | 'down' };
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  className?: string;
}

const severityStyles: Record<string, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-amber-400',
  low: 'border-l-blue-500',
  info: 'border-l-gray-400',
};

const severityIconBg: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400',
  high: 'bg-orange-500/15 text-orange-400',
  medium: 'bg-amber-400/15 text-amber-400',
  low: 'bg-blue-500/15 text-blue-400',
  info: 'bg-gray-500/15 text-gray-400',
};

export default function StatCard({
  icon,
  label,
  value,
  trend,
  severity,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 border-l-4 transition-colors',
        severity ? severityStyles[severity] : 'border-l-[var(--color-accent)]',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg',
            severity ? severityIconBg[severity] : 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
          )}
        >
          {icon}
        </div>

        {trend && (
          <div
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
              trend.direction === 'up'
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-red-500/15 text-red-400'
            )}
          >
            {trend.direction === 'up' ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {trend.value}%
          </div>
        )}
      </div>

      <div className="mt-3">
        <p className="text-sm text-[var(--color-text-secondary)]">{label}</p>
        <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
      </div>

      {/* Sparkline placeholder */}
      <div className="mt-3 h-6 w-full rounded bg-[var(--color-bg)]/50" />
    </div>
  );
}
