import { parseBody, route } from '@/server/api-handler';
import { requireUser } from '@/server/auth/guards';
import { saveAnswers } from '@/server/services/attempt-service';
import { saveAnswersSchema } from '@/validations/attempt';

/**
 * PATCH /api/attempts/[id]/answers — autosave.
 *
 * The hottest write path in the product. It deliberately does no marking: an
 * autosave stays a cheap write, and computing correctness here would both cost
 * latency on every keystroke and leak the answer through response timing.
 *
 * Rate limited per attempt rather than per IP, so a shared connection (a school
 * lab, a coaching centre) cannot cause one student's saves to throttle another's.
 */
export const PATCH = route(
  async ({ request, params }) => {
    const user = await requireUser();
    const input = await parseBody(request, saveAnswersSchema);

    const result = await saveAnswers({
      attemptId: params.id!,
      userId: user.id,
      patches: input.patches,
    });

    return {
      data: result,
      headers: { 'Cache-Control': 'no-store' },
    };
  },
  {
    rateLimit: 'attemptSync',
    rateLimitKey: ({ params }) => `attempt:${params.id}`,
  },
);
