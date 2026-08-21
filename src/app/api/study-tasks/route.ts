import { z } from 'zod';

import { parseBody, route } from '@/server/api-handler';
import { requireUser } from '@/server/auth/guards';
import {
  createStudyTask,
  deleteStudyTask,
  generateTasksFromWeakTopics,
  toggleStudyTask,
} from '@/server/services/study-planner-service';
import { cuidSchema } from '@/validations/common';

const createSchema = z.object({
  title: z.string().trim().min(1, 'Give the task a title').max(200),
  description: z.string().trim().max(1000).optional(),
  type: z.enum(['STUDY', 'REVISION', 'TEST', 'PRACTICE']).default('STUDY'),
  /** ISO date; the client sends a plain calendar day. */
  scheduledFor: z.coerce.date(),
  durationMinutes: z.coerce.number().int().min(5).max(600).default(60),
  topicId: cuidSchema.optional(),
});

const mutateSchema = z.object({
  taskId: cuidSchema,
  action: z.enum(['toggle', 'delete']),
});

/**
 * POST /api/study-tasks — create a task, or auto-generate from weak topics.
 *
 * The two shapes share a route because they are the same user intent ("put
 * something on my plan"), and the generate path needs the same ownership and
 * plan-creation logic.
 */
export const POST = route<{ created: number; reason: string } | { taskId: string }>(
  async ({ request }) => {
    const user = await requireUser();

    // `?generate=1` asks the planner to derive tasks rather than accept one.
    const url = new URL(request.url);
    if (url.searchParams.get('generate') === '1') {
      const result = await generateTasksFromWeakTopics(user.id);

      return {
        data: result,
        message:
          result.created > 0
            ? `Added ${result.created} revision ${result.created === 1 ? 'task' : 'tasks'} from your weakest topics.`
            : result.reason === 'INSUFFICIENT_DATA'
              ? 'Not enough data yet to identify weak topics. Attempt a few more questions first.'
              : result.reason === 'ALREADY_SCHEDULED'
                ? 'Your weak topics are already scheduled.'
                : 'No weak topics right now — nothing to schedule.',
      };
    }

    const input = await parseBody(request, createSchema);
    const task = await createStudyTask({ userId: user.id, ...input });

    return { data: { taskId: task.id }, message: 'Task added.', status: 201 };
  },
);

/** PATCH /api/study-tasks — toggle completion or delete. */
export const PATCH = route<{ deleted: true } | { completed: boolean }>(async ({ request }) => {
  const user = await requireUser();
  const input = await parseBody(request, mutateSchema);

  if (input.action === 'delete') {
    await deleteStudyTask(input.taskId, user.id);
    return { data: { deleted: true }, message: 'Task removed.' };
  }

  const result = await toggleStudyTask(input.taskId, user.id);
  return {
    data: result,
    message: result.completed ? 'Task completed.' : 'Task reopened.',
  };
});
