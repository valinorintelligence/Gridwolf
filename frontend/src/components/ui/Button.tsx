import React from 'react';
import { cn } from '@/lib/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const variantStyles: Record<string, string> = {
      primary:
        'bg-accent text-white hover:bg-accent-hover active:bg-accent-hover shadow-sm',
      secondary:
        'bg-surface-card text-content-primary border border-border-default hover:bg-surface-hover active:bg-surface-active',
      ghost:
        'bg-transparent text-content-secondary hover:bg-surface-hover hover:text-content-primary active:bg-surface-active',
      danger:
        'bg-severity-critical text-white hover:bg-red-700 active:bg-red-800 shadow-sm',
      outline:
        'bg-transparent text-content-primary border border-border-default hover:border-border-hover hover:bg-surface-hover active:bg-surface-active',
    };

    const sizeStyles: Record<string, string> = {
      sm: 'px-2.5 py-1 text-xs gap-1.5',
      md: 'px-3 py-1.5 text-sm gap-2',
      lg: 'px-4 py-2 text-sm gap-2',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded transition-colors duration-150 cursor-pointer select-none',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <svg
            className="animate-spin h-4 w-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : icon ? (
          <span className="shrink-0 flex items-center">{icon}</span>
        ) : null}
        {children && <span>{children}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button, type ButtonProps };
