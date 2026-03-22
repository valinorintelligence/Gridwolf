import {
  Server,
  ShieldAlert,
  Network,
  Cpu,
  Package,
  Scan,
  Route,
  ClipboardCheck,
  Component,
  User,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import type { OntologyObject } from '@/types/ontology';

/* ------------------------------------------------------------------ */
/*  Type → icon / color helpers                                       */
/* ------------------------------------------------------------------ */

const TYPE_ICON_MAP: Record<string, LucideIcon> = {
  Host: Server,
  Vulnerability: ShieldAlert,
  NetworkFlow: Network,
  Protocol: Cpu,
  Product: Package,
  Scanner: Scan,
  AttackPath: Route,
  ComplianceControl: ClipboardCheck,
  Component: Component,
  User: User,
};

const TYPE_COLOR_MAP: Record<string, string> = {
  Host: 'var(--type-host)',
  Vulnerability: 'var(--type-vulnerability)',
  NetworkFlow: 'var(--type-network-flow)',
  Protocol: 'var(--type-protocol)',
  Product: 'var(--type-product)',
  Scanner: 'var(--type-scanner)',
  AttackPath: 'var(--type-attack-path)',
  ComplianceControl: 'var(--type-compliance)',
  Component: 'var(--type-component)',
  User: 'var(--type-user)',
};

export function getTypeIcon(typeName: string): LucideIcon {
  return TYPE_ICON_MAP[typeName] ?? Component;
}

export function getTypeColor(typeName: string): string {
  return TYPE_COLOR_MAP[typeName] ?? 'var(--accent)';
}

/* ------------------------------------------------------------------ */
/*  Severity badge                                                    */
/* ------------------------------------------------------------------ */

const SEVERITY_CLASSES: Record<string, string> = {
  critical: 'bg-severity-critical/20 text-severity-critical',
  high: 'bg-severity-high/20 text-severity-high',
  medium: 'bg-severity-medium/20 text-severity-medium',
  low: 'bg-severity-low/20 text-severity-low',
  info: 'bg-severity-info/20 text-severity-info',
};

/* ------------------------------------------------------------------ */
/*  Status dot                                                        */
/* ------------------------------------------------------------------ */

const STATUS_COLORS: Record<string, string> = {
  active: 'var(--status-active)',
  resolved: 'var(--status-resolved)',
  mitigated: 'var(--status-mitigated)',
  false_positive: 'var(--status-false-positive)',
  risk_accepted: 'var(--status-risk-accepted)',
};

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export interface ObjectCardProps {
  object: OntologyObject;
  onClick?: (object: OntologyObject) => void;
  compact?: boolean;
  className?: string;
}

export function ObjectCard({ object, onClick, compact = false, className }: ObjectCardProps) {
  const Icon = getTypeIcon(object.typeName);
  const typeColor = getTypeColor(object.typeName);

  // Pick 2-3 representative properties to display
  const propertyEntries = Object.entries(object.properties).slice(0, compact ? 2 : 3);

  return (
    <button
      type="button"
      onClick={() => onClick?.(object)}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        'relative flex w-full items-start gap-3 rounded-md border border-border-default',
        'bg-surface-card text-left transition-colors hover:bg-surface-hover',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
        compact ? 'px-3 py-2' : 'px-4 py-3',
        className,
      )}
    >
      {/* Left color bar */}
      <span
        className="absolute left-0 top-0 h-full w-1 rounded-l-md"
        style={{ backgroundColor: typeColor }}
      />

      {/* Icon */}
      <span
        className="mt-0.5 flex shrink-0 items-center justify-center rounded"
        style={{ color: typeColor }}
      >
        <Icon size={compact ? 16 : 18} />
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-content-primary">
            {object.title}
          </span>

          {/* Severity badge */}
          {object.severity && (
            <span
              className={cn(
                'inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase leading-none',
                SEVERITY_CLASSES[object.severity] ?? SEVERITY_CLASSES.info,
              )}
            >
              {object.severity}
            </span>
          )}

          {/* Status dot */}
          <span
            className="ml-auto h-2 w-2 shrink-0 rounded-full"
            title={object.status}
            style={{
              backgroundColor: STATUS_COLORS[object.status] ?? 'var(--content-muted)',
            }}
          />
        </div>

        {/* Key properties */}
        {propertyEntries.length > 0 && (
          <div className={cn('mt-1 flex flex-wrap gap-x-3 gap-y-0.5', compact ? 'text-[11px]' : 'text-xs')}>
            {propertyEntries.map(([key, value]) => (
              <span key={key} className="truncate text-content-secondary">
                <span className="text-content-tertiary">{key}:</span>{' '}
                {String(value ?? '—')}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
