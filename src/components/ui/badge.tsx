import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors [&_svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        muted: 'border-transparent bg-muted text-muted-foreground',
        /**
         * Semantic variants use a tinted background rather than a solid fill so
         * that several can sit together in a table row without shouting.
         */
        success: 'border-success/20 bg-success/10 text-success',
        warning: 'border-warning/25 bg-warning/10 text-warning',
        danger: 'border-destructive/20 bg-destructive/10 text-destructive',
        info: 'border-info/20 bg-info/10 text-info',
        brand: 'border-primary/20 bg-primary/10 text-primary',
      },
      size: {
        sm: 'px-2 py-0 text-[0.6875rem]',
        default: '',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

/**
 * Maps a workflow status string to a badge variant.
 *
 * Centralised so that "PUBLISHED" is the same green everywhere it appears —
 * question bank, test list, blog CMS — instead of each screen picking its own.
 */
export function statusVariant(status: string): NonNullable<BadgeProps['variant']> {
  switch (status) {
    case 'PUBLISHED':
    case 'ACTIVE':
    case 'APPROVED':
    case 'PAID':
    case 'CAPTURED':
    case 'RESOLVED':
    case 'COMPLETED':
    case 'SUBMITTED':
      return 'success';

    case 'DRAFT':
    case 'CREATED':
    case 'PENDING':
    case 'PENDING_VERIFICATION':
    case 'NOT_VISITED':
      return 'muted';

    case 'UNDER_REVIEW':
    case 'REVIEWING':
    case 'IN_PROGRESS':
    case 'WAITING':
    case 'AUTHORIZED':
      return 'info';

    case 'ARCHIVED':
    case 'EXPIRED':
    case 'CLOSED':
    case 'ABANDONED':
      return 'secondary';

    case 'SUSPENDED':
    case 'FAILED':
    case 'CANCELLED':
    case 'REJECTED':
    case 'DELETED':
      return 'danger';

    case 'REPORTED':
    case 'PARTIALLY_REFUNDED':
    case 'REFUNDED':
    case 'AUTO_SUBMITTED':
      return 'warning';

    default:
      return 'muted';
  }
}

/** Turns an enum constant into display text: `UNDER_REVIEW` -> `Under review`. */
export function humanizeStatus(status: string): string {
  const lower = status.replace(/_/g, ' ').toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Convenience wrapper that renders a status enum with the right colour. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant={statusVariant(status)} className={className}>
      {humanizeStatus(status)}
    </Badge>
  );
}

export { Badge, badgeVariants };
