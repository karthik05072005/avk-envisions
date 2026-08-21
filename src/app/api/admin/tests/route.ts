import { AppError } from '@/lib/api';
import { AUDIT_ACTIONS, audit } from '@/server/audit';
import { parseBody, route } from '@/server/api-handler';
import { requireAdmin } from '@/server/auth/guards';
import { db } from '@/server/db';
import { testSchema } from '@/validations/admin';

/** POST /api/admin/tests — create a test. */
export const POST = route(async ({ request, ip }) => {
  const admin = await requireAdmin();
  const input = await parseBody(request, testSchema);

  const clash = await db.test.findUnique({ where: { slug: input.slug }, select: { id: true } });
  if (clash) {
    throw new AppError('CONFLICT', 'A test with that URL slug already exists. Choose a different one.');
  }

  const test = await db.test.create({
    data: {
      examId: input.examId,
      testSeriesId: input.testSeriesId ?? null,
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
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      createdById: admin.id,
      publishedAt: input.status === 'PUBLISHED' ? new Date() : null,
    },
    select: { id: true, title: true },
  });

  await audit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: AUDIT_ACTIONS.TEST_CREATED,
    entityType: 'Test',
    entityId: test.id,
    meta: { title: test.title },
    ipAddress: ip,
  });

  return {
    data: { id: test.id },
    message: 'Test created. Attach questions to make it attemptable.',
    status: 201,
  };
});
