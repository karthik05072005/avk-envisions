import { z } from 'zod';

import { cuidSchema } from './common';

/** Practice and bookmark input schemas. */

export const startPracticeSchema = z.object({
  subjectId: cuidSchema.optional(),
  chapterId: cuidSchema.optional(),
  topicId: cuidSchema.optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  source: z.enum(['NEW', 'INCORRECT', 'BOOKMARKED', 'ALL']).default('NEW'),
  /** Capped server-side too; this is the UI's range. */
  count: z.coerce.number().int().min(5).max(50).default(10),
});

export const answerPracticeSchema = z
  .object({
    questionId: cuidSchema,
    selectedOptionIds: z.array(cuidSchema).max(10).default([]),
    numericalValue: z.number().finite().nullable().default(null),
    timeSpentSeconds: z.number().int().min(0).max(3600).default(0),
  })
  .refine(
    (input) => input.selectedOptionIds.length > 0 || input.numericalValue !== null,
    { message: 'Select an option or enter a value before submitting', path: ['selectedOptionIds'] },
  );

export const bookmarkSchema = z.object({
  questionId: cuidSchema,
  note: z.string().trim().max(500).optional(),
});

export type StartPracticeInput = z.infer<typeof startPracticeSchema>;
export type AnswerPracticeInput = z.infer<typeof answerPracticeSchema>;
