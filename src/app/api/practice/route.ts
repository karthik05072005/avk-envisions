import { parseBody, route } from '@/server/api-handler';
import { requireUser } from '@/server/auth/guards';
import { startPracticeSession } from '@/server/services/practice-service';
import { startPracticeSchema } from '@/validations/practice';

/**
 * POST /api/practice — open a practice session.
 *
 * Unlike a test this needs no email verification: practice is not ranked and
 * creates no permanent record anyone else sees, so the friction is not
 * justified.
 */
export const POST = route(async ({ request }) => {
  const user = await requireUser();
  const input = await parseBody(request, startPracticeSchema);

  const result = await startPracticeSession({ userId: user.id, ...input });

  return {
    data: { ...result, href: `/practice/${result.sessionId}` },
    message: result.resumed
      ? 'Resuming your practice session in progress.'
      : 'Practice session ready.',
    status: result.resumed ? 200 : 201,
  };
});
