import { z } from 'zod';

import { AUDIT_ACTIONS, audit } from '@/server/audit';
import { parseBody, route } from '@/server/api-handler';
import { requireUser } from '@/server/auth/guards';
import { formatDocumentNumber } from '@/server/auth/tokens';
import { db } from '@/server/db';
import { cuidSchema } from '@/validations/common';

const createTicketSchema = z.object({
  subject: z.string().trim().min(5, 'Describe the issue in a few words').max(200),
  description: z.string().trim().min(20, 'Please give us enough detail to help').max(5000),
  category: z
    .enum(['TECHNICAL', 'PAYMENT', 'CONTENT', 'ACCOUNT', 'FEEDBACK', 'OTHER'])
    .default('OTHER'),
});

const replySchema = z.object({
  ticketId: cuidSchema,
  body: z.string().trim().min(1, 'Write a message').max(5000),
});

/** POST /api/support — open a ticket. */
export const POST = route(
  async ({ request, ip }) => {
    const user = await requireUser();
    const input = await parseBody(request, createTicketSchema);

    // Sequence is per-year, so ticket numbers stay short and human-quotable.
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const countThisYear = await db.supportTicket.count({
      where: { createdAt: { gte: yearStart } },
    });

    const ticket = await db.$transaction(async (tx) => {
      const created = await tx.supportTicket.create({
        data: {
          ticketNumber: formatDocumentNumber('TKT', countThisYear + 1),
          userId: user.id,
          subject: input.subject,
          description: input.description,
          category: input.category,
          status: 'OPEN',
          priority: input.category === 'PAYMENT' ? 'HIGH' : 'NORMAL',
          lastMessageAt: new Date(),
        },
        select: { id: true, ticketNumber: true },
      });

      // The opening description is also the first message, so the thread reads
      // in one place rather than splitting the original text from the replies.
      await tx.supportMessage.create({
        data: { ticketId: created.id, authorId: user.id, body: input.description },
      });

      return created;
    });

    await audit({
      actor: { id: user.id, email: user.email, role: user.role },
      action: AUDIT_ACTIONS.TICKET_CREATED,
      entityType: 'SupportTicket',
      entityId: ticket.id,
      meta: { category: input.category },
      ipAddress: ip,
    });

    return {
      data: { ticketId: ticket.id, ticketNumber: ticket.ticketNumber },
      message: `Ticket ${ticket.ticketNumber} created. We usually reply within one working day.`,
      status: 201,
    };
  },
  { rateLimit: 'publicWrite' },
);

/** PATCH /api/support — reply to your own ticket. */
export const PATCH = route(
  async ({ request }) => {
    const user = await requireUser();
    const input = await parseBody(request, replySchema);

    // Scoped by owner so one student can never post into another's thread.
    const ticket = await db.supportTicket.findFirst({
      where: { id: input.ticketId, userId: user.id },
      select: { id: true, status: true },
    });

    if (!ticket) {
      return { data: { sent: false }, message: 'That ticket could not be found.', status: 404 };
    }

    await db.$transaction([
      db.supportMessage.create({
        data: { ticketId: ticket.id, authorId: user.id, body: input.body },
      }),
      db.supportTicket.update({
        where: { id: ticket.id },
        data: {
          lastMessageAt: new Date(),
          // A reply reopens a resolved ticket — the student clearly is not done.
          status: ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' ? 'OPEN' : ticket.status,
        },
      }),
    ]);

    return { data: { sent: true }, message: 'Reply sent.' };
  },
  { rateLimit: 'publicWrite' },
);
