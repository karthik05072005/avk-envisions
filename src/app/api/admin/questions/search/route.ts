import { route } from '@/server/api-handler';
import { requireAdmin } from '@/server/auth/guards';
import { db } from '@/server/db';

/**
 * GET /api/admin/questions/search?q= — typeahead for the test builder.
 *
 * Only published questions are returned: attaching a draft to a test produces
 * a paper that silently skips it at attempt time, which is worse than not
 * finding it here.
 */
export const GET = route(
  async ({ request }) => {
    await requireAdmin();

    const term = new URL(request.url).searchParams.get('q')?.trim() ?? '';

    const rows = await db.question.findMany({
      where: {
        deletedAt: null,
        status: 'PUBLISHED',
        ...(term
          ? { OR: [{ body: { contains: term } }, { code: { contains: term } }] }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        code: true,
        body: true,
        status: true,
        subject: { select: { name: true } },
      },
    });

    return {
      data: {
        rows: rows.map((row) => ({
          id: row.id,
          code: row.code,
          body: row.body,
          status: row.status,
          subject: row.subject?.name ?? null,
        })),
      },
      headers: { 'Cache-Control': 'no-store' },
    };
  },
  { rateLimit: 'search' },
);
