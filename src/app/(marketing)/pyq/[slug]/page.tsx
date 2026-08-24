import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  BookOpenText,
  CalendarDays,
  Clock,
  FileQuestion,
  Layers,
  Lock,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDuration, formatPaise } from '@/lib/utils';
import { BuyButton } from '@/features/checkout/buy-button';
import { currentUser } from '@/server/auth/guards';
import { paymentsEnabled } from '@/server/services/payment-service';
import { getPyqPaper, getPyqYears } from '@/server/services/catalogue-service';

export async function generateStaticParams() {
  const years = await getPyqYears();
  return years.map((year) => ({ slug: year.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const paper = await getPyqPaper(slug);

  if (!paper) return { title: 'Paper not found', robots: { index: false, follow: false } };

  return {
    title: `${paper.name} — Previous Year Questions`,
    description: paper.tagline ?? undefined,
    alternates: { canonical: `/pyq/${paper.slug}` },
  };
}

export default async function PyqPaperPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [paper, user] = await Promise.all([getPyqPaper(slug), currentUser()]);

  if (!paper) notFound();

  const canBuy = paper.priceInPaise > 0 && paymentsEnabled();

  const label = paper.sessionLabel
    ? `${paper.sessionLabel} ${paper.examYear}`
    : `${paper.examYear}`;

  const totalSubjectQuestions = paper.subjectWise.reduce((sum, t) => sum + t.totalQuestions, 0);

  return (
    <>
      <section className="border-b border-border bg-muted/20">
        <div className="container py-10 sm:py-12">
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link href="/pyq">
              <ArrowLeft aria-hidden="true" />
              All papers
            </Link>
          </Button>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary">
                {paper.examYear}
              </span>
              <div>
                <h1 className="text-balance text-display-sm">{label} KAS Prelims</h1>
                {paper.tagline && (
                  <p className="mt-2 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
                    {paper.tagline}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card px-5 py-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Full-length papers
              </p>
              <p className="mt-0.5 text-2xl font-semibold tabular-nums text-primary">
                {paper.fullLength.length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {paper.subjectWise.length} subject-wise tests
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="container space-y-10 py-12">
        {/* 1. Full-length ------------------------------------------------- */}
        <section>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="text-primary">1.</span>
            {label} Full-Length PYQ Test
          </h2>

          <div className="mt-4 space-y-3">
            {paper.fullLength.map((test) => (
              <Card key={test.id}>
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3.5">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <FileQuestion className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight">{test.title}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" aria-hidden="true" />
                          {formatDuration(test.durationMinutes * 60)}
                        </span>
                        <span>
                          {test.isReady ? `${test.totalQuestions} questions` : 'Questions being added'}
                        </span>
                        {test.maxAttempts > 0 && <span>Max {test.maxAttempts} attempts</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2">
                    {test.isReady ? (
                      <Button asChild>
                        <Link href={`/test/${test.id}`}>View test</Link>
                      </Button>
                    ) : (
                      <Button disabled>Coming soon</Button>
                    )}

                    {test.hasSynopsis && (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/synopsis/test/${test.id}`}>
                          <BookOpenText aria-hidden="true" />
                          Analysed PDF
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <CalendarDays className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            The full-length test contains the complete {label} paper, attempted under real exam
            timing.
          </p>

          {/* --- Analysis / synopsis ------------------------------------- */}
          {paper.hasSynopsis && (
            <div className="mt-4 flex flex-col gap-4 rounded-xl border border-primary/30 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3.5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <BookOpenText className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold leading-tight">{label} Complete Analysis</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Every question with its answer, the reasoning, the core concept and the likely
                    future angle. Available to read once you have attempted the paper.
                  </p>
                </div>
              </div>

              <Button asChild variant="outline" className="shrink-0">
                <Link href={`/synopsis/${paper.slug}`}>Open analysis</Link>
              </Button>
            </div>
          )}
        </section>

        {/* Divider --------------------------------------------------------- */}
        <div className="flex items-center gap-4">
          <span className="h-px flex-1 bg-border" aria-hidden="true" />
          <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            or
          </span>
          <span className="h-px flex-1 bg-border" aria-hidden="true" />
        </div>

        {/* 2. Subject-wise ------------------------------------------------- */}
        <section>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="text-primary">2.</span>
            Subject-wise Tests ({label})
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Practise specific subjects. Each test contains only the questions from that subject.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {paper.subjectWise.map((test) => (
              <div
                key={test.id}
                className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold"
                  style={
                    test.subject?.colorHex
                      ? {
                          backgroundColor: `${test.subject.colorHex}1A`,
                          color: test.subject.colorHex,
                        }
                      : undefined
                  }
                >
                  <Layers className="size-4" aria-hidden="true" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-tight">
                    {test.subject?.name ?? test.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {test.isReady ? `${test.totalQuestions} questions` : 'Being added'}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col gap-1.5">
                  {test.isReady ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/test/${test.id}`}>View test</Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled>
                      <Lock aria-hidden="true" />
                      Soon
                    </Button>
                  )}

                  {test.hasSynopsis && (
                    <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                      <Link href={`/synopsis/test/${test.id}`}>
                        <BookOpenText aria-hidden="true" />
                        Analysed PDF
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {totalSubjectQuestions > 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              {totalSubjectQuestions} subject-wise{' '}
              {totalSubjectQuestions === 1 ? 'question is' : 'questions are'} ready to practise.
            </p>
          )}
        </section>

        {/* Pricing --------------------------------------------------------- */}
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <h2 className="font-semibold tracking-tight">Unlock {label}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Full-length paper plus every subject-wise test, with detailed solutions.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-2xl font-semibold tracking-tight">
                  {paper.priceInPaise === 0 ? 'Free' : formatPaise(paper.priceInPaise)}
                </p>
                {paper.comparePriceInPaise > paper.priceInPaise && (
                  <p className="text-sm text-muted-foreground line-through">
                    {formatPaise(paper.comparePriceInPaise)}
                  </p>
                )}
              </div>
              {paper.priceInPaise === 0 ? (
                <Button asChild size="lg" variant="brand">
                  <Link href={`/register?next=/pyq/${paper.slug}`}>Start free</Link>
                </Button>
              ) : !canBuy ? (
                // Payments off: say so rather than opening a checkout that
                // cannot complete.
                <Button size="lg" variant="brand" disabled>
                  Coming soon
                </Button>
              ) : user ? (
                <BuyButton
                  seriesSlug={paper.slug}
                  label="Get access"
                  prefill={{ name: user.name, email: user.email }}
                />
              ) : (
                <Button asChild size="lg" variant="brand">
                  <Link href={`/login?next=/pyq/${paper.slug}`}>Sign in to buy</Link>
                </Button>
              )}
            </div>
          </div>

          {paper.features.length > 0 && (
            <ul className="mt-5 grid gap-2 border-t border-border pt-5 sm:grid-cols-2">
              {paper.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
