import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileQuestion,
  Layers,
  ShieldCheck,
  Star,
} from 'lucide-react';

import { PageHeader } from '@/components/site/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatPaise } from '@/lib/utils';
import { getCourseTracks } from '@/server/services/catalogue-service';

export const metadata: Metadata = {
  title: 'Test series',
  description:
    'Structured test series with full-length mocks, sectional tests, previous year papers and detailed performance analysis after every attempt.',
  alternates: { canonical: '/test-series' },
};

export const dynamic = 'force-dynamic';

const ICONS: Record<string, typeof ClipboardCheck> = {
  ClipboardCheck,
  ClipboardList,
  FileQuestion,
  Layers,
};

/**
 * `/test-series` — the four tracks a student can buy into.
 *
 * Deliberately the four tracks rather than every individual series: listing
 * all fourteen (six paper years, five chapterwise subjects and the rest) buries
 * the decision the visitor is actually making.
 */
export default async function TestSeriesPage() {
  const tracks = await getCourseTracks();

  return (
    <>
      <PageHeader
        eyebrow="Test series"
        title="Structured series, not a pile of tests"
        description="Each series follows a deliberate progression — sectional tests across the syllabus, then current affairs, then full-length Paper I and Paper II simulations under real exam conditions."
      />

      <section className="container py-14 sm:py-16">
        <div className="grid gap-6 lg:grid-cols-2">
          {tracks.map((track) => {
            const Icon = ICONS[track.iconName] ?? Layers;
            const highlight = track.ribbon === 'Most useful' || track.ribbon === 'Most important';

            return (
              <Card
                key={track.key}
                className={highlight ? 'relative border-primary/40' : 'relative'}
              >
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
                            track.comingSoon ? 'info' : highlight ? 'warning' : 'success'
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

                  <h2 className="mt-4 text-lg font-semibold leading-tight tracking-tight">
                    {track.title}
                  </h2>
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
                      <p className="mt-0.5 text-sm font-semibold tabular-nums">
                        {track.readyCount}
                      </p>
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

        <p className="mt-8 flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/30 px-5 py-4 text-center text-sm text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
          Every series is designed to help you learn, practise and excel in the KPSC KAS Prelims.
        </p>
      </section>
    </>
  );
}
