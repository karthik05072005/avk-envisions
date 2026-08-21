import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, FileQuestion } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { enforceAdminArea } from '@/server/auth/guards';
import { db } from '@/server/db';

export const metadata: Metadata = {
  title: 'Exams & syllabus',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Read-only view of the syllabus tree with live question counts.
 *
 * Editing the taxonomy is deliberately not exposed here yet: renaming or
 * deleting a subject re-parents every question under it, and that needs a
 * considered flow rather than an inline text field. Seeds remain the way to
 * change structure.
 */
export default async function AdminExamsPage() {
  await enforceAdminArea('/admin/exams');

  const exams = await db.exam.findMany({
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      shortName: true,
      slug: true,
      category: true,
      isActive: true,
      colorHex: true,
      _count: { select: { questions: true, tests: true, testSeries: true } },
      subjects: {
        where: { deletedAt: null },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          colorHex: true,
          _count: { select: { questions: true, chapters: true } },
        },
      },
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Exams &amp; syllabus</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The hierarchy every question and test is filed under.
        </p>
      </header>

      {exams.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No exams yet"
          description="Exams are created by the seed scripts. Run `npm run db:seed` to populate the taxonomy."
        />
      ) : (
        <div className="space-y-4">
          {exams.map((exam) => (
            <Card key={exam.id}>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span
                      className="flex size-11 shrink-0 items-center justify-center rounded-xl text-xs font-bold"
                      style={
                        exam.colorHex
                          ? { backgroundColor: `${exam.colorHex}1A`, color: exam.colorHex }
                          : undefined
                      }
                    >
                      {exam.shortName.slice(0, 4)}
                    </span>
                    <div>
                      <h2 className="font-semibold tracking-tight">{exam.name}</h2>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{exam.category.replace(/_/g, ' ').toLowerCase()}</span>
                        <span>·</span>
                        <span>{exam._count.questions} questions</span>
                        <span>·</span>
                        <span>{exam._count.tests} tests</span>
                        <span>·</span>
                        <span>{exam._count.testSeries} series</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={exam.isActive ? 'success' : 'muted'} size="sm">
                      {exam.isActive ? 'Active' : 'Hidden'}
                    </Badge>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/exams/${exam.slug}`} target="_blank" rel="noreferrer">
                        View
                      </Link>
                    </Button>
                  </div>
                </div>

                {exam.subjects.length > 0 && (
                  <ul className="mt-4 grid gap-2 border-t border-border pt-4 sm:grid-cols-2">
                    {exam.subjects.map((subject) => (
                      <li
                        key={subject.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                      >
                        <div className="min-w-0">
                          <p
                            className="truncate text-sm font-medium"
                            style={subject.colorHex ? { color: subject.colorHex } : undefined}
                          >
                            {subject.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {subject._count.chapters} chapters
                          </p>
                        </div>

                        <Button asChild variant="ghost" size="sm" className="shrink-0">
                          <Link href={`/admin/questions?subjectId=${subject.id}`}>
                            <FileQuestion aria-hidden="true" />
                            {subject._count.questions}
                          </Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="rounded-xl border border-border bg-muted/30 px-5 py-4 text-sm leading-relaxed text-muted-foreground">
        Structural changes — adding an exam, renaming a subject, reordering chapters — are made
        through the seed scripts. Editing them inline would re-parent every question filed
        underneath, which needs a considered migration rather than a text field.
      </p>
    </div>
  );
}
