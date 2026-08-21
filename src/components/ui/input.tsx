import * as React from 'react';

import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Renders the error state and wires `aria-invalid` for assistive tech. */
  invalid?: boolean;
  /** Icon rendered inside the field, before the text. */
  startIcon?: React.ReactNode;
  /** Icon or control rendered inside the field, after the text. */
  endIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, invalid, startIcon, endIcon, ...props }, ref) => {
    const field = (
      <input
        type={type}
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'flex h-11 w-full rounded-lg border bg-background px-3.5 py-2 text-sm',
          'shadow-subtle transition-colors duration-150',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-60',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          invalid ? 'border-destructive focus-visible:ring-destructive' : 'border-input',
          startIcon && 'pl-10',
          endIcon && 'pr-10',
          className,
        )}
        {...props}
      />
    );

    if (!startIcon && !endIcon) return field;

    return (
      <div className="relative">
        {startIcon && (
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-4"
            aria-hidden="true"
          >
            {startIcon}
          </span>
        )}
        {field}
        {endIcon && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-4">
            {endIcon}
          </span>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <textarea
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(
      'flex min-h-[96px] w-full rounded-lg border bg-background px-3.5 py-2.5 text-sm',
      'shadow-subtle transition-colors duration-150',
      'placeholder:text-muted-foreground',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
      'disabled:cursor-not-allowed disabled:opacity-60',
      invalid ? 'border-destructive focus-visible:ring-destructive' : 'border-input',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export { Input, Textarea };
