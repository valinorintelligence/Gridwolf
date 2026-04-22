import React from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  prefixIcon?: React.ReactNode;
  suffixIcon?: React.ReactNode;
  inputSize?: 'sm' | 'md';
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      prefixIcon,
      suffixIcon,
      inputSize = 'md',
      className,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    const sizeStyles: Record<string, string> = {
      sm: 'px-2.5 py-1 text-xs',
      md: 'px-3 py-1.5 text-sm',
    };

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-content-secondary mb-1"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {prefixIcon && (
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-tertiary pointer-events-none flex items-center">
              {prefixIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded border bg-bg-secondary text-content-primary placeholder:text-content-muted',
              'border-border-default hover:border-border-hover',
              'focus:outline-none focus:border-border-active focus:ring-1 focus:ring-accent/30',
              '[&:valid:not(:placeholder-shown)]:border-accent-cyan/30',
              'transition-colors duration-150',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error && 'border-severity-critical focus:border-severity-critical focus:ring-red-500/30',
              sizeStyles[inputSize],
              prefixIcon && 'pl-8',
              suffixIcon && 'pr-8',
              className
            )}
            {...props}
          />
          {suffixIcon && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-tertiary pointer-events-none flex items-center">
              {suffixIcon}
            </span>
          )}
        </div>
        {error && (
          <p className="mt-1 text-xs text-severity-critical">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input, type InputProps };
