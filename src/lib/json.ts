/**
 * Typed access to JSON-encoded `String` columns.
 *
 * SQLite (via Prisma) has no scalar-list type, so repeated values are stored as
 * JSON text in columns suffixed `Json`. Reading them through these helpers
 * guarantees that malformed or legacy data degrades to a safe default instead
 * of throwing deep inside a React render or an API handler.
 */
import { z } from 'zod';

/**
 * Parses a JSON column against a schema, returning `fallback` when the column
 * is empty, unparseable, or fails validation.
 */
export function parseJsonColumn<T>(
  raw: string | null | undefined,
  // Input is pinned to `unknown` so `T` is inferred from the schema's *output*.
  // `z.ZodType<T>` defaults Input to `T` as well, which makes TypeScript unify
  // `T` against the input type — wrong for any schema using `.default()` or
  // `.transform()`, where the two differ.
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  fallback: T,
): T {
  if (!raw) return fallback;
  try {
    const result = schema.safeParse(JSON.parse(raw));
    return result.success ? result.data : fallback;
  } catch {
    return fallback;
  }
}

/** Serialises a value for storage in a `*Json` column. */
export function toJsonColumn(value: unknown): string {
  return JSON.stringify(value ?? null);
}

// ---------------------------------------------------------------------------
// Shared column schemas
// ---------------------------------------------------------------------------

export const stringArraySchema = z.array(z.string());
export const numberArraySchema = z.array(z.number());

/** `Exam.highlightsJson`, generic label/value pairs. */
export const labelValueArraySchema = z.array(
  z.object({ label: z.string(), value: z.string() }),
);
export type LabelValue = z.infer<typeof labelValueArraySchema>[number];

/** `ContentBlock.itemsJson` — heterogeneous CMS list items. */
export const contentItemArraySchema = z.array(
  z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    value: z.string().optional(),
    icon: z.string().optional(),
    href: z.string().optional(),
    imageUrl: z.string().optional(),
  }),
);
export type ContentItem = z.infer<typeof contentItemArraySchema>[number];

/** `Question.matchDataJson` for MATCH_THE_FOLLOWING items. */
export const matchDataSchema = z.object({
  left: z.array(z.string()).min(2),
  right: z.array(z.string()).min(2),
  /** Correct pairings as `[leftIndex, rightIndex]`. */
  pairs: z.array(z.tuple([z.number().int(), z.number().int()])),
});
export type MatchData = z.infer<typeof matchDataSchema>;

/** `Achievement.criteriaJson` — machine-evaluated unlock rule. */
export const achievementCriteriaSchema = z.object({
  metric: z.enum([
    'tests_completed',
    'questions_solved',
    'accuracy_percent',
    'streak_days',
    'best_rank',
    'perfect_scores',
    'practice_sessions',
  ]),
  op: z.enum(['>=', '>', '==', '<=', '<']),
  value: z.number(),
  /** Optional minimum sample size before the rule may fire. */
  minSample: z.number().optional(),
});
export type AchievementCriteria = z.infer<typeof achievementCriteriaSchema>;

/** `SupportTicket.attachmentsJson` / `SupportMessage.attachmentsJson`. */
export const attachmentArraySchema = z.array(
  z.object({
    storageKey: z.string(),
    fileName: z.string(),
    sizeBytes: z.number().int().nonnegative(),
    mimeType: z.string().optional(),
  }),
);
export type Attachment = z.infer<typeof attachmentArraySchema>[number];

/** `TestAnswer.selectedOptionIdsJson`. */
export const selectedOptionIdsSchema = z.array(z.string());

/** `TestAttempt.questionOrderJson`. */
export const questionOrderSchema = z.array(z.string());

/**
 * `TestAttempt.snapshotJson` — the frozen test configuration captured when an
 * attempt starts. Scoring reads this, never the live `Test` row, so editing a
 * test can never retroactively change a submitted result.
 */
export const attemptSnapshotSchema = z.object({
  testId: z.string(),
  title: z.string(),
  durationMinutes: z.number(),
  mode: z.string(),
  category: z.string(),
  navigationMode: z.string(),
  negativeMarkingEnabled: z.boolean(),
  defaultNegativeRatio: z.number(),
  randomizeOptions: z.boolean(),
  sectionTimingEnabled: z.boolean(),
  fullscreenRequired: z.boolean(),
  maxTabSwitches: z.number(),
  totalMarks: z.number(),
  sections: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      subjectId: z.string().nullable(),
      subjectName: z.string().nullable(),
      durationMinutes: z.number().nullable(),
      sortOrder: z.number(),
    }),
  ),
  questions: z.array(
    z.object({
      testQuestionId: z.string(),
      questionId: z.string(),
      sectionId: z.string().nullable(),
      sortOrder: z.number(),
      marks: z.number(),
      negativeMarks: z.number(),
      type: z.string(),
      difficulty: z.string(),
      subjectId: z.string(),
      chapterId: z.string().nullable(),
      topicId: z.string().nullable(),
      /** Per-attempt option ordering when `randomizeOptions` is on. */
      optionOrder: z.array(z.string()),
    }),
  ),
});
export type AttemptSnapshot = z.infer<typeof attemptSnapshotSchema>;

/** `Coupon.applicable*Json` restriction lists. */
export const applicabilityListSchema = z.array(z.string());

/** `QuestionTranslation.optionsJson` — option id to translated body. */
export const optionTranslationSchema = z.record(z.string(), z.string());
