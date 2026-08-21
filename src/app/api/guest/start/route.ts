import { createSession } from '@/server/auth/session';
import { parseBody, route } from '@/server/api-handler';
import { assertTestIsFree, findOrCreateGuest } from '@/server/services/guest-service';
import { guestStartSchema } from '@/validations/guest';

/**
 * POST /api/guest/start
 *
 * Lets a visitor take a free test after giving a name and phone number,
 * without registering. Creates (or reuses) a guest STUDENT account, signs them
 * in and hands back the test URL.
 *
 * The free-ness of the test is checked here, server-side, before any account
 * is created — the client cannot nominate a paid test and get in for nothing.
 */
export const POST = route<{ redirectTo: string; isNew: boolean }>(
  async ({ request, ip }) => {
    const input = await parseBody(request, guestStartSchema);
    const userAgent = request.headers.get('user-agent');

    // Order matters: refuse a non-free test before minting an account for it.
    const test = await assertTestIsFree(input.testId);

    const { userId, isNew } = await findOrCreateGuest({
      name: input.name,
      phone: input.phone,
      context: { ipAddress: ip, userAgent },
    });

    await createSession({ userId, ipAddress: ip, userAgent });

    return {
      data: { redirectTo: `/test/${test.id}`, isNew },
      message: isNew ? 'You are all set. Good luck!' : 'Welcome back.',
      status: 201,
    };
  },
  { rateLimit: 'guestStart' },
);
