import { cn } from '@/lib/cn';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { dot: string; text: string; bg: string }> = {
  active: {
    dot: 'bg-emerald-400',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
  },
  resolved: {
    dot: 'bg-blue-400',
    text: 'text-blue-400',
    bg: 'bg-blue-500/15',
  },
  mitigated: {
    dot: 'bg-amber-400',
    text: 'text-amber-400',
    bg: 'bg-amber-500/15',
  },
  false_positive: {
    dot: 'bg-gray-400',
    text: 'text-gray-400',
    bg: 'bg-gray-500/15',
  },
  risk_accepted: {
    dot: 'bg-purple-400',
    text: 'text-purple-400',
    bg: 'bg-purple-500/15',
  },
};

function formatLabel(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    dot: 'bg-gray-400',
    text: 'text-gray-400',
    bg: 'bg-gray-500/15',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.bg,
        config.text,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      {formatLabel(status)}
    </span>
  );
}
