import { AUDIT_ACTIONS, audit } from '@/server/audit';
import { requireUser } from '@/server/auth/guards';
import {
  createSession,
  currentSessionId,
  listActiveSessions,
  revokeAllSessions,
  revokeSession,
} from '@/server/auth/session';
import { parseBody, route } from '@/server/api-handler';
import { revokeSessionSchema } from '@/validations/auth';

/**
 * GET /api/auth/sessions — devices currently signed in to this account.
 */
export const GET = route(async () => {
  const user = await requireUser();
  const thisSessionId = await currentSessionId();

  const sessions = await listActiveSessions(user.id);

  return {
    data: sessions.map((session) => ({
      ...session,
      /** Lets the UI label the row the student is reading it on. */
      isCurrent: session.id === thisSessionId,
    })),
  };
});

/**
 * DELETE /api/auth/sessions — signs out one device, or every other device.
 *
 * Body `{ sessionId }` revokes a single session. An empty body revokes all
 * other devices and re-issues the current one.
 */
export const DELETE = route<{ revoked: number | 'all-others' }>(async ({ request, ip }) => {
  const user = await requireUser();
  const userAgent = request.headers.get('user-agent');
  const thisSessionId = await currentSessionId();

  const contentLength = request.headers.get('content-length');
  const hasBody = contentLength !== null && contentLength !== '0';

  if (hasBody) {
    const input = await parseBody(request, revokeSessionSchema);

    // Scoped by userId so one account can never revoke another's session.
    await revokeSession(input.sessionId, user.id);

    await audit({
      actor: { id: user.id, email: user.email, role: user.role },
      action: AUDIT_ACTIONS.SESSIONS_REVOKED,
      entityType: 'Session',
      entityId: input.sessionId,
      ipAddress: ip,
    });

    return { data: { revoked: 1 }, message: 'That device has been signed out.' };
  }

  await revokeAllSessions(user.id);
  await createSession({ userId: user.id, ipAddress: ip, userAgent });

  await audit({
    actor: { id: user.id, email: user.email, role: user.role },
    action: AUDIT_ACTIONS.SESSIONS_REVOKED,
    entityType: 'User',
    entityId: user.id,
    meta: { scope: 'all-other-devices', keptSessionId: thisSessionId },
    ipAddress: ip,
  });

  return {
    data: { revoked: 'all-others' as const },
    message: 'You have been signed out on all other devices.',
  };
});
