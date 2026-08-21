'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';

import { cn, clamp } from '@/lib/utils';

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    /** Colours the fill. Defaults to brand primary. */
    tone?: 'primary' | 'success' | 'warning' | 'danger';
    /** Height of the track. */
    size?: 'sm' | 'default' | 'lg';
  }
>(({ className, value, tone = 'primary', size = 'default', ...props }, ref) => {
  const pct = clamp(value ?? 0, 0, 100);

  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={pct}
      className={cn(
        'relative w-full overflow-hidden rounded-full bg-muted',
        size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2',
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          'h-full w-full flex-1 rounded-full transition-transform duration-500 ease-out-expo',
          tone === 'primary' && 'bg-primary',
          tone === 'success' && 'bg-success',
          tone === 'warning' && 'bg-warning',
          tone === 'danger' && 'bg-destructive',
        )}
        style={{ transform: `translateX(-${100 - pct}%)` }}
      />
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

/**
 * Circular progress used for accuracy and mastery dials.
 * Rendered as inline SVG so it inherits the current theme's colours.
 */
export interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
  label?: React.ReactNode;
}

function ProgressRing({
  value,
  size = 96,
  strokeWidth = 8,
  tone = 'primary',
  className,
  label,
}: ProgressRingProps) {
  const pct = clamp(value, 0, 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  const strokeClass =
    tone === 'success'
      ? 'stroke-success'
      : tone === 'warning'
        ? 'stroke-warning'
        : tone === 'danger'
          ? 'stroke-destructive'
          : 'stroke-primary';

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        role="img"
        aria-label={`${Math.round(pct)} percent`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="fill-none stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('fill-none transition-[stroke-dashoffset] duration-700 ease-out-expo', strokeClass)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {label ?? <span className="text-lg font-semibold tabular-nums">{Math.round(pct)}%</span>}
      </div>
    </div>
  );
}

export { Progress, ProgressRing };
