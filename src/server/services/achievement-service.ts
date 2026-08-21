import 'server-only';

import { z } from 'zod';

import { TERMINAL_ATTEMPT_STATUSES } from '@/lib/enums';
import { parseJsonColumn } from '@/lib/json';
import { round, safeDivide } from '@/lib/utils';
import { db } from '@/server/db';
import { logger } from '@/server/logger';

/**
 * Achievements.
 *
 * Progress is derived from the student's real record every time it is read,
 * rather than incremented by scattered call sites. That costs a handful of
 * aggregate queries, but it means an achievement can never drift out of sync
 * with the record it claims to describe — and a badge that says something
 * untrue about a student's own work is worse than no badge at all.
 */

const criteriaSchema = z.object({
  metric: z.string(),
  op: z.enum(['>=', '<=', '>', '<', '==']).default('>='),
  value: z.number(),
});

type Criteria = z.infer<typeof criteriaSchema>;

/** Every metric an achievement may be defined against. */
export interface MetricSnapshot {
  tests_completed: number;
  questions_solved: number;
  accuracy_percent: number;
  streak_days: number;
  /** Lowest (best) rank achieved. Infinity when never ranked. */
  best_rank: number;
  perfect_scores: number;
  practice_sessions: number;
}

/** One pass over the student's record, shared by every achievement check. */
export async function computeMetrics(userId: string): Promise<MetricSnapshot> {
  const [attempts, practiceCount, practiceAnswers, streak] = await Promise.all([
    db.testAttempt.findMany({
      where: { userId, status: { in: [...TERMINAL_ATTEMPT_STATUSES] } },
      select: {
        score: true,
        maxScore: true,
        rank: true,
        correctCount: true,
        attemptedCount: true,
      },
    }),
    db.practiceSession.count({ where: { userId } }),
    db.practiceAnswer.count({ where: { session: { userId }, isCorrect: { not: null } } }),
    db.streak.findUnique({
      where: { userId },
      select: { currentStreak: true, longestStreak: true },
    }),
  ]);

  const correct =
    attempts.reduce((sum, a) => sum + a.correctCount, 0) +
    (await db.practiceAnswer.count({ where: { session: { userId }, isCorrect: true } }));
  const answered = attempts.reduce((sum, a) => sum + a.attemptedCount, 0) + practiceAnswers;

  const ranks = attempts.map((a) => a.rank).filter((r): r is number => r != null);

  return {
    tests_completed: attempts.length,
    questions_solved: answered,
    accuracy_percent: round(safeDivide(correct, answered) * 100, 1),
    // Longest streak, not current: an achievement once earned is not revoked
    // because the student took a week off.
    streak_days: streak?.longestStreak ?? 0,
    best_rank: ranks.length > 0 ? Math.min(...ranks) : Number.POSITIVE_INFINITY,
    perfect_scores: attempts.filter((a) => a.maxScore > 0 && a.score >= a.maxScore).length,
    practice_sessions: practiceCount,
  };
}

function satisfies(criteria: Criteria, metrics: MetricSnapshot): boolean {
  const actual = metrics[criteria.metric as keyof MetricSnapshot];
  if (actual === undefined) return false;

  switch (criteria.op) {
    case '>=':
      return actual >= criteria.value;
    case '<=':
      return actual <= criteria.value;
    case '>':
      return actual > criteria.value;
    case '<':
      return actual < criteria.value;
    case '==':
      return actual === criteria.value;
    default:
      return false;
  }
}

/** 0-100 progress towards a criterion, for the progress bar on locked badges. */
function progressPercent(criteria: Criteria, metrics: MetricSnapshot): number {
  const actual = metrics[criteria.metric as keyof MetricSnapshot];
  if (actual === undefined || !Number.isFinite(actual)) return 0;

  // "Lower is better" criteria (best rank) cannot be expressed as a simple
  // ratio, so they read as all-or-nothing rather than as a misleading fraction.
  if (criteria.op === '<=' || criteria.op === '<') {
    return satisfies(criteria, metrics) ? 100 : 0;
  }

  if (criteria.value <= 0) return 100;
  return round(Math.min(100, (actual / criteria.value) * 100), 0);
}

export interface AchievementView {
  id: string;
  key: string;
  name: string;
  description: string;
  iconName: string;
  category: string;
  tier: string;
  points: number;
  unlocked: boolean;
  unlockedAt: Date | null;
  progress: number;
  /** Human-readable current standing, e.g. "7 / 10 tests". */
  progressLabel: string;
}

const METRIC_NOUNS: Record<string, string> = {
  tests_completed: 'tests',
  questions_solved: 'questions',
  accuracy_percent: '% accuracy',
  streak_days: 'days',
  best_rank: 'best rank',
  perfect_scores: 'perfect scores',
  practice_sessions: 'sessions',
};

/**
 * Evaluates every achievement, unlocking any newly earned, and returns the
 * full list with progress for display.
 *
 * Unlocking is a side effect of reading, which keeps badges correct without a
 * background job. Writes are best-effort: a failure to record an unlock must
 * not stop the page rendering.
 */
export async function getAchievements(userId: string): Promise<{
  achievements: AchievementView[];
  totalPoints: number;
  unlockedCount: number;
  newlyUnlocked: AchievementView[];
}> {
  const [definitions, existing, metrics] = await Promise.all([
    db.achievement.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { points: 'asc' }],
    }),
    db.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true, unlockedAt: true },
    }),
    computeMetrics(userId),
  ]);

  const unlockedMap = new Map(existing.map((row) => [row.achievementId, row.unlockedAt]));
  const toUnlock: string[] = [];

  const achievements: AchievementView[] = definitions.map((definition) => {
    // An unparseable criterion must never award a badge, so the fallback is
    // one that can never be satisfied.
    const fallback: Criteria = { metric: 'unknown', op: '>=', value: Number.POSITIVE_INFINITY };
    const criteria = parseJsonColumn(definition.criteriaJson, criteriaSchema, fallback);

    const alreadyUnlocked = unlockedMap.has(definition.id);
    const earned = alreadyUnlocked || satisfies(criteria, metrics);

    if (earned && !alreadyUnlocked) toUnlock.push(definition.id);

    const actual = metrics[criteria.metric as keyof MetricSnapshot];
    const noun = METRIC_NOUNS[criteria.metric] ?? '';

    return {
      id: definition.id,
      key: definition.key,
      name: definition.name,
      description: definition.description,
      iconName: definition.iconName,
      category: definition.category,
      tier: definition.tier,
      points: definition.points,
      unlocked: earned,
      unlockedAt: unlockedMap.get(definition.id) ?? null,
      progress: earned ? 100 : progressPercent(criteria, metrics),
      progressLabel:
        actual === undefined || !Number.isFinite(actual)
          ? 'Not started'
          : criteria.metric === 'best_rank'
            ? `Best rank ${actual}`
            : `${Math.min(actual, criteria.value)} / ${criteria.value} ${noun}`.trim(),
    };
  });

  // Record new unlocks. Best-effort: never block the page on this write.
  let newlyUnlocked: AchievementView[] = [];
  if (toUnlock.length > 0) {
    try {
      await db.userAchievement.createMany({
        data: toUnlock.map((achievementId) => ({ userId, achievementId, progress: 100 })),
      });
      newlyUnlocked = achievements.filter((a) => toUnlock.includes(a.id));
      logger.info({ userId, count: toUnlock.length }, 'Achievements unlocked');
    } catch (error) {
      logger.warn({ error, userId }, 'Failed to record achievement unlocks');
    }
  }

  const unlocked = achievements.filter((a) => a.unlocked);

  return {
    achievements,
    totalPoints: unlocked.reduce((sum, a) => sum + a.points, 0),
    unlockedCount: unlocked.length,
    newlyUnlocked,
  };
}
