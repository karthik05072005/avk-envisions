import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { QuestionEditor } from '@/features/admin/question-editor';
import { enforceAdminArea } from '@/server/auth/guards';
import { getQuestionForEdit, getTaxonomyTree } from '@/server/services/admin-service';

export const metadata: Metadata = {
  title: 'Edit question',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await enforceAdminArea(`/admin/questions/${id}`);

  const [question, exams] = await Promise.all([getQuestionForEdit(id), getTaxonomyTree()]);
  if (!question) notFound();

  return (
    <QuestionEditor
      exams={exams.filter((exam) => exam.subjects.length > 0)}
      initial={{
        id: question.id,
        code: question.code,
        examId: question.examId,
        subjectId: question.subjectId,
        chapterId: question.chapterId,
        topicId: question.topicId,
        type: question.type,
        difficulty: question.difficulty,
        status: question.status,
        body: question.body,
        passage: question.passage,
        marks: question.marks,
        negativeMarks: question.negativeMarks,
        numericalAnswer: question.numericalAnswer,
        numericalTolerance: question.numericalTolerance,
        explanation: question.explanation,
        detailedSolution: question.detailedSolution,
        concept: question.concept,
        source: question.source,
        examYear: question.examYear,
        reviewNote: question.reviewNote,
        options: question.options.map((option) => ({
          body: option.body,
          isCorrect: option.isCorrect,
        })),
      }}
    />
  );
}
