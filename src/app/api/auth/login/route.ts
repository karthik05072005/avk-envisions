import { defaultRouteForRole } from '@/server/auth/permissions';
import { createSession } from '@/server/auth/session';
import { parseBody, route } from '@/server/api-handler';
import { authenticate } from '@/server/services/auth-service';
import { loginSchema, safeRedirectPath } from '@/validations/auth';

/**
 * POST /api/auth/login
 *
 * Rate limited per IP by the wrapper and additionally per account inside
 * `authenticate`, so neither a single noisy client nor a distributed attempt
 * against one account can grind credentials.
 */
export const POST = route(
  async ({ request, ip, requestId }) => {
    const input = await parseBody(request, loginSchema);
    const userAgent = request.headers.get('user-agent');

    const account = await authenticate({
      email: input.email,
      password: input.password,
      context: { ipAddress: ip, userAgent, requestId },
    });

    await createSession({ userId: account.id, ipAddress: ip, userAgent });

    const fallback = defaultRouteForRole(account.role);

    return {
      data: {
        user: {
          id: account.id,
          name: account.name,
          email: account.email,
          role: account.role,
          emailVerified: account.emailVerified,
        },
        // `next` is attacker-influenced, so it is normalised to a same-site
        // path before it is ever handed back to the browser.
        redirectTo: safeRedirectPath(input.next, fallback),
      },
      message: `Welcome back, ${account.name.split(' ')[0] ?? account.name}.`,
    };
  },
  { rateLimit: 'login' },
);
