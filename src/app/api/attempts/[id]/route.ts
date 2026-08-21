import { route } from '@/server/api-handler';
import { requireUser } from '@/server/auth/guards';
import { getAttemptState } from '@/server/services/attempt-service';

/**
 * GET /api/attempts/[id] — full attempt state for the exam UI.
 *
 * Scoped to the signed-in user inside the service, so one student can never
 * read another's paper by guessing an id. In EXAM mode the payload carries no
 * answer key of any kind.
 */
export const GET = route(async ({ params }) => {
  const user = await requireUser();
  const state = await getAttemptState(params.id!, user.id);

  return {
    data: state,
    // Never cached: the countdown and answer state must always be current.
    headers: { 'Cache-Control': 'no-store, must-revalidate' },
  };
});
