import 'server-only';

import { cache } from 'react';

import { TERMINAL_ATTEMPT_STATUSES } from '@/lib/enums';
import { round, safeDivide } from '@/lib/utils';
import { db } from '@/server/db';

/**
 * Admin read models.
 *
 * The overview deliberately reports operational health — what is unpublished,
 * what is unanswered, what has been reported — rather than vanity totals. An
 * admin opening this page needs to know what is waiting for them, not how many
 * rows exist.
 */

export const getAdminOverview = cache(async () => {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

  const [
    questionsTotal,
    questionsPublished,
    questionsDraft,
    questionsFlagged,
    testsTotal,
    testsPublished,
    testsEmpty,
    students,
    newStudents,
    attemptsTotal,
    attemptsWeek,
    openTickets,
    openReports,
    paidOrders,
    revenue,
  ] = await Promise.all([
    db.question.count({ where: { deletedAt: null } }),
    db.question.count({ where: { deletedAt: null, status: 'PUBLISHED' } }),
    db.question.count({ where: { deletedAt: null, status: 'DRAFT' } }),
    db.question.count({ where: { deletedAt: null, reviewNote: { not: null } } }),
    db.test.count({ where: { deletedAt: null } }),
    db.test.count({ where: { deletedAt: null, status: 'PUBLISHED' } }),
    // A published test with no questions is the single most embarrassing state
    // the platform can be in, so it gets its own counter.
    db.test.count({ where: { deletedAt: null, status: 'PUBLISHED', totalQuestions: 0 } }),
    db.user.count({ where: { role: 'STUDENT', deletedAt: null } }),
    db.user.count({ where: { role: 'STUDENT', deletedAt: null, createdAt: { gte: weekAgo } } }),
    db.testAttempt.count({ where: { status: { in: [...TERMINAL_ATTEMPT_STATUSES] } } }),
    db.testAttempt.count({
      where: { status: { in: [...TERMINAL_ATTEMPT_STATUSES] }, submittedAt: { gte: weekAgo } },
    }),
    db.supportTicket.count({ where: { status: { in: ['OPEN', 'WAITING'] } } }),
    // REPORTED/REVIEWING, not 'OPEN' — that status does not exist on this
    // model, so the dashboard reported zero however many were waiting.
    db.questionReport.count({ where: { status: { in: ['REPORTED', 'REVIEWING'] } } }),
    db.order.count({ where: { status: 'PAID' } }),
    db.order.aggregate({ where: { status: 'PAID' }, _sum: { totalInPaise: true } }),
  ]);

  return {
    questions: {
      total: questionsTotal,
      published: questionsPublished,
      draft: questionsDraft,
      flagged: questionsFlagged,
    },
    tests: { total: testsTotal, published: testsPublished, empty: testsEmpty },
    students: { total: students, newThisWeek: newStudents },
    attempts: { total: attemptsTotal, thisWeek: attemptsWeek },
    inbox: { openTickets, openReports },
    commerce: { paidOrders, revenueInPaise: revenue._sum.totalInPaise ?? 0 },
  };
});

/** Most recent student activity, for the dashboard feed. */
export const getRecentActivity = cache(async (limit = 8) => {
  const attempts = await db.testAttempt.findMany({
    where: { status: { in: [...TERMINAL_ATTEMPT_STATUSES] } },
    orderBy: { submittedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      score: true,
      maxScore: true,
      percentage: true,
      submittedAt: true,
      user: { select: { name: true } },
      test: { select: { title: true } },
    },
  });

  return attempts;
});

/**
 * Tests that are published but unattemptable.
 *
 * Surfaced prominently because a student clicking one gets a dead end, and
 * nothing else in the admin UI would reveal it.
 */
export const getIncompleteTests = cache(async (limit = 10) =>
  db.test.findMany({
    where: { deletedAt: null, status: 'PUBLISHED', totalQuestions: 0 },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      title: true,
      slug: true,
      category: true,
      testSeries: { select: { name: true } },
    },
  }),
);

// ---------------------------------------------------------------------------
// Question bank
// ---------------------------------------------------------------------------

export interface QuestionFilters {
  search?: string;
  examId?: string;
  subjectId?: string;
  status?: string;
  difficulty?: string;
  flagged?: boolean;
  /** Narrow to the questions on one paper. */
  testId?: string;
  page?: number;
  pageSize?: number;
}

export async function listQuestions(filters: QuestionFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));

  const where = {
    deletedAt: null,
    ...(filters.examId ? { examId: filters.examId } : {}),
    ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.difficulty ? { difficulty: filters.difficulty } : {}),
    ...(filters.flagged ? { reviewNote: { not: null } } : {}),
    ...(filters.testId ? { testQuestions: { some: { testId: filters.testId } } } : {}),
    ...(filters.search
      ? {
          OR: [
            { body: { contains: filters.search } },
            { code: { contains: filters.search } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    db.question.findMany({
      where,
      // Newest first across the whole bank, but a paper is read in its own
      // order — an editor checking question 40 wants it between 39 and 41.
      orderBy: filters.testId ? { code: 'asc' } : { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        code: true,
        body: true,
        type: true,
        difficulty: true,
        status: true,
        marks: true,
        negativeMarks: true,
        source: true,
        examYear: true,
        reviewNote: true,
        createdAt: true,
        exam: { select: { shortName: true } },
        subject: { select: { name: true, colorHex: true } },
        topic: { select: { name: true } },
        _count: { select: { testQuestions: true } },
        stat: { select: { attemptCount: true, accuracy: true } },
      },
    }),
    db.question.count({ where }),
  ]);

  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * The papers an editor picks between, grouped by series.
 *
 * A flat list of 1,273 questions is not something anyone can work through:
 * finding the 2011 Paper II questions meant paging past a thousand others.
 * Content work happens one paper at a time, so the bank opens on the papers.
 *
 * Includes unpublished tests and empty ones — those are exactly the papers
 * needing work, and hiding them would hide the job.
 */
export interface PaperGroup {
  seriesName: string;
  seriesSlug: string;
  papers: {
    id: string;
    title: string;
    slug: string;
    status: string;
    questionCount: number;
  }[];
}

export async function listPaperGroups(): Promise<PaperGroup[]> {
  const tests = await db.test.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      testSeries: { select: { name: true, slug: true } },
      _count: { select: { questions: true } },
    },
    orderBy: { slug: 'asc' },
  });

  const groups = new Map<string, PaperGroup>();

  for (const test of tests) {
    const name = test.testSeries?.name ?? 'Standalone tests';
    const slug = test.testSeries?.slug ?? 'standalone';

    const group = groups.get(slug) ?? { seriesName: name, seriesSlug: slug, papers: [] };
    group.papers.push({
      id: test.id,
      title: test.title,
      slug: test.slug,
      status: test.status,
      questionCount: test._count.questions,
    });
    groups.set(slug, group);
  }

  // Papers within a series read in their printed order, and the most recent
  // year is the one being worked on, so series come newest first.
  return [...groups.values()].sort((a, b) => b.seriesSlug.localeCompare(a.seriesSlug));
}

/** Full question record for the editor. */
export async function getQuestionForEdit(id: string) {
  return db.question.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      code: true,
      examId: true,
      subjectId: true,
      chapterId: true,
      topicId: true,
      type: true,
      difficulty: true,
      status: true,
      body: true,
      passage: true,
      imageUrl: true,
      marks: true,
      negativeMarks: true,
      numericalAnswer: true,
      numericalTolerance: true,
      explanation: true,
      detailedSolution: true,
      concept: true,
      source: true,
      examYear: true,
      reviewNote: true,
      options: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          label: true,
          body: true,
          imageUrl: true,
          isCorrect: true,
          sortOrder: true,
        },
      },
    },
  });
}

/** Exam → subject → chapter → topic tree, for the editor's selectors. */
export const getTaxonomyTree = cache(async () =>
  db.exam.findMany({
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      shortName: true,
      subjects: {
        where: { deletedAt: null },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          chapters: {
            where: { deletedAt: null },
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              name: true,
              topics: {
                where: { deletedAt: null },
                orderBy: { sortOrder: 'asc' },
                select: { id: true, name: true },
              },
            },
          },
        },
      },
    },
  }),
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

export async function listTests(filters: { search?: string; status?: string; page?: number } = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = 25;

  const where = {
    deletedAt: null,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search ? { title: { contains: filters.search } } : {}),
  };

  const [rows, total] = await Promise.all([
    db.test.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        status: true,
        accessType: true,
        durationMinutes: true,
        totalQuestions: true,
        totalMarks: true,
        maxAttempts: true,
        attemptCount: true,
        avgScore: true,
        exam: { select: { shortName: true } },
        testSeries: { select: { name: true } },
      },
    }),
    db.test.count({ where }),
  ]);

  return { rows, total, page, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** A test plus its attached questions, for the builder. */
export async function getTestForEdit(id: string) {
  const test = await db.test.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      instructions: true,
      category: true,
      mode: true,
      status: true,
      accessType: true,
      durationMinutes: true,
      totalQuestions: true,
      totalMarks: true,
      passingMarks: true,
      maxAttempts: true,
      negativeMarkingEnabled: true,
      defaultNegativeRatio: true,
      randomizeQuestions: true,
      randomizeOptions: true,
      showResultImmediately: true,
      startDate: true,
      endDate: true,
      examId: true,
      testSeriesId: true,
      questions: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          sortOrder: true,
          marks: true,
          negativeMarks: true,
          question: {
            select: {
              id: true,
              code: true,
              body: true,
              type: true,
              difficulty: true,
              status: true,
              subject: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  return test;
}

/** Recomputes a test's cached totals from its attached questions. */
export async function refreshTestTotals(testId: string) {
  const rows = await db.testQuestion.findMany({
    where: { testId },
    select: { marks: true },
  });

  const totalMarks = rows.reduce((sum, r) => sum + r.marks, 0);

  await db.test.update({
    where: { id: testId },
    data: {
      totalQuestions: rows.length,
      totalMarks: round(totalMarks, 2),
    },
  });

  return { totalQuestions: rows.length, totalMarks: round(totalMarks, 2) };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function listUsers(
  filters: { search?: string; role?: string; source?: string; page?: number } = {},
) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = 25;

  // Digits only, and only when the search actually contains some. An empty
  // `contains` matches every row that has a phone number, which would quietly
  // turn a name search into "everyone with a phone".
  const searchDigits = (filters.search ?? '').replace(/\D/g, '');

  const where = {
    deletedAt: null,
    ...(filters.role ? { role: filters.role } : {}),
    ...(filters.source ? { signupSource: filters.source } : {}),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search } },
            { emailNormal: { contains: filters.search.toLowerCase() } },
            // Guest leads are looked up by number far more often than by name.
            ...(searchDigits.length >= 4 ? [{ phone: { contains: searchDigits } }] : []),
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        emailVerified: true,
        phone: true,
        signupSource: true,
        lastLoginAt: true,
        createdAt: true,
        _count: { select: { attempts: true, orders: true } },
      },
    }),
    db.user.count({ where }),
  ]);

  return { rows, total, page, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Platform-wide analytics for the admin analytics page. */
export const getPlatformAnalytics = cache(async () => {
  const [attempts, byTest, subjects] = await Promise.all([
    db.testAttempt.findMany({
      where: { status: { in: [...TERMINAL_ATTEMPT_STATUSES] } },
      select: { score: true, maxScore: true, accuracy: true, timeSpentSeconds: true },
    }),
    db.test.findMany({
      where: { deletedAt: null, attemptCount: { gt: 0 } },
      orderBy: { attemptCount: 'desc' },
      take: 10,
      select: { id: true, title: true, attemptCount: true, avgScore: true, totalMarks: true },
    }),
    db.question.groupBy({
      by: ['subjectId'],
      where: { deletedAt: null, status: 'PUBLISHED' },
      _count: { _all: true },
    }),
  ]);

  const subjectNames = await db.subject.findMany({
    where: { id: { in: subjects.map((s) => s.subjectId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(subjectNames.map((s) => [s.id, s.name]));

  const avgAccuracy = attempts.length
    ? round(attempts.reduce((sum, a) => sum + a.accuracy, 0) / attempts.length, 1)
    : 0;

  return {
    totalAttempts: attempts.length,
    avgAccuracy,
    avgScorePercent: attempts.length
      ? round(
          attempts.reduce((sum, a) => sum + safeDivide(a.score, a.maxScore) * 100, 0) /
            attempts.length,
          1,
        )
      : 0,
    totalTimeSeconds: attempts.reduce((sum, a) => sum + a.timeSpentSeconds, 0),
    popularTests: byTest,
    questionsBySubject: subjects
      .map((s) => ({ name: nameById.get(s.subjectId) ?? 'Unknown', count: s._count._all }))
      .sort((a, b) => b.count - a.count),
  };
});
