import { AppError, errors } from '@/lib/api';
import { AUDIT_ACTIONS, audit } from '@/server/audit';
import { parseBody, route } from '@/server/api-handler';
import { requireAdmin } from '@/server/auth/guards';
import { db } from '@/server/db';
import { testSchema } from '@/validations/admin';

/**
 * PUT /api/admin/tests/[id] — update a test's configuration.
 *
 * Refuses to publish a test with no questions. Publishing an empty test puts a
 * Start button in front of students that cannot work, and nothing downstream
 * would catch it.
 */
export const PUT = route(async ({ request, params, ip }) => {
  const admin = await requireAdmin();
  const input = await parseBody(request, testSchema);
  const id = params.id!;

  const existing = await db.test.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, title: true, status: true, publishedAt: true, totalQuestions: true },
  });
  if (!existing) throw errors.notFound('Test');

  if (input.status === 'PUBLISHED' && existing.totalQuestions === 0) {
    throw new AppError(
      'BAD_REQUEST',
      'This test has no questions yet, so it cannot be published — students would hit a dead end. Attach questions first.',
    );
  }

  const clash = await db.test.findFirst({
    where: { slug: input.slug, NOT: { id } },
    select: { id: true },
  });
  if (clash) throw new AppError('CONFLICT', 'Another test already uses that URL slug.');

  await db.test.update({
    where: { id },
    data: {
      examId: input.examId,
      // `undefined` means "leave alone" to Prisma; `null` means "clear it".
      // Collapsing both to null detached a test from its series whenever the
      // caller simply did not send the field — which silently removed a day
      // from the fifty-day challenge and lost its schedule date with it.
      testSeriesId: input.testSeriesId === undefined ? undefined : input.testSeriesId,
      title: input.title,
      slug: input.slug,
      description: input.description ?? null,
      instructions: input.instructions ?? null,
      category: input.category,
      mode: input.mode,
      status: input.status,
      accessType: input.accessType,
      durationMinutes: input.durationMinutes,
      maxAttempts: input.maxAttempts,
      passingMarks: input.passingMarks,
      negativeMarkingEnabled: input.negativeMarkingEnabled,
      defaultNegativeRatio: input.defaultNegativeRatio,
      randomizeQuestions: input.randomizeQuestions,
      randomizeOptions: input.randomizeOptions,
      showResultImmediately: input.showResultImmediately,
      startDate: input.startDate === undefined ? undefined : input.startDate,
      endDate: input.endDate === undefined ? undefined : input.endDate,
      publishedAt:
        input.status === 'PUBLISHED' ? (existing.publishedAt ?? new Date()) : existing.publishedAt,
    },
  });

  await audit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action:
      input.status === 'PUBLISHED' && existing.status !== 'PUBLISHED'
        ? AUDIT_ACTIONS.TEST_PUBLISHED
        : AUDIT_ACTIONS.TEST_UPDATED,
    entityType: 'Test',
    entityId: id,
    meta: { title: input.title, status: input.status },
    ipAddress: ip,
  });

  return { data: { id }, message: 'Test saved.' };
});

/** DELETE /api/admin/tests/[id] — soft delete, preserving submitted attempts. */
export const DELETE = route(async ({ params, ip }) => {
  const admin = await requireAdmin();
  const id = params.id!;

  const test = await db.test.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, title: true, _count: { select: { attempts: true } } },
  });
  if (!test) throw errors.notFound('Test');

  await db.test.update({
    where: { id },
    data: { deletedAt: new Date(), status: 'ARCHIVED' },
  });

  await audit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: AUDIT_ACTIONS.TEST_UPDATED,
    entityType: 'Test',
    entityId: id,
    meta: { title: test.title, archived: true, attempts: test._count.attempts },
    ipAddress: ip,
  });

  return {
    data: { archived: true },
    message:
      test._count.attempts > 0
        ? `Archived. ${test._count.attempts} existing attempt(s) and their results are unaffected.`
        : 'Test archived.',
  };
});
