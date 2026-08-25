import { createSession } from '@/server/auth/session';
import { parseBody, route } from '@/server/api-handler';
import { assertTestIsFree, findOrCreateGuest } from '@/server/services/guest-service';
import { guestStartSchema } from '@/validations/guest';
import { safeRedirectPath } from '@/validations/auth';

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

    // Where they are heading, normalised so a crafted value cannot turn this
    // into an open redirect.
    const destination = safeRedirectPath(input.next, `/test/${input.testId}`);

    // A paper with no questions can still have an analysis worth reading, so
    // the "has questions" rule only applies when they are going to sit it.
    const test = await assertTestIsFree(input.testId, {
      requireQuestions: !destination.startsWith('/synopsis/'),
    });

    const { userId, isNew } = await findOrCreateGuest({
      name: input.name,
      phone: input.phone,
      context: { ipAddress: ip, userAgent },
    });

    await createSession({ userId, ipAddress: ip, userAgent });

    return {
      data: { redirectTo: destination, isNew },
      message: isNew ? 'You are all set. Good luck!' : 'Welcome back.',
      status: 201,
    };
  },
  { rateLimit: 'guestStart' },
);
