import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileQuestion,
  Layers,
  Star,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatPaise } from '@/lib/utils';
import type { TrackSummary } from '@/server/services/catalogue-service';

const ICONS: Record<string, typeof ClipboardCheck> = {
  ClipboardCheck,
  ClipboardList,
  FileQuestion,
  Layers,
};

/**
 * The four preparation tracks, as a card grid.
 *
 * Shared by the home page and `/test-series` so the two cannot drift apart —
 * they were separately maintained copies of the same four cards, which is how
 * the site ended up advertising different prices in different places.
 */
export function TrackCards({ tracks }: { tracks: TrackSummary[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {tracks.map((track) => {
        const Icon = ICONS[track.iconName] ?? Layers;
        const highlight = track.ribbon === 'Most useful' || track.ribbon === 'Most important';

        return (
          <Card key={track.key} className={highlight ? 'relative border-primary/40' : 'relative'}>
            <CardContent className="flex h-full flex-col p-6">
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-6" aria-hidden="true" />
                </span>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Badge variant="muted" size="sm">
                    KAS
                  </Badge>
                  {track.ribbon && (
                    <Badge
                      variant={track.comingSoon ? 'info' : highlight ? 'warning' : 'success'}
                      size="sm"
                    >
                      {track.comingSoon ? (
                        <Clock aria-hidden="true" />
                      ) : (
                        <Star aria-hidden="true" />
                      )}
                      {track.ribbon}
                    </Badge>
                  )}
                  {track.isFree && (
                    <Badge variant="success" size="sm">
                      Free
                    </Badge>
                  )}
                </div>
              </div>

              <h3 className="mt-4 text-lg font-semibold leading-tight tracking-tight">
                {track.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{track.blurb}</p>

              <ul className="mt-5 flex-1 space-y-2.5">
                {track.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2 text-sm">
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-success"
                      aria-hidden="true"
                    />
                    <span className="leading-relaxed text-muted-foreground">{benefit}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border text-center">
                <div className="bg-card px-2 py-3">
                  <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                    Price
                  </p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums">
                    {track.isFree || track.fromPriceInPaise === 0
                      ? 'Free'
                      : formatPaise(track.fromPriceInPaise)}
                  </p>
                </div>
                <div className="bg-card px-2 py-3">
                  <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                    Tests
                  </p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums">
                    {track.testCount > 0 ? track.testCount : '—'}
                  </p>
                </div>
                <div className="bg-card px-2 py-3">
                  <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                    Ready
                  </p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums">{track.readyCount}</p>
                </div>
              </div>

              {/* Shown only while an early-bird tier is genuinely running. */}
              {track.earlyBirdLimit != null && (
                <p className="mt-2 text-center text-xs font-medium text-primary">
                  Early bird price — first {track.earlyBirdLimit} members only
                </p>
              )}

              {track.comingSoon ? (
                <Button disabled fullWidth className="mt-4">
                  <Clock aria-hidden="true" />
                  Coming soon
                </Button>
              ) : (
                <Button asChild fullWidth className="mt-4">
                  <Link href={track.href}>
                    {track.ctaLabel}
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
