import { AppError, errors } from '@/lib/api';
import { AUDIT_ACTIONS, audit } from '@/server/audit';
import { parseBody, route } from '@/server/api-handler';
import { requireAdmin } from '@/server/auth/guards';
import { db } from '@/server/db';
import { refreshTestTotals } from '@/server/services/admin-service';
import { importCommitSchema } from '@/validations/import';

/**
 * POST /api/admin/import/commit — create the reviewed questions and wire them up.
 *
 * Everything happens in one transaction. A partial import — half the questions
 * created, the test left inconsistent — would be worse than a clean failure,
 * because the admin would have no way to tell which half landed.
 */
export const POST = route(async ({ request, ip }) => {
  const admin = await requireAdmin();
  const input = await parseBody(request, importCommitSchema);

  const [exam, subject] = await Promise.all([
    db.exam.findFirst({ where: { id: input.examId, deletedAt: null }, select: { id: true, shortName: true } }),
    db.subject.findFirst({ where: { id: input.subjectId, deletedAt: null }, select: { id: true } }),
  ]);
  if (!exam) throw errors.notFound('Exam');
  if (!subject) throw errors.notFound('Subject');

  // Resolve the destination test before writing anything.
  let targetTestId: string | null = null;

  if (input.target === 'EXISTING_TEST') {
    const test = await db.test.findFirst({
      where: { id: input.testId!, deletedAt: null },
      select: { id: true },
    });
    if (!test) throw errors.notFound('Test');
    targetTestId = test.id;
  }

  // Question codes must be unique. Reserve a contiguous range up front rather
  // than probing inside the loop, which would be O(n) round trips.
  const existingCount = await db.question.count({ where: { examId: exam.id } });
  const taken = new Set(
    (
      await db.question.findMany({
        where: { examId: exam.id },
        select: { code: true },
      })
    ).map((q) => q.code),
  );

  let sequence = existingCount;
  const nextCode = () => {
    let code: string;
    do {
      sequence += 1;
      code = `${exam.shortName}-Q${String(sequence).padStart(4, '0')}`;
    } while (taken.has(code));
    taken.add(code);
    return code;
  };

  const status = input.publish ? 'PUBLISHED' : 'DRAFT';
  const now = new Date();

  const result = await db.$transaction(
    async (tx) => {
      // --- Questions -------------------------------------------------------
      const createdIds: string[] = [];

      for (const question of input.questions) {
        const created = await tx.question.create({
          data: {
            code: nextCode(),
            examId: exam.id,
            subjectId: subject.id,
            type: 'SINGLE_CORRECT',
            difficulty: question.difficulty,
            status,
            body: question.body,
            marks: input.marks,
            negativeMarks: input.negativeMarks,
            source: input.source ?? null,
            examYear: input.examYear ?? null,
            language: 'en',
            createdById: admin.id,
            reviewedById: admin.id,
            reviewedAt: now,
            publishedAt: input.publish ? now : null,
            // No explanation is invented. The paper supplied none, and a
            // fabricated one would be worse than an empty field.
            options: {
              create: question.options.map((option, index) => ({
                label: String.fromCharCode(65 + index),
                body: option.body,
                isCorrect: index === question.correctIndex,
                sortOrder: index,
              })),
            },
            stat: { create: {} },
          },
          select: { id: true },
        });

        createdIds.push(created.id);
      }

      // --- Test ------------------------------------------------------------
      if (input.target === 'NEW_TEST') {
        const base = input.title!
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '');

        let slug = base;
        let suffix = 1;
        while (await tx.test.findUnique({ where: { slug }, select: { id: true } })) {
          suffix += 1;
          slug = `${base}-${suffix}`;
        }

        const test = await tx.test.create({
          data: {
            examId: exam.id,
            testSeriesId: input.testSeriesId ?? null,
            title: input.title!,
            slug,
            category: input.category,
            mode: 'EXAM',
            // A newly imported test is never published automatically, even when
            // the questions are: an admin should look at it first.
            status: 'DRAFT',
            accessType: input.accessType,
            durationMinutes: input.durationMinutes,
            maxAttempts: input.maxAttempts,
            negativeMarkingEnabled: input.negativeMarks > 0,
            randomizeOptions: false,
            showResultImmediately: true,
            createdById: admin.id,
          },
          select: { id: true },
        });

        targetTestId = test.id;
      }

      if (targetTestId) {
        const offset = await tx.testQuestion.count({ where: { testId: targetTestId } });

        await tx.testQuestion.createMany({
          data: createdIds.map((questionId, index) => ({
            testId: targetTestId!,
            questionId,
            sortOrder: offset + index + 1,
            marks: input.marks,
            negativeMarks: input.negativeMarks,
          })),
        });
      }

      return { createdIds, testId: targetTestId };
    },
    // A 300-question import does a lot of inserts; the default 5s is not enough.
    { timeout: 120_000, maxWait: 20_000 },
  );

  if (result.testId) await refreshTestTotals(result.testId);

  await audit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: AUDIT_ACTIONS.QUESTION_IMPORTED,
    entityType: 'Question',
    meta: {
      count: result.createdIds.length,
      target: input.target,
      testId: result.testId,
      source: input.source,
      published: input.publish,
    },
    ipAddress: ip,
  });

  return {
    data: {
      created: result.createdIds.length,
      testId: result.testId,
      status,
    },
    message:
      result.testId !== null
        ? `Imported ${result.createdIds.length} questions and attached them to the test.`
        : `Imported ${result.createdIds.length} questions into the bank.`,
    status: 201,
  };
});
