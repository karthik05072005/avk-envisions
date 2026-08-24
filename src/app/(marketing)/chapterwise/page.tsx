import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Atom,
  Brain,
  Castle,
  Globe2,
  GraduationCap,
  IndianRupee,
  Landmark,
  Layers,
  Leaf,
  Lock,
  Newspaper,
  Scale,
  type LucideIcon,
  Clock,
} from 'lucide-react';

import { PageHeader } from '@/components/site/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { formatPaise } from '@/lib/utils';
import { getChapterwiseSubjects } from '@/server/services/catalogue-service';

export const metadata: Metadata = {
  title: 'Solve Chapterwise',
  description:
    'Practise chapterwise questions mapped to the standard reference books — Laxmikanth, Spectrum, NCERT, Shankar IAS and the Economic Survey.',
  alternates: { canonical: '/chapterwise' },
};

const ICONS: Record<string, LucideIcon> = {
  Scale,
  Castle,
  Globe2,
  Leaf,
  IndianRupee,
  Landmark,
  Atom,
  Brain,
  Newspaper,
  GraduationCap,
};

export default async function ChapterwisePage() {
  const subjects = await getChapterwiseSubjects();

  return (
    <>
      <PageHeader
        eyebrow="Chapterwise"
        title="Practise by the book, chapter by chapter"
        description="Each track is mapped to the standard reference every serious aspirant already owns. Work through a chapter, test it immediately, and keep a running record of what you have actually mastered."
      />

      <section className="container py-14 sm:py-16">
        {subjects.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No chapterwise tracks yet"
            description="Subject tracks appear here as they are published."
            action={{ label: 'Browse courses', href: '/courses' }}
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((subject, index) => {
              const Icon = ICONS[subject.iconName ?? ''] ?? Layers;

              return (
                <Card key={subject.id} interactive className="h-full">
                  <CardContent className="flex h-full flex-col p-6">
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className="flex size-12 shrink-0 items-center justify-center rounded-xl"
                        style={
                          subject.accentHex
                            ? {
                                backgroundColor: `${subject.accentHex}1A`,
                                color: subject.accentHex,
                              }
                            : undefined
                        }
                      >
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <Badge variant="muted" size="sm">
                        <Lock aria-hidden="true" />
                        Paid
                      </Badge>
                    </div>

                    <h2 className="mt-4 font-semibold leading-tight tracking-tight">
                      <span className="text-muted-foreground">{index + 1}.</span> {subject.name}
                    </h2>

                    {subject.tagline && (
                      <p className="mt-2 flex-1 text-pretty text-sm leading-relaxed text-muted-foreground">
                        {subject.tagline}
                      </p>
                    )}

                    <p className="mt-4 text-xs text-muted-foreground">
                      {subject.chapterCount === 0
                        ? 'Chapters are being added'
                        : `${subject.readyCount} of ${subject.chapterCount} chapter tests ready`}
                    </p>

                    {/* No price shown while the track is unreleased. Quoting a
                        figure for something nobody can buy invites the question
                        of what it costs, which has not been decided. */}
                    <div className="mt-4 border-t border-border pt-4">
                      <Button disabled fullWidth size="sm">
                        <Clock aria-hidden="true" />
                        Coming soon
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <p className="mt-8 rounded-xl border border-border bg-muted/30 px-5 py-4 text-sm leading-relaxed text-muted-foreground">
          Chapterwise practice is being built. In the meantime, the previous year papers and the
          full-length test series cover the same syllabus.
        </p>
      </section>
    </>
  );
}
