import { z } from 'zod';

import { cuidSchema } from './common';

/**
 * Admin write schemas.
 *
 * These guard the content-authoring path. The option rules are the important
 * part: a question saved with no correct option, or with two correct options on
 * a single-correct item, would silently mis-mark every student who answers it.
 * That is caught here rather than at scoring time.
 */

const optionSchema = z.object({
  id: cuidSchema.optional(),
  body: z.string().trim().min(1, 'Option text cannot be empty').max(2000),
  isCorrect: z.boolean().default(false),
});

export const questionSchema = z
  .object({
    examId: cuidSchema,
    subjectId: cuidSchema,
    chapterId: cuidSchema.nullish(),
    topicId: cuidSchema.nullish(),

    type: z.enum(['SINGLE_CORRECT', 'MULTIPLE_CORRECT', 'TRUE_FALSE', 'NUMERICAL']),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
    status: z.enum(['DRAFT', 'UNDER_REVIEW', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),

    body: z.string().trim().min(5, 'Write the question').max(10_000),
    passage: z.string().trim().max(10_000).nullish(),
    imageUrl: z.string().trim().url().nullish().or(z.literal('')),

    marks: z.coerce.number().min(0.25).max(100).default(1),
    negativeMarks: z.coerce.number().min(0).max(100).default(0),

    numericalAnswer: z.coerce.number().finite().nullish(),
    numericalTolerance: z.coerce.number().min(0).max(1000).nullish(),

    explanation: z.string().trim().max(10_000).nullish(),
    detailedSolution: z.string().trim().max(50_000).nullish(),
    concept: z.string().trim().max(200).nullish(),
    source: z.string().trim().max(200).nullish(),
    examYear: z.coerce.number().int().min(1950).max(2100).nullish(),
    reviewNote: z.string().trim().max(2000).nullish(),

    options: z.array(optionSchema).max(10).default([]),
  })
  .superRefine((input, ctx) => {
    const addIssue = (message: string, path: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });

    if (input.type === 'NUMERICAL') {
      if (input.numericalAnswer === null || input.numericalAnswer === undefined) {
        addIssue('A numerical question needs an expected answer', 'numericalAnswer');
      }
      return;
    }

    // --- Option-based types ------------------------------------------------
    const correct = input.options.filter((o) => o.isCorrect).length;

    if (input.options.length < 2) {
      addIssue('Add at least two options', 'options');
      return;
    }
    if (correct === 0) {
      addIssue('Mark one option as correct — otherwise the question cannot be scored', 'options');
    }
    if (input.type !== 'MULTIPLE_CORRECT' && correct > 1) {
      addIssue('A single-correct question can only have one correct option', 'options');
    }
    if (input.type === 'TRUE_FALSE' && input.options.length !== 2) {
      addIssue('A true/false question needs exactly two options', 'options');
    }

    const texts = input.options.map((o) => o.body.trim().toLowerCase());
    if (new Set(texts).size !== texts.length) {
      addIssue('Two options have the same text', 'options');
    }
  });

export type QuestionInput = z.infer<typeof questionSchema>;

export const testSchema = z.object({
  examId: cuidSchema,
  testSeriesId: cuidSchema.nullish(),

  title: z.string().trim().min(3, 'Give the test a title').max(200),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(200)
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens only'),
  description: z.string().trim().max(2000).nullish(),
  instructions: z.string().trim().max(10_000).nullish(),

  category: z
    .enum(['FULL_MOCK', 'SECTIONAL', 'CHAPTER', 'TOPIC', 'PRACTICE', 'PREVIOUS_YEAR', 'CUSTOM'])
    .default('FULL_MOCK'),
  mode: z.enum(['EXAM', 'PRACTICE']).default('EXAM'),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  accessType: z.enum(['FREE', 'PAID', 'SUBSCRIPTION']).default('FREE'),

  durationMinutes: z.coerce.number().int().min(1).max(600).default(60),
  /** 0 means unlimited re-attempts. */
  maxAttempts: z.coerce.number().int().min(0).max(50).default(2),
  passingMarks: z.coerce.number().min(0).max(10_000).default(0),

  negativeMarkingEnabled: z.boolean().default(true),
  defaultNegativeRatio: z.coerce.number().min(0).max(1).default(0.25),
  randomizeQuestions: z.boolean().default(false),
  randomizeOptions: z.boolean().default(false),
  showResultImmediately: z.boolean().default(true),

  startDate: z.coerce.date().nullish(),
  endDate: z.coerce.date().nullish(),
});

export type TestInput = z.infer<typeof testSchema>;

/** Attach, detach or reorder the questions on a test. */
export const testQuestionsSchema = z.object({
  action: z.enum(['attach', 'detach', 'reorder']),
  questionIds: z.array(cuidSchema).max(500).default([]),
  /** For reorder: the full ordered list of testQuestion ids. */
  order: z.array(cuidSchema).max(500).default([]),
});

export const userActionSchema = z.object({
  userId: cuidSchema,
  action: z.enum(['suspend', 'activate', 'make_admin', 'make_student', 'revoke_sessions']),
});

export const ticketReplySchema = z.object({
  ticketId: cuidSchema,
  body: z.string().trim().min(1).max(5000),
  /** Internal notes are never shown to the student. */
  isInternalNote: z.boolean().default(false),
  status: z.enum(['OPEN', 'WAITING', 'RESOLVED', 'CLOSED']).optional(),
});

export const settingSchema = z.object({
  key: z.string().trim().min(1).max(120),
  value: z.string().max(5000),
});
