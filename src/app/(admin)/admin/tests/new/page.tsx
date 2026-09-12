import type { Metadata } from 'next';

import { EmptyState } from '@/components/ui/states';
import { TestBuilder } from '@/features/admin/test-builder';
import { TestCategory } from '@/lib/enums';
import { enforceAdminArea } from '@/server/auth/guards';
import { db } from '@/server/db';

export const metadata: Metadata = {
  title: 'New test',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * A new test, optionally arriving with its kind already chosen.
 *
 * `/admin/quiz` links here with `?category=QUIZ&seriesId=...`, so making a quiz
 * does not depend on remembering to change a form that defaults to a full
 * mock — get either wrong and the quiz never appears at /quiz.
 */
export default async function NewTestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await enforceAdminArea('/admin/tests/new');
  const query = await searchParams;

  const [exams, series] = await Promise.all([
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

  if (exams.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          title="No exams yet"
          description="A test belongs to an exam. Create one before adding tests."
          action={{ label: 'Manage exams', href: '/admin/exams' }}
        />
      </div>
    );
  }

  // Only a category the builder actually offers; anything else is ignored
  // rather than producing a test with a category nothing can render.
  const requested = query.category ?? '';
  const category = TestCategory.is(requested) ? requested : undefined;
  const seriesId = series.some((s) => s.id === query.seriesId) ? query.seriesId : undefined;

  return (
    <TestBuilder
      exams={exams}
      series={series}
      preset={category || seriesId ? { category, testSeriesId: seriesId } : undefined}
    />
  );
}
