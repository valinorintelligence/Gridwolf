import { useMemo } from 'react';
import { Link2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ObjectLink, OntologyObject } from '@/types/ontology';
import { getTypeColor } from './ObjectCard';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface LinkBadgeProps {
  links: ObjectLink[];
  linkedObjects?: OntologyObject[];
  onClick?: (typeName: string) => void;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function LinkBadge({ links, linkedObjects = [], onClick, className }: LinkBadgeProps) {
  /* Group linked objects by type and count */
  const groups = useMemo(() => {
    if (linkedObjects.length > 0) {
      const counts: Record<string, number> = {};
      linkedObjects.forEach((o) => {
        counts[o.typeName] = (counts[o.typeName] ?? 0) + 1;
      });
      return Object.entries(counts);
    }

    /* Fallback: count links by linkType */
    const counts: Record<string, number> = {};
    links.forEach((l) => {
      counts[l.linkType] = (counts[l.linkType] ?? 0) + 1;
    });
    return Object.entries(counts);
  }, [links, linkedObjects]);

  if (groups.length === 0) {
    return null;
  }

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs text-content-secondary', className)}>
      <Link2 size={12} className="shrink-0 text-content-tertiary" />
      {groups.map(([typeName, count], i) => (
        <span key={typeName} className="inline-flex items-center">
          {i > 0 && <span className="mx-1 text-content-muted">&middot;</span>}
          <button
            type="button"
            onClick={() => onClick?.(typeName)}
            className="inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-surface-hover hover:text-content-primary"
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: getTypeColor(typeName) }}
            />
            <span className="font-medium">{count}</span>
            <span>{typeName}{count !== 1 ? 's' : ''}</span>
          </button>
        </span>
      ))}
    </span>
  );
}
