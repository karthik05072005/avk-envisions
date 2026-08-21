import * as React from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Headline metric tile used across the student dashboard and admin overview.
 *
 * `trend` describes movement versus the previous period. Direction is conveyed
 * by an arrow icon and a text label as well as colour, so the meaning survives
 * for colour-blind users and in grayscale print.
 */
export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  /** Small qualifier under the value, e.g. "across 12 tests". */
  hint?: string;
  icon?: LucideIcon;
  trend?: {
    /** Signed percentage-point or percentage change. */
    value: number;
    label?: string;
    /**
     * Set false where a rise is bad (e.g. average time per question), which
     * flips the colour without flipping the arrow.
     */
    increaseIsGood?: boolean;
  };
  className?: string;
}

export function StatCard({ label, value, hint, icon: Icon, trend, className }: StatCardProps) {
  const direction = !trend || trend.value === 0 ? 'flat' : trend.value > 0 ? 'up' : 'down';
  const increaseIsGood = trend?.increaseIsGood ?? true;
  const isPositive = direction === 'flat' ? null : (direction === 'up') === increaseIsGood;

  const TrendIcon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : ArrowRight;

  return (
    <div
      className={cn(
        'group rounded-xl border border-border bg-card p-5 shadow-card transition-all duration-200 hover:shadow-elevated',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon && (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary">
            <Icon className="size-4" aria-hidden="true" />
          </span>
        )}
      </div>

      <p className="mt-2.5 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        {trend && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums',
              isPositive === null
                ? 'text-muted-foreground'
                : isPositive
                  ? 'text-success'
                  : 'text-destructive',
            )}
          >
            <TrendIcon className="size-3.5" aria-hidden="true" />
            {trend.value > 0 ? '+' : ''}
            {trend.value}%
            <span className="sr-only">
              {direction === 'flat' ? 'no change' : direction === 'up' ? 'increase' : 'decrease'}
            </span>
          </span>
        )}
        {(trend?.label || hint) && (
          <span className="text-xs text-muted-foreground">{trend?.label ?? hint}</span>
        )}
      </div>
    </div>
  );
}

/** Compact inline metric for dense panels where a full card is too heavy. */
export function MiniStat({
  label,
  value,
  tone = 'default',
  className,
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'success' | 'danger' | 'muted';
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg bg-muted/50 px-3 py-2.5', className)}>
      <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'mt-0.5 text-lg font-semibold tabular-nums',
          tone === 'success' && 'text-success',
          tone === 'danger' && 'text-destructive',
          tone === 'muted' && 'text-muted-foreground',
        )}
      >
        {value}
      </p>
    </div>
  );
}
