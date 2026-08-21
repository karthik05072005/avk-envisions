import { AUDIT_ACTIONS, audit } from '@/server/audit';
import { errors } from '@/lib/api';
import { parseBody, route } from '@/server/api-handler';
import { requireAdmin } from '@/server/auth/guards';
import { db } from '@/server/db';
import { questionSchema } from '@/validations/admin';

/** PUT /api/admin/questions/[id] — update a question and rebuild its options. */
export const PUT = route(async ({ request, params, ip }) => {
  const admin = await requireAdmin();
  const input = await parseBody(request, questionSchema);
  const id = params.id!;

  const existing = await db.question.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, code: true, status: true, publishedAt: true },
  });
  if (!existing) throw errors.notFound('Question');

  await db.$transaction(async (tx) => {
    await tx.question.update({
      where: { id },
      data: {
        examId: input.examId,
        subjectId: input.subjectId,
        chapterId: input.chapterId ?? null,
        topicId: input.topicId ?? null,
        type: input.type,
        difficulty: input.difficulty,
        status: input.status,
        body: input.body,
        passage: input.passage ?? null,
        imageUrl: input.imageUrl || null,
        marks: input.marks,
        negativeMarks: input.negativeMarks,
        numericalAnswer: input.numericalAnswer ?? null,
        numericalTolerance: input.numericalTolerance ?? null,
        explanation: input.explanation ?? null,
        detailedSolution: input.detailedSolution ?? null,
        concept: input.concept ?? null,
        source: input.source ?? null,
        examYear: input.examYear ?? null,
        reviewNote: input.reviewNote ?? null,
        // Preserve the original publish timestamp; only set it on first publish.
        publishedAt:
          input.status === 'PUBLISHED' ? (existing.publishedAt ?? new Date()) : existing.publishedAt,
      },
    });

    // Options are rebuilt wholesale. Editing in place would require matching
    // rows the client may have reordered or removed, and a stale option left
    // behind is exactly the kind of bug that mis-marks a paper.
    await tx.questionOption.deleteMany({ where: { questionId: id } });
    if (input.options.length > 0) {
      await tx.questionOption.createMany({
        data: input.options.map((option, index) => ({
          questionId: id,
          label: String.fromCharCode(65 + index),
          body: option.body,
          isCorrect: option.isCorrect,
          sortOrder: index,
        })),
      });
    }
  });

  await audit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: AUDIT_ACTIONS.QUESTION_UPDATED,
    entityType: 'Question',
    entityId: id,
    meta: { code: existing.code, status: input.status },
    ipAddress: ip,
  });

  return { data: { id, code: existing.code }, message: 'Question saved.' };
});

/**
 * DELETE /api/admin/questions/[id] — soft delete.
 *
 * Never a hard delete: the question may be referenced by submitted attempts,
 * and removing it would corrupt results that students have already seen.
 */
export const DELETE = route(async ({ params, ip }) => {
  const admin = await requireAdmin();
  const id = params.id!;

  const question = await db.question.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, code: true, _count: { select: { testQuestions: true } } },
  });
  if (!question) throw errors.notFound('Question');

  await db.question.update({
    where: { id },
    data: { deletedAt: new Date(), status: 'ARCHIVED' },
  });

  await audit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: AUDIT_ACTIONS.QUESTION_DELETED,
    entityType: 'Question',
    entityId: id,
    meta: { code: question.code, attachedToTests: question._count.testQuestions },
    ipAddress: ip,
  });

  return {
    data: { deleted: true, wasAttachedTo: question._count.testQuestions },
    message:
      question._count.testQuestions > 0
        ? `Archived. It was attached to ${question._count.testQuestions} test(s); existing results are unaffected.`
        : 'Question archived.',
  };
});
