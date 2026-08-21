import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, BookOpen, ClipboardList, FileText, Layers } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { EXAM_CATEGORY_LABELS, type ExamCategory } from '@/lib/enums';
import { formatNumber, formatPaise } from '@/lib/utils';
import { getAllExams, getExamBySlug } from '@/server/services/marketing-service';

/** Pre-render every exam page at build time; the set is small and stable. */
export async function generateStaticParams() {
  const exams = await getAllExams();
  return exams.map((exam) => ({ slug: exam.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const exam = await getExamBySlug(slug);

  if (!exam) return { title: 'Exam not found', robots: { index: false, follow: false } };

  return {
    title: exam.seoTitle ?? `${exam.name} Test Series`,
    description: exam.seoDescription ?? exam.description ?? undefined,
    alternates: { canonical: `/exams/${exam.slug}` },
    openGraph: {
      title: exam.seoTitle ?? exam.name,
      description: exam.seoDescription ?? exam.description ?? undefined,
      type: 'website',
    },
  };
}

export default async function ExamDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const exam = await getExamBySlug(slug);

  if (!exam) notFound();

  const chapterCount = exam.subjects.reduce((sum, subject) => sum + subject.chapters.length, 0);

  return (
    <>
      <section className="border-b border-border bg-muted/20">
        <div className="container py-14 sm:py-16">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="brand">{exam.shortName}</Badge>
            <Badge variant="muted">
              {EXAM_CATEGORY_LABELS[exam.category as ExamCategory] ?? exam.category}
            </Badge>
          </div>

          <h1 className="mt-4 text-balance text-display-sm sm:text-display-md">{exam.name}</h1>
          {exam.description && (
            <p className="mt-4 max-w-3xl text-pretty text-base leading-relaxed text-muted-foreground">
              {exam.description}
            </p>
          )}

          <dl className="mt-8 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Subjects', value: exam.subjects.length, icon: Layers },
              { label: 'Chapters', value: chapterCount, icon: FileText },
              { label: 'Questions', value: formatNumber(exam.questionCount), icon: BookOpen },
              { label: 'Tests', value: exam.testCount, icon: ClipboardList },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl border border-border bg-card p-4">
                <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                  <Icon className="size-3.5" aria-hidden="true" />
                  {label}
                </dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="brand">
              <Link href="/register">
                Start preparing free
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            {exam.testSeries.length > 0 && (
              <Button asChild size="lg" variant="outline">
                <Link href="#test-series">View test series</Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {exam.overview && (
        <section className="container py-14">
          <div
            className="prose-avk max-w-3xl"
            // CMS-authored HTML, written by trusted staff through the admin CMS.
            dangerouslySetInnerHTML={{ __html: exam.overview }}
          />
        </section>
      )}

      {/* Syllabus ---------------------------------------------------------- */}
      <section className="container py-14 sm:py-16">
        <h2 className="text-display-sm">Syllabus coverage</h2>
        <p className="mt-3 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
          The full hierarchy the platform tracks your performance against — every question is tagged
          down to topic level.
        </p>

        {exam.subjects.length === 0 ? (
          <EmptyState
            className="mt-8"
            icon={Layers}
            title="Syllabus not published yet"
            description="The subject and chapter breakdown for this exam is being prepared."
          />
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {exam.subjects.map((subject) => (
              <Card key={subject.id} className="h-full">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3
                      className="font-semibold tracking-tight"
                      style={subject.colorHex ? { color: subject.colorHex } : undefined}
                    >
                      {subject.name}
                    </h3>
                    <Badge variant="muted" size="sm">
                      {subject._count.questions} Qs
                    </Badge>
                  </div>

                  <ul className="mt-4 space-y-2.5">
                    {subject.chapters.map((chapter) => (
                      <li
                        key={chapter.id}
                        className="flex items-start justify-between gap-3 border-b border-border pb-2.5 last:border-0 last:pb-0"
                      >
                        <div>
                          <p className="text-sm font-medium leading-tight">{chapter.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {chapter._count.topics} topics · {chapter._count.questions} questions
                          </p>
                        </div>
                        {chapter.weightage != null && (
                          <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                            {chapter.weightage}%
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Test series ------------------------------------------------------- */}
      {exam.testSeries.length > 0 && (
        <section id="test-series" className="border-t border-border bg-muted/20 py-14 sm:py-16">
          <div className="container">
            <h2 className="text-display-sm">Test series for {exam.shortName}</h2>

            <div className="mt-8 grid gap-6 lg:grid-cols-3">
              {exam.testSeries.map((series) => (
                <Card key={series.id} interactive className="h-full">
                  <CardContent className="flex h-full flex-col p-6">
                    <h3 className="font-semibold leading-tight tracking-tight">{series.name}</h3>
                    {series.tagline && (
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                        {series.tagline}
                      </p>
                    )}

                    <div className="mt-5 flex items-baseline gap-2">
                      <span className="text-xl font-semibold tracking-tight">
                        {series.priceInPaise === 0 ? 'Free' : formatPaise(series.priceInPaise)}
                      </span>
                      {series.comparePriceInPaise > series.priceInPaise && (
                        <span className="text-sm text-muted-foreground line-through">
                          {formatPaise(series.comparePriceInPaise)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {series._count.tests} tests included
                    </p>

                    <Button asChild fullWidth className="mt-4">
                      <Link href={`/test-series/${series.slug}`}>View details</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
