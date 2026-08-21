import 'server-only';

import { AppError, errors } from '@/lib/api';
import type { QuestionType } from '@/lib/enums';
import { parseJsonColumn, selectedOptionIdsSchema, stringArraySchema, toJsonColumn } from '@/lib/json';
import { round, safeDivide, seededShuffle } from '@/lib/utils';
import { db } from '@/server/db';

import { evaluateAnswer, type QuestionKey, type SubmittedAnswer } from './scoring';

/**
 * Practice sessions.
 *
 * The opposite mode to a test: there is no clock, no ranking and no negative
 * marking, and the answer is revealed the moment the student commits to one.
 * Practice exists to teach, so the feedback loop is made as short as possible —
 * which is exactly why practice answers must never feed leaderboards or the
 * ranked percentile.
 */

/** Where the question pool is drawn from. */
export type PracticeSource = 'NEW' | 'INCORRECT' | 'BOOKMARKED' | 'ALL';

const MAX_QUESTIONS = 50;
const DEFAULT_QUESTIONS = 10;

export interface StartPracticeParams {
  userId: string;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  source?: PracticeSource;
  count?: number;
}

/**
 * Builds a question pool and opens a session.
 *
 * Throws rather than silently returning an empty session when the filters match
 * nothing — a student who asked for "hard Polity questions I got wrong" and has
 * none deserves to be told, not handed a blank screen.
 */
export async function startPracticeSession(params: StartPracticeParams) {
  const {
    userId,
    subjectId,
    chapterId,
    topicId,
    difficulty,
    source = 'NEW',
    count = DEFAULT_QUESTIONS,
  } = params;

  const limit = Math.min(Math.max(1, count), MAX_QUESTIONS);

  // Resume an open session rather than stacking them up.
  const existing = await db.practiceSession.findFirst({
    where: { userId, status: 'IN_PROGRESS' },
    orderBy: { startedAt: 'desc' },
    select: { id: true },
  });
  if (existing) return { sessionId: existing.id, resumed: true as const };

  const scope = {
    ...(topicId ? { topicId } : {}),
    ...(chapterId && !topicId ? { chapterId } : {}),
    ...(subjectId && !chapterId && !topicId ? { subjectId } : {}),
    ...(difficulty ? { difficulty } : {}),
  };

  // --- Source-specific id sets ------------------------------------------
  let restrictTo: string[] | null = null;
  let exclude: string[] = [];

  if (source === 'BOOKMARKED') {
    const marks = await db.bookmark.findMany({
      where: { userId },
      select: { questionId: true },
    });
    restrictTo = marks.map((m) => m.questionId);
  } else if (source === 'INCORRECT') {
    const [testWrong, practiceWrong] = await Promise.all([
      db.testAnswer.findMany({
        where: { attempt: { userId }, isCorrect: false },
        select: { questionId: true },
        distinct: ['questionId'],
      }),
      db.practiceAnswer.findMany({
        where: { session: { userId }, isCorrect: false },
        select: { questionId: true },
        distinct: ['questionId'],
      }),
    ]);
    restrictTo = [...new Set([...testWrong, ...practiceWrong].map((r) => r.questionId))];
  } else if (source === 'NEW') {
    // Anything already seen, in a test or in practice, is not "new".
    const [seenTest, seenPractice] = await Promise.all([
      db.testAnswer.findMany({
        where: { attempt: { userId } },
        select: { questionId: true },
        distinct: ['questionId'],
      }),
      db.practiceAnswer.findMany({
        where: { session: { userId } },
        select: { questionId: true },
        distinct: ['questionId'],
      }),
    ]);
    exclude = [...new Set([...seenTest, ...seenPractice].map((r) => r.questionId))];
  }

  if (restrictTo !== null && restrictTo.length === 0) {
    throw new AppError(
      'NOT_FOUND',
      source === 'BOOKMARKED'
        ? 'You have not bookmarked any questions yet.'
        : 'You have no incorrect questions to review — nothing to practise here yet.',
    );
  }

  const pool = await db.question.findMany({
    where: {
      status: 'PUBLISHED',
      deletedAt: null,
      ...scope,
      ...(restrictTo ? { id: { in: restrictTo } } : {}),
      ...(exclude.length > 0 ? { id: { notIn: exclude } } : {}),
    },
    select: { id: true },
    // Over-fetch so the shuffle has room, without loading the whole bank.
    take: limit * 5,
  });

  if (pool.length === 0) {
    throw new AppError(
      'NOT_FOUND',
      source === 'NEW'
        ? 'You have already practised every question matching those filters. Try a different topic, or switch the source to "All questions".'
        : 'No questions match those filters yet.',
    );
  }

  const chosen = seededShuffle(
    pool.map((q) => q.id),
    `${userId}:${Date.now()}`,
  ).slice(0, limit);

  const session = await db.practiceSession.create({
    data: {
      userId,
      subjectId: subjectId ?? null,
      chapterId: chapterId ?? null,
      topicId: topicId ?? null,
      difficulty: difficulty ?? null,
      source,
      status: 'IN_PROGRESS',
      questionIdsJson: toJsonColumn(chosen),
      questionCount: chosen.length,
    },
    select: { id: true },
  });

  return { sessionId: session.id, resumed: false as const };
}

// ---------------------------------------------------------------------------

/**
 * Loads a session for the practice UI.
 *
 * Unlike a test, the answer key *is* included — practice reveals the solution
 * as soon as the student answers, and round-tripping to the server for it would
 * make the feedback feel sluggish. Nothing here is scored competitively, so
 * there is no integrity cost.
 */
export async function getPracticeSession(sessionId: string, userId: string) {
  const session = await db.practiceSession.findFirst({
    where: { id: sessionId, userId },
    select: {
      id: true,
      status: true,
      source: true,
      difficulty: true,
      questionIdsJson: true,
      questionCount: true,
      attemptedCount: true,
      correctCount: true,
      incorrectCount: true,
      timeSpentSeconds: true,
      accuracy: true,
      startedAt: true,
      completedAt: true,
      subject: { select: { id: true, name: true } },
      chapter: { select: { id: true, name: true } },
      topic: { select: { id: true, name: true } },
      answers: {
        select: {
          questionId: true,
          selectedOptionIdsJson: true,
          numericalValue: true,
          isCorrect: true,
          timeSpentSeconds: true,
        },
      },
    },
  });

  if (!session) throw errors.notFound('Practice session');

  const questionIds = parseJsonColumn(session.questionIdsJson, stringArraySchema, []);

  const questions = await db.question.findMany({
    where: { id: { in: questionIds } },
    select: {
      id: true,
      type: true,
      difficulty: true,
      body: true,
      passage: true,
      imageUrl: true,
      marks: true,
      explanation: true,
      detailedSolution: true,
      numericalAnswer: true,
      numericalTolerance: true,
      options: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, label: true, body: true, isCorrect: true },
      },
      subject: { select: { name: true } },
      chapter: { select: { name: true } },
      topic: { select: { id: true, name: true } },
    },
  });

  const byId = new Map(questions.map((q) => [q.id, q]));
  const bookmarks = await db.bookmark.findMany({
    where: { userId, questionId: { in: questionIds } },
    select: { questionId: true },
  });
  const bookmarked = new Set(bookmarks.map((b) => b.questionId));

  const answerByQuestion = new Map(session.answers.map((a) => [a.questionId, a]));

  // Preserve the session's stored order, dropping anything withdrawn since.
  const ordered = questionIds
    .map((id, index) => {
      const question = byId.get(id);
      if (!question) return null;
      const answer = answerByQuestion.get(id);

      return {
        index,
        questionId: question.id,
        type: question.type as QuestionType,
        difficulty: question.difficulty,
        body: question.body,
        passage: question.passage,
        imageUrl: question.imageUrl,
        marks: question.marks,
        explanation: question.explanation,
        detailedSolution: question.detailedSolution,
        numericalAnswer: question.numericalAnswer,
        options: question.options.map((o) => ({
          id: o.id,
          label: o.label,
          body: o.body,
          isCorrect: o.isCorrect,
        })),
        subject: question.subject?.name ?? null,
        chapter: question.chapter?.name ?? null,
        topic: question.topic,
        isBookmarked: bookmarked.has(question.id),
        answer: answer
          ? {
              selectedOptionIds: parseJsonColumn(
                answer.selectedOptionIdsJson,
                selectedOptionIdsSchema,
                [],
              ),
              numericalValue: answer.numericalValue,
              isCorrect: answer.isCorrect,
            }
          : null,
      };
    })
    .filter((q): q is NonNullable<typeof q> => q !== null);

  return {
    id: session.id,
    status: session.status,
    source: session.source,
    scope:
      session.topic?.name ?? session.chapter?.name ?? session.subject?.name ?? 'All subjects',
    questionCount: ordered.length,
    attemptedCount: session.attemptedCount,
    correctCount: session.correctCount,
    incorrectCount: session.incorrectCount,
    accuracy: session.accuracy,
    timeSpentSeconds: session.timeSpentSeconds,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    questions: ordered,
  };
}

// ---------------------------------------------------------------------------

export interface AnswerPracticeParams {
  sessionId: string;
  userId: string;
  questionId: string;
  selectedOptionIds?: string[];
  numericalValue?: number | null;
  timeSpentSeconds?: number;
}

/**
 * Records an answer and marks it immediately.
 *
 * Idempotent per question: answering twice keeps the first response, so a
 * double-click cannot inflate the session's counters or overwrite what the
 * student actually chose.
 */
export async function answerPracticeQuestion(params: AnswerPracticeParams) {
  const {
    sessionId,
    userId,
    questionId,
    selectedOptionIds = [],
    numericalValue = null,
    timeSpentSeconds = 0,
  } = params;

  const session = await db.practiceSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, status: true, questionIdsJson: true },
  });
  if (!session) throw errors.notFound('Practice session');
  if (session.status !== 'IN_PROGRESS') {
    throw new AppError('CONFLICT', 'This practice session has already been completed.');
  }

  const questionIds = parseJsonColumn(session.questionIdsJson, stringArraySchema, []);
  if (!questionIds.includes(questionId)) {
    throw errors.badRequest('That question is not part of this practice session.');
  }

  const existing = await db.practiceAnswer.findUnique({
    where: { sessionId_questionId: { sessionId, questionId } },
    select: { id: true, isCorrect: true },
  });
  if (existing) {
    return { isCorrect: existing.isCorrect, alreadyAnswered: true as const };
  }

  const question = await db.question.findUniqueOrThrow({
    where: { id: questionId },
    select: {
      id: true,
      type: true,
      marks: true,
      numericalAnswer: true,
      numericalTolerance: true,
      options: { where: { isCorrect: true }, select: { id: true } },
    },
  });

  const key: QuestionKey = {
    questionId: question.id,
    type: question.type as QuestionType,
    marks: question.marks,
    // Practice never penalises. The point is to learn, not to simulate risk.
    negativeMarks: 0,
    correctOptionIds: question.options.map((o) => o.id),
    numericalAnswer: question.numericalAnswer,
    numericalTolerance: question.numericalTolerance,
  };

  const submitted: SubmittedAnswer = { selectedOptionIds, numericalValue };
  const verdict = evaluateAnswer(key, submitted, { negativeMarkingEnabled: false });
  const isCorrect = verdict.isCorrect === true;

  await db.$transaction(async (tx) => {
    await tx.practiceAnswer.create({
      data: {
        sessionId,
        questionId,
        selectedOptionIdsJson: toJsonColumn(selectedOptionIds),
        numericalValue,
        isCorrect,
        timeSpentSeconds: Math.max(0, Math.min(timeSpentSeconds, 3600)),
        answeredAt: new Date(),
        revealedAt: new Date(),
      },
    });

    const updated = await tx.practiceSession.update({
      where: { id: sessionId },
      data: {
        attemptedCount: { increment: 1 },
        correctCount: { increment: isCorrect ? 1 : 0 },
        incorrectCount: { increment: isCorrect ? 0 : 1 },
        timeSpentSeconds: { increment: Math.max(0, Math.min(timeSpentSeconds, 3600)) },
      },
      select: { attemptedCount: true, correctCount: true },
    });

    await tx.practiceSession.update({
      where: { id: sessionId },
      data: {
        accuracy: round(safeDivide(updated.correctCount, updated.attemptedCount) * 100, 1),
      },
    });

    // Per-question aggregates power the "% of students who got this right"
    // figure shown in review, and feed observed-difficulty reporting for the
    // content team.
    const stat = await tx.questionStat.upsert({
      where: { questionId },
      create: {
        questionId,
        attemptCount: 1,
        correctCount: isCorrect ? 1 : 0,
        incorrectCount: isCorrect ? 0 : 1,
      },
      update: {
        attemptCount: { increment: 1 },
        correctCount: { increment: isCorrect ? 1 : 0 },
        incorrectCount: { increment: isCorrect ? 0 : 1 },
      },
      select: { attemptCount: true, correctCount: true },
    });

    // Derived from the counters just written, so the two can never disagree.
    await tx.questionStat.update({
      where: { questionId },
      data: {
        accuracy: round(safeDivide(stat.correctCount, stat.attemptCount) * 100, 1),
        lastComputedAt: new Date(),
      },
    });
  });

  return { isCorrect, alreadyAnswered: false as const };
}

// ---------------------------------------------------------------------------

/** Closes a session and returns its summary. */
export async function completePracticeSession(sessionId: string, userId: string) {
  const session = await db.practiceSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, status: true },
  });
  if (!session) throw errors.notFound('Practice session');

  if (session.status === 'IN_PROGRESS') {
    await db.practiceSession.update({
      where: { id: sessionId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }

  return getPracticeSession(sessionId, userId);
}

/** Filter options for the practice setup screen, with live question counts. */
export async function getPracticeFilters(userId: string) {
  const [subjects, bookmarkCount, incorrectCount] = await Promise.all([
    db.subject.findMany({
      where: { isActive: true, deletedAt: null, questions: { some: { status: 'PUBLISHED' } } },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        colorHex: true,
        exam: { select: { shortName: true } },
        _count: { select: { questions: { where: { status: 'PUBLISHED', deletedAt: null } } } },
        chapters: {
          where: { isActive: true, deletedAt: null },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            _count: { select: { questions: { where: { status: 'PUBLISHED', deletedAt: null } } } },
          },
        },
      },
    }),
    db.bookmark.count({ where: { userId } }),
    db.testAnswer
      .findMany({
        where: { attempt: { userId }, isCorrect: false },
        select: { questionId: true },
        distinct: ['questionId'],
      })
      .then((rows) => rows.length),
  ]);

  return {
    subjects: subjects
      .filter((s) => s._count.questions > 0)
      .map((s) => ({
        id: s.id,
        name: s.name,
        colorHex: s.colorHex,
        examShortName: s.exam.shortName,
        questionCount: s._count.questions,
        chapters: s.chapters
          .filter((c) => c._count.questions > 0)
          .map((c) => ({ id: c.id, name: c.name, questionCount: c._count.questions })),
      })),
    bookmarkCount,
    incorrectCount,
  };
}

/** Recent practice history for the practice landing page. */
export async function getRecentPracticeSessions(userId: string, limit = 10) {
  return db.practiceSession.findMany({
    where: { userId },
    orderBy: { startedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      status: true,
      source: true,
      questionCount: true,
      attemptedCount: true,
      correctCount: true,
      accuracy: true,
      timeSpentSeconds: true,
      startedAt: true,
      completedAt: true,
      subject: { select: { name: true } },
      chapter: { select: { name: true } },
      topic: { select: { name: true } },
    },
  });
}
