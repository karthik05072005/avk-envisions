import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Clock, FileQuestion, PlayCircle, Trophy } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { TERMINAL_ATTEMPT_STATUSES, TEST_CATEGORY_LABELS, type TestCategory } from '@/lib/enums';
import { formatDate, formatDuration, ordinal } from '@/lib/utils';
import { enforceStudent } from '@/server/auth/guards';
import { db } from '@/server/db';

export const metadata: Metadata = {
  title: 'My tests',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function MyTestsPage() {
  const user = await enforceStudent('/my-tests');

  const [inProgress, completed, available] = await Promise.all([
    db.testAttempt.findMany({
      where: { userId: user.id, status: 'IN_PROGRESS', expiresAt: { gt: new Date() } },
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        startedAt: true,
        expiresAt: true,
        test: { select: { title: true, totalQuestions: true, durationMinutes: true } },
      },
    }),
    db.testAttempt.findMany({
      where: { userId: user.id, status: { in: [...TERMINAL_ATTEMPT_STATUSES] } },
      orderBy: { submittedAt: 'desc' },
      take: 25,
      select: {
        id: true,
        score: true,
        maxScore: true,
        percentage: true,
        accuracy: true,
        rank: true,
        percentile: true,
        timeSpentSeconds: true,
        submittedAt: true,
        attemptNumber: true,
        test: { select: { id: true, title: true, category: true } },
      },
    }),
    // Free tests are all that can be opened until the commerce phase lands;
    // advertising a paid test the student cannot start would be worse than
    // showing a shorter list.
    db.test.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        accessType: 'FREE',
        OR: [{ startDate: null }, { startDate: { lte: new Date() } }],
      },
      orderBy: [{ publishedAt: 'desc' }],
      take: 12,
      select: {
        id: true,
        title: true,
        category: true,
        durationMinutes: true,
        totalQuestions: true,
        totalMarks: true,
        maxAttempts: true,
        exam: { select: { shortName: true } },
        _count: { select: { attempts: { where: { userId: user.id } } } },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">My tests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything you have attempted, and everything you can start right now.
        </p>
      </header>

      {/* Resume -------------------------------------------------------- */}
      {inProgress.length > 0 && (
        <section aria-labelledby="in-progress-heading">
          <h2 id="in-progress-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            In progress
          </h2>

          <div className="mt-3 space-y-3">
            {inProgress.map((attempt) => (
              <Card key={attempt.id} variant="accent">
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3.5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <PlayCircle className="size-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-semibold leading-tight">{attempt.test.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Started {formatDate(attempt.startedAt, 'full')} · your answers are saved
                      </p>
                    </div>
                  </div>
                  <Button asChild className="shrink-0">
                    <Link href={`/test/${attempt.id}`}>
                      Resume
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Available ------------------------------------------------------ */}
      <section aria-labelledby="available-heading">
        <h2 id="available-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Available to attempt
        </h2>

        {available.length === 0 ? (
          <EmptyState
            className="mt-3"
            size="sm"
            icon={FileQuestion}
            title="No tests available right now"
            description="New tests appear here as soon as they are published."
            action={{ label: 'Browse test series', href: '/test-series' }}
          />
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((test) => {
              const used = test._count.attempts;
              const exhausted = test.maxAttempts > 0 && used >= test.maxAttempts;

              return (
                <Card key={test.id} interactive={!exhausted} className="h-full">
                  <CardContent className="flex h-full flex-col p-5">
                    <div className="flex items-center gap-2">
                      <Badge variant="brand" size="sm">
                        {test.exam.shortName}
                      </Badge>
                      <Badge variant="muted" size="sm">
                        {TEST_CATEGORY_LABELS[test.category as TestCategory] ?? test.category}
                      </Badge>
                    </div>

                    <h3 className="mt-3 flex-1 font-semibold leading-snug tracking-tight">
                      {test.title}
                    </h3>

                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3.5" aria-hidden="true" />
                        {formatDuration(test.durationMinutes * 60)}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileQuestion className="size-3.5" aria-hidden="true" />
                        {test.totalQuestions} questions
                      </span>
                      <span className="flex items-center gap-1">
                        <Trophy className="size-3.5" aria-hidden="true" />
                        {test.totalMarks} marks
                      </span>
                    </p>

                    <Button
                      asChild={!exhausted}
                      fullWidth
                      className="mt-4"
                      variant={used > 0 ? 'outline' : 'default'}
                      disabled={exhausted}
                    >
                      {exhausted ? (
                        <span>Attempts used</span>
                      ) : (
                        <Link href={`/test/${test.id}`}>
                          {used > 0 ? 'Attempt again' : 'Start test'}
                        </Link>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* History -------------------------------------------------------- */}
      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Completed
        </h2>

        {completed.length === 0 ? (
          <EmptyState
            className="mt-3"
            size="sm"
            icon={Trophy}
            title="No completed tests yet"
            description="Once you submit a test, your score, rank and full analysis appear here."
          />
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
            <div className="divide-y divide-border">
              {completed.map((attempt) => (
                <Link
                  key={attempt.id}
                  href={`/test/${attempt.id}/result`}
                  className="group flex items-center gap-4 p-4 transition-colors hover:bg-muted/40 sm:p-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium leading-tight transition-colors group-hover:text-primary">
                      {attempt.test.title}
                      {attempt.attemptNumber > 1 && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          Attempt {attempt.attemptNumber}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(attempt.submittedAt, 'short')} ·{' '}
                      {formatDuration(attempt.timeSpentSeconds)} · {attempt.accuracy}% accuracy
                    </p>
                  </div>

                  <div className="hidden shrink-0 text-right sm:block">
                    {attempt.rank != null && (
                      <p className="text-sm font-medium tabular-nums">{ordinal(attempt.rank)}</p>
                    )}
                    {attempt.percentile != null && (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {attempt.percentile} percentile
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="font-semibold tabular-nums">
                      {attempt.score}
                      <span className="text-sm font-normal text-muted-foreground">
                        /{attempt.maxScore}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {attempt.percentage}%
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
