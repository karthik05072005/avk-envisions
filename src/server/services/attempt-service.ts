import 'server-only';

import { AppError, errors } from '@/lib/api';
import { TERMINAL_ATTEMPT_STATUSES, type AnswerState, type QuestionType } from '@/lib/enums';
import {
  attemptSnapshotSchema,
  parseJsonColumn,
  questionOrderSchema,
  selectedOptionIdsSchema,
  toJsonColumn,
  type AttemptSnapshot,
} from '@/lib/json';
import { seededShuffle } from '@/lib/utils';
import { db } from '@/server/db';
import { logger } from '@/server/logger';

import {
  buildBreakdown,
  computePercentile,
  computeRank,
  evaluateAnswer,
  totalAttempt,
  type QuestionKey,
  type SubmittedAnswer,
} from './scoring';

/**
 * Test attempt lifecycle.
 *
 * Three invariants govern this module, and every function is written to
 * preserve them:
 *
 *  1. **The server owns the clock.** `expiresAt` is computed once, at start,
 *     from the server's own time. Nothing the client sends can extend it, and
 *     the countdown shown in the browser is advisory only.
 *
 *  2. **The paper is frozen at start.** A JSON snapshot of the test — its
 *     questions, marks, ordering and rules — is written when the attempt
 *     begins. Scoring reads that snapshot, never the live `Test` row, so an
 *     admin editing a test can never retroactively alter a result.
 *
 *  3. **Submission happens exactly once.** The terminal transition is guarded
 *     by a conditional update, so a double-clicked button, a retried request
 *     and the expiry sweeper cannot produce two scored submissions.
 */

/** Grace period allowed for the final autosave to land after expiry. */
const SUBMIT_GRACE_SECONDS = 30;

// ---------------------------------------------------------------------------
// Starting an attempt
// ---------------------------------------------------------------------------

export interface StartAttemptResult {
  attemptId: string;
  resumed: boolean;
}

/**
 * Starts a new attempt, or resumes an existing live one.
 *
 * Resuming rather than erroring is deliberate: a student who refreshes, loses
 * connection, or opens the test in a second tab must land back in the same
 * attempt, not be told they have used up their allowance.
 */
export async function startAttempt(params: {
  userId: string;
  testId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<StartAttemptResult> {
  const { userId, testId, ipAddress, userAgent } = params;

  const test = await db.test.findFirst({
    where: { id: testId, deletedAt: null },
    select: {
      id: true,
      title: true,
      status: true,
      mode: true,
      category: true,
      accessType: true,
      testSeriesId: true,
      durationMinutes: true,
      totalMarks: true,
      maxAttempts: true,
      navigationMode: true,
      negativeMarkingEnabled: true,
      defaultNegativeRatio: true,
      randomizeQuestions: true,
      randomizeOptions: true,
      sectionTimingEnabled: true,
      fullscreenRequired: true,
      maxTabSwitches: true,
      startDate: true,
      endDate: true,
      sections: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          sortOrder: true,
          durationMinutes: true,
          subjectId: true,
          subject: { select: { name: true } },
        },
      },
      questions: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          sortOrder: true,
          marks: true,
          negativeMarks: true,
          sectionId: true,
          question: {
            select: {
              id: true,
              type: true,
              difficulty: true,
              subjectId: true,
              chapterId: true,
              topicId: true,
              status: true,
              deletedAt: true,
              options: { orderBy: { sortOrder: 'asc' }, select: { id: true } },
            },
          },
        },
      },
    },
  });

  if (!test) throw errors.notFound('Test');

  // --- Availability ------------------------------------------------------
  if (test.status !== 'PUBLISHED') {
    throw new AppError('TEST_UNAVAILABLE', 'This test is not currently available.');
  }
  const now = new Date();
  if (test.startDate && test.startDate > now) {
    throw new AppError('TEST_UNAVAILABLE', 'This test has not opened yet.');
  }
  if (test.endDate && test.endDate < now) {
    throw new AppError('TEST_UNAVAILABLE', 'This test has closed.');
  }

  // --- Resume a live attempt --------------------------------------------
  const live = await db.testAttempt.findFirst({
    where: { testId, userId, status: 'IN_PROGRESS' },
    orderBy: { startedAt: 'desc' },
    select: { id: true, expiresAt: true },
  });

  if (live) {
    if (live.expiresAt > now) return { attemptId: live.id, resumed: true };
    // Expired but never finalised — close it out before issuing a new one.
    await submitAttempt({ attemptId: live.id, userId, reason: 'EXPIRED' });
  }

  // --- Access ------------------------------------------------------------
  // Enforced here rather than only in the UI: `accessType` decides whether a
  // paper is free, and without this check any signed-in account could start a
  // paid test by posting its id straight to the API.
  //
  // Placed after the resume branch on purpose. Someone already mid-paper keeps
  // their attempt even if their access lapses while they are sitting it;
  // starting a *new* attempt is what requires entitlement.
  if (test.accessType !== 'FREE') {
    const actor = await db.user.findUnique({ where: { id: userId }, select: { role: true } });

    // Admins can open any paper — they need to be able to review content.
    if (actor?.role !== 'ADMIN') {
      const entitled = test.testSeriesId
        ? await db.entitlement.findFirst({
            where: {
              userId,
              testSeriesId: test.testSeriesId,
              revokedAt: null,
              startsAt: { lte: now },
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
            select: { id: true },
          })
        : null;

      if (!entitled) {
        throw errors.entitlementRequired(
          'This test is part of a paid series. Purchase access to attempt it.',
        );
      }
    }
  }

  // --- Attempt limit -----------------------------------------------------
  if (test.maxAttempts > 0) {
    const used = await db.testAttempt.count({
      where: { testId, userId, status: { in: [...TERMINAL_ATTEMPT_STATUSES] } },
    });
    if (used >= test.maxAttempts) {
      throw new AppError(
        'ATTEMPT_LIMIT_REACHED',
        test.maxAttempts === 1
          ? 'You have already attempted this test.'
          : `You have used all ${test.maxAttempts} attempts for this test.`,
      );
    }
  }

  // --- Usable questions --------------------------------------------------
  // Archived or soft-deleted questions are excluded at start, so a paper never
  // contains an item the content team has withdrawn.
  const usable = test.questions.filter(
    (tq) => tq.question.deletedAt === null && tq.question.status === 'PUBLISHED',
  );

  if (usable.length === 0) {
    throw new AppError('TEST_UNAVAILABLE', 'This test has no available questions right now.');
  }

  const attemptNumber =
    (await db.testAttempt.count({ where: { testId, userId } })) + 1;

  // Seed derives from the attempt identity, so the same shuffle can be
  // reproduced later if an order ever needs to be reconstructed.
  const seed = `${userId}:${testId}:${attemptNumber}`;

  const ordered = test.randomizeQuestions ? seededShuffle(usable, seed) : usable;

  const snapshot: AttemptSnapshot = {
    testId: test.id,
    title: test.title,
    durationMinutes: test.durationMinutes,
    mode: test.mode,
    category: test.category,
    navigationMode: test.navigationMode,
    negativeMarkingEnabled: test.negativeMarkingEnabled,
    defaultNegativeRatio: test.defaultNegativeRatio,
    randomizeOptions: test.randomizeOptions,
    sectionTimingEnabled: test.sectionTimingEnabled,
    fullscreenRequired: test.fullscreenRequired,
    maxTabSwitches: test.maxTabSwitches,
    totalMarks: ordered.reduce((sum, tq) => sum + tq.marks, 0),
    sections: test.sections.map((section) => ({
      id: section.id,
      name: section.name,
      subjectId: section.subjectId,
      subjectName: section.subject?.name ?? null,
      durationMinutes: section.durationMinutes,
      sortOrder: section.sortOrder,
    })),
    questions: ordered.map((tq, index) => ({
      testQuestionId: tq.id,
      questionId: tq.question.id,
      sectionId: tq.sectionId,
      sortOrder: index + 1,
      marks: tq.marks,
      negativeMarks: tq.negativeMarks,
      type: tq.question.type,
      difficulty: tq.question.difficulty,
      subjectId: tq.question.subjectId,
      chapterId: tq.question.chapterId,
      topicId: tq.question.topicId,
      optionOrder: test.randomizeOptions
        ? seededShuffle(tq.question.options.map((o) => o.id), `${seed}:${tq.id}`)
        : tq.question.options.map((o) => o.id),
    })),
  };

  const expiresAt = new Date(now.getTime() + test.durationMinutes * 60_000);

  const attempt = await db.$transaction(async (tx) => {
    const created = await tx.testAttempt.create({
      data: {
        testId,
        userId,
        attemptNumber,
        status: 'IN_PROGRESS',
        startedAt: now,
        expiresAt,
        maxScore: snapshot.totalMarks,
        unansweredCount: snapshot.questions.length,
        snapshotJson: toJsonColumn(snapshot),
        questionOrderJson: toJsonColumn(snapshot.questions.map((q) => q.testQuestionId)),
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
      select: { id: true },
    });

    // Pre-create answer rows so autosave is always an update, never an insert
    // race between two tabs.
    await tx.testAnswer.createMany({
      data: snapshot.questions.map((q) => ({
        attemptId: created.id,
        testQuestionId: q.testQuestionId,
        questionId: q.questionId,
        state: 'NOT_VISITED',
      })),
    });

    return created;
  });

  logger.info({ attemptId: attempt.id, testId, userId, attemptNumber }, 'Attempt started');

  return { attemptId: attempt.id, resumed: false };
}

// ---------------------------------------------------------------------------
// Reading attempt state
// ---------------------------------------------------------------------------

export interface AttemptQuestionView {
  testQuestionId: string;
  questionId: string;
  sortOrder: number;
  sectionId: string | null;
  marks: number;
  negativeMarks: number;
  type: QuestionType;
  body: string;
  passage: string | null;
  imageUrl: string | null;
  options: { id: string; label: string; body: string; imageUrl: string | null }[];
  /** Present only in PRACTICE mode, where revealing is permitted. */
  explanation?: string | null;
  correctOptionIds?: string[];
  numericalAnswer?: number | null;
}

export interface AttemptState {
  attemptId: string;
  status: string;
  title: string;
  mode: string;
  navigationMode: string;
  fullscreenRequired: boolean;
  maxTabSwitches: number;
  totalQuestions: number;
  totalMarks: number;
  sections: AttemptSnapshot['sections'];
  questions: AttemptQuestionView[];
  answers: Record<
    string,
    { selectedOptionIds: string[]; numericalValue: number | null; state: AnswerState; timeSpentSeconds: number }
  >;
  /** Server time at the moment of the response, for clock synchronisation. */
  serverTime: string;
  expiresAt: string;
  secondsRemaining: number;
}

/**
 * Loads everything the exam UI needs.
 *
 * In EXAM mode the payload contains no answer key of any kind — not the correct
 * option ids, not the explanation. A student inspecting the network response
 * finds nothing they could not see on screen.
 */
export async function getAttemptState(attemptId: string, userId: string): Promise<AttemptState> {
  const attempt = await db.testAttempt.findFirst({
    where: { id: attemptId, userId },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      snapshotJson: true,
      answers: {
        select: {
          testQuestionId: true,
          selectedOptionIdsJson: true,
          numericalValue: true,
          state: true,
          timeSpentSeconds: true,
        },
      },
    },
  });

  if (!attempt) throw errors.notFound('Attempt');

  const snapshot = parseJsonColumn(attempt.snapshotJson, attemptSnapshotSchema, null as never);
  if (!snapshot) {
    throw errors.internal('This attempt could not be loaded because its configuration is unreadable.');
  }

  const revealAnswers = snapshot.mode === 'PRACTICE';

  const questions = await db.question.findMany({
    where: { id: { in: snapshot.questions.map((q) => q.questionId) } },
    select: {
      id: true,
      body: true,
      passage: true,
      imageUrl: true,
      explanation: revealAnswers,
      numericalAnswer: revealAnswers,
      options: {
        select: { id: true, label: true, body: true, imageUrl: true, isCorrect: revealAnswers },
      },
    },
  });

  const byId = new Map(questions.map((q) => [q.id, q]));

  const views: AttemptQuestionView[] = snapshot.questions
    .map((entry): AttemptQuestionView | null => {
      const question = byId.get(entry.questionId);
      if (!question) return null;

      // Apply this attempt's frozen option order.
      //
      // The order is stored as option ids, and an admin editing the question
      // replaces its options wholesale — new rows, new ids. Every id in the
      // snapshot then matches nothing and the question renders with no options
      // at all: unanswerable, with no clue why. Falling back to the question's
      // own order keeps the paper usable. The attempt loses its shuffle for
      // that one question, which is a far smaller harm than losing the answers.
      const optionMap = new Map(question.options.map((o) => [o.id, o]));
      const ordered = entry.optionOrder
        .map((id) => optionMap.get(id))
        .filter((o): o is NonNullable<typeof o> => Boolean(o));

      const options = ordered.length > 0 ? ordered : question.options;

      return {
        testQuestionId: entry.testQuestionId,
        questionId: entry.questionId,
        sortOrder: entry.sortOrder,
        sectionId: entry.sectionId,
        marks: entry.marks,
        negativeMarks: entry.negativeMarks,
        type: entry.type as QuestionType,
        body: question.body,
        passage: question.passage,
        imageUrl: question.imageUrl,
        options: options.map((o) => ({
          id: o.id,
          label: o.label,
          body: o.body,
          imageUrl: o.imageUrl,
        })),
        ...(revealAnswers
          ? {
              explanation: question.explanation ?? null,
              numericalAnswer: question.numericalAnswer ?? null,
              // Same fallback: reading the key off `ordered` would return an
              // empty list on an edited question, so the review page would show
              // no correct answer at all.
              correctOptionIds: options.filter((o) => o.isCorrect).map((o) => o.id),
            }
          : {}),
      };
    })
    .filter((v): v is AttemptQuestionView => v !== null);

  const answers: AttemptState['answers'] = {};
  for (const answer of attempt.answers) {
    answers[answer.testQuestionId] = {
      selectedOptionIds: parseJsonColumn(answer.selectedOptionIdsJson, selectedOptionIdsSchema, []),
      numericalValue: answer.numericalValue,
      state: answer.state as AnswerState,
      timeSpentSeconds: answer.timeSpentSeconds,
    };
  }

  const now = new Date();

  return {
    attemptId: attempt.id,
    status: attempt.status,
    title: snapshot.title,
    mode: snapshot.mode,
    navigationMode: snapshot.navigationMode,
    fullscreenRequired: snapshot.fullscreenRequired,
    maxTabSwitches: snapshot.maxTabSwitches,
    totalQuestions: views.length,
    totalMarks: snapshot.totalMarks,
    sections: snapshot.sections,
    questions: views,
    answers,
    serverTime: now.toISOString(),
    expiresAt: attempt.expiresAt.toISOString(),
    secondsRemaining: Math.max(
      0,
      Math.floor((attempt.expiresAt.getTime() - now.getTime()) / 1000),
    ),
  };
}

// ---------------------------------------------------------------------------
// Saving answers
// ---------------------------------------------------------------------------

export interface AnswerPatch {
  testQuestionId: string;
  selectedOptionIds?: string[];
  numericalValue?: number | null;
  state?: AnswerState;
  /** Seconds to add to this question's running total. */
  timeDeltaSeconds?: number;
}

/**
 * Persists a batch of answer updates.
 *
 * Batched by design: the client debounces and sends several questions at once,
 * so a 180-question paper costs a few dozen writes rather than several hundred.
 * Marking is *not* performed here — an autosave must stay cheap, and computing
 * correctness on every keystroke would also leak the answer through timing.
 */
export async function saveAnswers(params: {
  attemptId: string;
  userId: string;
  patches: AnswerPatch[];
}): Promise<{ saved: number; secondsRemaining: number; expired: boolean }> {
  const { attemptId, userId, patches } = params;

  const attempt = await db.testAttempt.findFirst({
    where: { id: attemptId, userId },
    select: { id: true, status: true, expiresAt: true },
  });

  if (!attempt) throw errors.notFound('Attempt');

  if (attempt.status !== 'IN_PROGRESS') {
    throw new AppError('ALREADY_SUBMITTED', 'This attempt has already been submitted.');
  }

  const now = Date.now();
  const secondsRemaining = Math.floor((attempt.expiresAt.getTime() - now) / 1000);

  // Past expiry (plus grace) nothing more is accepted — this is what stops a
  // client with a doctored clock from continuing to answer.
  if (secondsRemaining < -SUBMIT_GRACE_SECONDS) {
    return { saved: 0, secondsRemaining: 0, expired: true };
  }

  const valid = new Set(
    (
      await db.testAnswer.findMany({
        where: { attemptId, testQuestionId: { in: patches.map((p) => p.testQuestionId) } },
        select: { testQuestionId: true },
      })
    ).map((a) => a.testQuestionId),
  );

  let saved = 0;

  await db.$transaction(async (tx) => {
    for (const patch of patches) {
      // Silently ignore ids not belonging to this attempt rather than failing
      // the whole batch — one stale id must not cost the student 19 good saves.
      if (!valid.has(patch.testQuestionId)) continue;

      await tx.testAnswer.update({
        where: {
          attemptId_testQuestionId: {
            attemptId,
            testQuestionId: patch.testQuestionId,
          },
        },
        data: {
          ...(patch.selectedOptionIds !== undefined
            ? { selectedOptionIdsJson: toJsonColumn(patch.selectedOptionIds) }
            : {}),
          ...(patch.numericalValue !== undefined ? { numericalValue: patch.numericalValue } : {}),
          ...(patch.state !== undefined ? { state: patch.state } : {}),
          ...(patch.timeDeltaSeconds
            ? { timeSpentSeconds: { increment: Math.max(0, Math.round(patch.timeDeltaSeconds)) } }
            : {}),
          answeredAt: new Date(),
          visitCount: { increment: 1 },
        },
      });
      saved += 1;
    }

    await tx.testAttempt.update({
      where: { id: attemptId },
      data: { lastSyncedAt: new Date() },
    });
  });

  return { saved, secondsRemaining: Math.max(0, secondsRemaining), expired: false };
}

// ---------------------------------------------------------------------------
// Submission
// ---------------------------------------------------------------------------

export type SubmitReason = 'MANUAL' | 'AUTO' | 'EXPIRED';

export interface SubmitResult {
  attemptId: string;
  alreadySubmitted: boolean;
  score: number;
  maxScore: number;
  percentage: number;
  accuracy: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
}

/**
 * Scores and finalises an attempt.
 *
 * The whole operation is one transaction, and it opens with a conditional
 * status update that acts as a lock: whichever caller flips IN_PROGRESS first
 * proceeds, and every other caller sees `alreadySubmitted`. That is what makes
 * a double-clicked submit button, a retried request and the expiry sweeper all
 * safe to run concurrently.
 */
export async function submitAttempt(params: {
  attemptId: string;
  userId: string;
  reason?: SubmitReason;
}): Promise<SubmitResult> {
  const { attemptId, userId, reason = 'MANUAL' } = params;

  const attempt = await db.testAttempt.findFirst({
    where: { id: attemptId, userId },
    select: {
      id: true,
      testId: true,
      status: true,
      startedAt: true,
      expiresAt: true,
      snapshotJson: true,
      score: true,
      maxScore: true,
      percentage: true,
      accuracy: true,
      correctCount: true,
      incorrectCount: true,
      unansweredCount: true,
    },
  });

  if (!attempt) throw errors.notFound('Attempt');

  if (attempt.status !== 'IN_PROGRESS') {
    return {
      attemptId: attempt.id,
      alreadySubmitted: true,
      score: attempt.score,
      maxScore: attempt.maxScore,
      percentage: attempt.percentage,
      accuracy: attempt.accuracy,
      correctCount: attempt.correctCount,
      incorrectCount: attempt.incorrectCount,
      unansweredCount: attempt.unansweredCount,
    };
  }

  const snapshot = parseJsonColumn(attempt.snapshotJson, attemptSnapshotSchema, null as never);
  if (!snapshot) throw errors.internal('This attempt cannot be scored — its configuration is unreadable.');

  // Claim the attempt. `updateMany` with a status predicate gives us an atomic
  // compare-and-set; a count of 0 means someone else got there first.
  const claimed = await db.testAttempt.updateMany({
    where: { id: attemptId, status: 'IN_PROGRESS' },
    data: {
      status: reason === 'MANUAL' ? 'SUBMITTED' : reason === 'AUTO' ? 'AUTO_SUBMITTED' : 'EXPIRED',
      submittedAt: new Date(),
    },
  });

  if (claimed.count === 0) {
    const current = await db.testAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: {
        score: true,
        maxScore: true,
        percentage: true,
        accuracy: true,
        correctCount: true,
        incorrectCount: true,
        unansweredCount: true,
      },
    });
    return { attemptId, alreadySubmitted: true, ...current };
  }

  // --- Score -------------------------------------------------------------
  const [answers, questionKeys] = await Promise.all([
    db.testAnswer.findMany({
      where: { attemptId },
      select: {
        id: true,
        testQuestionId: true,
        questionId: true,
        selectedOptionIdsJson: true,
        numericalValue: true,
        timeSpentSeconds: true,
      },
    }),
    db.question.findMany({
      where: { id: { in: snapshot.questions.map((q) => q.questionId) } },
      select: {
        id: true,
        type: true,
        numericalAnswer: true,
        numericalTolerance: true,
        options: { where: { isCorrect: true }, select: { id: true } },
      },
    }),
  ]);

  const keyById = new Map(questionKeys.map((q) => [q.id, q]));
  const answerByTq = new Map(answers.map((a) => [a.testQuestionId, a]));

  const evaluations: {
    answerId: string;
    evaluated: ReturnType<typeof evaluateAnswer>;
    maxMarks: number;
    entry: AttemptSnapshot['questions'][number];
    timeSpentSeconds: number;
  }[] = [];

  for (const entry of snapshot.questions) {
    const answer = answerByTq.get(entry.testQuestionId);
    const source = keyById.get(entry.questionId);
    if (!answer || !source) continue;

    const key: QuestionKey = {
      questionId: entry.questionId,
      type: source.type as QuestionType,
      marks: entry.marks,
      negativeMarks: entry.negativeMarks,
      correctOptionIds: source.options.map((o) => o.id),
      numericalAnswer: source.numericalAnswer,
      numericalTolerance: source.numericalTolerance,
    };

    const submitted: SubmittedAnswer = {
      selectedOptionIds: parseJsonColumn(answer.selectedOptionIdsJson, selectedOptionIdsSchema, []),
      numericalValue: answer.numericalValue,
    };

    evaluations.push({
      answerId: answer.id,
      evaluated: evaluateAnswer(key, submitted, {
        negativeMarkingEnabled: snapshot.negativeMarkingEnabled,
      }),
      maxMarks: entry.marks,
      entry,
      timeSpentSeconds: answer.timeSpentSeconds,
    });
  }

  const totals = totalAttempt(
    evaluations.map((e) => ({ evaluated: e.evaluated, maxMarks: e.maxMarks })),
  );

  const timeSpentSeconds = Math.max(
    0,
    Math.min(
      Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000),
      snapshot.durationMinutes * 60,
    ),
  );

  await db.$transaction(async (tx) => {
    for (const evaluation of evaluations) {
      await tx.testAnswer.update({
        where: { id: evaluation.answerId },
        data: {
          isCorrect: evaluation.evaluated.isCorrect,
          marksAwarded: evaluation.evaluated.marksAwarded,
        },
      });
    }

    await tx.testAttempt.update({
      where: { id: attemptId },
      data: {
        score: totals.score,
        maxScore: totals.maxScore,
        percentage: totals.percentage,
        accuracy: totals.accuracy,
        correctCount: totals.correctCount,
        incorrectCount: totals.incorrectCount,
        unansweredCount: totals.unansweredCount,
        attemptedCount: totals.attemptedCount,
        timeSpentSeconds,
      },
    });
  });

  logger.info(
    { attemptId, userId, reason, score: totals.score, maxScore: totals.maxScore },
    'Attempt submitted',
  );

  // Ranking and aggregate updates are deliberately outside the scoring
  // transaction: they touch every other attempt at this test, and a student
  // must never wait on that to see their own result.
  void recomputeRanking(attempt.testId).catch((error) =>
    logger.error({ error, testId: attempt.testId }, 'Ranking recomputation failed'),
  );

  return {
    attemptId,
    alreadySubmitted: false,
    score: totals.score,
    maxScore: totals.maxScore,
    percentage: totals.percentage,
    accuracy: totals.accuracy,
    correctCount: totals.correctCount,
    incorrectCount: totals.incorrectCount,
    unansweredCount: totals.unansweredCount,
  };
}

/**
 * Recomputes rank and percentile for every submitted attempt at a test, and
 * refreshes the test's cached aggregates.
 *
 * Ranks are relative, so one new submission can shift everyone. At current
 * scale a full recomputation is both simplest and fastest; if a single test
 * ever exceeds a few thousand attempts this should move to the job queue.
 */
export async function recomputeRanking(testId: string): Promise<void> {
  const attempts = await db.testAttempt.findMany({
    where: { testId, status: { in: [...TERMINAL_ATTEMPT_STATUSES] } },
    select: { id: true, score: true },
  });

  if (attempts.length === 0) return;

  const scores = attempts.map((a) => a.score);

  await db.$transaction(
    attempts.map((attempt) =>
      db.testAttempt.update({
        where: { id: attempt.id },
        data: {
          rank: computeRank(attempt.score, scores),
          percentile: computePercentile(attempt.score, scores),
          rankedAt: new Date(),
        },
      }),
    ),
  );

  const total = scores.reduce((sum, s) => sum + s, 0);
  await db.test.update({
    where: { id: testId },
    data: {
      attemptCount: attempts.length,
      avgScore: Math.round((total / attempts.length) * 100) / 100,
    },
  });
}

// ---------------------------------------------------------------------------
// Integrity events
// ---------------------------------------------------------------------------

/**
 * Records a client-reported integrity event.
 *
 * These are advisory signals, not proof: a tab switch may be a notification,
 * and the counters exist to surface patterns to a human reviewer. Nothing here
 * ends an attempt automatically.
 */
export async function recordAttemptEvent(params: {
  attemptId: string;
  userId: string;
  type: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const { attemptId, userId, type, meta } = params;

  const attempt = await db.testAttempt.findFirst({
    where: { id: attemptId, userId, status: 'IN_PROGRESS' },
    select: { id: true },
  });
  if (!attempt) return;

  await db.$transaction(async (tx) => {
    await tx.attemptEvent.create({
      data: { attemptId, type, metaJson: toJsonColumn(meta ?? {}) },
    });

    if (type === 'TAB_HIDDEN') {
      await tx.testAttempt.update({
        where: { id: attemptId },
        data: { tabSwitchCount: { increment: 1 } },
      });
    } else if (type === 'FULLSCREEN_EXIT') {
      await tx.testAttempt.update({
        where: { id: attemptId },
        data: { fullscreenExitCount: { increment: 1 } },
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

/** Full result payload, including the answer key — only after submission. */
export async function getAttemptResult(attemptId: string, userId: string) {
  const attempt = await db.testAttempt.findFirst({
    where: { id: attemptId, userId },
    select: {
      id: true,
      status: true,
      score: true,
      maxScore: true,
      percentage: true,
      accuracy: true,
      correctCount: true,
      incorrectCount: true,
      unansweredCount: true,
      attemptedCount: true,
      timeSpentSeconds: true,
      rank: true,
      percentile: true,
      startedAt: true,
      submittedAt: true,
      snapshotJson: true,
      test: { select: { id: true, title: true, slug: true, durationMinutes: true } },
      answers: {
        select: {
          testQuestionId: true,
          questionId: true,
          selectedOptionIdsJson: true,
          numericalValue: true,
          isCorrect: true,
          marksAwarded: true,
          timeSpentSeconds: true,
        },
      },
    },
  });

  if (!attempt) throw errors.notFound('Result');

  if (attempt.status === 'IN_PROGRESS') {
    throw new AppError('CONFLICT', 'This test has not been submitted yet.');
  }

  const snapshot = parseJsonColumn(attempt.snapshotJson, attemptSnapshotSchema, null as never);
  if (!snapshot) throw errors.internal('This result could not be loaded.');

  const questions = await db.question.findMany({
    where: { id: { in: snapshot.questions.map((q) => q.questionId) } },
    select: {
      id: true,
      code: true,
      body: true,
      passage: true,
      imageUrl: true,
      type: true,
      difficulty: true,
      explanation: true,
      detailedSolution: true,
      numericalAnswer: true,
      options: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, label: true, body: true, isCorrect: true },
      },
      subject: { select: { id: true, name: true } },
      chapter: { select: { id: true, name: true } },
      topic: { select: { id: true, name: true } },
    },
  });

  const questionById = new Map(questions.map((q) => [q.id, q]));
  const answerByTq = new Map(attempt.answers.map((a) => [a.testQuestionId, a]));

  const review = snapshot.questions
    .map((entry) => {
      const question = questionById.get(entry.questionId);
      const answer = answerByTq.get(entry.testQuestionId);
      if (!question) return null;

      const selected = answer
        ? parseJsonColumn(answer.selectedOptionIdsJson, selectedOptionIdsSchema, [])
        : [];

      const optionMap = new Map(question.options.map((o) => [o.id, o]));
      const ordered = entry.optionOrder
        .map((id) => optionMap.get(id))
        .filter((o): o is NonNullable<typeof o> => Boolean(o));

      // Same fallback as the live attempt: an edited question leaves the
      // snapshot's ids pointing at nothing, and a result page that shows the
      // question with no options tells a student nothing about why they were
      // marked as they were.
      const reviewOptions = ordered.length > 0 ? ordered : question.options;

      return {
        sortOrder: entry.sortOrder,
        testQuestionId: entry.testQuestionId,
        questionId: question.id,
        code: question.code,
        type: question.type,
        difficulty: question.difficulty,
        body: question.body,
        passage: question.passage,
        imageUrl: question.imageUrl,
        explanation: question.explanation,
        detailedSolution: question.detailedSolution,
        numericalAnswer: question.numericalAnswer,
        marks: entry.marks,
        negativeMarks: entry.negativeMarks,
        marksAwarded: answer?.marksAwarded ?? 0,
        isCorrect: answer?.isCorrect ?? null,
        timeSpentSeconds: answer?.timeSpentSeconds ?? 0,
        selectedOptionIds: selected,
        numericalValue: answer?.numericalValue ?? null,
        options: reviewOptions.map((o) => ({
          id: o.id,
          label: o.label,
          body: o.body,
          isCorrect: o.isCorrect,
          isSelected: selected.includes(o.id),
        })),
        subject: question.subject,
        chapter: question.chapter,
        topic: question.topic,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // Breakdowns reuse the same aggregation function as the analytics layer, so
  // the figures on the result page and in /analytics can never disagree.
  const toInput = (
    keyOf: (r: (typeof review)[number]) => { key: string; label: string } | null,
  ) =>
    review
      .map((r) => {
        const group = keyOf(r);
        if (!group) return null;
        return {
          groupKey: group.key,
          groupLabel: group.label,
          evaluated: {
            verdict: (r.isCorrect === null ? 'UNANSWERED' : r.isCorrect ? 'CORRECT' : 'INCORRECT') as
              | 'CORRECT'
              | 'INCORRECT'
              | 'UNANSWERED',
            isCorrect: r.isCorrect,
            marksAwarded: r.marksAwarded,
          },
          maxMarks: r.marks,
          timeSpentSeconds: r.timeSpentSeconds,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

  return {
    attempt: {
      id: attempt.id,
      status: attempt.status,
      score: attempt.score,
      maxScore: attempt.maxScore,
      percentage: attempt.percentage,
      accuracy: attempt.accuracy,
      correctCount: attempt.correctCount,
      incorrectCount: attempt.incorrectCount,
      unansweredCount: attempt.unansweredCount,
      attemptedCount: attempt.attemptedCount,
      timeSpentSeconds: attempt.timeSpentSeconds,
      rank: attempt.rank,
      percentile: attempt.percentile,
      submittedAt: attempt.submittedAt,
      durationMinutes: snapshot.durationMinutes,
    },
    test: attempt.test,
    review,
    breakdowns: {
      subject: buildBreakdown(
        toInput((r) => (r.subject ? { key: r.subject.id, label: r.subject.name } : null)),
      ),
      chapter: buildBreakdown(
        toInput((r) => (r.chapter ? { key: r.chapter.id, label: r.chapter.name } : null)),
      ),
      topic: buildBreakdown(
        toInput((r) => (r.topic ? { key: r.topic.id, label: r.topic.name } : null)),
      ),
      difficulty: buildBreakdown(toInput((r) => ({ key: r.difficulty, label: r.difficulty }))),
    },
  };
}
