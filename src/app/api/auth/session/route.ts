import { currentSession } from '@/server/auth/guards';
import type { SessionUser } from '@/server/auth/session';
import { route } from '@/server/api-handler';

/**
 * GET /api/auth/session
 *
 * Returns the signed-in user, or `null` when there is no valid session. Used by
 * client components that need auth state without a full page load. Never 401s —
 * "signed out" is a legitimate answer, not an error.
 */
type SessionPayload =
  | { authenticated: false; user: null }
  | { authenticated: true; user: SessionUser; expiresAt: string };

export const GET = route<SessionPayload>(async () => {
  const session = await currentSession();

  if (!session) {
    return { data: { authenticated: false, user: null } };
  }

  return {
    data: {
      authenticated: true,
      user: session.user,
      expiresAt: session.expiresAt.toISOString(),
    },
  };
});
