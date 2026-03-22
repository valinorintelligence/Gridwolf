import { useState } from 'react';
import { Calendar, Clock, Link2, Play, List } from 'lucide-react';
import { cn } from '@/lib/cn';
import type {
  OntologyObject,
  ObjectTypeDefinition,
  ObjectLink,
} from '@/types/ontology';
import { getTypeIcon, getTypeColor } from './ObjectCard';
import { ObjectCard } from './ObjectCard';

/* ------------------------------------------------------------------ */
/*  Severity / status helpers                                         */
/* ------------------------------------------------------------------ */

const SEVERITY_CLASSES: Record<string, string> = {
  critical: 'bg-severity-critical/20 text-severity-critical',
  high: 'bg-severity-high/20 text-severity-high',
  medium: 'bg-severity-medium/20 text-severity-medium',
  low: 'bg-severity-low/20 text-severity-low',
  info: 'bg-severity-info/20 text-severity-info',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'var(--status-active)',
  resolved: 'var(--status-resolved)',
  mitigated: 'var(--status-mitigated)',
  false_positive: 'var(--status-false-positive)',
  risk_accepted: 'var(--status-risk-accepted)',
};

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface ObjectDetailProps {
  object: OntologyObject;
  typeDefinition?: ObjectTypeDefinition;
  links?: ObjectLink[];
  linkedObjects?: OntologyObject[];
  onAction?: (action: string) => void;
}

type TabId = 'properties' | 'links' | 'timeline' | 'actions';

const TABS: { id: TabId; label: string }[] = [
  { id: 'properties', label: 'Properties' },
  { id: 'links', label: 'Links' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'actions', label: 'Actions' },
];

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function ObjectDetail({
  object,
  typeDefinition,
  links = [],
  linkedObjects = [],
  onAction,
}: ObjectDetailProps) {
  const [activeTab, setActiveTab] = useState<TabId>('properties');

  const Icon = getTypeIcon(object.typeName);
  const typeColor = getTypeColor(object.typeName);

  /* Group linked objects by typeName */
  const groupedLinked = linkedObjects.reduce<Record<string, OntologyObject[]>>((acc, lo) => {
    (acc[lo.typeName] ??= []).push(lo);
    return acc;
  }, {});

  /* Derive labels from type definition */
  const labelMap = new Map(
    typeDefinition?.propertiesSchema.map((p) => [p.key, p.label]),
  );

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-md border border-border-default bg-surface-card">
      {/* ---- Header ---- */}
      <div className="flex items-start gap-3 border-b border-border-default px-5 py-4">
        <span
          className="mt-1 flex shrink-0 items-center justify-center rounded"
          style={{ color: typeColor }}
        >
          <Icon size={22} />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-content-primary">
            {object.title}
          </h2>
          <span className="text-xs text-content-tertiary">{object.typeName}</span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {object.severity && (
            <span
              className={cn(
                'inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium uppercase leading-none',
                SEVERITY_CLASSES[object.severity] ?? SEVERITY_CLASSES.info,
              )}
            >
              {object.severity}
            </span>
          )}

          <span className="inline-flex items-center gap-1.5 text-xs text-content-secondary">
            <span
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: STATUS_COLORS[object.status] ?? 'var(--content-muted)',
              }}
            />
            {object.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Dates */}
      <div className="flex gap-4 border-b border-border-default px-5 py-2 text-[11px] text-content-tertiary">
        <span className="inline-flex items-center gap-1">
          <Calendar size={11} /> Created {new Date(object.createdAt).toLocaleDateString()}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock size={11} /> Updated {new Date(object.updatedAt).toLocaleDateString()}
        </span>
      </div>

      {/* ---- Tab bar ---- */}
      <div className="flex border-b border-border-default">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-xs font-medium transition-colors',
              activeTab === tab.id
                ? 'border-b-2 border-accent text-accent'
                : 'text-content-tertiary hover:text-content-secondary',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ---- Tab content ---- */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === 'properties' && (
          <div className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-sm">
            {Object.entries(object.properties).map(([key, value]) => (
              <div key={key} className="contents">
                <span className="truncate text-content-tertiary">
                  {labelMap.get(key) ?? key}
                </span>
                <span className="break-words text-content-primary">
                  {value != null ? String(value) : <span className="text-content-muted">--</span>}
                </span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'links' && (
          <div className="space-y-4">
            {Object.keys(groupedLinked).length === 0 && links.length === 0 ? (
              <p className="text-sm text-content-tertiary">No linked objects.</p>
            ) : (
              Object.entries(groupedLinked).map(([typeName, objs]) => (
                <div key={typeName}>
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-content-tertiary">
                    <Link2 size={12} /> {typeName} ({objs.length})
                  </h3>
                  <div className="space-y-1.5">
                    {objs.map((lo) => (
                      <ObjectCard key={lo.id} object={lo} compact />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="space-y-3">
            {/* Placeholder audit events */}
            {[
              { time: object.updatedAt, event: 'Object updated' },
              { time: object.createdAt, event: 'Object created' },
            ].map((entry, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                <div>
                  <p className="text-content-primary">{entry.event}</p>
                  <p className="text-xs text-content-tertiary">
                    {new Date(entry.time).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="space-y-2">
            {[
              { id: 'scan', label: 'Re-scan', icon: Play },
              { id: 'export', label: 'Export details', icon: List },
            ].map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => onAction?.(action.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md border border-border-default px-4 py-2.5 text-sm',
                  'text-content-primary transition-colors hover:bg-surface-hover',
                )}
              >
                <action.icon size={14} className="text-content-tertiary" />
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
