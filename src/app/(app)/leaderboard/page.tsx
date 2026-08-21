import type { Metadata } from 'next';
import Link from 'next/link';
import { Award, Crown, Medal, Trophy } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { UserAvatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/states';
import { TERMINAL_ATTEMPT_STATUSES } from '@/lib/enums';
import { cn, formatDate, ordinal, round } from '@/lib/utils';
import { enforceStudent } from '@/server/auth/guards';
import { db } from '@/server/db';

export const metadata: Metadata = {
  title: 'Leaderboard',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Leaderboard.
 *
 * Privacy is the governing constraint: a student appears only if they have not
 * opted out, and they are shown by their chosen display name rather than the
 * name on their account. Email addresses are never selected, so they cannot
 * leak into the payload even accidentally.
 *
 * Ranking is by best score, with the faster attempt winning a tie — the same
 * rule real exams use.
 */
export default async function LeaderboardPage() {
  const user = await enforceStudent('/leaderboard');

  const attempts = await db.testAttempt.findMany({
    where: {
      status: { in: [...TERMINAL_ATTEMPT_STATUSES] },
      user: {
        deletedAt: null,
        role: 'STUDENT',
        // Respect the opt-out. A missing profile row counts as visible, which
        // matches the default on the profile itself.
        OR: [{ studentProfile: { leaderboardVisible: true } }, { studentProfile: null }],
      },
    },
    orderBy: [{ score: 'desc' }, { timeSpentSeconds: 'asc' }],
    take: 200,
    select: {
      id: true,
      userId: true,
      score: true,
      maxScore: true,
      percentage: true,
      accuracy: true,
      timeSpentSeconds: true,
      submittedAt: true,
      user: {
        select: {
          name: true,
          avatarUrl: true,
          studentProfile: { select: { displayName: true, city: true } },
        },
      },
      test: { select: { title: true } },
    },
  });

  // One row per student — their single best attempt across all tests.
  const bestByUser = new Map<string, (typeof attempts)[number]>();
  for (const attempt of attempts) {
    const existing = bestByUser.get(attempt.userId);
    if (!existing || attempt.score > existing.score) bestByUser.set(attempt.userId, attempt);
  }

  const rows = [...bestByUser.values()]
    .sort((a, b) => b.score - a.score || a.timeSpentSeconds - b.timeSpentSeconds)
    .slice(0, 50);

  const myRank = rows.findIndex((row) => row.userId === user.id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Leaderboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ranked by best score across all tests. Ties are broken by the faster attempt.
        </p>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No ranked attempts yet"
          description="Be the first to submit a test and take the top spot."
          action={{ label: 'Find a test', href: '/my-tests' }}
        />
      ) : (
        <>
          {myRank === -1 && (
            <Card variant="accent">
              <CardContent className="flex items-center gap-3.5 p-5">
                <Award className="size-5 shrink-0 text-primary" aria-hidden="true" />
                <p className="text-sm">
                  You are not on the board yet.{' '}
                  <Link href="/my-tests" className="font-medium text-primary underline underline-offset-4">
                    Submit a test
                  </Link>{' '}
                  to claim a rank.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              <ol className="divide-y divide-border">
                {rows.map((row, index) => {
                  const rank = index + 1;
                  const isMe = row.userId === user.id;
                  const displayName =
                    row.user.studentProfile?.displayName?.trim() || row.user.name;

                  return (
                    <li
                      key={row.id}
                      className={cn(
                        'flex items-center gap-4 px-4 py-3.5 sm:px-5',
                        isMe && 'bg-primary-muted/50',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums',
                          rank === 1 && 'bg-warning/15 text-warning',
                          rank === 2 && 'bg-muted-foreground/15 text-muted-foreground',
                          rank === 3 && 'bg-accent/15 text-accent',
                          rank > 3 && 'bg-muted text-muted-foreground',
                        )}
                      >
                        {rank === 1 ? (
                          <Crown className="size-4" aria-hidden="true" />
                        ) : rank <= 3 ? (
                          <Medal className="size-4" aria-hidden="true" />
                        ) : (
                          rank
                        )}
                        <span className="sr-only">{ordinal(rank)}</span>
                      </span>

                      <UserAvatar
                        name={displayName}
                        src={row.user.avatarUrl}
                        className="size-9 shrink-0"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate font-medium leading-tight">
                          {displayName}
                          {isMe && (
                            <Badge variant="brand" size="sm">
                              You
                            </Badge>
                          )}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {row.test.title} · {formatDate(row.submittedAt, 'short')}
                        </p>
                      </div>

                      <div className="hidden shrink-0 text-right sm:block">
                        <p className="text-sm font-medium tabular-nums">{round(row.accuracy, 0)}%</p>
                        <p className="text-xs text-muted-foreground">accuracy</p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="font-semibold tabular-nums">
                          {row.score}
                          <span className="text-sm font-normal text-muted-foreground">
                            /{row.maxScore}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {round(row.percentage, 0)}%
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Students who have turned off leaderboard visibility in their profile settings are not
            listed. You can change this at any time from your profile.
          </p>
        </>
      )}
    </div>
  );
}
