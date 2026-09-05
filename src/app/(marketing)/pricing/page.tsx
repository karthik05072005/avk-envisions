import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock, Flame, Target, TrendingUp, Trophy } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { cn, formatPaise } from '@/lib/utils';
import { db } from '@/server/db';
import { countEnrolledMany, resolvePricing } from '@/server/services/pricing-service';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Start free with real mock tests. Previous year papers, the fifty-day challenge and full-length mocks at early-bird prices for the first fifty members.',
  alternates: { canonical: '/pricing' },
};

export const dynamic = 'force-dynamic';

/**
 * The plans, in the order they are offered.
 *
 * Colour and copy live here; price, seats sold and availability come from the
 * database, so a plan cannot advertise a price nobody is charged. A slug that
 * is missing or unpublished simply does not render.
 */
interface PlanCard {
  slug: string | null;
  number: number;
  title: string;
  blurb: string;
  benefits: [string, string];
  cta: string;
  href: string;
  /** Tailwind classes, kept whole so the compiler can see them. */
  tint: string;
  accent: string;
  button: string;
  ribbon: string;
  badge?: string;
}

const PLANS: PlanCard[] = [
  {
    slug: 'kas-prelims-free-test-series',
    number: 1,
    title: 'Free Test Series',
    blurb: 'Try our free tests and evaluate your preparation level.',
    benefits: ['Exam-style practice', 'Detailed solutions'],
    cta: 'Start Free Tests',
    href: '/test-series/kas-prelims-free-test-series',
    tint: 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20',
    accent: 'bg-emerald-600 text-white',
    button: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    ribbon: 'bg-emerald-600',
  },
  {
    slug: 'kas-pyq-2015',
    number: 2,
    title: 'KAS Previous Year Question Papers',
    blurb: 'Full-length and subject-wise papers to understand the exam pattern.',
    benefits: ['Subject-wise papers', 'Detailed solutions'],
    cta: 'Get Now',
    href: '/pyq',
    tint: 'border-blue-200 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-950/20',
    accent: 'bg-blue-600 text-white',
    button: 'bg-blue-600 hover:bg-blue-700 text-white',
    ribbon: 'bg-rose-500',
  },
  {
    slug: 'kas-50-questions-50-days',
    number: 3,
    title: 'KAS 50 Days 50 Tests (KAS50)',
    blurb: '50 days. 50 tests. One powerful preparation journey.',
    benefits: ['Daily practice', 'Track your progress'],
    cta: 'Start KAS50',
    href: '/50-days',
    tint: 'border-rose-200 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-950/20',
    accent: 'bg-rose-500 text-white',
    button: 'bg-rose-500 hover:bg-rose-600 text-white',
    ribbon: 'bg-rose-500',
    badge: 'Most Popular',
  },
  {
    slug: 'kas-prelims-paid-test-series',
    number: 4,
    title: 'Test Series (Full-Length Mock Tests)',
    blurb: 'Full-length tests in the exact prelims pattern with detailed analysis.',
    benefits: ['All India ranking', 'Performance analysis'],
    cta: 'Enrol Now',
    href: '/test-series/kas-prelims-paid-test-series',
    tint: 'border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20',
    accent: 'bg-amber-500 text-white',
    button: 'bg-amber-500 hover:bg-amber-600 text-white',
    ribbon: 'bg-orange-500',
  },
  {
    // No series behind it yet, so it renders as the coming-soon card rather
    // than advertising a price nobody can pay.
    slug: null,
    number: 5,
    title: 'Chapter-wise Practice',
    blurb: 'Strengthen every chapter, step by step.',
    benefits: ['Topic-wise tests', 'Concept clarity'],
    cta: 'Stay Tuned',
    href: '/chapterwise',
    tint: 'border-violet-200 bg-violet-50/60 dark:border-violet-900/40 dark:bg-violet-950/20',
    accent: 'bg-violet-600 text-white',
    button: 'bg-violet-600 hover:bg-violet-700 text-white',
    ribbon: 'bg-violet-600',
  },
];

const PROMISES = [
  { icon: Target, title: 'Practice', detail: 'Effectively' },
  { icon: TrendingUp, title: 'Track Your', detail: 'Progress' },
  { icon: Trophy, title: 'Be Exam', detail: 'Ready' },
];

export default async function PricingPage() {
  const slugs = PLANS.map((p) => p.slug).filter((s): s is string => s !== null);

  const series = await db.testSeries.findMany({
    where: { slug: { in: slugs }, deletedAt: null },
    select: {
      id: true,
      slug: true,
      status: true,
      priceInPaise: true,
      tier1PriceInPaise: true,
      tier1Limit: true,
      tier2PriceInPaise: true,
      tier2Limit: true,
    },
  });

  // Seats sold are counted from live entitlements, so the early-bird rung
  // closes on its own the moment the fiftieth person buys.
  const enrolled = await countEnrolledMany(series.map((s) => s.id));
  const bySlug = new Map(series.map((s) => [s.slug, s]));

  return (
    <div className="bg-gradient-to-b from-sky-50/60 to-transparent dark:from-sky-950/10">
      <div className="container max-w-4xl py-10 sm:py-14">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            KAS Prelims
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Choose Your <span className="text-primary">Plan</span>
          </h1>
          <p className="mt-2 text-muted-foreground">
            Flexible options. Focused preparation. Your success.
          </p>

          <ul className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
            {PROMISES.map((promise) => (
              <li key={promise.title} className="flex items-center gap-2.5">
                <promise.icon className="size-5 text-primary" aria-hidden="true" />
                <span className="text-sm font-medium leading-tight">
                  {promise.title}
                  <br />
                  <span className="text-muted-foreground">{promise.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </header>

        <ul className="mt-8 space-y-4">
          {PLANS.map((plan) => {
            const row = plan.slug ? bySlug.get(plan.slug) : undefined;
            const pricing = row
              ? resolvePricing(row, enrolled.get(row.id) ?? 0)
              : null;

            // A plan with no series, or one still in draft, is not for sale.
            const available = Boolean(row && row.status === 'PUBLISHED');
            const isFree = pricing !== null && pricing.priceInPaise === 0;

            // The early-bird rung is only announced while it is genuinely open.
            const earlyBird =
              pricing?.ladder.find((rung) => rung.active && rung.limit !== null) ?? null;
            const standard = pricing?.ladder.find((rung) => rung.limit === null) ?? null;

            return (
              <li key={plan.number}>
                <Card className={cn('overflow-hidden', plan.tint)}>
                  <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
                    <span
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                        plan.accent,
                      )}
                      aria-hidden="true"
                    >
                      {plan.number}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold leading-tight tracking-tight">
                          {plan.title}
                        </h2>
                        {plan.badge && available && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[0.7rem] font-semibold text-white">
                            <Flame className="size-3" aria-hidden="true" />
                            {plan.badge}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{plan.blurb}</p>

                      <ul className="mt-2.5 flex flex-wrap gap-x-6 gap-y-1.5">
                        {plan.benefits.map((benefit) => (
                          <li key={benefit} className="flex items-center gap-1.5 text-sm">
                            <CheckCircle2
                              className="size-4 shrink-0 text-success"
                              aria-hidden="true"
                            />
                            {benefit}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Price and call to action */}
                    <div className="shrink-0 sm:w-56">
                      {!available ? (
                        <div className="rounded-xl border border-border bg-card/60 p-3 text-center">
                          <p className="text-base font-bold text-violet-600 dark:text-violet-400">
                            Coming Soon
                          </p>
                          <p className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                            <Clock className="size-3.5" aria-hidden="true" />
                            {plan.cta}
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-hidden rounded-xl border border-border bg-card/70">
                          {earlyBird && (
                            <p
                              className={cn(
                                'px-3 py-1 text-center text-[0.7rem] font-semibold leading-tight text-white',
                                plan.ribbon,
                              )}
                            >
                              Special Price
                              <br />
                              for First {earlyBird.limit} Members
                            </p>
                          )}

                          <div className="flex items-stretch">
                            <p className="flex-1 px-3 py-2.5 text-center text-2xl font-bold tabular-nums">
                              {isFree ? '₹0' : formatPaise(pricing!.priceInPaise)}
                            </p>

                            {earlyBird && standard && (
                              <p className="flex-1 border-l border-border px-2 py-2.5 text-center text-xs leading-tight text-muted-foreground">
                                Later Price
                                <br />
                                <span className="font-semibold text-foreground tabular-nums">
                                  {formatPaise(standard.priceInPaise)}
                                </span>
                              </p>
                            )}

                            {isFree && (
                              <p className="flex-1 border-l border-border px-2 py-2.5 text-center text-xs text-muted-foreground">
                                Always
                                <br />
                                <span className="font-semibold text-foreground">Free</span>
                              </p>
                            )}
                          </div>

                          <Link
                            href={plan.href}
                            className={cn(
                              'flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold transition-colors',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              plan.button,
                            )}
                          >
                            {plan.cta}
                            <ArrowRight className="size-4" aria-hidden="true" />
                          </Link>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>

        <p className="mt-8 text-center text-sm font-medium italic text-muted-foreground">
          Small steps everyday lead to big results.
        </p>
      </div>
    </div>
  );
}
