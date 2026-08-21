import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, ClipboardList, Clock, Plus, Users } from 'lucide-react';

import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { TEST_CATEGORY_LABELS, type TestCategory } from '@/lib/enums';
import { formatDuration } from '@/lib/utils';
import { enforceAdminArea } from '@/server/auth/guards';
import { listTests } from '@/server/services/admin-service';

export const metadata: Metadata = {
  title: 'Tests',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminTestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await enforceAdminArea('/admin/tests');
  const params = await searchParams;

  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const result = await listTests({ search: params.q, status: params.status, page });

  const emptyCount = result.rows.filter(
    (t) => t.status === 'PUBLISHED' && t.totalQuestions === 0,
  ).length;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Tests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.total} {result.total === 1 ? 'test' : 'tests'}
            {emptyCount > 0 && ` · ${emptyCount} published with no questions`}
          </p>
        </div>

        <Button asChild>
          <Link href="/admin/tests/new">
            <Plus aria-hidden="true" />
            New test
          </Link>
        </Button>
      </header>

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
                placeholder="Test title"
                className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              />
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
                {['DRAFT', 'PUBLISHED', 'ARCHIVED'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" size="sm">
              Apply
            </Button>
            {(params.q || params.status) && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/tests">Clear</Link>
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {result.rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No tests found"
          description="Create a test, then attach questions from the bank to make it attemptable."
          action={{ label: 'New test', href: '/admin/tests/new' }}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {result.rows.map((test) => {
                const isEmpty = test.totalQuestions === 0;

                return (
                  <li key={test.id}>
                    <Link
                      href={`/admin/tests/${test.id}`}
                      className="group flex items-start gap-4 p-4 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium leading-tight transition-colors group-hover:text-primary">
                            {test.title}
                          </p>
                          <StatusBadge status={test.status} />
                          <Badge variant={test.accessType === 'FREE' ? 'success' : 'muted'} size="sm">
                            {test.accessType}
                          </Badge>
                          {isEmpty && test.status === 'PUBLISHED' && (
                            <Badge variant="danger" size="sm">
                              <AlertTriangle aria-hidden="true" />
                              No questions
                            </Badge>
                          )}
                        </div>

                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>{test.exam.shortName}</span>
                          <span>
                            {TEST_CATEGORY_LABELS[test.category as TestCategory] ?? test.category}
                          </span>
                          {test.testSeries && <span>{test.testSeries.name}</span>}
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" aria-hidden="true" />
                            {formatDuration(test.durationMinutes * 60)}
                          </span>
                          <span>
                            {test.totalQuestions} questions · {test.totalMarks} marks
                          </span>
                          {test.attemptCount > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="size-3" aria-hidden="true" />
                              {test.attemptCount} attempts · avg {Math.round(test.avgScore)}
                            </span>
                          )}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {result.totalPages > 1 && (
        <nav className="flex items-center justify-center gap-3" aria-label="Pagination">
          <Button asChild variant="outline" size="sm" disabled={page <= 1}>
            <Link href={`/admin/tests?page=${page - 1}`}>Previous</Link>
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">
            Page {page} of {result.totalPages}
          </span>
          <Button asChild variant="outline" size="sm" disabled={page >= result.totalPages}>
            <Link href={`/admin/tests?page=${page + 1}`}>Next</Link>
          </Button>
        </nav>
      )}
    </div>
  );
}
