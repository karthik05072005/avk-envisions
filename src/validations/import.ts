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
  /** Set when an option is itself a diagram. */
  imageUrl: z.string().trim().max(500).optional(),
});

export const reviewedQuestionSchema = z
  .object({
    number: z.number().int().min(1),
    body: z.string().trim().min(5, 'Question text is too short').max(10_000),
    options: z.array(reviewedOptionSchema).min(2, 'At least two options').max(8),
    /** Zero-based. Must be resolved by the human before commit. */
    correctIndex: z.number().int().min(0),
    /**
     * The worked explanation, where the paper printed one and the reviewer
     * kept it. Optional: many papers carry no explanation at all, and an
     * empty string is stored as absent rather than as a blank one.
     */
    explanation: z.string().trim().max(10_000).optional(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
    /**
     * The figure this question depends on.
     *
     * Written by the parse step and confirmed by the admin. A question whose
     * wording refers to a map or diagram is unanswerable without it, so this
     * travels with the question rather than being attached afterwards.
     */
    imageUrl: z.string().trim().max(500).optional(),
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

/**
 * One place the imported questions should land.
 *
 * A commit may name several. The questions themselves are created once and
 * linked to each destination, so the same paper can fill a subject-wise drill
 * and a free mock without duplicating a single question — edit it later and
 * every test showing it changes together.
 */
export const importDestinationSchema = z
  .object({
    kind: z.enum(['EXISTING_TEST', 'NEW_TEST']),

    /** EXISTING_TEST: which test to append to. */
    testId: cuidSchema.optional(),

    /** NEW_TEST: how to build it. */
    title: z.string().trim().min(3).max(200).optional(),
    testSeriesId: cuidSchema.optional(),
    category: z
      .enum(['FULL_MOCK', 'SECTIONAL', 'CHAPTER', 'TOPIC', 'PRACTICE', 'PREVIOUS_YEAR', 'CUSTOM'])
      .default('PREVIOUS_YEAR'),
    accessType: z.enum(['FREE', 'PAID', 'SUBSCRIPTION']).default('FREE'),
    durationMinutes: z.coerce.number().int().min(1).max(600).default(120),
    maxAttempts: z.coerce.number().int().min(0).max(50).default(0),
  })
  .superRefine((input, ctx) => {
    if (input.kind === 'EXISTING_TEST' && !input.testId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Choose the test to add these questions to', path: ['testId'] });
    }
    if (input.kind === 'NEW_TEST' && !input.title) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Give the new test a title', path: ['title'] });
    }
  });

export type ImportDestination = z.infer<typeof importDestinationSchema>;

/** Where the imported questions should end up. */
export const importCommitSchema = z
  .object({
    examId: cuidSchema,
    subjectId: cuidSchema,

    /**
     * Every place these questions should appear. An empty list means the
     * question bank only, to be attached to a test later.
     */
    destinations: z.array(importDestinationSchema).max(20).default([]),

    // --- Superseded by `destinations`, still accepted ---------------------
    // Kept so a client that has not been reloaded mid-release keeps working;
    // normalised into `destinations` below.
    target: z.enum(['NEW_TEST', 'EXISTING_TEST', 'BANK_ONLY']).optional(),
    testId: cuidSchema.optional(),
    title: z.string().trim().min(3).max(200).optional(),
    testSeriesId: cuidSchema.optional(),
    category: z
      .enum(['FULL_MOCK', 'SECTIONAL', 'CHAPTER', 'TOPIC', 'PRACTICE', 'PREVIOUS_YEAR', 'CUSTOM'])
      .default('PREVIOUS_YEAR'),
    accessType: z.enum(['FREE', 'PAID', 'SUBSCRIPTION']).default('FREE'),
    durationMinutes: z.coerce.number().int().min(1).max(600).default(120),
    // 0 = unlimited; see the note in validations/admin.ts.
    maxAttempts: z.coerce.number().int().min(0).max(50).default(0),

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
    // Only the legacy single-target fields are checked here; a destination
    // list validates itself, entry by entry.
    if (input.destinations.length > 0 || input.target === undefined) return;

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
  })
  .transform((input) => {
    // One shape reaches the route: a list. A request written against the old
    // single-target fields is folded into it here rather than being handled
    // again further in.
    if (input.destinations.length > 0 || input.target === undefined) return input;

    const destinations: ImportDestination[] =
      input.target === 'BANK_ONLY'
        ? []
        : [
            {
              kind: input.target,
              testId: input.testId,
              title: input.title,
              testSeriesId: input.testSeriesId,
              category: input.category,
              accessType: input.accessType,
              durationMinutes: input.durationMinutes,
              maxAttempts: input.maxAttempts,
            },
          ];

    return { ...input, destinations };
  });

export type ImportCommitInput = z.infer<typeof importCommitSchema>;
