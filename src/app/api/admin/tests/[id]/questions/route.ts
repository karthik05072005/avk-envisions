import { errors } from '@/lib/api';
import { AUDIT_ACTIONS, audit } from '@/server/audit';
import { parseBody, route } from '@/server/api-handler';
import { requireAdmin } from '@/server/auth/guards';
import { db } from '@/server/db';
import { refreshTestTotals } from '@/server/services/admin-service';
import { testQuestionsSchema } from '@/validations/admin';

/**
 * POST /api/admin/tests/[id]/questions — attach, detach or reorder questions.
 *
 * Every branch ends by recomputing the test's cached totals, so
 * `totalQuestions` and `totalMarks` can never drift from what is actually
 * attached. Those two fields drive the student-facing catalogue and the
 * "published but empty" warning, so a stale value is not cosmetic.
 */
export const POST = route(async ({ request, params, ip }) => {
  const admin = await requireAdmin();
  const input = await parseBody(request, testQuestionsSchema);
  const testId = params.id!;

  const test = await db.test.findFirst({
    where: { id: testId, deletedAt: null },
    select: { id: true, title: true, defaultNegativeRatio: true },
  });
  if (!test) throw errors.notFound('Test');

  if (input.action === 'attach') {
    // Only attach questions that exist, are not archived, and are not already
    // on the test — silently skipping the rest beats failing the whole batch.
    const existing = await db.testQuestion.findMany({
      where: { testId },
      select: { questionId: true, sortOrder: true },
    });
    const already = new Set(existing.map((row) => row.questionId));
    let nextOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder), 0);

    const usable = await db.question.findMany({
      where: {
        id: { in: input.questionIds.filter((qid) => !already.has(qid)) },
        deletedAt: null,
      },
      select: { id: true, marks: true, negativeMarks: true },
    });

    for (const question of usable) {
      nextOrder += 1;
      await db.testQuestion.create({
        data: {
          testId,
          questionId: question.id,
          sortOrder: nextOrder,
          // Marks default to the question's own, so a test inherits the
          // authored value unless an admin overrides it later.
          marks: question.marks,
          negativeMarks: question.negativeMarks,
        },
      });
    }

    const totals = await refreshTestTotals(testId);

    await audit({
      actor: { id: admin.id, email: admin.email, role: admin.role },
      action: AUDIT_ACTIONS.TEST_UPDATED,
      entityType: 'Test',
      entityId: testId,
      meta: { attached: usable.length, totalQuestions: totals.totalQuestions },
      ipAddress: ip,
    });

    return {
      data: { attached: usable.length, skipped: input.questionIds.length - usable.length, ...totals },
      message:
        usable.length === 0
          ? 'Those questions are already on this test.'
          : `Added ${usable.length} question${usable.length === 1 ? '' : 's'}.`,
    };
  }

  if (input.action === 'detach') {
    const removed = await db.testQuestion.deleteMany({
      where: { testId, questionId: { in: input.questionIds } },
    });

    const totals = await refreshTestTotals(testId);

    return {
      data: { detached: removed.count, ...totals },
      message: `Removed ${removed.count} question${removed.count === 1 ? '' : 's'}.`,
    };
  }

  // --- reorder -------------------------------------------------------------
  const owned = await db.testQuestion.findMany({
    where: { testId },
    select: { id: true },
  });
  const valid = new Set(owned.map((row) => row.id));

  await db.$transaction(
    input.order
      .filter((rowId) => valid.has(rowId))
      .map((rowId, index) =>
        db.testQuestion.update({ where: { id: rowId }, data: { sortOrder: index + 1 } }),
      ),
  );

  const totals = await refreshTestTotals(testId);

  return { data: totals, message: 'Order saved.' };
});
