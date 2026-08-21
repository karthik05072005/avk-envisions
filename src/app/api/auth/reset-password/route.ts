import { parseBody, route } from '@/server/api-handler';
import { resetPassword } from '@/server/services/auth-service';
import { resetPasswordSchema } from '@/validations/auth';

/**
 * POST /api/auth/reset-password
 *
 * Completing a reset revokes every existing session for the account, including
 * any an attacker may hold. The user must sign in again with the new password.
 */
export const POST = route(
  async ({ request, ip, requestId }) => {
    const input = await parseBody(request, resetPasswordSchema);

    await resetPassword(input.token, input.password, {
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
      requestId,
    });

    return {
      data: { reset: true, redirectTo: '/login' },
      message: 'Your password has been reset. Please sign in with your new password.',
    };
  },
  { rateLimit: 'forgotPassword' },
);
