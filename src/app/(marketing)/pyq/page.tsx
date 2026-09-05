import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CalendarDays, FileText, Layers, Lock } from 'lucide-react';

import { EmptyState } from '@/components/ui/states';
import { cn } from '@/lib/utils';
import { getPyqYears } from '@/server/services/catalogue-service';

export const metadata: Metadata = {
  title: 'Previous Year Question Papers',
  description:
    'Solve KAS Prelims previous year papers in the real exam environment — full-length attempts and subject-wise practice, year by year.',
  alternates: { canonical: '/pyq' },
};

export const dynamic = 'force-dynamic';

/**
 * A colour per year, cycled so the grid reads as a set rather than a list.
 *
 * Kept whole rather than composed, so the compiler can see every class.
 */
const ACCENTS = [
  { chip: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  { chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  { chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  { chip: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
  { chip: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  { chip: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
];

export default async function PyqPage() {
  const years = await getPyqYears();
  const free = years.find((year) => year.isFree);

  return (
    <div className="container max-w-5xl py-10 sm:py-12">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          KAS Prelims
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Previous year question papers
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Each paper is reproduced in the real exam format, with the actual timing and marking
          scheme. Attempt the full paper end to end, or drill one subject at a time using only
          that subject&rsquo;s questions from the paper.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <div className="rounded-xl border border-border bg-card px-5 py-3.5">
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              KAS Prelims conducted
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {years.length} {years.length === 1 ? 'paper' : 'papers'} available
            </p>
          </div>

          <Link
            href="/test-series"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Explore Other Test Series
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      {years.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={FileText}
            title="Papers are being prepared"
            description="Previous year papers will appear here as they are published."
          />
        </div>
      ) : (
        <>
          <h2 className="mt-10 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Select question paper
          </h2>

          {/* The free year, promoted. It is the reason to try any of this, and a
              student should sit a complete paper before being asked to pay. */}
          {free && (
            <div className="mt-3 flex flex-wrap items-center gap-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20 sm:p-5">
              <span
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                aria-hidden="true"
              >
                <FileText className="size-5" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold leading-tight">
                  Try the {free.examYear} paper free
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    No payment needed
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The complete {free.examYear} paper with its full analysis, open to everyone. See
                  exactly what you get before paying for any other year.
                </p>
              </div>

              <Link
                href={`/pyq/${free.slug}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Start free
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          )}

          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {years.map((year, index) => {
              const accent = ACCENTS[index % ACCENTS.length]!;

              return (
                <li key={year.id}>
                  <div
                    className={cn(
                      'flex h-full flex-col rounded-2xl border bg-card p-4',
                      year.isFree ? 'border-emerald-300/70 dark:border-emerald-900/50' : 'border-border',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          'rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums',
                          accent.chip,
                        )}
                      >
                        {year.examYear}
                      </span>

                      {year.isFree ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          Free
                        </span>
                      ) : (
                        <Lock
                          className="size-4 text-muted-foreground"
                          aria-label="Locked until purchased"
                        />
                      )}
                    </div>

                    <h3 className="mt-3 text-base font-semibold leading-snug tracking-tight">
                      {year.examYear} KAS Prelims
                      {year.sessionLabel ? ` — ${year.sessionLabel}` : ''}
                    </h3>

                    <ul className="mt-3 space-y-2">
                      <li className="flex items-start gap-2 rounded-lg border border-border/70 px-3 py-2">
                        <FileText
                          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="text-sm leading-tight">
                          Full-Length PYQ Test
                          <br />
                          <span className="text-xs text-muted-foreground">
                            {year.fullLengthCount}{' '}
                            {year.fullLengthCount === 1 ? 'paper' : 'papers'}
                          </span>
                        </span>
                      </li>

                      <li className="flex items-start gap-2 rounded-lg border border-border/70 px-3 py-2">
                        <Layers
                          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="text-sm leading-tight">
                          Subject-wise Tests
                          <br />
                          <span className="text-xs text-muted-foreground">
                            {year.subjectCount} {year.subjectCount === 1 ? 'subject' : 'subjects'}
                          </span>
                        </span>
                      </li>
                    </ul>

                    <div className="mt-4 flex items-center justify-between gap-2 pt-1">
                      {year.isFree ? (
                        <span className="text-sm font-semibold">Free</span>
                      ) : (
                        <Lock className="size-4 text-muted-foreground" aria-hidden="true" />
                      )}

                      <Link
                        href={`/pyq/${year.slug}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {year.isFree ? 'Start free' : 'Proceed to buy'}
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
