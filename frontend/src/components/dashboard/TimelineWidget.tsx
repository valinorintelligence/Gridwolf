import { cn } from '@/lib/cn';

interface TimelineEvent {
  id: string;
  timestamp: string;
  action: string;
  objectType?: string;
  objectTitle?: string;
  severity?: string;
}

interface TimelineWidgetProps {
  events: TimelineEvent[];
  maxEvents?: number;
  className?: string;
}

const severityDotColors: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-400',
  low: 'bg-blue-500',
  info: 'bg-gray-400',
};

const objectTypeBadgeColors: Record<string, string> = {
  vulnerability: 'bg-red-500/15 text-red-400',
  asset: 'bg-blue-500/15 text-blue-400',
  threat: 'bg-purple-500/15 text-purple-400',
  network: 'bg-cyan-500/15 text-cyan-400',
  compliance: 'bg-green-500/15 text-green-400',
  identity: 'bg-yellow-500/15 text-yellow-400',
  application: 'bg-indigo-500/15 text-indigo-400',
  alert: 'bg-orange-500/15 text-orange-400',
};

function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

export default function TimelineWidget({
  events,
  maxEvents = 10,
  className,
}: TimelineWidgetProps) {
  const visible = events.slice(0, maxEvents);

  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4',
        className
      )}
    >
      <h3 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
        Recent Activity
      </h3>

      {visible.length === 0 && (
        <p className="py-6 text-center text-sm text-[var(--color-text-secondary)]">
          No events to display
        </p>
      )}

      <div className="relative space-y-0">
        {visible.map((event, idx) => (
          <div key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
            {/* Vertical line */}
            {idx < visible.length - 1 && (
              <div className="absolute left-[7px] top-4 h-full w-px bg-[var(--color-border)]" />
            )}

            {/* Dot */}
            <div
              className={cn(
                'relative z-10 mt-1 h-[15px] w-[15px] flex-shrink-0 rounded-full border-2 border-[var(--color-surface)]',
                event.severity
                  ? severityDotColors[event.severity] ?? 'bg-gray-400'
                  : 'bg-[var(--color-accent)]'
              )}
            />

            {/* Content */}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[var(--color-text-primary)]">
                {event.action}
                {event.objectTitle && (
                  <span className="ml-1 font-medium">{event.objectTitle}</span>
                )}
              </p>

              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {formatTimestamp(event.timestamp)}
                </span>

                {event.objectType && (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                      objectTypeBadgeColors[event.objectType] ??
                        'bg-gray-500/15 text-gray-400'
                    )}
                  >
                    {event.objectType}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
