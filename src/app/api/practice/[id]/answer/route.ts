import { parseBody, route } from '@/server/api-handler';
import { requireUser } from '@/server/auth/guards';
import { answerPracticeQuestion } from '@/server/services/practice-service';
import { answerPracticeSchema } from '@/validations/practice';

/**
 * POST /api/practice/[id]/answer — submit one practice answer.
 *
 * Marking happens here rather than at the end, because immediate feedback is
 * the entire point of practice mode. Idempotent per question, so a double-click
 * cannot inflate the session counters.
 */
export const POST = route(
  async ({ request, params }) => {
    const user = await requireUser();
    const input = await parseBody(request, answerPracticeSchema);

    const result = await answerPracticeQuestion({
      sessionId: params.id!,
      userId: user.id,
      ...input,
    });

    return { data: result, headers: { 'Cache-Control': 'no-store' } };
  },
  { rateLimit: 'attemptSync', rateLimitKey: ({ params }) => `practice:${params.id}` },
);
