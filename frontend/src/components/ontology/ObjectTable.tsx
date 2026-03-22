import { useState, useMemo, useCallback } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { OntologyObject, ObjectTypeDefinition } from '@/types/ontology';
import { getTypeIcon, getTypeColor } from './ObjectCard';

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

export interface ObjectTableProps {
  objects: OntologyObject[];
  typeDefinition?: ObjectTypeDefinition;
  onObjectClick?: (object: OntologyObject) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

type SortDir = 'asc' | 'desc';

interface ColumnDef {
  key: string;
  label: string;
  sortable: boolean;
  render?: (value: unknown, obj: OntologyObject) => React.ReactNode;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function ObjectTable({
  objects,
  typeDefinition,
  onObjectClick,
  selectable = false,
  selectedIds,
  onSelectionChange,
}: ObjectTableProps) {
  const [sortKey, setSortKey] = useState<string>('title');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  /* Build columns from type definition or fall back to object keys */
  const columns = useMemo<ColumnDef[]>(() => {
    const cols: ColumnDef[] = [
      { key: 'title', label: 'Name', sortable: true },
    ];

    if (typeDefinition) {
      typeDefinition.propertiesSchema.forEach((prop) => {
        cols.push({ key: `prop.${prop.key}`, label: prop.label, sortable: true });
      });
    } else if (objects.length > 0) {
      const sample = objects[0];
      Object.keys(sample.properties)
        .slice(0, 5)
        .forEach((k) => {
          cols.push({ key: `prop.${k}`, label: k, sortable: true });
        });
    }

    cols.push({
      key: 'severity',
      label: 'Severity',
      sortable: true,
      render: (v) => {
        const sev = v as string | undefined;
        if (!sev) return <span className="text-content-muted">--</span>;
        return (
          <span
            className={cn(
              'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase leading-none',
              SEVERITY_CLASSES[sev] ?? SEVERITY_CLASSES.info,
            )}
          >
            {sev}
          </span>
        );
      },
    });

    cols.push({
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (v) => {
        const st = v as string;
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-content-secondary">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[st] ?? 'var(--content-muted)' }}
            />
            {st.replace(/_/g, ' ')}
          </span>
        );
      },
    });

    return cols;
  }, [typeDefinition, objects]);

  /* Resolve cell value */
  const getCellValue = useCallback((obj: OntologyObject, key: string): unknown => {
    if (key.startsWith('prop.')) return obj.properties[key.slice(5)];
    return (obj as Record<string, unknown>)[key];
  }, []);

  /* Sort */
  const sorted = useMemo(() => {
    const copy = [...objects];
    copy.sort((a, b) => {
      const av = getCellValue(a, sortKey);
      const bv = getCellValue(b, sortKey);
      const as = av == null ? '' : String(av);
      const bs = bv == null ? '' : String(bv);
      const cmp = as.localeCompare(bs, undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [objects, sortKey, sortDir, getCellValue]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  /* Selection */
  const allSelected = objects.length > 0 && selectedIds?.size === objects.length;

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(objects.map((o) => o.id)));
    }
  };

  const toggleOne = (id: string) => {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  /* Empty state */
  if (objects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-border-default bg-surface-card px-6 py-12 text-center">
        <span className="text-sm text-content-tertiary">No objects found</span>
        <span className="text-xs text-content-muted">Try adjusting your filters or creating a new object.</span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border-default">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border-default bg-bg-tertiary">
            {selectable && (
              <th className="w-10 px-3 py-2 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="accent-accent"
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-content-tertiary',
                  col.sortable && 'cursor-pointer select-none hover:text-content-secondary',
                )}
                onClick={col.sortable ? () => toggleSort(col.key) : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortable &&
                    (sortKey === col.key ? (
                      sortDir === 'asc' ? (
                        <ArrowUp size={12} />
                      ) : (
                        <ArrowDown size={12} />
                      )
                    ) : (
                      <ArrowUpDown size={12} className="opacity-30" />
                    ))}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((obj) => {
            const Icon = getTypeIcon(obj.typeName);
            const color = getTypeColor(obj.typeName);
            const isSelected = selectedIds?.has(obj.id);

            return (
              <tr
                key={obj.id}
                onClick={() => onObjectClick?.(obj)}
                className={cn(
                  'border-b border-border-default transition-colors',
                  'cursor-pointer hover:bg-surface-hover',
                  isSelected && 'bg-accent-muted/30',
                )}
              >
                {selectable && (
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={isSelected ?? false}
                      onChange={() => toggleOne(obj.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="accent-accent"
                    />
                  </td>
                )}
                {columns.map((col) => {
                  const value = getCellValue(obj, col.key);

                  /* Title column gets icon */
                  if (col.key === 'title') {
                    return (
                      <td key={col.key} className="whitespace-nowrap px-3 py-2">
                        <span className="inline-flex items-center gap-2">
                          <Icon size={14} style={{ color }} />
                          <span className="font-medium text-content-primary">{obj.title}</span>
                        </span>
                      </td>
                    );
                  }

                  if (col.render) {
                    return (
                      <td key={col.key} className="whitespace-nowrap px-3 py-2">
                        {col.render(value, obj)}
                      </td>
                    );
                  }

                  return (
                    <td key={col.key} className="max-w-[200px] truncate whitespace-nowrap px-3 py-2 text-content-secondary">
                      {value != null ? String(value) : <span className="text-content-muted">--</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
