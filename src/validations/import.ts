import { MARKS_PER_QUESTION } from '@/lib/marking';
import { z } from 'zod';

import { cuidSchema } from './common';

/**
 * Import commit schema.
 *
 * The client sends back the reviewed questions, not the parsed ones — an admin
 * may have corrected a body, fixed an option or set a key the parser could not
 * find. Every question must therefore carry a resolved `correctIndex`: the
 * commit endpoint refuses to create a question the parser guessed at.
 */
const reviewedOptionSchema = z.object({
  body: z.string().trim().min(1, 'An option cannot be empty').max(2000),
});

export const reviewedQuestionSchema = z
  .object({
    number: z.number().int().min(1),
    body: z.string().trim().min(5, 'Question text is too short').max(10_000),
    options: z.array(reviewedOptionSchema).min(2, 'At least two options').max(8),
    /** Zero-based. Must be resolved by the human before commit. */
    correctIndex: z.number().int().min(0),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
  })
  .superRefine((input, ctx) => {
    if (input.correctIndex >= input.options.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Question ${input.number}: the correct answer points past the last option`,
        path: ['correctIndex'],
      });
    }

    const bodies = input.options.map((o) => o.body.trim().toLowerCase());
    if (new Set(bodies).size !== bodies.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Question ${input.number}: two options have identical text`,
        path: ['options'],
      });
    }
  });

/** Where the imported questions should end up. */
export const importCommitSchema = z
  .object({
    examId: cuidSchema,
    subjectId: cuidSchema,

    /** Attach to an existing test, or create a new one. */
    target: z.enum(['NEW_TEST', 'EXISTING_TEST', 'BANK_ONLY']).default('NEW_TEST'),
    testId: cuidSchema.optional(),

    // --- New-test fields -------------------------------------------------
    title: z.string().trim().min(3).max(200).optional(),
    testSeriesId: cuidSchema.optional(),
    category: z
      .enum(['FULL_MOCK', 'SECTIONAL', 'CHAPTER', 'TOPIC', 'PRACTICE', 'PREVIOUS_YEAR', 'CUSTOM'])
      .default('PREVIOUS_YEAR'),
    accessType: z.enum(['FREE', 'PAID', 'SUBSCRIPTION']).default('FREE'),
    durationMinutes: z.coerce.number().int().min(1).max(600).default(120),
    maxAttempts: z.coerce.number().int().min(0).max(50).default(2),

    // --- Marking ----------------------------------------------------------
    marks: z.coerce.number().min(0.25).max(100).default(MARKS_PER_QUESTION),
    negativeMarks: z.coerce.number().min(0).max(100).default(0.25),

    // --- Provenance -------------------------------------------------------
    source: z.string().trim().max(200).optional(),
    examYear: z.coerce.number().int().min(1950).max(2100).optional(),

    /** Questions are created as drafts unless explicitly published. */
    publish: z.boolean().default(false),

    questions: z.array(reviewedQuestionSchema).min(1, 'Nothing to import').max(300),
  })
  .superRefine((input, ctx) => {
    if (input.target === 'NEW_TEST' && !input.title) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Give the new test a title',
        path: ['title'],
      });
    }
    if (input.target === 'EXISTING_TEST' && !input.testId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Choose the test to add these questions to',
        path: ['testId'],
      });
    }
  });

export type ImportCommitInput = z.infer<typeof importCommitSchema>;
