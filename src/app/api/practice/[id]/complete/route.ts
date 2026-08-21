import { route } from '@/server/api-handler';
import { requireUser } from '@/server/auth/guards';
import { completePracticeSession } from '@/server/services/practice-service';

/** POST /api/practice/[id]/complete — close the session and return its summary. */
export const POST = route(async ({ params }) => {
  const user = await requireUser();
  const summary = await completePracticeSession(params.id!, user.id);

  return {
    data: {
      sessionId: summary.id,
      attemptedCount: summary.attemptedCount,
      correctCount: summary.correctCount,
      incorrectCount: summary.incorrectCount,
      accuracy: summary.accuracy,
      questionCount: summary.questionCount,
    },
    message: 'Practice session complete.',
    headers: { 'Cache-Control': 'no-store' },
  };
});
