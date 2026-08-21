import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpenCheck,
  Clock,
  Flame,
  Gauge,
  PlayCircle,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/states';
import { TEST_CATEGORY_LABELS, type TestCategory } from '@/lib/enums';
import { formatDate, formatDuration, formatNumber, ordinal } from '@/lib/utils';
import { enforceStudent } from '@/server/auth/guards';
import {
  buildRecommendations,
  getDashboardSummary,
  getRecommendedTests,
  getResumableAttempt,
  getSubjectBreakdown,
  getTopicInsights,
  getUpcomingTests,
} from '@/server/services/dashboard-service';
import { db } from '@/server/db';

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: { index: false, follow: false },
};

/** Time-of-day greeting — small touch, makes the product feel attended to. */
function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default async function DashboardPage() {
  const user = await enforceStudent();

  const [summary, resumable, insights, subjects, recommended, upcoming, incorrectCount] =
    await Promise.all([
      getDashboardSummary(user.id),
      getResumableAttempt(user.id),
      getTopicInsights(user.id),
      getSubjectBreakdown(user.id),
      getRecommendedTests(user.id),
      getUpcomingTests(),
      db.testAnswer.count({ where: { attempt: { userId: user.id }, isCorrect: false } }),
    ]);

  const isNewStudent = summary.testsAttempted === 0;

  const recommendations = buildRecommendations({
    testsAttempted: summary.testsAttempted,
    weakTopics: insights.weak,
    incorrectCount,
    resumable: Boolean(resumable),
  });

  const firstName = user.name.split(' ')[0] ?? user.name;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Greeting -------------------------------------------------------- */}
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {greeting()}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isNewStudent
            ? 'Let’s establish your baseline — one full-length test is all it takes.'
            : summary.currentStreak > 1
              ? `You’re on a ${summary.currentStreak}-day streak. Consistency is doing the work.`
              : 'Ready for your next challenge?'}
        </p>
      </header>

      {/* Resume banner --------------------------------------------------- */}
      {resumable && (
        <Card variant="accent">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <PlayCircle className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-semibold leading-tight">Test in progress</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {resumable.test.title} — your answers are saved. Time remaining is calculated on
                  our servers.
                </p>
              </div>
            </div>
            <Button asChild className="shrink-0">
              <Link href={`/test/${resumable.id}`}>
                Resume test
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats ------------------------------------------------------------ */}
      <section aria-label="Your performance">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Tests attempted"
            value={summary.testsAttempted}
            icon={BookOpenCheck}
            hint={isNewStudent ? 'Start with a free mock' : 'Across all exams'}
          />
          <StatCard
            label="Questions solved"
            value={formatNumber(summary.questionsSolved)}
            icon={Target}
            hint="Tests and practice combined"
          />
          <StatCard
            label="Average accuracy"
            value={summary.averageAccuracy != null ? `${summary.averageAccuracy}%` : '—'}
            icon={Gauge}
            hint={summary.averageAccuracy == null ? 'No attempts yet' : 'Of questions you answered'}
          />
          <StatCard
            label="Study streak"
            value={`${summary.currentStreak} ${summary.currentStreak === 1 ? 'day' : 'days'}`}
            icon={Flame}
            hint={summary.longestStreak > 0 ? `Best: ${summary.longestStreak} days` : 'Start today'}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column -------------------------------------------------- */}
        <div className="space-y-6 lg:col-span-2">
          {/* Recommendations */}
          <Card>
            <CardContent className="p-5 sm:p-6">
              <h2 className="font-semibold tracking-tight">Do this next</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Ordered by what will move your score most.
              </p>

              <ul className="mt-4 space-y-3">
                {recommendations.map((action, index) => (
                  <li key={action.title}>
                    <Link
                      href={action.href}
                      className="group flex items-start gap-3.5 rounded-lg border border-border p-4 transition-all hover:-translate-y-0.5 hover:shadow-card"
                    >
                      <span
                        className={
                          action.tone === 'primary'
                            ? 'flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground'
                            : 'flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground'
                        }
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-tight transition-colors group-hover:text-primary">
                          {action.title}
                        </p>
                        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                          {action.body}
                        </p>
                      </div>
                      <ArrowRight
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Subject performance */}
          <Card>
            <CardContent className="p-5 sm:p-6">
              <h2 className="font-semibold tracking-tight">Subject performance</h2>

              {subjects.length === 0 ? (
                <EmptyState
                  size="sm"
                  className="mt-4"
                  icon={Gauge}
                  title="No subject data yet"
                  description="Attempt a test and your accuracy will be broken down by subject here."
                  action={{ label: 'Browse tests', href: '/test-series' }}
                />
              ) : (
                <div className="mt-5 space-y-5">
                  {subjects.map((subject) => (
                    <div key={subject.subjectId}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{subject.name}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {subject.accuracy}%
                          <span className="ml-2 text-xs">({subject.attempts} questions)</span>
                        </span>
                      </div>
                      <Progress
                        value={subject.accuracy}
                        className="mt-2"
                        tone={
                          subject.accuracy >= 75
                            ? 'success'
                            : subject.accuracy >= 50
                              ? 'warning'
                              : 'danger'
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent attempts */}
          <Card>
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold tracking-tight">Recent attempts</h2>
                {summary.recentAttempts.length > 0 && (
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/my-tests">View all</Link>
                  </Button>
                )}
              </div>

              {summary.recentAttempts.length === 0 ? (
                <EmptyState
                  size="sm"
                  className="mt-4"
                  icon={BookOpenCheck}
                  title="No tests attempted yet"
                  description="Start your first mock test to see your performance here."
                  action={{ label: 'Find a test', href: '/test-series' }}
                />
              ) : (
                <ul className="mt-4 divide-y divide-border">
                  {summary.recentAttempts.map((attempt) => (
                    <li key={attempt.id}>
                      <Link
                        href={`/test/${attempt.id}/result`}
                        className="group flex items-center gap-4 py-3.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium leading-tight transition-colors group-hover:text-primary">
                            {attempt.test.title}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatDate(attempt.submittedAt, 'short')} ·{' '}
                            {formatDuration(attempt.timeSpentSeconds)}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="font-semibold tabular-nums">
                            {attempt.score}
                            <span className="text-sm font-normal text-muted-foreground">
                              /{attempt.maxScore}
                            </span>
                          </p>
                          {attempt.rank != null && (
                            <p className="text-xs text-muted-foreground">
                              {ordinal(attempt.rank)} rank
                            </p>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column ------------------------------------------------- */}
        <div className="space-y-6">
          {/* Weak topics */}
          <Card>
            <CardContent className="p-5 sm:p-6">
              <h2 className="font-semibold tracking-tight">Focus areas</h2>

              {insights.weak.length === 0 ? (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {insights.analysedCount === 0
                    ? 'We need a few more attempts before we can identify your weak topics honestly. A topic is only flagged once you have answered enough questions on it.'
                    : 'No weak topics right now — your analysed topics are all above 50% accuracy.'}
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {insights.weak.map((topic) => (
                    <li key={topic.topicId} className="rounded-lg border border-border p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium leading-tight">{topic.name}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {topic.subject} · {topic.chapter}
                          </p>
                        </div>
                        <Badge variant="danger" size="sm">
                          {topic.accuracy}%
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Based on {topic.attempts} questions
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              {insights.weak.length > 0 && (
                <Button asChild fullWidth variant="outline" className="mt-4">
                  <Link href="/practice">Practise these topics</Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Strong topics */}
          {insights.strong.length > 0 && (
            <Card>
              <CardContent className="p-5 sm:p-6">
                <h2 className="font-semibold tracking-tight">Your strengths</h2>
                <ul className="mt-4 space-y-2.5">
                  {insights.strong.map((topic) => (
                    <li key={topic.topicId} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm">{topic.name}</span>
                      <Badge variant="success" size="sm">
                        {topic.accuracy}%
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Recommended tests */}
          <Card>
            <CardContent className="p-5 sm:p-6">
              <h2 className="font-semibold tracking-tight">Available now</h2>

              {recommended.length === 0 ? (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  You have attempted every free test available. Explore the full test series for
                  more.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {recommended.map((test) => (
                    <li key={test.id}>
                      <Link
                        href={`/test/${test.id}`}
                        className="group block rounded-lg border border-border p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-card"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="brand" size="sm">
                            {test.exam.shortName}
                          </Badge>
                          <Badge variant="muted" size="sm">
                            {TEST_CATEGORY_LABELS[test.category as TestCategory] ?? test.category}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm font-medium leading-tight transition-colors group-hover:text-primary">
                          {test.title}
                        </p>
                        <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="size-3.5" aria-hidden="true" />
                          {test.durationMinutes} min · {test.totalQuestions} questions
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <Card>
              <CardContent className="p-5 sm:p-6">
                <h2 className="font-semibold tracking-tight">Scheduled</h2>
                <ul className="mt-4 space-y-3">
                  {upcoming.map((test) => (
                    <li key={test.id} className="text-sm">
                      <p className="font-medium leading-tight">{test.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Opens {formatDate(test.startDate, 'full')}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
