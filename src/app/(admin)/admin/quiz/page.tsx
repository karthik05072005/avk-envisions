import type { Metadata } from 'next';
import Link from 'next/link';
import { FileUp, ListChecks, Plus } from 'lucide-react';

import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { QUIZ_SERIES_SLUG, isTestOpen } from '@/lib/enums';
import { formatDate } from '@/lib/utils';
import { enforceAdminArea } from '@/server/auth/guards';
import { db } from '@/server/db';

export const metadata: Metadata = {
  title: 'Quizzes',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * `/admin/quiz` — where quizzes are made and filled.
 *
 * A quiz is an ordinary test with category QUIZ, so every button here leads to
 * the editors used everywhere else rather than a parallel set that would need
 * keeping in step. What this page adds is a single place to see them, and a
 * new-quiz link that arrives with the category and series already chosen.
 */
export default async function AdminQuizPage() {
  await enforceAdminArea('/admin/quiz');

  const [series, quizzes] = await Promise.all([
    db.testSeries.findFirst({
      where: { slug: QUIZ_SERIES_SLUG, deletedAt: null },
      select: { id: true, name: true },
    }),
    db.test.findMany({
      where: { category: 'QUIZ', deletedAt: null },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        totalQuestions: true,
        durationMinutes: true,
        startDate: true,
        _count: { select: { attempts: true } },
      },
    }),
  ]);

  const newQuizHref = series
    ? `/admin/tests/new?category=QUIZ&seriesId=${series.id}`
    : '/admin/tests/new?category=QUIZ';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quizzes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Short quizzes with their own questions. Students take them at{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">/quiz</code>, and these
            questions are kept out of ordinary practice.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/import">
              <FileUp aria-hidden="true" />
              Import from PDF
            </Link>
          </Button>
          <Button asChild>
            <Link href={newQuizHref}>
              <Plus aria-hidden="true" />
              New quiz
            </Link>
          </Button>
        </div>
      </header>

      {quizzes.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No quizzes yet"
          description="Create a quiz, then add questions to it by hand or by importing a PDF. It appears at /quiz as soon as it is published and has questions."
          action={{ label: 'Create the first quiz', href: newQuizHref }}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-2.5 font-medium">Quiz</th>
                  <th scope="col" className="w-28 px-3 py-2.5 font-medium">Questions</th>
                  <th scope="col" className="w-24 px-3 py-2.5 font-medium">Duration</th>
                  <th scope="col" className="w-40 px-3 py-2.5 font-medium">Opens</th>
                  <th scope="col" className="w-28 px-3 py-2.5 font-medium">Status</th>
                  <th scope="col" className="w-24 px-3 py-2.5 font-medium">Attempts</th>
                  <th scope="col" className="w-44 px-3 py-2.5 font-medium">Edit</th>
                </tr>
              </thead>

              <tbody>
                {quizzes.map((quiz) => {
                  // What a student would see right now, which is not the same
                  // as the status: a published quiz can still be shut.
                  const live =
                    quiz.status === 'PUBLISHED' && quiz.totalQuestions > 0 && isTestOpen(quiz.startDate);

                  return (
                    <tr key={quiz.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium leading-tight">{quiz.title}</p>
                        <p className="text-xs text-muted-foreground">{quiz.slug}</p>
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        {quiz.totalQuestions === 0 ? (
                          <span className="text-destructive">none yet</span>
                        ) : (
                          quiz.totalQuestions
                        )}
                      </td>
                      <td className="px-3 py-3 tabular-nums">{quiz.durationMinutes} min</td>
                      <td className="px-3 py-3 text-xs">
                        {quiz.startDate ? formatDate(quiz.startDate, 'short') : 'Any time'}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge status={quiz.status} />
                          {live && (
                            <Badge variant="secondary" className="text-[0.65rem]">
                              Live
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 tabular-nums">{quiz._count.attempts}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/admin/tests/${quiz.id}`}>Settings</Link>
                          </Button>
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/admin/questions?testId=${quiz.id}`}>Questions</Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
