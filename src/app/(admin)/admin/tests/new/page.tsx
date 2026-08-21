import type { Metadata } from 'next';

import { EmptyState } from '@/components/ui/states';
import { TestBuilder } from '@/features/admin/test-builder';
import { enforceAdminArea } from '@/server/auth/guards';
import { db } from '@/server/db';

export const metadata: Metadata = {
  title: 'New test',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function NewTestPage() {
  await enforceAdminArea('/admin/tests/new');

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

  return <TestBuilder exams={exams} series={series} />;
}
