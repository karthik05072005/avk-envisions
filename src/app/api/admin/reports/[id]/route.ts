import { z } from 'zod';

import { ReportStatus } from '@/lib/enums';
import { parseBody, route } from '@/server/api-handler';
import { requireAdmin } from '@/server/auth/guards';
import { resolveQuestionReport } from '@/server/services/question-report-service';

/** PATCH /api/admin/reports/[id] — move a report through the queue. */
const schema = z.object({
  status: z.enum(ReportStatus.values),
  note: z.string().trim().max(2000).optional(),
});

export const PATCH = route(async ({ request, params }) => {
  const admin = await requireAdmin();
  const input = await parseBody(request, schema);

  await resolveQuestionReport(String(params.id), input.status, admin.id, input.note);

  return { data: { id: String(params.id) }, message: 'Report updated.' };
});
