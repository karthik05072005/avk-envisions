import { z } from 'zod';

import { parseBody, route } from '@/server/api-handler';
import { requireUser } from '@/server/auth/guards';
import { db } from '@/server/db';
import { cuidSchema } from '@/validations/common';

const markSchema = z.object({
  /** Omit to mark every unread notification as read. */
  notificationId: cuidSchema.optional(),
});

/** PATCH /api/notifications — mark one notification, or all, as read. */
export const PATCH = route(async ({ request }) => {
  const user = await requireUser();
  const input = await parseBody(request, markSchema);

  // Always scoped by userId, so an id from another account matches nothing
  // rather than being marked on their behalf.
  const result = await db.notification.updateMany({
    where: {
      userId: user.id,
      readAt: null,
      ...(input.notificationId ? { id: input.notificationId } : {}),
    },
    data: { readAt: new Date() },
  });

  return {
    data: { marked: result.count },
    message: input.notificationId ? 'Marked as read.' : `Marked ${result.count} as read.`,
  };
});
