import React from 'react';
import { cn } from '@/lib/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  accentColor?: string;
}

function Card({ accentColor, className, style, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface-card border border-border-default rounded-lg overflow-hidden',
        accentColor && 'border-l-2',
        className
      )}
      style={{
        ...style,
        ...(accentColor ? { borderLeftColor: accentColor } : {}),
      }}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  action?: React.ReactNode;
}

function CardHeader({ title, action, className, children, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3 border-b border-border-default',
        className
      )}
      {...props}
    >
      {title ? (
        <>
          <h3 className="text-sm font-semibold text-content-primary truncate">{title}</h3>
          {action && <div className="shrink-0 ml-2">{action}</div>}
        </>
      ) : (
        children
      )}
    </div>
  );
}

function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-4 py-3', className)} {...props}>
      {children}
    </div>
  );
}

function CardFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'px-4 py-2.5 border-t border-border-default bg-surface-hover/30',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

Card.displayName = 'Card';
CardHeader.displayName = 'CardHeader';
CardContent.displayName = 'CardContent';
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardContent, CardFooter, type CardProps, type CardHeaderProps };
