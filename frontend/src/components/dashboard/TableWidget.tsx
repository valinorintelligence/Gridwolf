import { cn } from '@/lib/cn';

interface TableColumn {
  key: string;
  label: string;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

interface TableWidgetProps {
  title?: string;
  columns: TableColumn[];
  data: Record<string, unknown>[];
  maxRows?: number;
  onViewAll?: () => void;
  className?: string;
}

export default function TableWidget({
  title,
  columns,
  data,
  maxRows = 5,
  onViewAll,
  className,
}: TableWidgetProps) {
  const visibleData = data.slice(0, maxRows);
  const hasMore = data.length > maxRows;

  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4',
        className
      )}
    >
      {(title || (hasMore && onViewAll)) && (
        <div className="mb-3 flex items-center justify-between">
          {title && (
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {title}
            </h3>
          )}
          {hasMore && onViewAll && (
            <button
              onClick={onViewAll}
              className="text-xs font-medium text-[var(--color-accent)] hover:underline"
            >
              View all ({data.length})
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleData.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="border-b border-[var(--color-border)]/50 transition-colors hover:bg-[var(--color-bg)]/50 last:border-0"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="whitespace-nowrap px-3 py-2 text-[var(--color-text-primary)]"
                  >
                    {col.render
                      ? col.render(row[col.key], row)
                      : String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
            {visibleData.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-6 text-center text-[var(--color-text-secondary)]"
                >
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
