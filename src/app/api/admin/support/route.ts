import { errors } from '@/lib/api';
import { AUDIT_ACTIONS, audit } from '@/server/audit';
import { parseBody, route } from '@/server/api-handler';
import { requireAdmin } from '@/server/auth/guards';
import { db } from '@/server/db';
import { ticketReplySchema } from '@/validations/admin';

/**
 * PATCH /api/admin/support — reply to a ticket and/or change its status.
 *
 * `isInternalNote` writes a message the student never sees. It is stored on the
 * same thread so the context stays in one place, and filtered out of the
 * student-facing query rather than kept in a separate table that could drift.
 */
export const PATCH = route(async ({ request, ip }) => {
  const admin = await requireAdmin();
  const input = await parseBody(request, ticketReplySchema);

  const ticket = await db.supportTicket.findUnique({
    where: { id: input.ticketId },
    select: { id: true, ticketNumber: true, status: true, firstRespondedAt: true },
  });
  if (!ticket) throw errors.notFound('Ticket');

  const now = new Date();

  await db.$transaction([
    db.supportMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: admin.id,
        body: input.body,
        isInternalNote: input.isInternalNote,
      },
    }),
    db.supportTicket.update({
      where: { id: ticket.id },
      data: {
        lastMessageAt: now,
        assigneeId: admin.id,
        // First-response time is a real support metric, so it is recorded once
        // and only for a message the student can actually see.
        firstRespondedAt:
          !input.isInternalNote && !ticket.firstRespondedAt ? now : ticket.firstRespondedAt,
        ...(input.status
          ? {
              status: input.status,
              resolvedAt: input.status === 'RESOLVED' ? now : null,
              closedAt: input.status === 'CLOSED' ? now : null,
            }
          : {}),
      },
    }),
  ]);

  await audit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: input.status
      ? AUDIT_ACTIONS.TICKET_STATUS_CHANGED
      : AUDIT_ACTIONS.TICKET_REPLIED,
    entityType: 'SupportTicket',
    entityId: ticket.id,
    meta: { ticketNumber: ticket.ticketNumber, status: input.status, internal: input.isInternalNote },
    ipAddress: ip,
  });

  return {
    data: { sent: true },
    message: input.isInternalNote ? 'Internal note added.' : 'Reply sent to the student.',
  };
});
