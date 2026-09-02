import 'server-only';

import { AppError } from '@/lib/api';
import { logger } from '@/server/logger';
import { db } from '@/server/db';

/**
 * Question reports — the "found an error?" path.
 *
 * A wrong answer key is the one defect a student cannot work around and cannot
 * see the cause of: they answer correctly, are marked wrong, and lose trust in
 * every other question on the paper. The people best placed to catch it are the
 * ones sitting the test, so reporting has to be available at the moment they
 * notice, with as little friction as possible.
 *
 * Reports are therefore accepted from guests as well as signed-in students.
 * Requiring an account here would filter out most of the reports and all of the
 * urgency, and the cost of an occasional junk report is one admin dismissal.
 */

/** What a student is telling us, and enough context to act on it. */
export interface SubmitReportInput {
  questionId: string;
  reason: string;
  description?: string | null;
  reporterId?: string | null;
}

export async function submitQuestionReport(input: SubmitReportInput): Promise<{ id: string }> {
  const question = await db.question.findFirst({
    where: { id: input.questionId, deletedAt: null },
    select: { id: true, code: true },
  });

  if (!question) {
    throw new AppError('NOT_FOUND', 'That question no longer exists.');
  }

  // One person hammering the button on the same question adds noise, not
  // signal. An identical open report from the same reporter is treated as the
  // one they already sent — reported back as success, because from their side
  // it was: we have their message.
  if (input.reporterId) {
    const existing = await db.questionReport.findFirst({
      where: {
        questionId: question.id,
        reporterId: input.reporterId,
        status: { in: ['REPORTED', 'REVIEWING'] },
      },
      select: { id: true },
    });
    if (existing) return { id: existing.id };
  }

  const report = await db.questionReport.create({
    data: {
      questionId: question.id,
      reporterId: input.reporterId ?? null,
      reason: input.reason,
      description: input.description?.trim() || null,
      status: 'REPORTED',
    },
    select: { id: true },
  });

  logger.info(
    { reportId: report.id, questionCode: question.code, reason: input.reason },
    'Question reported',
  );

  return report;
}

export interface ReportRow {
  id: string;
  reason: string;
  description: string | null;
  status: string;
  createdAt: Date;
  question: { id: string; code: string; body: string };
  reporter: { name: string; email: string } | null;
}

/** Open reports first, because those are the ones costing students marks. */
export async function listQuestionReports(status?: string): Promise<ReportRow[]> {
  const rows = await db.questionReport.findMany({
    where: status ? { status } : undefined,
    select: {
      id: true,
      reason: true,
      description: true,
      status: true,
      createdAt: true,
      question: { select: { id: true, code: true, body: true } },
      reporter: { select: { name: true, email: true } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  });

  return rows;
}

/** How many reports still need someone to look at them. */
export async function openReportCount(): Promise<number> {
  return db.questionReport.count({ where: { status: { in: ['REPORTED', 'REVIEWING'] } } });
}

export async function resolveQuestionReport(
  id: string,
  status: string,
  resolverId: string,
  note?: string | null,
): Promise<void> {
  const report = await db.questionReport.findUnique({ where: { id }, select: { id: true } });
  if (!report) throw new AppError('NOT_FOUND', 'That report no longer exists.');

  await db.questionReport.update({
    where: { id },
    data: {
      status,
      resolverId,
      resolutionNote: note?.trim() || null,
      resolvedAt: status === 'RESOLVED' || status === 'REJECTED' ? new Date() : null,
    },
  });
}
