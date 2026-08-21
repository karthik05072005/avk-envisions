import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { TestBuilder } from '@/features/admin/test-builder';
import { enforceAdminArea } from '@/server/auth/guards';
import { db } from '@/server/db';
import { getTestForEdit } from '@/server/services/admin-service';

export const metadata: Metadata = {
  title: 'Edit test',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function EditTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await enforceAdminArea(`/admin/tests/${id}`);

  const [test, exams, series] = await Promise.all([
    getTestForEdit(id),
    db.exam.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, shortName: true },
    }),
    db.testSeries.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  if (!test) notFound();

  return (
    <TestBuilder
      exams={exams}
      series={series}
      initial={{
        id: test.id,
        examId: test.examId,
        testSeriesId: test.testSeriesId,
        title: test.title,
        slug: test.slug,
        description: test.description,
        instructions: test.instructions,
        category: test.category,
        mode: test.mode,
        status: test.status,
        accessType: test.accessType,
        durationMinutes: test.durationMinutes,
        maxAttempts: test.maxAttempts,
        // Nullable in the database; the builder treats "no pass mark" as 0.
        passingMarks: test.passingMarks ?? 0,
        negativeMarkingEnabled: test.negativeMarkingEnabled,
        defaultNegativeRatio: test.defaultNegativeRatio,
        randomizeQuestions: test.randomizeQuestions,
        randomizeOptions: test.randomizeOptions,
        showResultImmediately: test.showResultImmediately,
      }}
      attached={test.questions.map((row) => ({
        rowId: row.id,
        questionId: row.question.id,
        code: row.question.code,
        body: row.question.body,
        type: row.question.type,
        difficulty: row.question.difficulty,
        status: row.question.status,
        subject: row.question.subject?.name ?? null,
        marks: row.marks,
        negativeMarks: row.negativeMarks,
      }))}
    />
  );
}
