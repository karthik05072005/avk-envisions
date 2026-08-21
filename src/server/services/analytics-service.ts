import 'server-only';

import { cache } from 'react';

import { TERMINAL_ATTEMPT_STATUSES } from '@/lib/enums';
import { round, safeDivide } from '@/lib/utils';
import { db } from '@/server/db';

/**
 * Performance analytics.
 *
 * Computed live from the answer tables rather than from denormalised
 * `TopicPerformance` / `SubjectPerformance` rows. Those tables exist in the
 * schema for a future rollup job, but reading them today would report zeroes
 * for everyone, and a dashboard that quietly under-reports is worse than one
 * that costs an extra query. At the current scale the live join is cheap;
 * revisit if a single student ever accumulates tens of thousands of answers.
 *
 * Both test and practice answers are included: a topic you keep missing in
 * practice is just as much a weakness as one you miss in a mock.
 */

/**
 * Minimum answers on a topic before it may be labelled weak or strong.
 * Below this, one bad session would send a student to revise something they
 * already know.
 */
export const MIN_ANSWERS_FOR_VERDICT = 8;
const WEAK_THRESHOLD = 50;
const STRONG_THRESHOLD = 75;

interface RawAnswer {
  isCorrect: boolean | null;
  timeSpentSeconds: number;
  question: {
    difficulty: string;
    subject: { id: string; name: string; colorHex: string | null } | null;
    chapter: { id: string; name: string } | null;
    topic: { id: string; name: string } | null;
  };
}

/** Every marked answer the student has produced, from both modes. */
const loadAnswers = cache(async (userId: string): Promise<RawAnswer[]> => {
  const questionSelect = {
    difficulty: true,
    subject: { select: { id: true, name: true, colorHex: true } },
    chapter: { select: { id: true, name: true } },
    topic: { select: { id: true, name: true } },
  } as const;

  const [testAnswers, practiceAnswers] = await Promise.all([
    db.testAnswer.findMany({
      where: {
        attempt: { userId, status: { in: [...TERMINAL_ATTEMPT_STATUSES] } },
        // Unanswered questions carry no signal about what the student knows.
        isCorrect: { not: null },
      },
      select: {
        isCorrect: true,
        timeSpentSeconds: true,
        question: { select: questionSelect },
      },
    }),
    db.practiceAnswer.findMany({
      where: { session: { userId }, isCorrect: { not: null } },
      select: {
        isCorrect: true,
        timeSpentSeconds: true,
        question: { select: questionSelect },
      },
    }),
  ]);

  return [...testAnswers, ...practiceAnswers];
});

export interface PerformanceRow {
  id: string;
  name: string;
  colorHex?: string | null;
  total: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  avgTimeSeconds: number;
  /** True once there is enough evidence to state a verdict. */
  isReliable: boolean;
}

function aggregate(
  answers: RawAnswer[],
  keyOf: (a: RawAnswer) => { id: string; name: string; colorHex?: string | null } | null,
): PerformanceRow[] {
  const groups = new Map<string, PerformanceRow & { totalTime: number }>();

  for (const answer of answers) {
    const key = keyOf(answer);
    if (!key) continue;

    let row = groups.get(key.id);
    if (!row) {
      row = {
        id: key.id,
        name: key.name,
        colorHex: key.colorHex ?? null,
        total: 0,
        correct: 0,
        incorrect: 0,
        accuracy: 0,
        avgTimeSeconds: 0,
        isReliable: false,
        totalTime: 0,
      };
      groups.set(key.id, row);
    }

    row.total += 1;
    row.totalTime += answer.timeSpentSeconds;
    if (answer.isCorrect) row.correct += 1;
    else row.incorrect += 1;
  }

  return [...groups.values()]
    .map(({ totalTime, ...row }) => ({
      ...row,
      accuracy: round(safeDivide(row.correct, row.total) * 100, 1),
      avgTimeSeconds: round(safeDivide(totalTime, row.total), 1),
      isReliable: row.total >= MIN_ANSWERS_FOR_VERDICT,
    }))
    .sort((a, b) => b.total - a.total);
}

export const getSubjectPerformance = cache(async (userId: string) =>
  aggregate(await loadAnswers(userId), (a) =>
    a.question.subject
      ? {
          id: a.question.subject.id,
          name: a.question.subject.name,
          colorHex: a.question.subject.colorHex,
        }
      : null,
  ),
);

export const getChapterPerformance = cache(async (userId: string) =>
  aggregate(await loadAnswers(userId), (a) =>
    a.question.chapter ? { id: a.question.chapter.id, name: a.question.chapter.name } : null,
  ),
);

export const getTopicPerformance = cache(async (userId: string) =>
  aggregate(await loadAnswers(userId), (a) =>
    a.question.topic ? { id: a.question.topic.id, name: a.question.topic.name } : null,
  ),
);

export const getDifficultyPerformance = cache(async (userId: string) => {
  const rows = aggregate(await loadAnswers(userId), (a) => ({
    id: a.question.difficulty,
    name: a.question.difficulty,
  }));

  // Present in exam order, not by volume.
  const order = ['EASY', 'MEDIUM', 'HARD'];
  return rows.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
});

/**
 * Weak and strong topics.
 *
 * Only topics with enough evidence are classified; everything else is counted
 * as "still gathering data" so the UI can say so honestly rather than implying
 * the student has no weaknesses.
 */
export const getTopicVerdicts = cache(async (userId: string) => {
  const topics = await getTopicPerformance(userId);
  const reliable = topics.filter((t) => t.isReliable);

  return {
    weak: reliable
      .filter((t) => t.accuracy < WEAK_THRESHOLD)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 8),
    strong: reliable
      .filter((t) => t.accuracy >= STRONG_THRESHOLD)
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 8),
    analysedCount: reliable.length,
    pendingCount: topics.length - reliable.length,
    minAnswers: MIN_ANSWERS_FOR_VERDICT,
  };
});

/** Score, accuracy and percentile across submitted attempts, oldest first. */
export const getScoreTrend = cache(async (userId: string, limit = 15) => {
  const attempts = await db.testAttempt.findMany({
    where: { userId, status: { in: [...TERMINAL_ATTEMPT_STATUSES] } },
    orderBy: { submittedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      score: true,
      maxScore: true,
      percentage: true,
      accuracy: true,
      percentile: true,
      timeSpentSeconds: true,
      submittedAt: true,
      test: { select: { title: true } },
    },
  });

  return attempts.reverse().map((a) => ({
    attemptId: a.id,
    title: a.test.title,
    date: a.submittedAt,
    score: a.score,
    maxScore: a.maxScore,
    percentage: round(a.percentage, 1),
    accuracy: round(a.accuracy, 1),
    percentile: a.percentile != null ? round(a.percentile, 1) : null,
    timeSpentSeconds: a.timeSpentSeconds,
  }));
});

/** Headline counters for the analytics page. */
export const getAnalyticsOverview = cache(async (userId: string) => {
  const answers = await loadAnswers(userId);

  const correct = answers.filter((a) => a.isCorrect).length;
  const totalTime = answers.reduce((sum, a) => sum + a.timeSpentSeconds, 0);

  const [attempts, practiceSessions] = await Promise.all([
    db.testAttempt.count({
      where: { userId, status: { in: [...TERMINAL_ATTEMPT_STATUSES] } },
    }),
    db.practiceSession.count({ where: { userId } }),
  ]);

  return {
    questionsAnswered: answers.length,
    correct,
    incorrect: answers.length - correct,
    accuracy: round(safeDivide(correct, answers.length) * 100, 1),
    avgTimeSeconds: round(safeDivide(totalTime, answers.length), 1),
    totalTimeSeconds: totalTime,
    testsCompleted: attempts,
    practiceSessions,
  };
});
