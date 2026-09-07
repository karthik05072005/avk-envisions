import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileQuestion,
  Layers,
  Star,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatPaise } from "@/lib/utils";
import type { TrackSummary } from "@/server/services/catalogue-service";

const ICONS: Record<string, typeof ClipboardCheck> = {
  CalendarDays,
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
  // The first two lead — the current offer and the free entry point — so they
  // get a wider row of their own. Everything after sits in a denser second row,
  // which keeps the whole set on one screen instead of a long even column.
  const featured = tracks.slice(0, 2);
  const rest = tracks.slice(2);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {featured.map((track) => (
          <TrackCard key={track.key} track={track} featured />
        ))}
      </div>

      {rest.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {rest.map((track) => (
            <TrackCard key={track.key} track={track} />
          ))}
        </div>
      )}
    </div>
  );
}

function TrackCard({
  track,
  featured = false,
}: {
  track: TrackSummary;
  featured?: boolean;
}) {
  const Icon = ICONS[track.iconName] ?? Layers;
  const highlight =
    featured ||
    track.ribbon === "Most useful" ||
    track.ribbon === "Most important";

  return (
    <Card className={highlight ? "relative border-primary/40" : "relative"}>
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
                variant={
                  track.comingSoon ? "info" : highlight ? "warning" : "success"
                }
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
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {track.blurb}
        </p>

        <ul className="mt-5 flex-1 space-y-2.5">
          {track.benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-sm">
              <CheckCircle2
                className="mt-0.5 size-4 shrink-0 text-success"
                aria-hidden="true"
              />
              <span className="leading-relaxed text-muted-foreground">
                {benefit}
              </span>
            </li>
          ))}
        </ul>

        {/* No price-and-test-count strip. Half of it was usually a dash —
            a track with no papers yet, or one whose price is per subject —
            and a card promising "50 Questions × 50 Days" then reporting "—"
            tests reads as a fault rather than as content still being written.
            The pricing page carries the numbers, in full and in context. */}

        {/* Shown only while an early-bird tier is genuinely running. */}
        {track.earlyBirdLimit != null && (
          <p className="mt-6 text-center text-xs font-semibold leading-tight text-primary">
            Early bird offer — only for the first {track.earlyBirdLimit} members
          </p>
        )}

        {track.comingSoon ? (
          <Button disabled fullWidth className={track.earlyBirdLimit != null ? 'mt-2' : 'mt-6'}>
            <Clock aria-hidden="true" />
            Coming soon
          </Button>
        ) : (
          <Button asChild fullWidth className={track.earlyBirdLimit != null ? 'mt-2' : 'mt-6'}>
            <Link href={track.href}>
              {track.ctaLabel}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
