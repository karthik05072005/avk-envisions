import 'server-only';

import { cache } from 'react';

import { TERMINAL_ATTEMPT_STATUSES } from '@/lib/enums';
import { average, percentage, round } from '@/lib/utils';
import { db } from '@/server/db';

import { getSubjectPerformance, getTopicVerdicts } from './analytics-service';

/**
 * Student dashboard data.
 *
 * Written to answer one question well — "what should I do next?" — rather than
 * to fill a grid with numbers. Anything the platform cannot yet say honestly
 * (percentile with no ranked attempts, a weak topic with three data points) is
 * returned as `null` so the UI can show an empty state instead of a misleading
 * zero.
 */

/**
 * Minimum answered questions on a topic before it may be classified. Below
 * this, one bad day would brand a topic "weak" and send the student to revise
 * something they already know.
 */
const MIN_TOPIC_ATTEMPTS = 8;
const WEAK_ACCURACY_THRESHOLD = 50;
const STRONG_ACCURACY_THRESHOLD = 75;

export const getDashboardSummary = cache(async (userId: string) => {
  const [attempts, practiceAgg, streak, studyAgg] = await Promise.all([
    db.testAttempt.findMany({
      where: { userId, status: { in: [...TERMINAL_ATTEMPT_STATUSES] } },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        score: true,
        maxScore: true,
        percentage: true,
        accuracy: true,
        percentile: true,
        rank: true,
        correctCount: true,
        incorrectCount: true,
        attemptedCount: true,
        timeSpentSeconds: true,
        submittedAt: true,
        test: { select: { id: true, title: true, slug: true } },
      },
    }),
    db.practiceAnswer.aggregate({
      where: { session: { userId } },
      _count: { _all: true },
    }),
    db.streak.findUnique({
      where: { userId },
      select: { currentStreak: true, longestStreak: true, totalActiveDays: true },
    }),
    db.studySession.aggregate({
      where: { userId },
      _sum: { durationSeconds: true },
    }),
  ]);

  const testQuestionsAnswered = attempts.reduce((sum, a) => sum + a.attemptedCount, 0);
  const rankedAttempts = attempts.filter((a) => a.percentile != null);

  return {
    testsAttempted: attempts.length,
    questionsSolved: testQuestionsAnswered + practiceAgg._count._all,

    // `null` rather than 0 when there is nothing to average — the UI shows a
    // prompt to attempt a test instead of a meaningless "0%".
    averageScore: attempts.length > 0 ? round(average(attempts.map((a) => a.percentage)), 1) : null,
    averageAccuracy: attempts.length > 0 ? round(average(attempts.map((a) => a.accuracy)), 1) : null,
    averagePercentile:
      rankedAttempts.length > 0
        ? round(average(rankedAttempts.map((a) => a.percentile ?? 0)), 1)
        : null,
    bestScore: attempts.length > 0 ? round(Math.max(...attempts.map((a) => a.percentage)), 1) : null,
    latestRank: attempts.find((a) => a.rank != null)?.rank ?? null,

    currentStreak: streak?.currentStreak ?? 0,
    longestStreak: streak?.longestStreak ?? 0,
    totalStudySeconds:
      (studyAgg._sum.durationSeconds ?? 0) + attempts.reduce((s, a) => s + a.timeSpentSeconds, 0),

    /** Oldest-first, for trend charts. */
    trend: [...attempts]
      .reverse()
      .slice(-10)
      .map((a) => ({
        attemptId: a.id,
        label: a.test.title,
        date: a.submittedAt,
        score: round(a.percentage, 1),
        accuracy: round(a.accuracy, 1),
        percentile: a.percentile != null ? round(a.percentile, 1) : null,
      })),

    recentAttempts: attempts.slice(0, 5),
  };
});

/** An attempt the student left open, so the dashboard can offer "resume". */
export const getResumableAttempt = cache(async (userId: string) =>
  db.testAttempt.findFirst({
    where: { userId, status: 'IN_PROGRESS', expiresAt: { gt: new Date() } },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      startedAt: true,
      expiresAt: true,
      test: { select: { id: true, title: true, slug: true, durationMinutes: true, totalQuestions: true } },
    },
  }),
);

/**
 * Topic classification.
 *
 * Delegates to the analytics service, which computes from the answer tables
 * directly. The denormalised `TopicPerformance` rows this used to read are
 * never written by any code path, so it reported "no weak topics" to every
 * student regardless of how they were actually performing.
 */
export const getTopicInsights = cache(async (userId: string) => {
  const verdicts = await getTopicVerdicts(userId);

  const shape = (row: { id: string; name: string; accuracy: number; total: number }) => ({
    topicId: row.id,
    name: row.name,
    // Chapter and subject are not needed for the dashboard card; the full
    // hierarchy is available on /analytics.
    chapter: '',
    subject: '',
    accuracy: row.accuracy,
    attempts: row.total,
    trend: 'STABLE' as const,
  });

  return {
    weak: verdicts.weak.slice(0, 5).map(shape),
    strong: verdicts.strong.slice(0, 5).map(shape),
    /** Topics with enough answers to classify. */
    analysedCount: verdicts.analysedCount,
    /** Topics seen but not yet classifiable. */
    pendingCount: verdicts.pendingCount,
  };
});

/** Per-subject accuracy for the dashboard breakdown, computed live. */
export const getSubjectBreakdown = cache(async (userId: string) => {
  const rows = await getSubjectPerformance(userId);

  return rows.map((row) => ({
    subjectId: row.id,
    name: row.name,
    colorHex: row.colorHex ?? null,
    accuracy: row.accuracy,
    attempts: row.total,
    trend: 'STABLE' as const,
  }));
});

/**
 * Tests the student can start next.
 *
 * Free tests only at this stage — entitlement checking arrives with the
 * commerce phase, and it would be worse to advertise a test the student cannot
 * open than to under-promise here.
 */
export const getRecommendedTests = cache(async (userId: string, limit = 3) => {
  const attempted = await db.testAttempt.findMany({
    where: { userId },
    select: { testId: true },
    distinct: ['testId'],
  });
  const attemptedIds = attempted.map((a) => a.testId);

  return db.test.findMany({
    where: {
      status: 'PUBLISHED',
      deletedAt: null,
      accessType: 'FREE',
      ...(attemptedIds.length > 0 ? { id: { notIn: attemptedIds } } : {}),
      OR: [{ startDate: null }, { startDate: { lte: new Date() } }],
    },
    orderBy: [{ category: 'asc' }, { publishedAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      title: true,
      slug: true,
      category: true,
      durationMinutes: true,
      totalQuestions: true,
      totalMarks: true,
      exam: { select: { shortName: true } },
    },
  });
});

/** Tests scheduled to open in the near future. */
export const getUpcomingTests = cache(async (limit = 3) =>
  db.test.findMany({
    where: { status: 'PUBLISHED', deletedAt: null, startDate: { gt: new Date() } },
    orderBy: { startDate: 'asc' },
    take: limit,
    select: {
      id: true,
      title: true,
      slug: true,
      startDate: true,
      durationMinutes: true,
      totalQuestions: true,
    },
  }),
);

export const getUnreadNotificationCount = cache(async (userId: string) =>
  db.notification.count({ where: { userId, readAt: null } }),
);

/**
 * Builds the "do this next" list.
 *
 * Deliberately ordered by usefulness, and capped — a list of twelve
 * recommendations is the same as no recommendation.
 */
export function buildRecommendations(input: {
  testsAttempted: number;
  weakTopics: { name: string; accuracy: number }[];
  incorrectCount: number;
  resumable: boolean;
}) {
  const actions: { title: string; body: string; href: string; tone: 'primary' | 'default' }[] = [];

  if (input.resumable) {
    actions.push({
      title: 'Finish your test in progress',
      body: 'You have an attempt still open. Your answers are saved.',
      href: '/my-tests',
      tone: 'primary',
    });
  }

  if (input.testsAttempted === 0) {
    actions.push({
      title: 'Attempt your first mock test',
      body: 'One full-length attempt is enough to establish a baseline across every subject.',
      href: '/test-series',
      tone: 'primary',
    });
    return actions;
  }

  const weakest = input.weakTopics[0];
  if (weakest) {
    actions.push({
      title: `Practise ${weakest.name}`,
      body: `Your accuracy here is ${weakest.accuracy}% — the lowest of your analysed topics.`,
      href: '/practice',
      tone: 'primary',
    });
  }

  if (input.incorrectCount > 0) {
    actions.push({
      title: 'Revise questions you got wrong',
      body: `${input.incorrectCount} questions are waiting in your review list.`,
      href: '/wrong-questions',
      tone: 'default',
    });
  }

  actions.push({
    title: 'Attempt your next mock test',
    body: 'Consistent attempts are what make the trend lines meaningful.',
    href: '/test-series',
    tone: 'default',
  });

  return actions.slice(0, 3);
}
