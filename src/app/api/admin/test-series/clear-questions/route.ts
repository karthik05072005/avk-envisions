import { errors } from '@/lib/api';
import { AUDIT_ACTIONS, audit } from '@/server/audit';
import { parseBody, route } from '@/server/api-handler';
import { requireAdmin } from '@/server/auth/guards';
import { db } from '@/server/db';
import { refreshTestTotals } from '@/server/services/admin-service';
import { clearSeriesQuestionsSchema } from '@/validations/admin';

/**
 * POST /api/admin/test-series/clear-questions — empties every paper in a series.
 *
 * For the case where a whole year was built from the wrong document and is
 * being replaced: the papers, their subject tests and the series itself all
 * stay, and only the questions come off, leaving the structure ready to refill.
 *
 * Questions are detached, never deleted. They stay in the bank, so anything
 * else pointing at them still resolves and a mistake is recoverable by
 * reattaching rather than by re-importing.
 *
 * A paper somebody has attempted is refused. The result page reads its
 * questions back to show what was asked, so emptying one would leave a student
 * looking at a broken record of their own work.
 */
export const POST = route(async ({ request, ip }) => {
  const admin = await requireAdmin();
  const input = await parseBody(request, clearSeriesQuestionsSchema);

  const series = await db.testSeries.findFirst({
    where: { id: input.seriesId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!series) throw errors.notFound('Test series');

  // Typing the name is the confirmation. Compared loosely on case and spacing
  // so a correct answer is not rejected over a stray space, but it still has
  // to be the right series.
  const typed = input.confirm.trim().toLowerCase().replace(/\s+/g, ' ');
  const expected = series.name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (typed !== expected) {
    throw errors.badRequest(`Type the series name exactly — “${series.name}” — to confirm.`);
  }

  const tests = await db.test.findMany({
    where: { testSeriesId: series.id, deletedAt: null },
    select: {
      id: true,
      title: true,
      _count: { select: { questions: true, attempts: true } },
    },
  });

  const attempted = tests.filter((test) => test._count.attempts > 0);
  if (attempted.length > 0) {
    const names = attempted.map((test) => test.title).slice(0, 3).join(', ');
    throw errors.badRequest(
      `${attempted.length} paper${attempted.length === 1 ? ' has' : 's have'} student attempts ` +
        `(${names}${attempted.length > 3 ? '…' : ''}). Clearing would break those result pages.`,
    );
  }

  const total = tests.reduce((sum, test) => sum + test._count.questions, 0);

  const removed = await db.testQuestion.deleteMany({
    where: { testId: { in: tests.map((test) => test.id) } },
  });

  for (const test of tests) await refreshTestTotals(test.id);

  await audit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: AUDIT_ACTIONS.TEST_UPDATED,
    entityType: 'TestSeries',
    entityId: series.id,
    meta: { clearedQuestions: removed.count, papers: tests.length, series: series.name },
    ipAddress: ip,
  });

  return {
    data: { cleared: removed.count, papers: tests.length },
    message:
      total === 0
        ? `${series.name} had no questions to clear.`
        : `Cleared ${removed.count} question${removed.count === 1 ? '' : 's'} from ` +
          `${tests.length} paper${tests.length === 1 ? '' : 's'}. The papers remain, and the ` +
          'questions are still in the bank.',
  };
});
