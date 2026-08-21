import { AppError, errors } from '@/lib/api';
import { AUDIT_ACTIONS, audit } from '@/server/audit';
import { parseBody, route } from '@/server/api-handler';
import { requireAdmin } from '@/server/auth/guards';
import { revokeAllSessions } from '@/server/auth/session';
import { db } from '@/server/db';
import { userActionSchema } from '@/validations/admin';

/**
 * PATCH /api/admin/users — act on a user.
 *
 * Two guards matter here and both are about not locking the platform out of
 * itself: an admin cannot act on their own account, and the last remaining
 * admin cannot be demoted or suspended.
 */
export const PATCH = route(async ({ request, ip }) => {
  const admin = await requireAdmin();
  const input = await parseBody(request, userActionSchema);

  if (input.userId === admin.id) {
    throw new AppError(
      'FORBIDDEN',
      'You cannot change your own role or status here. Ask another admin.',
    );
  }

  const target = await db.user.findFirst({
    where: { id: input.userId, deletedAt: null },
    select: { id: true, name: true, email: true, role: true, status: true },
  });
  if (!target) throw errors.notFound('User');

  // Guard against removing the last admin.
  if (
    target.role === 'ADMIN' &&
    (input.action === 'make_student' || input.action === 'suspend')
  ) {
    const otherAdmins = await db.user.count({
      where: { role: 'ADMIN', deletedAt: null, status: 'ACTIVE', NOT: { id: target.id } },
    });
    if (otherAdmins === 0) {
      throw new AppError(
        'FORBIDDEN',
        'This is the only active admin. Promote another account before changing this one.',
      );
    }
  }

  let message = '';

  switch (input.action) {
    case 'suspend':
      await db.user.update({ where: { id: target.id }, data: { status: 'SUSPENDED' } });
      // A suspended user must lose their live sessions immediately, or the
      // suspension does nothing until their cookie expires.
      await revokeAllSessions(target.id);
      message = `${target.name} suspended and signed out everywhere.`;
      break;

    case 'activate':
      await db.user.update({ where: { id: target.id }, data: { status: 'ACTIVE' } });
      message = `${target.name} reactivated.`;
      break;

    case 'make_admin':
      await db.user.update({ where: { id: target.id }, data: { role: 'ADMIN' } });
      message = `${target.name} is now an admin.`;
      break;

    case 'make_student':
      await db.user.update({ where: { id: target.id }, data: { role: 'STUDENT' } });
      await revokeAllSessions(target.id);
      message = `${target.name} is now a student.`;
      break;

    case 'revoke_sessions':
      await revokeAllSessions(target.id);
      message = `${target.name} signed out on all devices.`;
      break;
  }

  await audit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action:
      input.action === 'suspend'
        ? AUDIT_ACTIONS.USER_SUSPENDED
        : AUDIT_ACTIONS.SESSIONS_REVOKED,
    entityType: 'User',
    entityId: target.id,
    meta: { action: input.action, targetEmail: target.email, previousRole: target.role },
    ipAddress: ip,
  });

  return { data: { ok: true }, message };
});
