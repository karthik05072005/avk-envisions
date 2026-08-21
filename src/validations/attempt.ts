import { z } from 'zod';

import { AnswerState, AttemptEventType } from '@/lib/enums';

import { cuidSchema } from './common';

/**
 * Exam-engine input schemas.
 *
 * These guard the highest-traffic write path in the product. Batch sizes and
 * value ranges are capped deliberately — a malformed or hostile client must not
 * be able to turn one autosave into an unbounded write.
 */

export const startAttemptSchema = z.object({
  testId: cuidSchema,
});

/** A single question's worth of changes. */
export const answerPatchSchema = z
  .object({
    testQuestionId: cuidSchema,
    /** Capped: no real question has more than a handful of options. */
    selectedOptionIds: z.array(cuidSchema).max(10).optional(),
    numericalValue: z.number().finite().nullable().optional(),
    state: AnswerState.schema.optional(),
    /**
     * Seconds to add to this question's timer. Bounded to 10 minutes per
     * flush so a tampered client cannot inflate its own time-per-question
     * analytics into nonsense.
     */
    timeDeltaSeconds: z.number().int().min(0).max(600).optional(),
  })
  .refine(
    (patch) =>
      patch.selectedOptionIds !== undefined ||
      patch.numericalValue !== undefined ||
      patch.state !== undefined ||
      patch.timeDeltaSeconds !== undefined,
    { message: 'Patch must change at least one field' },
  );

export const saveAnswersSchema = z.object({
  /** One flush covers at most 60 questions; the client batches beyond that. */
  patches: z.array(answerPatchSchema).min(1).max(60),
});

export const submitAttemptSchema = z.object({
  /**
   * AUTO is what the client sends when its own countdown reaches zero. The
   * server re-checks expiry regardless, so this only affects how the
   * submission is labelled.
   */
  reason: z.enum(['MANUAL', 'AUTO']).default('MANUAL'),
});

export const attemptEventSchema = z.object({
  type: AttemptEventType.schema,
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type StartAttemptInput = z.infer<typeof startAttemptSchema>;
export type SaveAnswersInput = z.infer<typeof saveAnswersSchema>;
export type AttemptEventInput = z.infer<typeof attemptEventSchema>;
