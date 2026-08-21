import { parseBody, route } from '@/server/api-handler';
import { resendVerificationEmail, verifyEmailToken } from '@/server/services/auth-service';
import { resendVerificationSchema, verifyEmailSchema } from '@/validations/auth';

/**
 * POST /api/auth/verify-email
 *
 * Consuming an already-used token for an already-verified account is reported
 * as success, so a double-clicked link does not show the student an error.
 */
export const POST = route(async ({ request, ip }) => {
  const input = await parseBody(request, verifyEmailSchema);

  const result = await verifyEmailToken(input.token, {
    ipAddress: ip,
    userAgent: request.headers.get('user-agent'),
  });

  return {
    data: { verified: true, alreadyVerified: result.alreadyVerified, redirectTo: '/dashboard' },
    message: result.alreadyVerified
      ? 'Your email address was already verified.'
      : 'Your email address has been verified.',
  };
});

/**
 * PUT /api/auth/verify-email — resends the verification email.
 * Non-enumerating: always reports the same result.
 */
export const PUT = route(
  async ({ request }) => {
    const input = await parseBody(request, resendVerificationSchema);
    await resendVerificationEmail(input.email);

    return {
      data: { submitted: true },
      message: 'If that account still needs verification, a new link is on its way.',
    };
  },
  { rateLimit: 'resendVerification' },
);
