import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Clock, Newspaper } from 'lucide-react';

import { PageHeader } from '@/components/site/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { formatDate } from '@/lib/utils';
import { getBlogPosts } from '@/server/services/marketing-service';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Practical guidance on exam preparation strategy, test-taking technique and how to use your performance data.',
  alternates: { canonical: '/blog' },
};

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);

  const { posts, totalPages } = await getBlogPosts(page);

  return (
    <>
      <PageHeader
        eyebrow="Blog"
        title="Preparation, not motivation"
        description="Practical writing on strategy, technique and how to read your own performance data honestly."
      />

      <section className="container py-14 sm:py-16">
        {posts.length === 0 ? (
          <EmptyState
            icon={Newspaper}
            title="No posts published yet"
            description="We are writing the first few. Check back soon, or start preparing in the meantime."
            action={{ label: 'Explore test series', href: '/test-series' }}
          />
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <article key={post.id}>
                  <Link href={`/blog/${post.slug}`} className="group block h-full rounded-xl">
                    <Card interactive className="h-full">
                      <CardContent className="flex h-full flex-col p-6">
                        {post.category && (
                          <Badge variant="brand" size="sm" className="self-start">
                            {post.category.name}
                          </Badge>
                        )}

                        <h2 className="mt-3 text-balance font-semibold leading-snug tracking-tight transition-colors group-hover:text-primary">
                          {post.title}
                        </h2>

                        {post.excerpt && (
                          <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                            {post.excerpt}
                          </p>
                        )}

                        <div className="mt-5 flex items-center gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
                          <time dateTime={post.publishedAt?.toISOString()}>
                            {formatDate(post.publishedAt, 'long')}
                          </time>
                          <span aria-hidden="true">·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="size-3.5" aria-hidden="true" />
                            {post.readMinutes} min read
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </article>
              ))}
            </div>

            {totalPages > 1 && (
              <nav
                className="mt-12 flex items-center justify-center gap-3"
                aria-label="Blog pagination"
              >
                <Button asChild variant="outline" disabled={page <= 1}>
                  <Link href={`/blog?page=${page - 1}`} aria-disabled={page <= 1}>
                    Previous
                  </Link>
                </Button>
                <span className="text-sm tabular-nums text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button asChild variant="outline" disabled={page >= totalPages}>
                  <Link href={`/blog?page=${page + 1}`} aria-disabled={page >= totalPages}>
                    Next
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              </nav>
            )}
          </>
        )}
      </section>
    </>
  );
}
