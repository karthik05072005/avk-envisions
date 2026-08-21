import { AUDIT_ACTIONS, audit } from '@/server/audit';
import { currentUser } from '@/server/auth/guards';
import { destroySession } from '@/server/auth/session';
import { route } from '@/server/api-handler';

/**
 * POST /api/auth/logout
 *
 * Always succeeds, even without a valid session, so a client with a stale
 * cookie can always reach a clean signed-out state.
 */
export const POST = route(async ({ ip, request }) => {
  const user = await currentUser();

  await destroySession();

  if (user) {
    await audit({
      actor: { id: user.id, email: user.email, role: user.role },
      action: AUDIT_ACTIONS.LOGOUT,
      entityType: 'User',
      entityId: user.id,
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });
  }

  return { data: { signedOut: true }, message: 'You have been signed out.' };
});
