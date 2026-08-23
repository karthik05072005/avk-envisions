import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeIndianRupee,
  CalendarDays,
  CheckCircle2,
  FileQuestion,
  Layers,
  Lock,
  Star,
} from 'lucide-react';

import { PageHeader } from '@/components/site/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { formatPaise } from '@/lib/utils';
import { getPyqYears } from '@/server/services/catalogue-service';

export const metadata: Metadata = {
  title: 'Previous Year Question Papers',
  description:
    'Solve KAS Prelims previous year papers in the real exam environment — full-length attempts and subject-wise practice, year by year.',
  alternates: { canonical: '/pyq' },
};

/** Distinct accent per year card, cycled so the grid reads as a set. */
const ACCENTS = [
  'text-primary bg-primary/10',
  'text-success bg-success/10',
  'text-warning bg-warning/10',
  'text-info bg-info/10',
  'text-destructive bg-destructive/10',
  'text-exam-review bg-exam-review/10',
];

/** What unlocking the papers gets you, as advertised. */
const UNLOCK_BENEFITS = [
  'Genuine KPSC previous year questions',
  'Relevant article or case for every question',
  'Topic-level performance analytics',
  'Complete analysis to gain clarity',
];

export default async function PyqPage() {
  const years = await getPyqYears();

  // Every paid year shares one ladder, so the banner can quote any of them.
  const paid = years.find((y) => !y.isFree);
  const offer = paid?.pricing ?? null;

  return (
    <>
      {offer?.activeTier && (
        <div className="border-b border-border bg-warning/10">
          <div className="container flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm">
            <BadgeIndianRupee className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="font-semibold">Price update:</span>
            <span>
              {formatPaise(offer.priceInPaise)} for the first {offer.tierLimit} members.
            </span>
            {offer.nextPriceInPaise !== null && (
              <span className="text-muted-foreground">
                Price then rises to {formatPaise(offer.nextPriceInPaise)}.
              </span>
            )}
          </div>
        </div>
      )}

      <PageHeader
        eyebrow="PYQ Tests"
        title="Previous year question papers"
        description="Each paper is reproduced in the real exam format, with the actual timing and marking scheme. Attempt the full paper end to end, or drill one subject at a time using only that subject's questions from the paper."
      >
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3.5">
            <CalendarDays className="size-5 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                KAS Prelims conducted
              </p>
              <p className="text-sm font-semibold">
                {years.length} {years.length === 1 ? 'paper' : 'papers'} available
              </p>
            </div>
          </div>

          {/* Previous papers are where visitors land; the test series is what
              they are here to buy, so it gets a first-class route out of this
              page rather than only a nav item. */}
          <Button asChild size="lg" variant="brand">
            <Link href="/test-series">
              <Layers aria-hidden="true" />
              Explore test series
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </PageHeader>

      {offer && (
        <section className="container pt-12" aria-labelledby="unlock-heading">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileQuestion className="size-6" aria-hidden="true" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 id="unlock-heading" className="font-semibold tracking-tight">
                      Unlock all previous year questions — complete analysis
                    </h2>
                    <Badge variant="warning" size="sm">
                      <Star aria-hidden="true" />
                      Most important
                    </Badge>
                  </div>
                  <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
                    Complete access to every previous year paper with detailed solutions,
                    topic-wise analysis, the relevant article or case for each question, and
                    performance insights.
                  </p>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-3xl font-semibold tabular-nums text-primary">
                  {formatPaise(offer.priceInPaise)}
                </p>
                {offer.activeTier && offer.nextPriceInPaise !== null && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    for the first {offer.tierLimit} members · then{' '}
                    {formatPaise(offer.nextPriceInPaise)}
                  </p>
                )}
                <Button asChild size="lg" variant="brand" className="mt-3">
                  <Link href="/pricing">Get access</Link>
                </Button>
              </div>
            </div>

            <ul className="mt-5 grid gap-2.5 border-t border-primary/20 pt-5 sm:grid-cols-2 lg:grid-cols-4">
              {UNLOCK_BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  {benefit}
                </li>
              ))}
            </ul>

            {/* Seats are counted from real enrolments, so this bar reflects
                actual sales rather than a number chosen to create urgency. */}
            {offer.activeTier && offer.seatsLeftInTier !== null && offer.tierLimit !== null && (
              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-card px-4 py-3">
                <p className="text-sm">
                  <span className="font-semibold tabular-nums">{offer.enrolled}</span>
                  <span className="text-muted-foreground"> / {offer.tierLimit} enrolled</span>
                </p>
                <div
                  className="h-2 min-w-[8rem] flex-1 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={offer.enrolled}
                  aria-valuemin={0}
                  aria-valuemax={offer.tierLimit}
                  aria-label="Early bird seats taken"
                >
                  <div
                    className="h-full rounded-full bg-success transition-[width]"
                    style={{ width: `${Math.min(100, (offer.enrolled / offer.tierLimit) * 100)}%` }}
                  />
                </div>
                <p className="text-sm font-medium text-primary tabular-nums">
                  {offer.seatsLeftInTier} left at {formatPaise(offer.priceInPaise)}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="container py-14 sm:py-16">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Select question paper
        </h2>

        {years.length === 0 ? (
          <EmptyState
            className="mt-5"
            icon={FileQuestion}
            title="No papers published yet"
            description="Previous year papers appear here as they are added."
            action={{ label: 'Browse courses', href: '/courses' }}
          />
        ) : (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {years.map((year, index) => {
              const accent = ACCENTS[index % ACCENTS.length]!;
              const label = year.sessionLabel
                ? `${year.sessionLabel} ${year.examYear}`
                : `${year.examYear}`;

              return (
                <Card
                  key={year.id}
                  interactive
                  className={year.isFree ? 'h-full border-primary/40 ring-1 ring-primary/20' : 'h-full'}
                >
                  <CardContent className="flex h-full flex-col p-6">
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={`flex size-14 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${accent}`}
                      >
                        {year.examYear}
                      </span>
                      {year.isFree ? (
                        <Badge variant="success" size="sm">
                          Free
                        </Badge>
                      ) : year.readyCount > 0 ? (
                        <Badge variant="secondary" size="sm">
                          <Lock aria-hidden="true" />
                          Locked
                        </Badge>
                      ) : (
                        <Badge variant="muted" size="sm">
                          Being added
                        </Badge>
                      )}
                    </div>

                    <h3 className="mt-4 font-semibold leading-tight tracking-tight">
                      {label} KAS Prelims
                    </h3>

                    <ul className="mt-4 flex-1 space-y-2.5">
                      <li className="flex items-center gap-2.5 rounded-lg border border-border p-2.5">
                        <FileQuestion
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-tight">Full-Length PYQ Test</p>
                          <p className="text-xs text-muted-foreground">
                            {year.fullLengthCount} {year.fullLengthCount === 1 ? 'paper' : 'papers'}
                          </p>
                        </div>
                      </li>
                      <li className="flex items-center gap-2.5 rounded-lg border border-border p-2.5">
                        <Layers
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-tight">Subject-wise Tests</p>
                          <p className="text-xs text-muted-foreground">
                            {year.subjectCount} subjects
                          </p>
                        </div>
                      </li>
                    </ul>

                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
                      <span className="text-sm font-semibold tabular-nums">
                        {year.isFree ? 'Free' : formatPaise(year.pricing.priceInPaise)}
                      </span>
                      <Button asChild size="sm" variant={year.isFree ? 'brand' : 'outline'}>
                        <Link href={`/pyq/${year.slug}`}>
                          {year.isFree ? (
                            <>
                              Start free
                              <ArrowRight aria-hidden="true" />
                            </>
                          ) : (
                            <>
                              <Lock aria-hidden="true" />
                              Unlock
                            </>
                          )}
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <p className="mt-8 rounded-xl border border-border bg-muted/30 px-5 py-4 text-sm leading-relaxed text-muted-foreground">
          The full-length test contains the complete paper. Subject-wise tests contain only the
          questions from that subject in the same paper — useful once you know which subject is
          costing you marks.
        </p>
      </section>
    </>
  );
}
