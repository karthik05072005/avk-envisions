import { parseBody, route } from '@/server/api-handler';
import { requireVerifiedUser } from '@/server/auth/guards';
import { startAttempt } from '@/server/services/attempt-service';
import { startAttemptSchema } from '@/validations/attempt';

/**
 * POST /api/attempts — start (or resume) an attempt.
 *
 * Requires a verified email: starting a test creates a scored, ranked record,
 * so this is the point at which an unverified account is stopped rather than at
 * sign-in.
 */
export const POST = route(async ({ request, ip }) => {
  const user = await requireVerifiedUser();
  const input = await parseBody(request, startAttemptSchema);

  const result = await startAttempt({
    userId: user.id,
    testId: input.testId,
    ipAddress: ip,
    userAgent: request.headers.get('user-agent'),
  });

  return {
    data: result,
    message: result.resumed ? 'Resuming your attempt in progress.' : 'Attempt started.',
    status: result.resumed ? 200 : 201,
  };
});
