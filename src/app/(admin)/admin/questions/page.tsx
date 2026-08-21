import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, FileQuestion, Filter, Plus } from 'lucide-react';

import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { formatDate } from '@/lib/utils';
import { enforceAdminArea } from '@/server/auth/guards';
import { getTaxonomyTree, listQuestions } from '@/server/services/admin-service';

export const metadata: Metadata = {
  title: 'Question bank',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const DIFFICULTY_LABELS: Record<string, string> = {
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard',
};

export default async function AdminQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await enforceAdminArea('/admin/questions');
  const params = await searchParams;

  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);

  const [result, exams] = await Promise.all([
    listQuestions({
      search: params.q,
      examId: params.examId,
      subjectId: params.subjectId,
      status: params.status,
      difficulty: params.difficulty,
      flagged: params.flagged === '1',
      page,
    }),
    getTaxonomyTree(),
  ]);

  /** Preserves the active filters when only the page changes. */
  function pageHref(target: number) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== 'page') query.set(key, value);
    }
    query.set('page', String(target));
    return `/admin/questions?${query.toString()}`;
  }

  const activeFilters = [
    params.q && `“${params.q}”`,
    params.status && params.status.toLowerCase(),
    params.difficulty && params.difficulty.toLowerCase(),
    params.flagged === '1' && 'flagged',
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Question bank</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.total} {result.total === 1 ? 'question' : 'questions'}
            {activeFilters.length > 0 && ` matching ${activeFilters.join(', ')}`}
          </p>
        </div>

        <Button asChild>
          <Link href="/admin/questions/new">
            <Plus aria-hidden="true" />
            New question
          </Link>
        </Button>
      </header>

      {/* Filters --------------------------------------------------------- */}
      <Card>
        <CardContent className="p-4">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label htmlFor="q" className="text-xs font-medium text-muted-foreground">
                Search
              </label>
              <input
                id="q"
                name="q"
                defaultValue={params.q ?? ''}
                placeholder="Question text or code"
                className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              />
            </div>

            <div>
              <label htmlFor="examId" className="text-xs font-medium text-muted-foreground">
                Exam
              </label>
              <select
                id="examId"
                name="examId"
                defaultValue={params.examId ?? ''}
                className="mt-1 h-10 rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="">All</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.shortName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="status" className="text-xs font-medium text-muted-foreground">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={params.status ?? ''}
                className="mt-1 h-10 rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="">All</option>
                {['DRAFT', 'UNDER_REVIEW', 'PUBLISHED', 'ARCHIVED'].map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="difficulty" className="text-xs font-medium text-muted-foreground">
                Difficulty
              </label>
              <select
                id="difficulty"
                name="difficulty"
                defaultValue={params.difficulty ?? ''}
                className="mt-1 h-10 rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="">All</option>
                {['EASY', 'MEDIUM', 'HARD'].map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_LABELS[d]}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                name="flagged"
                value="1"
                defaultChecked={params.flagged === '1'}
                className="size-4 rounded border-input"
              />
              Flagged only
            </label>

            <Button type="submit" size="sm">
              <Filter aria-hidden="true" />
              Apply
            </Button>

            {activeFilters.length > 0 && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/questions">Clear</Link>
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Results --------------------------------------------------------- */}
      {result.rows.length === 0 ? (
        <EmptyState
          icon={FileQuestion}
          title="No questions match"
          description={
            activeFilters.length > 0
              ? 'Try widening the filters, or clear them to see the whole bank.'
              : 'The question bank is empty. Create the first question to get started.'
          }
          action={{ label: 'New question', href: '/admin/questions/new' }}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {result.rows.map((question) => (
                <li key={question.id}>
                  <Link
                    href={`/admin/questions/${question.id}`}
                    className="group flex items-start gap-4 p-4 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {question.code}
                        </span>
                        <StatusBadge status={question.status} />
                        <Badge variant="muted" size="sm">
                          {DIFFICULTY_LABELS[question.difficulty] ?? question.difficulty}
                        </Badge>
                        {question.subject && (
                          <span className="text-xs text-muted-foreground">
                            {question.subject.name}
                          </span>
                        )}
                        {question.reviewNote && (
                          <Badge variant="warning" size="sm">
                            <AlertTriangle aria-hidden="true" />
                            Flagged
                          </Badge>
                        )}
                      </div>

                      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed transition-colors group-hover:text-primary">
                        {question.body}
                      </p>

                      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          +{question.marks}
                          {question.negativeMarks > 0 && ` / −${question.negativeMarks}`}
                        </span>
                        <span>
                          in {question._count.testQuestions}{' '}
                          {question._count.testQuestions === 1 ? 'test' : 'tests'}
                        </span>
                        {question.stat && question.stat.attemptCount > 0 && (
                          <span>
                            {question.stat.attemptCount} attempts ·{' '}
                            {Math.round(question.stat.accuracy)}% correct
                          </span>
                        )}
                        {question.source && <span>{question.source}</span>}
                        <span>{formatDate(question.createdAt, 'short')}</span>
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Pagination ------------------------------------------------------ */}
      {result.totalPages > 1 && (
        <nav className="flex items-center justify-center gap-3" aria-label="Pagination">
          <Button asChild variant="outline" size="sm" disabled={page <= 1}>
            <Link href={pageHref(page - 1)}>Previous</Link>
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">
            Page {page} of {result.totalPages}
          </span>
          <Button asChild variant="outline" size="sm" disabled={page >= result.totalPages}>
            <Link href={pageHref(page + 1)}>Next</Link>
          </Button>
        </nav>
      )}
    </div>
  );
}
