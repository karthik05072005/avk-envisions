import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, Clock, ListChecks, Lock, Play, Trophy } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { TEST_OPENS_EARLY_MINUTES } from '@/lib/enums';
import { formatDate } from '@/lib/utils';
import { requireStudent } from '@/server/auth/guards';
import { listQuizzes } from '@/server/services/quiz-service';

export const metadata: Metadata = {
  title: 'Quizzes',
  description: 'Short quizzes to test yourself between papers.',
};

export const dynamic = 'force-dynamic';

/**
 * `/quiz` — the quiz section.
 *
 * Its own page rather than a corner of practice: a quiz is a short, finished
 * thing a student picks off a list, where practice is an endless generated
 * stream. They also draw from separate question sets, so putting them together
 * made it unclear which pool anything came from.
 */
export default async function QuizPage() {
  const user = await requireStudent();
  const quizzes = await listQuizzes(user.id);

  const open = quizzes.filter((q) => q.isOpen);
  const scheduled = quizzes.filter((q) => !q.isOpen);

  return (
    <div className="container max-w-5xl py-8 sm:py-10">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Quizzes</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Test yourself</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Short quizzes with their own questions, separate from the test series. Attempt them as
          often as you like — nothing here counts towards your ranking.
        </p>
      </header>

      {quizzes.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={ListChecks}
            title="No quizzes yet"
            description="Quizzes will appear here as they are published. In the meantime, practice draws from the full question bank."
            action={{ label: 'Go to practice', href: '/practice' }}
          />
        </div>
      ) : (
        <>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {open.map((quiz) => (
              <Card key={quiz.id} className="transition-colors hover:border-primary/40">
                <CardContent className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-semibold leading-tight">{quiz.title}</h2>
                    {quiz.attempts > 0 && (
                      <Badge variant="secondary" className="shrink-0">
                        <CheckCircle2 className="size-3" aria-hidden="true" />
                        Done
                      </Badge>
                    )}
                  </div>

                  {quiz.description && (
                    <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                      {quiz.description}
                    </p>
                  )}

                  <dl className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <ListChecks className="size-3.5" aria-hidden="true" />
                      {quiz.totalQuestions} questions
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="size-3.5" aria-hidden="true" />
                      {quiz.durationMinutes} min
                    </div>
                    {quiz.bestScore !== null && (
                      <div className="flex items-center gap-1.5">
                        <Trophy className="size-3.5 text-primary" aria-hidden="true" />
                        Best {Math.round(quiz.bestScore)}
                      </div>
                    )}
                  </dl>

                  <div className="mt-4 flex-1" />

                  <Button asChild className="w-full">
                    <Link href={`/start/${quiz.id}`}>
                      <Play aria-hidden="true" />
                      {quiz.attempts > 0 ? 'Attempt again' : 'Start quiz'}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {scheduled.length > 0 && (
            <section className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Opening soon
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                A scheduled quiz opens {TEST_OPENS_EARLY_MINUTES} minutes before its time.
              </p>

              <ul className="mt-3 space-y-2">
                {scheduled.map((quiz) => (
                  <li
                    key={quiz.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{quiz.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {quiz.totalQuestions} questions · {quiz.durationMinutes} min
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <Lock className="size-3.5" aria-hidden="true" />
                      {quiz.startDate ? formatDate(quiz.startDate, 'short') : 'Soon'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
