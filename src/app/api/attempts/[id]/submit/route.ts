import { parseBody, route } from '@/server/api-handler';
import { requireUser } from '@/server/auth/guards';
import { submitAttempt } from '@/server/services/attempt-service';
import { submitAttemptSchema } from '@/validations/attempt';

/**
 * POST /api/attempts/[id]/submit — finalise and score.
 *
 * Idempotent by construction: the service claims the attempt with a conditional
 * status update, so a double-clicked button or a retried request returns the
 * already-computed result rather than scoring twice.
 */
export const POST = route(
  async ({ request, params }) => {
    const user = await requireUser();
    const input = await parseBody(request, submitAttemptSchema);

    const result = await submitAttempt({
      attemptId: params.id!,
      userId: user.id,
      reason: input.reason,
    });

    return {
      data: { ...result, resultUrl: `/test/${result.attemptId}/result` },
      message: result.alreadySubmitted
        ? 'This attempt was already submitted.'
        : 'Your test has been submitted.',
      headers: { 'Cache-Control': 'no-store' },
    };
  },
  { rateLimit: 'submitAttempt', rateLimitKey: ({ params }) => `attempt:${params.id}` },
);
