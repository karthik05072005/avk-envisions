import type { Metadata } from 'next';
import { ShieldCheck } from 'lucide-react';

import { PageHeader } from '@/components/site/page-header';
import { TrackCards } from '@/components/site/track-cards';
import { getCourseTracks } from '@/server/services/catalogue-service';

export const metadata: Metadata = {
  title: 'Test series',
  description:
    'Structured test series with full-length mocks, sectional tests, previous year papers and detailed performance analysis after every attempt.',
  alternates: { canonical: '/test-series' },
};

export const dynamic = 'force-dynamic';

/**
 * `/test-series` — the four tracks a student can buy into.
 *
 * Deliberately the four tracks rather than every individual series: listing
 * all fourteen (six paper years, five chapterwise subjects and the rest) buries
 * the decision the visitor is actually making.
 */
export default async function TestSeriesPage() {
  const tracks = await getCourseTracks();

  return (
    <>
      <PageHeader
        eyebrow="Test series"
        title="Structured series, not a pile of tests"
        description="Each series follows a deliberate progression — sectional tests across the syllabus, then current affairs, then full-length Paper I and Paper II simulations under real exam conditions."
      />

      <section className="container py-14 sm:py-16">
        <TrackCards tracks={tracks} />

        <p className="mt-8 flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/30 px-5 py-4 text-center text-sm text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
          Every series is designed to help you learn, practise and excel in the KPSC KAS Prelims.
        </p>
      </section>
    </>
  );
}
