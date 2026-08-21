import { parseBody, route } from '@/server/api-handler';
import { requestPasswordReset } from '@/server/services/auth-service';
import { forgotPasswordSchema } from '@/validations/auth';

/**
 * POST /api/auth/forgot-password
 *
 * Deliberately non-enumerating: the response is identical whether or not the
 * address has an account, so this endpoint cannot be used to discover which
 * emails are registered.
 */
export const POST = route(
  async ({ request, ip, requestId }) => {
    const input = await parseBody(request, forgotPasswordSchema);

    await requestPasswordReset(input.email, {
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
      requestId,
    });

    return {
      data: { submitted: true },
      message:
        'If an account exists for that email address, we have sent a password reset link. Please check your inbox.',
    };
  },
  { rateLimit: 'forgotPassword' },
);
