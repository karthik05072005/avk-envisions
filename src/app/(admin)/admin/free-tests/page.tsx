import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText, Plus, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { SynopsisManager } from '@/features/admin/synopsis-manager';
import { enforceAdminArea } from '@/server/auth/guards';
import { db } from '@/server/db';
import { synopsisStatus } from '@/server/services/synopsis-service';

export const metadata: Metadata = {
  title: 'Free test series',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const FREE_SERIES_SLUG = 'kas-prelims-free-test-series';

/**
 * The free test series, in one place.
 *
 * These are the papers a visitor meets first, so they need editing without
 * hunting through the general test list. Each row is an ordinary test, so the
 * links lead to the same editors used everywhere else rather than a parallel
 * set that would need keeping in step.
 */
export default async function AdminFreeTestsPage() {
  await enforceAdminArea('/admin/free-tests');

  const series = await db.testSeries.findFirst({
    where: { slug: FREE_SERIES_SLUG, deletedAt: null },
    select: {
      id: true,
      name: true,
      status: true,
      synopsisFileName: true,
      tests: {
        where: { deletedAt: null },
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          totalQuestions: true,
          durationMinutes: true,
          totalMarks: true,
          synopsisFileName: true,
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!series) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={Sparkles}
          title="The free series has not been created yet"
          description="Run the catalogue seed to create it, then manage its papers here."
        />
      </div>
    );
  }

  const withStatus = await Promise.all(
    series.tests.map(async (test) => ({
      ...test,
      synopsis: await synopsisStatus(test.synopsisFileName),
    })),
  );

  const seriesSynopsis = await synopsisStatus(series.synopsisFileName);
  const live = withStatus.filter((t) => t.status === 'PUBLISHED' && t.totalQuestions > 0).length;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{series.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {live} of {withStatus.length} papers live for students
            {series.status !== 'PUBLISHED' && ' · the series itself is a draft'}
          </p>
        </div>

        <Button asChild>
          <Link href={`/admin/tests/new?seriesId=${series.id}`}>
            <Plus aria-hidden="true" />
            Add a free test
          </Link>
        </Button>
      </header>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Series-level analysis PDF</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Shown for any paper that has none of its own
            </p>
          </div>
          <SynopsisManager
            kind="series"
            id={series.id}
            fileName={series.synopsisFileName}
            sizeBytes={seriesSynopsis.sizeBytes}
            present={seriesSynopsis.present}
          />
        </CardContent>
      </Card>

      {withStatus.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No free tests yet"
          description="Add one, attach its questions, then publish it."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {withStatus.map((test) => (
                <li key={test.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{test.title}</span>
                      {test.status !== 'PUBLISHED' && (
                        <Badge variant="warning" size="sm">
                          {test.status.toLowerCase()}
                        </Badge>
                      )}
                      {test.totalQuestions === 0 && (
                        <Badge variant="danger" size="sm">
                          no questions
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                      {test.slug} · {test.totalQuestions} questions · {test.totalMarks} marks ·{' '}
                      {test.durationMinutes} min
                    </p>
                  </div>

                  <SynopsisManager
                    kind="test"
                    id={test.id}
                    fileName={test.synopsisFileName}
                    sizeBytes={test.synopsis.sizeBytes}
                    present={test.synopsis.present}
                  />

                  <div className="flex gap-2">
                    <Button asChild size="sm" variant="ghost" className="h-8 text-xs">
                      <Link href={`/admin/questions?testId=${test.id}`}>
                        <FileText className="size-3.5" aria-hidden="true" />
                        Questions
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost" className="h-8 text-xs">
                      <Link href={`/admin/tests/${test.id}`}>Settings</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
