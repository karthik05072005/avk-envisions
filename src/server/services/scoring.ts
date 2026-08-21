import { OPTION_BASED_TYPES, type QuestionType } from '@/lib/enums';
import { percentage, round, safeDivide } from '@/lib/utils';

/**
 * Scoring engine.
 *
 * Deliberately pure: no database, no I/O, no clock. Every function takes plain
 * data and returns plain data, so the marking rules — the part of an exam
 * platform where a bug is least forgivable — can be unit tested exhaustively
 * without a fixture database.
 *
 * All marks arithmetic is rounded to two decimals at the point of award, so
 * fractional negative marking (0.25, 1/3) cannot accumulate floating-point
 * drift across a 180-question paper.
 */

/** The answer key for one question, taken from the attempt snapshot / database. */
export interface QuestionKey {
  questionId: string;
  type: QuestionType;
  marks: number;
  negativeMarks: number;
  /** Ids of every option flagged correct. Empty for numerical questions. */
  correctOptionIds: string[];
  /** Expected value for NUMERICAL questions. */
  numericalAnswer?: number | null;
  /** Inclusive tolerance either side of `numericalAnswer`. */
  numericalTolerance?: number | null;
}

/** What the student actually submitted for one question. */
export interface SubmittedAnswer {
  selectedOptionIds: string[];
  numericalValue?: number | null;
}

export type AnswerVerdict = 'CORRECT' | 'INCORRECT' | 'UNANSWERED';

export interface EvaluatedAnswer {
  verdict: AnswerVerdict;
  isCorrect: boolean | null;
  marksAwarded: number;
}

/**
 * Marking scheme for multiple-correct questions.
 *
 * EXACT   — full marks only for selecting every correct option and nothing
 *           else. Anything else is wrong. This is the KCET/KAS convention and
 *           the platform default.
 * PARTIAL — JEE Advanced style: marks for each correct option chosen provided
 *           no incorrect option is chosen; any incorrect selection scores the
 *           full negative.
 */
export type MultiSelectScheme = 'EXACT' | 'PARTIAL';

export interface ScoringOptions {
  multiSelectScheme?: MultiSelectScheme;
  /** When false, incorrect answers score 0 instead of the negative value. */
  negativeMarkingEnabled?: boolean;
}

/** True when the student left the question genuinely untouched. */
function isUnanswered(answer: SubmittedAnswer | undefined, type: QuestionType): boolean {
  if (!answer) return true;

  if (type === 'NUMERICAL') {
    return answer.numericalValue === null || answer.numericalValue === undefined;
  }
  return answer.selectedOptionIds.length === 0;
}

/**
 * Evaluates a single answer against its key.
 *
 * An unanswered question always scores exactly zero — never a negative. This is
 * the one rule that must never bend: penalising a blank would change the
 * expected value of skipping and silently invalidate every student's strategy.
 */
export function evaluateAnswer(
  key: QuestionKey,
  answer: SubmittedAnswer | undefined,
  options: ScoringOptions = {},
): EvaluatedAnswer {
  const { multiSelectScheme = 'EXACT', negativeMarkingEnabled = true } = options;

  if (isUnanswered(answer, key.type)) {
    return { verdict: 'UNANSWERED', isCorrect: null, marksAwarded: 0 };
  }

  const penalty = negativeMarkingEnabled ? -Math.abs(key.negativeMarks) : 0;
  const wrong: EvaluatedAnswer = {
    verdict: 'INCORRECT',
    isCorrect: false,
    marksAwarded: round(penalty, 2),
  };
  const right: EvaluatedAnswer = {
    verdict: 'CORRECT',
    isCorrect: true,
    marksAwarded: round(key.marks, 2),
  };

  // --- Numerical --------------------------------------------------------
  if (key.type === 'NUMERICAL') {
    const expected = key.numericalAnswer;
    const submitted = answer!.numericalValue;

    // A numerical question with no key cannot be marked; award nothing rather
    // than guessing. Surfaced to admins by the question-quality report.
    if (expected === null || expected === undefined) {
      return { verdict: 'UNANSWERED', isCorrect: null, marksAwarded: 0 };
    }

    const tolerance = Math.abs(key.numericalTolerance ?? 0);
    const withinTolerance = Math.abs((submitted as number) - expected) <= tolerance + Number.EPSILON;

    return withinTolerance ? right : wrong;
  }

  // --- Option based -----------------------------------------------------
  if (!OPTION_BASED_TYPES.includes(key.type)) {
    // Unknown/unsupported type: never award marks silently.
    return { verdict: 'UNANSWERED', isCorrect: null, marksAwarded: 0 };
  }

  const correct = new Set(key.correctOptionIds);
  const selected = new Set(answer!.selectedOptionIds);

  // A question with no correct option marked is unmarkable.
  if (correct.size === 0) {
    return { verdict: 'UNANSWERED', isCorrect: null, marksAwarded: 0 };
  }

  const chosenCorrect = [...selected].filter((id) => correct.has(id)).length;
  const chosenIncorrect = selected.size - chosenCorrect;

  if (key.type !== 'MULTIPLE_CORRECT' || multiSelectScheme === 'EXACT') {
    const exact = chosenIncorrect === 0 && chosenCorrect === correct.size;
    return exact ? right : wrong;
  }

  // PARTIAL scheme.
  if (chosenIncorrect > 0) return wrong;
  if (chosenCorrect === correct.size) return right;

  const partial = key.marks * safeDivide(chosenCorrect, correct.size);
  return { verdict: 'CORRECT', isCorrect: false, marksAwarded: round(partial, 2) };
}

// ---------------------------------------------------------------------------
// Attempt-level aggregation
// ---------------------------------------------------------------------------

export interface AttemptTotals {
  score: number;
  maxScore: number;
  percentage: number;
  /** Correct as a share of *attempted*, not of total. */
  accuracy: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  attemptedCount: number;
  totalQuestions: number;
}

/**
 * Totals an evaluated attempt.
 *
 * `score` is floored at zero: negative marking can drive a raw total below
 * zero, and reporting "−3 / 60" to a student is both demoralising and outside
 * how every real exam publishes results. The raw value stays available in the
 * per-question breakdown.
 */
export function totalAttempt(
  results: { evaluated: EvaluatedAnswer; maxMarks: number }[],
): AttemptTotals {
  let rawScore = 0;
  let maxScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  for (const { evaluated, maxMarks } of results) {
    rawScore += evaluated.marksAwarded;
    maxScore += maxMarks;

    if (evaluated.verdict === 'UNANSWERED') unansweredCount += 1;
    else if (evaluated.isCorrect) correctCount += 1;
    else incorrectCount += 1;
  }

  const attemptedCount = correctCount + incorrectCount;
  const score = round(Math.max(0, rawScore), 2);

  return {
    score,
    maxScore: round(maxScore, 2),
    percentage: percentage(score, maxScore),
    accuracy: round(safeDivide(correctCount, attemptedCount) * 100, 1),
    correctCount,
    incorrectCount,
    unansweredCount,
    attemptedCount,
    totalQuestions: results.length,
  };
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

/**
 * Percentile of a score within a cohort.
 *
 * Uses the formula Indian competitive exams actually publish (the NTA
 * definition): the share of candidates scoring **equal to or below** you,
 * inclusive of yourself.
 *
 *     percentile = (candidates scoring <= yours) / total * 100
 *
 * Counting *strictly* below instead is a subtly wrong variant that can never
 * award 100 and reports the top scorer in a one-person cohort as 0 — which is
 * both mathematically defensible and completely useless to a student.
 *
 * The top score therefore always yields 100, and a lone attempt yields 100.
 */
export function computePercentile(score: number, allScores: number[]): number {
  if (allScores.length === 0) return 100;
  const atOrBelow = allScores.filter((s) => s <= score).length;
  return round(safeDivide(atOrBelow, allScores.length) * 100, 2);
}

/**
 * Competition ranking (1224): equal scores share a rank, and the next distinct
 * score skips accordingly. Two students on 58 are both 2nd; the next is 4th.
 */
export function computeRank(score: number, allScores: number[]): number {
  return allScores.filter((s) => s > score).length + 1;
}

// ---------------------------------------------------------------------------
// Breakdowns
// ---------------------------------------------------------------------------

export interface BreakdownInput {
  groupKey: string;
  groupLabel: string;
  evaluated: EvaluatedAnswer;
  maxMarks: number;
  timeSpentSeconds: number;
}

export interface BreakdownRow {
  key: string;
  label: string;
  total: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  attempted: number;
  score: number;
  maxScore: number;
  accuracy: number;
  timeSpentSeconds: number;
  avgTimeSeconds: number;
}

/**
 * Aggregates per-question results into a named grouping — by subject, chapter,
 * topic or difficulty. One function serves all four so the numbers can never
 * disagree between sections of the result page.
 */
export function buildBreakdown(rows: BreakdownInput[]): BreakdownRow[] {
  const groups = new Map<string, BreakdownRow>();

  for (const row of rows) {
    let group = groups.get(row.groupKey);
    if (!group) {
      group = {
        key: row.groupKey,
        label: row.groupLabel,
        total: 0,
        correct: 0,
        incorrect: 0,
        unanswered: 0,
        attempted: 0,
        score: 0,
        maxScore: 0,
        accuracy: 0,
        timeSpentSeconds: 0,
        avgTimeSeconds: 0,
      };
      groups.set(row.groupKey, group);
    }

    group.total += 1;
    group.score += row.evaluated.marksAwarded;
    group.maxScore += row.maxMarks;
    group.timeSpentSeconds += row.timeSpentSeconds;

    if (row.evaluated.verdict === 'UNANSWERED') group.unanswered += 1;
    else if (row.evaluated.isCorrect) group.correct += 1;
    else group.incorrect += 1;
  }

  return [...groups.values()]
    .map((group) => {
      group.attempted = group.correct + group.incorrect;
      group.score = round(Math.max(0, group.score), 2);
      group.maxScore = round(group.maxScore, 2);
      group.accuracy = round(safeDivide(group.correct, group.attempted) * 100, 1);
      group.avgTimeSeconds = round(safeDivide(group.timeSpentSeconds, group.total), 1);
      return group;
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}
