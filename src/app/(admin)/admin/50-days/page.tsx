import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarDays, FileText } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { SynopsisManager } from '@/features/admin/synopsis-manager';
import { formatDate } from '@/lib/utils';
import { enforceAdminArea } from '@/server/auth/guards';
import { db } from '@/server/db';
import { DAILY_CHALLENGE_SLUG } from '@/lib/enums';
import { synopsisStatus } from '@/server/services/synopsis-service';

export const metadata: Metadata = {
  title: '50 Questions · 50 Days',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Running the fifty-day challenge.
 *
 * One row per day, showing what a student would see: whether it is dated, has
 * questions, is published, and carries an analysis PDF. Every day is a normal
 * test, so the buttons here lead to the same editors used everywhere else
 * rather than a parallel set that would need keeping in step.
 */
export default async function AdminFiftyDaysPage() {
  await enforceAdminArea('/admin/50-days');

  const series = await db.testSeries.findFirst({
    where: { slug: DAILY_CHALLENGE_SLUG, deletedAt: null },
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
          startDate: true,
          totalQuestions: true,
          durationMinutes: true,
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
          icon={CalendarDays}
          title="The challenge has not been created yet"
          description="Run “npm run db:50days” on the server to lay out the fifty days, then configure them here."
        />
      </div>
    );
  }

  const withStatus = await Promise.all(
    series.tests.map(async (test) => ({
      ...test,
      status_: await synopsisStatus(test.synopsisFileName),
    })),
  );

  const seriesStatus = await synopsisStatus(series.synopsisFileName);
  const ready = withStatus.filter((t) => t.totalQuestions > 0).length;
  const live = withStatus.filter((t) => t.status === 'PUBLISHED' && t.totalQuestions > 0).length;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{series.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ready} of {withStatus.length} days have questions · {live} live for students
            {series.status !== 'PUBLISHED' && ' · the series itself is a draft'}
          </p>
        </div>

        <Button asChild variant="secondary">
          <Link href={`/admin/test-series`}>Series settings</Link>
        </Button>
      </header>

      {series.status !== 'PUBLISHED' && (
        <p className="rounded-lg border border-warning/25 bg-warning/10 p-3 text-sm text-warning">
          This series is a draft, so the public page shows nothing yet. Publish it from Series
          settings once the first days are ready.
        </p>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Series-level analysis PDF</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Used for any day without one of its own
            </p>
          </div>
          <SynopsisManager
            kind="series"
            id={series.id}
            fileName={series.synopsisFileName}
            sizeBytes={seriesStatus.sizeBytes}
            present={seriesStatus.present}
          />
        </CardContent>
      </Card>

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
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {test.startDate ? `Opens ${formatDate(test.startDate)}` : 'No date set'} ·{' '}
                    {test.totalQuestions} questions · {test.durationMinutes} min
                  </p>
                </div>

                <SynopsisManager
                  kind="test"
                  id={test.id}
                  fileName={test.synopsisFileName}
                  sizeBytes={test.status_.sizeBytes}
                  present={test.status_.present}
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
    </div>
  );
}
