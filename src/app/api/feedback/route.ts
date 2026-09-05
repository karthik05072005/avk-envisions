import { z } from 'zod';

import { parseBody, route } from '@/server/api-handler';
import { getSession } from '@/server/auth/session';
import { db } from '@/server/db';
import { logger } from '@/server/logger';

/**
 * POST /api/feedback — "Your feedback helps us improve".
 *
 * Open to guests. Most of the site is readable without an account, and the
 * person most likely to notice something confusing is the one still deciding
 * whether to sign up — requiring a login would filter out exactly that.
 *
 * Rate limited by IP, and the page is recorded because "this is broken" is not
 * actionable without knowing where they were.
 */
const schema = z.object({
  message: z.string().trim().min(3, 'Tell us a little more').max(2000),
  page: z.string().trim().max(300).default('/'),
  email: z.string().trim().email('Enter a valid email').max(200).optional().or(z.literal('')),
});

export const POST = route(
  async ({ request }) => {
    const input = await parseBody(request, schema);
    const session = await getSession();

    const saved = await db.feedback.create({
      data: {
        userId: session?.user.id ?? null,
        page: input.page,
        message: input.message,
        email: input.email || null,
      },
      select: { id: true },
    });

    logger.info({ feedbackId: saved.id, page: input.page }, 'Feedback received');

    return {
      data: { id: saved.id },
      message: 'Thank you — your feedback helps us improve.',
    };
  },
  { rateLimit: 'publicWrite' },
);
