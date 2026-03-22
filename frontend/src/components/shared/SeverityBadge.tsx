import { cn } from '@/lib/cn';

interface SeverityBadgeProps {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  count?: number;
  className?: string;
}

const severityStyles: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium: 'bg-amber-400/15 text-amber-400 border-amber-400/30',
  low: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  info: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

export default function SeverityBadge({
  severity,
  count,
  className,
}: SeverityBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
        severityStyles[severity] ?? severityStyles.info,
        className
      )}
    >
      {severity}
      {count !== undefined && (
        <span className="ml-0.5 rounded-full bg-white/10 px-1.5 py-px text-[10px]">
          {count}
        </span>
      )}
    </span>
  );
}
