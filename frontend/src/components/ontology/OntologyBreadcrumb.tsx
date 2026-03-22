import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/cn';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface OntologyBreadcrumbProps {
  typeName?: string;
  typeId?: string;
  objectTitle?: string;
  objectId?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function OntologyBreadcrumb({
  typeName,
  typeId,
  objectTitle,
  objectId,
}: OntologyBreadcrumbProps) {
  const crumbs: { label: React.ReactNode; to?: string }[] = [
    { label: <Home size={13} />, to: '/' },
  ];

  if (typeName) {
    crumbs.push({
      label: typeName,
      to: typeId ? `/ontology/types/${typeId}` : undefined,
    });
  }

  if (objectTitle) {
    crumbs.push({
      label: objectTitle,
      to: objectId ? `/ontology/objects/${objectId}` : undefined,
    });
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;

        return (
          <span key={i} className="inline-flex items-center gap-1">
            {i > 0 && <ChevronRight size={12} className="text-content-muted" />}

            {crumb.to && !isLast ? (
              <Link
                to={crumb.to}
                className={cn(
                  'inline-flex items-center rounded px-1 py-0.5 text-content-secondary',
                  'transition-colors hover:bg-surface-hover hover:text-content-primary',
                )}
              >
                {crumb.label}
              </Link>
            ) : (
              <span
                className={cn(
                  'inline-flex items-center px-1 py-0.5',
                  isLast ? 'font-medium text-content-primary' : 'text-content-secondary',
                )}
              >
                {crumb.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
