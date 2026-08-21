import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, Inbox, RefreshCw, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

import { Button } from './button';

/**
 * Empty and error states.
 *
 * Every list surface in the product uses these rather than rendering nothing.
 * An empty state that only says "No data" wastes the one moment the student is
 * actually looking for direction, so `description` is required and each usage
 * is expected to suggest the next action.
 */

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  /** Tell the user what to do next, not just that the list is empty. */
  description: string;
  action?: { label: string; href?: string; onClick?: () => void };
  secondaryAction?: { label: string; href?: string; onClick?: () => void };
  className?: string;
  /** `sm` fits inside a card; `default` is for a full page region. */
  size?: 'sm' | 'default';
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  className,
  size = 'default',
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-center',
        size === 'sm' ? 'px-6 py-10' : 'px-6 py-16',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-muted text-muted-foreground',
          size === 'sm' ? 'size-11' : 'size-14',
        )}
      >
        <Icon className={size === 'sm' ? 'size-5' : 'size-6'} aria-hidden="true" />
      </div>

      <h3 className={cn('mt-4 font-semibold tracking-tight', size === 'sm' ? 'text-sm' : 'text-base')}>
        {title}
      </h3>
      <p className="mt-1.5 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>

      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {action &&
            (action.href ? (
              <Button asChild size={size === 'sm' ? 'sm' : 'default'}>
                <Link href={action.href}>{action.label}</Link>
              </Button>
            ) : (
              <Button size={size === 'sm' ? 'sm' : 'default'} onClick={action.onClick}>
                {action.label}
              </Button>
            ))}

          {secondaryAction &&
            (secondaryAction.href ? (
              <Button asChild variant="outline" size={size === 'sm' ? 'sm' : 'default'}>
                <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                size={size === 'sm' ? 'sm' : 'default'}
                onClick={secondaryAction.onClick}
              >
                {secondaryAction.label}
              </Button>
            ))}
        </div>
      )}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  description?: string;
  /** Shown in development only; never expose internals to students. */
  detail?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this right now. Please try again in a moment.',
  detail,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 px-6 py-14 text-center',
        className,
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" aria-hidden="true" />
      </div>

      <h3 className="mt-4 text-base font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>

      {detail && process.env.NODE_ENV !== 'production' && (
        <pre className="mt-4 max-w-full overflow-x-auto rounded-lg bg-muted px-3 py-2 text-left font-mono text-xs text-muted-foreground">
          {detail}
        </pre>
      )}

      {onRetry && (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          <RefreshCw aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  );
}

/** Inline variant for a failed section inside an otherwise working page. */
export function InlineError({ message, className }: { message: string; className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-3 text-sm text-destructive',
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span className="leading-relaxed">{message}</span>
    </div>
  );
}
