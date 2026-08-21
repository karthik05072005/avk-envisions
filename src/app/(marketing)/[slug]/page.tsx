import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { formatDate } from '@/lib/utils';
import { db } from '@/server/db';

/**
 * CMS pages — /about, /privacy, /terms, /refund-policy and anything else the
 * content team publishes.
 *
 * A single dynamic route rather than four near-identical files. Next resolves
 * static routes first, so /pricing, /exams and the rest are unaffected; this
 * only ever catches a single-segment path nothing else claimed.
 */
export const revalidate = 3600;

async function getPage(slug: string) {
  return db.page.findFirst({
    where: { slug, status: 'PUBLISHED' },
    select: {
      title: true,
      content: true,
      seoTitle: true,
      seoDescription: true,
      updatedAt: true,
    },
  });
}

export async function generateStaticParams() {
  const pages = await db.page.findMany({
    where: { status: 'PUBLISHED' },
    select: { slug: true },
  });
  return pages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);

  if (!page) return { title: 'Page not found', robots: { index: false, follow: false } };

  return {
    title: page.seoTitle ?? page.title,
    description: page.seoDescription ?? undefined,
    alternates: { canonical: `/${slug}` },
  };
}

export default async function CmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPage(slug);

  if (!page) notFound();

  return (
    <article className="container max-w-3xl py-14 sm:py-16">
      <h1 className="text-balance text-display-sm sm:text-display-md">{page.title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Last updated {formatDate(page.updatedAt, 'long')}
      </p>

      {/* Authored by staff through the admin CMS. */}
      <div
        className="prose-avk mt-8"
        dangerouslySetInnerHTML={{ __html: page.content }}
      />
    </article>
  );
}
