import { parseBody, route } from '@/server/api-handler';
import { requireUser } from '@/server/auth/guards';
import { db } from '@/server/db';
import { bookmarkSchema } from '@/validations/practice';

/**
 * POST /api/bookmarks — add or update a bookmark.
 *
 * An upsert rather than an insert, so re-bookmarking is harmless and a note can
 * be edited without the client tracking whether the row already exists.
 */
export const POST = route(async ({ request }) => {
  const user = await requireUser();
  const input = await parseBody(request, bookmarkSchema);

  // Scoped to published questions so a bookmark can never reference a draft.
  const question = await db.question.findFirst({
    where: { id: input.questionId, deletedAt: null },
    select: { id: true },
  });
  if (!question) {
    return { data: { bookmarked: false }, message: 'That question no longer exists.', status: 404 };
  }

  await db.bookmark.upsert({
    where: { userId_questionId: { userId: user.id, questionId: input.questionId } },
    update: { note: input.note ?? null },
    create: { userId: user.id, questionId: input.questionId, note: input.note ?? null },
  });

  return { data: { bookmarked: true }, message: 'Bookmarked.' };
});

/** DELETE /api/bookmarks — remove a bookmark. Succeeds even if none existed. */
export const DELETE = route(async ({ request }) => {
  const user = await requireUser();
  const input = await parseBody(request, bookmarkSchema);

  await db.bookmark.deleteMany({
    where: { userId: user.id, questionId: input.questionId },
  });

  return { data: { bookmarked: false }, message: 'Bookmark removed.' };
});
