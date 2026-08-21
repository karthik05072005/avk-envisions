import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, ClipboardList, Layers } from 'lucide-react';

import { PageHeader } from '@/components/site/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { EXAM_CATEGORY_LABELS, type ExamCategory } from '@/lib/enums';
import { formatNumber } from '@/lib/utils';
import { getAllExams } from '@/server/services/marketing-service';

export const metadata: Metadata = {
  title: 'Exams',
  description:
    'Every exam covered on AVK Envisions, each with its own syllabus tree, reviewed question bank and structured test series.',
  alternates: { canonical: '/exams' },
};

export default async function ExamsPage() {
  const exams = await getAllExams();

  // Group by category so related exams sit together rather than in one long list.
  const grouped = exams.reduce<Record<string, typeof exams>>((acc, exam) => {
    (acc[exam.category] ??= []).push(exam);
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        eyebrow="Exams"
        title="Choose your exam"
        description="Each exam has its own syllabus hierarchy, question bank and test series — modelled on the real paper rather than a shared template."
      />

      <section className="container py-14 sm:py-16">
        {exams.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No exams published yet"
            description="Exams appear here as soon as the content team publishes them."
            action={{ label: 'Back to home', href: '/' }}
          />
        ) : (
          <div className="space-y-12">
            {Object.entries(grouped).map(([category, list]) => (
              <div key={category}>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {EXAM_CATEGORY_LABELS[category as ExamCategory] ?? category}
                </h2>

                <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((exam) => (
                    <Link key={exam.id} href={`/exams/${exam.slug}`} className="group rounded-xl">
                      <Card interactive className="h-full">
                        <CardContent className="flex h-full flex-col p-6">
                          <div className="flex items-start justify-between gap-3">
                            <span
                              className="flex size-12 items-center justify-center rounded-xl text-sm font-bold"
                              style={
                                exam.colorHex
                                  ? { backgroundColor: `${exam.colorHex}1A`, color: exam.colorHex }
                                  : undefined
                              }
                            >
                              {exam.shortName.slice(0, 4)}
                            </span>
                            {exam.seriesCount > 0 && (
                              <Badge variant="success" size="sm">
                                {exam.seriesCount} series
                              </Badge>
                            )}
                          </div>

                          <h3 className="mt-4 font-semibold leading-tight tracking-tight transition-colors group-hover:text-primary">
                            {exam.name}
                          </h3>
                          {exam.description && (
                            <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                              {exam.description}
                            </p>
                          )}

                          <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-4">
                            <div>
                              <dt className="flex items-center gap-1 text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                                <Layers className="size-3" aria-hidden="true" />
                                Subjects
                              </dt>
                              <dd className="mt-0.5 text-sm font-semibold tabular-nums">
                                {exam.subjectCount}
                              </dd>
                            </div>
                            <div>
                              <dt className="flex items-center gap-1 text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                                <BookOpen className="size-3" aria-hidden="true" />
                                Questions
                              </dt>
                              <dd className="mt-0.5 text-sm font-semibold tabular-nums">
                                {formatNumber(exam.questionCount)}
                              </dd>
                            </div>
                            <div>
                              <dt className="flex items-center gap-1 text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                                <ClipboardList className="size-3" aria-hidden="true" />
                                Tests
                              </dt>
                              <dd className="mt-0.5 text-sm font-semibold tabular-nums">
                                {exam.testCount}
                              </dd>
                            </div>
                          </dl>

                          <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                            View exam
                            <ArrowRight
                              className="size-4 transition-transform group-hover:translate-x-0.5"
                              aria-hidden="true"
                            />
                          </span>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
