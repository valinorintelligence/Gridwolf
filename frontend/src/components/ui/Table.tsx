import React from 'react';
import { cn } from '@/lib/cn';

function Table({ className, children, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-auto">
      <table
        className={cn('w-full text-sm border-collapse', className)}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

function TableHeader({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn('border-b border-border-default', className)}
      {...props}
    >
      {children}
    </thead>
  );
}

function TableBody({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn('[&>tr:last-child]:border-0', className)} {...props}>
      {children}
    </tbody>
  );
}

function TableRow({ className, children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'border-b border-border-default transition-colors hover:bg-surface-hover/50',
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  sorted?: 'asc' | 'desc' | false;
  onSort?: () => void;
}

function TableHead({
  sortable = false,
  sorted = false,
  onSort,
  className,
  children,
  ...props
}: TableHeadProps) {
  return (
    <th
      className={cn(
        'px-3 py-2 text-left text-xs font-semibold text-content-secondary uppercase tracking-wider',
        sortable && 'cursor-pointer select-none hover:text-content-primary',
        className
      )}
      onClick={sortable ? onSort : undefined}
      {...props}
    >
      <div className="inline-flex items-center gap-1">
        {children}
        {sortable && (
          <span className="inline-flex flex-col text-[8px] leading-none">
            <span className={cn(sorted === 'asc' ? 'text-accent' : 'text-content-muted')}>
              ▲
            </span>
            <span className={cn(sorted === 'desc' ? 'text-accent' : 'text-content-muted')}>
              ▼
            </span>
          </span>
        )}
      </div>
    </th>
  );
}

function TableCell({ className, children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn('px-3 py-2 text-sm text-content-primary', className)}
      {...props}
    >
      {children}
    </td>
  );
}

Table.displayName = 'Table';
TableHeader.displayName = 'TableHeader';
TableBody.displayName = 'TableBody';
TableRow.displayName = 'TableRow';
TableHead.displayName = 'TableHead';
TableCell.displayName = 'TableCell';

export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  type TableHeadProps,
};
