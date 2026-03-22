import { cn } from '@/lib/cn';

interface WidgetGridProps {
  children: React.ReactNode;
  cols?: number;
  gap?: number;
  className?: string;
}

interface WidgetWrapperProps {
  colSpan?: number;
  rowSpan?: number;
  children: React.ReactNode;
  className?: string;
}

export function WidgetGrid({
  children,
  cols = 12,
  gap = 4,
  className,
}: WidgetGridProps) {
  return (
    <div
      className={cn('grid', className)}
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gap: `${gap * 0.25}rem`,
      }}
    >
      {children}
    </div>
  );
}

export function WidgetWrapper({
  colSpan = 6,
  rowSpan = 1,
  children,
  className,
}: WidgetWrapperProps) {
  return (
    <div
      className={cn(className)}
      style={{
        gridColumn: `span ${colSpan} / span ${colSpan}`,
        gridRow: `span ${rowSpan} / span ${rowSpan}`,
      }}
    >
      {children}
    </div>
  );
}
