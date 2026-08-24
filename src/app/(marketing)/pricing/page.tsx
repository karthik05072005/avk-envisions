import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileQuestion,
  HelpCircle,
  Info,
  Users,
} from 'lucide-react';

import { PageHeader } from '@/components/site/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MARKS_PER_QUESTION } from '@/lib/marking';
import { formatPaise } from '@/lib/utils';
import { db } from '@/server/db';
import { countEnrolledMany, resolvePricing, type PricingRung } from '@/server/services/pricing-service';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Start free with real mock tests and a real performance report. Previous year papers from ₹50 and the full-length test series from ₹199, at early-bird prices.',
  alternates: { canonical: '/pricing' },
};

export const dynamic = 'force-dynamic';

/** Slugs the three published offers are built from. */
const FREE_SLUG = 'kas-prelims-free-test-series';
const PAID_SLUG = 'kas-prelims-paid-test-series';

interface Stat {
  icon: typeof Clock;
  label: string;
  value: string;
}

function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="flex items-center gap-1.5 text-[0.7rem] font-medium uppercase tracking-wide text-primary">
            <stat.icon className="size-3.5" aria-hidden="true" />
            {stat.label}
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}

function Benefits({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-primary">{title}</p>
      <ul className="mt-2.5 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            <span className="leading-relaxed text-muted-foreground">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The early-bird ladder as a small table, current rung marked. */
function Ladder({ title, rungs }: { title: string; rungs: PricingRung[] }) {
  if (rungs.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-primary">{title}</p>
      <ul className="mt-2.5 divide-y divide-border">
        {rungs.map((rung) => (
          <li key={rung.label} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Users className="size-3.5 shrink-0" aria-hidden="true" />
              {rung.label}
            </span>
            <span className="flex items-center gap-2">
              <span className="font-semibold tabular-nums">{formatPaise(rung.priceInPaise)}</span>
              {rung.active && (
                <Badge variant="success" size="sm">
                  Now
                </Badge>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * `/pricing` — the three published offers.
 *
 * Prices and seat counts are read live rather than written into the page, so
 * this cannot advertise a figure that checkout will not honour. The plan table
 * that used to live here described subscription tiers the platform does not
 * sell.
 */
export default async function PricingPage() {
  const series = await db.testSeries.findMany({
    where: { slug: { in: [FREE_SLUG, PAID_SLUG] }, deletedAt: null },
    select: {
      id: true,
      slug: true,
      priceInPaise: true,
      tier1PriceInPaise: true,
      tier1Limit: true,
      tier2PriceInPaise: true,
      tier2Limit: true,
      tests: { where: { status: 'PUBLISHED', deletedAt: null }, select: { durationMinutes: true } },
    },
  });

  const pyq = await db.testSeries.findMany({
    where: { track: 'PYQ', status: 'PUBLISHED', deletedAt: null },
    select: {
      id: true,
      priceInPaise: true,
      tier1PriceInPaise: true,
      tier1Limit: true,
      tier2PriceInPaise: true,
      tier2Limit: true,
      _count: { select: { tests: true } },
    },
  });

  const enrolments = await countEnrolledMany([...series.map((s) => s.id), ...pyq.map((s) => s.id)]);

  const free = series.find((s) => s.slug === FREE_SLUG);
  const paid = series.find((s) => s.slug === PAID_SLUG);

  const freeMinutes = free?.tests[0]?.durationMinutes ?? 25;
  const paidMinutes = paid?.tests[0]?.durationMinutes ?? 120;

  const paidPricing = paid ? resolvePricing(paid, enrolments.get(paid.id) ?? 0) : null;

  // Every paper shares one ladder, so the cheapest paid year represents it.
  const paidYears = pyq.filter((y) => y.priceInPaise > 0);
  const pyqPricing = paidYears[0]
    ? resolvePricing(paidYears[0], enrolments.get(paidYears[0].id) ?? 0)
    : null;
  const pyqTests = pyq.reduce((sum, y) => sum + y._count.tests, 0);

  return (
    <>
      <PageHeader
        eyebrow="Pricing"
        title="Choose the right plan for your preparation"
        description="Start free, with real mock tests and a real performance report. Upgrade only when it has earned it."
      />

      <section className="container space-y-6 py-14 sm:py-16">
        {/* 1. Free ------------------------------------------------------- */}
        <Card>
          <CardContent className="grid gap-6 p-6 lg:grid-cols-[1fr_16rem]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex size-10 items-center justify-center rounded-xl bg-success/10 text-success">
                  <ClipboardCheck className="size-5" aria-hidden="true" />
                </span>
                <h2 className="text-lg font-semibold tracking-tight">1. Free Test Series</h2>
                <Badge variant="success" size="sm">
                  Free
                </Badge>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Try our free tests and evaluate your preparation level.
              </p>

              <div className="mt-5">
                <StatGrid
                  stats={[
                    { icon: FileQuestion, label: 'Total tests', value: String(free?.tests.length ?? 0) },
                    { icon: HelpCircle, label: 'Questions per test', value: '20 questions' },
                    { icon: Clock, label: 'Duration per test', value: `${freeMinutes} minutes` },
                  ]}
                />
              </div>

              <div className="mt-4">
                <Benefits
                  title="What you get"
                  items={[
                    `${free?.tests.length ?? 0} free mock tests`,
                    '20 questions per test',
                    'Basic performance report',
                    'Bookmarks and wrong-question review',
                    'Ideal to get started and build consistency',
                  ]}
                />
              </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-muted/20 p-5 text-center">
              <p className="text-3xl font-semibold tracking-tight">Free</p>
              <p className="text-sm text-success">Always free</p>
              <Button asChild fullWidth variant="outline" className="mt-3">
                <Link href="/courses/free-test-series">Start free tests</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 2. Previous year papers --------------------------------------- */}
        <Card className="border-primary/30">
          <CardContent className="grid gap-6 p-6 lg:grid-cols-[1fr_16rem]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileQuestion className="size-5" aria-hidden="true" />
                </span>
                <h2 className="text-lg font-semibold tracking-tight">
                  2. Previous Year Question Papers
                </h2>
                <Badge variant="warning" size="sm">
                  Most important
                </Badge>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Solve real exam papers and understand the pattern deeply.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Benefits
                  title="What you get"
                  items={[
                    `${pyq.length} full-length previous year papers`,
                    'All subject-wise papers',
                    'Detailed solutions and explanations',
                    'Topic-wise analysis',
                    'Complete analysis document for every paper',
                  ]}
                />
                {pyqPricing && <Ladder title="Pricing" rungs={pyqPricing.ladder} />}
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                {pyqTests} tests across {pyq.length} papers. Offer valid only for a limited time.
              </p>
            </div>

            <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-border bg-muted/20 p-5 text-center">
              <p className="text-xs text-muted-foreground">Start solving at</p>
              <p className="text-3xl font-semibold tracking-tight text-primary">
                {pyqPricing ? formatPaise(pyqPricing.priceInPaise) : '—'}
              </p>
              {pyqPricing?.activeTier && (
                <p className="text-[0.7rem] font-semibold leading-tight text-primary">
                  Only for the first {pyqPricing.tierLimit} members
                </p>
              )}
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                <li>Lifetime validity</li>
                <li>Solve anytime</li>
              </ul>
              <Button asChild fullWidth className="mt-3">
                <Link href="/pyq">Get now</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 3. Full-length test series ------------------------------------ */}
        <Card className="border-primary/40">
          <CardContent className="grid gap-6 p-6 lg:grid-cols-[1fr_16rem]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <CalendarDays className="size-5" aria-hidden="true" />
                </span>
                <h2 className="text-lg font-semibold tracking-tight">
                  3. Test Series (Full-Length Mock Tests)
                </h2>
                <Badge variant="brand" size="sm">
                  Premium
                </Badge>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Full-length tests in the exact prelims pattern, with detailed analysis.
              </p>

              <div className="mt-5">
                <StatGrid
                  stats={[
                    { icon: FileQuestion, label: 'Total tests', value: String(paid?.tests.length ?? 0) },
                    { icon: HelpCircle, label: 'Questions per test', value: '100 questions' },
                    { icon: Clock, label: 'Duration per test', value: `${paidMinutes / 60} hours` },
                  ]}
                />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Benefits
                  title="What you get"
                  items={[
                    `${paid?.tests.length ?? 0} full-length mock tests`,
                    'All tests in real exam pattern',
                    'All India ranking and percentile',
                    'Detailed performance analysis',
                    'Topic-wise strength and weakness',
                    'Up to 2 attempts per test',
                  ]}
                />
                {paidPricing && <Ladder title="Early bird offer" rungs={paidPricing.ladder} />}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-border bg-muted/20 p-5 text-center">
              <p className="text-xs text-muted-foreground">Start your test series at</p>
              <p className="text-3xl font-semibold tracking-tight text-primary">
                {paidPricing ? formatPaise(paidPricing.priceInPaise) : '—'}
              </p>
              {paidPricing?.activeTier && (
                <p className="text-[0.7rem] font-semibold leading-tight text-primary">
                  Only for the first {paidPricing.tierLimit} members
                </p>
              )}
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                <li>{paidMinutes / 60} hours per test</li>
                <li>All India ranking</li>
                <li>Detailed analysis after every test</li>
              </ul>
              <Button asChild fullWidth variant="brand" className="mt-3">
                <Link href="/courses/paid-test-series">Enrol now</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/5 px-5 py-4 text-sm leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <span>
            All prices are in Indian Rupees and inclusive of applicable taxes. Prices increase
            automatically once an early-bird limit is reached. Every test carries{' '}
            {MARKS_PER_QUESTION} marks per question with negative marking, matching the KPSC
            prelims scheme.
          </span>
        </div>
      </section>
    </>
  );
}
