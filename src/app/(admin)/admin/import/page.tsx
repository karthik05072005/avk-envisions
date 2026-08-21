import type { Metadata } from 'next';

import { EmptyState } from '@/components/ui/states';
import { PdfImport } from '@/features/admin/pdf-import';
import { enforceAdminArea } from '@/server/auth/guards';
import { db } from '@/server/db';

export const metadata: Metadata = {
  title: 'Import from PDF',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  await enforceAdminArea('/admin/import');

  const [exams, series, tests] = await Promise.all([
    db.exam.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        shortName: true,
        subjects: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, name: true },
        },
      },
    }),
    db.testSeries.findMany({
      where: { deletedAt: null },
      orderBy: [{ track: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, track: true },
    }),
    // Only drafts and unpublished tests are offered as an append target —
    // adding questions to a live test would change a paper mid-flight for
    // anyone attempting it.
    db.test.findMany({
      where: { deletedAt: null, status: { not: 'ARCHIVED' } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, title: true },
    }),
  ]);

  const usable = exams.filter((exam) => exam.subjects.length > 0);

  if (usable.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          title="No subjects to import into"
          description="Imported questions need an exam and a subject to be filed under. Create at least one subject first."
          action={{ label: 'Manage exams', href: '/admin/exams' }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Import from PDF</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a question paper. Everything is shown for review before a single question is saved.
        </p>
      </header>

      <PdfImport exams={usable} series={series} tests={tests} />
    </div>
  );
}
