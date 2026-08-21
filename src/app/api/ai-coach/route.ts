import { z } from 'zod';

import { parseBody, route } from '@/server/api-handler';
import { requireUser } from '@/server/auth/guards';
import { askCoach } from '@/server/services/ai-coach-service';

const askSchema = z.object({
  question: z.string().trim().min(3, 'Ask a question').max(1000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(4000),
      }),
    )
    .max(10)
    .default([]),
});

/**
 * POST /api/ai-coach — ask the coach a question.
 *
 * Rate limited per user rather than per IP: an AI call costs real money, and a
 * shared connection must not let one student exhaust another's allowance.
 */
export const POST = route(
  async ({ request }) => {
    const user = await requireUser();
    const input = await parseBody(request, askSchema);

    const result = await askCoach({
      userId: user.id,
      question: input.question,
      history: input.history,
    });

    return { data: result, headers: { 'Cache-Control': 'no-store' } };
  },
  { rateLimit: 'aiCoach' },
);
