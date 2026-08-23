import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileQuestion,
  Layers,
  Lock,
  type LucideIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatPaise } from '@/lib/utils';
import type { TrackSummary } from '@/server/services/catalogue-service';

/**
 * The four course tracks.
 *
 * This is the platform's front door: a student's first decision is which of
 * these four paths they are on, so the widgets state plainly what each one
 * costs and how much of it is actually ready to attempt today.
 */
const ICONS: Record<string, LucideIcon> = {
  ClipboardCheck,
  ClipboardList,
  FileQuestion,
  Layers,
  CalendarDays,
};

/** Per-track accent, kept here so the four cards read as a set. */
const ACCENTS: Record<string, { ring: string; chip: string; button: string }> = {
  FREE_SERIES: {
    ring: 'border-success/30 hover:border-success/60',
    chip: 'bg-success/10 text-success',
    button: 'bg-success text-success-foreground hover:bg-success/90',
  },
  PAID_SERIES: {
    ring: 'border-warning/30 hover:border-warning/60',
    chip: 'bg-warning/10 text-warning',
    button: 'bg-warning text-warning-foreground hover:bg-warning/90',
  },
  PYQ: {
    ring: 'border-primary/30 hover:border-primary/60',
    chip: 'bg-primary/10 text-primary',
    button: 'bg-primary text-primary-foreground hover:bg-primary/90',
  },
  CHAPTERWISE: {
    ring: 'border-info/30 hover:border-info/60',
    chip: 'bg-info/10 text-info',
    button: 'bg-info text-info-foreground hover:bg-info/90',
  },
};

export function CourseTracks({
  tracks,
  className,
}: {
  tracks: TrackSummary[];
  className?: string;
}) {
  return (
    <div className={cn('grid gap-5 lg:grid-cols-2', className)}>
      {tracks.map((track, index) => {
        const Icon = ICONS[track.iconName] ?? ClipboardList;
        const accent = ACCENTS[track.key] ?? ACCENTS.PYQ!;

        return (
          <div
            key={track.key}
            className={cn(
              'group relative flex flex-col rounded-xl border bg-card p-6 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elevated',
              accent.ring,
            )}
          >
            <div className="flex items-start gap-4">
              <span
                className={cn(
                  'relative flex size-12 shrink-0 items-center justify-center rounded-xl',
                  accent.chip,
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {!track.isFree && (
                  <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border-2 border-card bg-muted text-muted-foreground">
                    <Lock className="size-2.5" aria-hidden="true" />
                  </span>
                )}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold leading-tight tracking-tight">
                    <span className="text-muted-foreground">{index + 1}.</span> {track.title}
                  </h3>
                  {track.isFree ? (
                    <Badge variant="success" size="sm">
                      Free
                    </Badge>
                  ) : (
                    <Badge variant="muted" size="sm">
                      Paid
                    </Badge>
                  )}
                </div>

                <p className="mt-1.5 text-pretty text-sm leading-relaxed text-muted-foreground">
                  {track.blurb}
                </p>
              </div>
            </div>

            {/* Counts are real, never planned figures. */}
            <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4 text-center">
              <div>
                <dt className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                  {track.key === 'PYQ' ? 'Papers' : track.key === 'CHAPTERWISE' ? 'Subjects' : 'Series'}
                </dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">{track.seriesCount}</dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                  Tests
                </dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">{track.testCount}</dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                  {track.isFree ? 'Price' : 'From'}
                </dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                  {track.fromPriceInPaise === 0 ? 'Free' : formatPaise(track.fromPriceInPaise)}
                </dd>
                {/* The price only holds for the early-bird band, and a buyer
                    should see that beside the number rather than discover it
                    at checkout. */}
                {track.earlyBirdLimit != null && (
                  <dd className="mt-0.5 text-[0.6875rem] font-medium leading-tight text-primary">
                    Early bird offer
                    <br />
                    Only for first {track.earlyBirdLimit} members
                  </dd>
                )}
              </div>
            </dl>

            <div className="mt-5 flex flex-1 items-end gap-2.5">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href={track.href}>View details</Link>
              </Button>
              <Button asChild size="sm" className={cn('flex-1', accent.button)}>
                <Link href={track.href}>
                  {track.ctaLabel}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </div>

            {/* Honest readiness signal rather than a silent empty catalogue. */}
            {track.readyCount === 0 && track.testCount > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Questions are being added to this track.
              </p>
            )}
            {track.readyCount > 0 && track.readyCount < track.testCount && (
              <p className="mt-3 text-xs text-muted-foreground">
                {track.readyCount} of {track.testCount} tests ready to attempt now.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
