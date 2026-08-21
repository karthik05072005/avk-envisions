import { parseBody, route } from '@/server/api-handler';
import { requireUser } from '@/server/auth/guards';
import { recordAttemptEvent } from '@/server/services/attempt-service';
import { attemptEventSchema } from '@/validations/attempt';

/**
 * POST /api/attempts/[id]/events — integrity and diagnostics telemetry.
 *
 * Records advisory signals (tab hidden, fullscreen exited, reconnected). These
 * are never automatically punitive: a tab switch may be a system notification,
 * so the counters exist to surface patterns to a human reviewer, not to end an
 * attempt.
 *
 * Always answers 202 — telemetry must never be able to interrupt an exam in
 * progress, so a rejected or unknown event is accepted and dropped rather than
 * surfaced to the student mid-paper.
 */
export const POST = route(
  async ({ request, params }) => {
    const user = await requireUser();
    const input = await parseBody(request, attemptEventSchema);

    await recordAttemptEvent({
      attemptId: params.id!,
      userId: user.id,
      type: input.type,
      meta: input.meta,
    });

    return { data: { recorded: true }, status: 202, headers: { 'Cache-Control': 'no-store' } };
  },
  { rateLimit: 'attemptSync', rateLimitKey: ({ params }) => `events:${params.id}` },
);
