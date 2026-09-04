import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarDays, CheckCircle2, Flame, Lock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { cn, formatDate } from '@/lib/utils';
import { getSession } from '@/server/auth/session';
import { getChallenge } from '@/server/services/daily-challenge-service';

export const metadata: Metadata = {
  title: 'KAS 50 Questions · 50 Days',
  description:
    'One 50-question KAS paper every day for fifty days, with answers and explanations as soon as you finish.',
};

export const dynamic = 'force-dynamic';

/**
 * The fifty-day challenge.
 *
 * Lives in the marketing group, not the app shell, so it is readable without an
 * account — the whole point is that someone can see the plan before committing
 * to it. Signing in adds their progress and streak.
 */
export default async function FiftyDaysPage() {
  const session = await getSession();
  const challenge = await getChallenge(session?.user.id ?? null);

  if (!challenge || !challenge.isPublished) {
    return (
      <div className="container py-16">
        <EmptyState
          icon={CalendarDays}
          title="50 Questions · 50 Days is on its way"
          description="The challenge has not opened yet. Check back shortly."
          action={{ label: 'Browse the test series', href: '/test-series' }}
        />
      </div>
    );
  }

  const today = challenge.days.find((day) => day.isToday && day.isAvailable);
  // Falls back to the most recent open day, so someone arriving late — or on a
  // day with no paper — still has something to start.
  const next =
    today ?? [...challenge.days].reverse().find((day) => day.isAvailable) ?? null;

  return (
    <div className="container max-w-5xl space-y-8 py-10 sm:py-14">
      <header className="text-center">
        <Badge variant="info">Free · no payment needed</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          KAS 50 Questions · 50 Days
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          {challenge.description ??
            'One 50-question paper every day for fifty days, right up to the exam.'}
        </p>

        <dl className="mt-6 flex flex-wrap justify-center gap-x-10 gap-y-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Papers ready</dt>
            <dd className="text-xl font-semibold tabular-nums">
              {challenge.readyCount} / {challenge.plannedCount}
            </dd>
          </div>
          {session && (
            <>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  You have finished
                </dt>
                <dd className="text-xl font-semibold tabular-nums">{challenge.completedCount}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Streak</dt>
                <dd className="flex items-center justify-center gap-1.5 text-xl font-semibold tabular-nums">
                  {challenge.currentStreak > 0 && (
                    <Flame className="size-4 text-warning" aria-hidden="true" />
                  )}
                  {challenge.currentStreak}
                </dd>
              </div>
            </>
          )}
        </dl>

        {next && (
          <Button asChild size="lg" className="mt-6">
            <Link href={`/start/${next.testId}`}>
              {next.isToday ? "Start today's paper" : `Start Day ${next.dayNumber}`}
            </Link>
          </Button>
        )}
      </header>

      {challenge.readyCount === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="The first paper is being prepared"
          description="Days appear here as they are published. Nothing to attempt just yet."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {challenge.days.map((day) => {
            const done = Boolean(day.attempt);

            return (
              <li key={day.testId}>
                <div
                  className={cn(
                    'flex h-full flex-col rounded-xl border p-4',
                    day.isToday && day.isAvailable
                      ? 'border-primary bg-primary-muted/40'
                      : 'border-border',
                    !day.isAvailable && 'opacity-60',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">Day {day.dayNumber}</span>
                    {done ? (
                      <Badge variant="success" size="sm">
                        <CheckCircle2 className="size-3" aria-hidden="true" />
                        Done
                      </Badge>
                    ) : day.isToday && day.isAvailable ? (
                      <Badge variant="info" size="sm">
                        Today
                      </Badge>
                    ) : !day.isAvailable ? (
                      <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    ) : null}
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {day.questionCount} questions · {day.durationMinutes} min
                  </p>

                  {day.attempt ? (
                    <p className="mt-2 text-sm font-medium tabular-nums">
                      {day.attempt.score} / {day.attempt.maxScore}
                    </p>
                  ) : day.opensAt && !day.isAvailable ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Opens {formatDate(day.opensAt)}
                    </p>
                  ) : null}

                  {day.isAvailable && (
                    <Button asChild size="sm" variant={done ? 'ghost' : 'default'} className="mt-3">
                      <Link href={done ? `/test/${day.testId}/result` : `/start/${day.testId}`}>
                        {done ? 'See your result' : 'Start'}
                      </Link>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
