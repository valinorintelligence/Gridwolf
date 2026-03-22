import React from 'react';
import { cn } from '@/lib/cn';

interface BadgeProps {
  variant?: 'default' | 'critical' | 'high' | 'medium' | 'low' | 'info' | 'outline';
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

function Badge({ variant = 'default', dot = false, children, className }: BadgeProps) {
  const variantStyles: Record<string, string> = {
    default: 'bg-accent-muted text-accent border-accent/30',
    critical: 'bg-red-950/60 text-red-400 border-red-500/30',
    high: 'bg-orange-950/60 text-orange-400 border-orange-500/30',
    medium: 'bg-amber-950/60 text-amber-400 border-amber-500/30',
    low: 'bg-blue-950/60 text-blue-400 border-blue-500/30',
    info: 'bg-surface-hover text-content-secondary border-border-default',
    outline: 'bg-transparent text-content-secondary border-border-default',
  };

  const dotColors: Record<string, string> = {
    default: 'bg-accent',
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-amber-500',
    low: 'bg-blue-500',
    info: 'bg-content-tertiary',
    outline: 'bg-content-tertiary',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border leading-tight',
        variantStyles[variant],
        className
      )}
    >
      {dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColors[variant])} />
      )}
      {children}
    </span>
  );
}

Badge.displayName = 'Badge';

export { Badge, type BadgeProps };
