import 'server-only';

import { cache } from 'react';

import { TERMINAL_ATTEMPT_STATUSES } from '@/lib/enums';
import { average, round, safeDivide } from '@/lib/utils';
import { db } from '@/server/db';

/**
 * Cohort analytics for a submitted attempt.
 *
 * Everything here is computed from real attempts at the same test. Where the
 * cohort is too small for a comparison to mean anything, the figures are
 * returned with `hasCohort: false` so the UI can say so rather than telling a
 * student they "scored better than 0% of attempts" when they are simply first.
 */

/** Below this many attempts, a percentile comparison is noise, not signal. */
const MIN_COHORT_FOR_COMPARISON = 5;

export interface MarksBreakdown {
  /** Positive marks from correct answers. */
  earned: number;
  /** Marks lost to negative marking, as a negative number. */
  lost: number;
  /** earned + lost, floored at zero, which is what is reported as the score. */
  net: number;
  maxScore: number;
}

export interface ScoreBucket {
  label: string;
  from: number;
  to: number;
  count: number;
  /** True for the bucket this attempt falls into. */
  isYou: boolean;
}

export interface AttemptComparison {
  hasCohort: boolean;
  yourScore: number;
  averageScore: number;
  bestScore: number;
  totalAttempts: number;
  uniqueParticipants: number;
  /** Percentage of attempts scoring strictly below this one. */
  betterThanPercent: number;
  distribution: ScoreBucket[];
}

/**
 * Splits an attempt's marks into what was earned and what was lost.
 *
 * Students consistently misread a single net figure — showing "+4.00 earned,
 * −1.32 lost" makes the cost of guessing legible in a way "2.68" never does.
 */
export const getMarksBreakdown = cache(async (attemptId: string): Promise<MarksBreakdown> => {
  const rows = await db.testAnswer.findMany({
    where: { attemptId },
    select: { marksAwarded: true },
  });

  const attempt = await db.testAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    select: { maxScore: true },
  });

  let earned = 0;
  let lost = 0;
  for (const row of rows) {
    if (row.marksAwarded > 0) earned += row.marksAwarded;
    else lost += row.marksAwarded;
  }

  return {
    earned: round(earned, 2),
    lost: round(lost, 2),
    net: round(Math.max(0, earned + lost), 2),
    maxScore: round(attempt.maxScore, 2),
  };
});

/**
 * Where this attempt sits among everyone who has taken the same test.
 *
 * The distribution is bucketed into ten equal bands of the maximum score, which
 * is how every exam platform presents it and keeps the histogram readable
 * regardless of whether the paper is out of 10 or 200.
 */
export const getAttemptComparison = cache(
  async (testId: string, attemptId: string): Promise<AttemptComparison> => {
    const attempts = await db.testAttempt.findMany({
      where: { testId, status: { in: [...TERMINAL_ATTEMPT_STATUSES] } },
      select: { id: true, userId: true, score: true, maxScore: true },
    });

    const mine = attempts.find((a) => a.id === attemptId);
    const yourScore = mine?.score ?? 0;
    const maxScore = mine?.maxScore ?? 0;

    const scores = attempts.map((a) => a.score);
    const uniqueParticipants = new Set(attempts.map((a) => a.userId)).size;

    const below = scores.filter((s) => s < yourScore).length;
    const betterThanPercent = round(safeDivide(below, scores.length) * 100, 0);

    // Ten equal bands across the paper's maximum.
    const bucketCount = 10;
    const bandSize = maxScore > 0 ? maxScore / bucketCount : 1;

    const distribution: ScoreBucket[] = Array.from({ length: bucketCount }, (_, index) => {
      const from = round(index * bandSize, 2);
      const to = round((index + 1) * bandSize, 2);

      // The top band is inclusive of the maximum so a perfect score has a home.
      const inBucket = (value: number) =>
        index === bucketCount - 1 ? value >= from && value <= to : value >= from && value < to;

      return {
        label: `${Math.round(from)}–${Math.round(to)}`,
        from,
        to,
        count: scores.filter(inBucket).length,
        isYou: inBucket(yourScore),
      };
    });

    return {
      hasCohort: attempts.length >= MIN_COHORT_FOR_COMPARISON,
      yourScore: round(yourScore, 2),
      averageScore: round(average(scores), 2),
      bestScore: scores.length > 0 ? round(Math.max(...scores), 2) : 0,
      totalAttempts: attempts.length,
      uniqueParticipants,
      betterThanPercent,
      distribution,
    };
  },
);

/**
 * How many attempts the student has left on this test.
 * `remaining: null` means the test allows unlimited re-attempts.
 */
export const getRetakeAllowance = cache(async (testId: string, userId: string) => {
  const [test, used] = await Promise.all([
    db.test.findUniqueOrThrow({ where: { id: testId }, select: { maxAttempts: true } }),
    db.testAttempt.count({
      where: { testId, userId, status: { in: [...TERMINAL_ATTEMPT_STATUSES] } },
    }),
  ]);

  return {
    used,
    max: test.maxAttempts,
    remaining: test.maxAttempts === 0 ? null : Math.max(0, test.maxAttempts - used),
    canRetake: test.maxAttempts === 0 || used < test.maxAttempts,
  };
});
