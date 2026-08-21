import type { Metadata } from 'next';

import { CourseTracks } from '@/components/site/course-tracks';
import { PageHeader } from '@/components/site/page-header';
import { getCourseTracks } from '@/server/services/catalogue-service';

export const metadata: Metadata = {
  title: 'KPSC KAS Courses',
  description:
    'Choose your preparation path: free test series, paid full-length tests with All India ranking, previous year papers, or chapterwise practice.',
  alternates: { canonical: '/courses' },
};

export default async function CoursesPage() {
  const tracks = await getCourseTracks();

  return (
    <>
      <PageHeader
        eyebrow="KPSC KAS Courses"
        title="Choose the right path for your preparation"
        description="Four tracks, each built for a different stage. Start free to find your level, move to full-length tests for ranking, and use previous papers and chapterwise drills to close the gaps they expose."
      />

      <section className="container py-14 sm:py-16">
        <CourseTracks tracks={tracks} />
      </section>
    </>
  );
}
