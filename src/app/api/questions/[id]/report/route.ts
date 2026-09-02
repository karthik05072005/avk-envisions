import { z } from 'zod';

import { QuestionReportReason } from '@/lib/enums';
import { parseBody, route } from '@/server/api-handler';
import { getSession } from '@/server/auth/session';
import { submitQuestionReport } from '@/server/services/question-report-service';

/**
 * POST /api/questions/[id]/report — tell us a question is wrong.
 *
 * Open to guests. The whole catalogue is readable without an account, so
 * requiring one to report a mistake would mean the people most likely to spot a
 * wrong answer key are the least able to say so. Rate limited by IP instead.
 */
const schema = z.object({
  reason: z.enum(QuestionReportReason.values),
  description: z.string().trim().max(2000).optional(),
});

export const POST = route(
  async ({ request, params }) => {
    const input = await parseBody(request, schema);
    const session = await getSession();

    const report = await submitQuestionReport({
      questionId: String(params.id),
      reason: input.reason,
      description: input.description,
      reporterId: session?.user.id ?? null,
    });

    return {
      data: { id: report.id },
      message: 'Thank you — we will check this and correct it.',
    };
  },
  { rateLimit: 'questionReport' },
);
