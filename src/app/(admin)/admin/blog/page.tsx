import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText, MessageSquareQuote, Newspaper } from 'lucide-react';

import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { formatDate } from '@/lib/utils';
import { enforceAdminArea } from '@/server/auth/guards';
import { db } from '@/server/db';

export const metadata: Metadata = {
  title: 'Content',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Editorial content overview.
 *
 * Read-only for now: rich-text authoring needs an editor component that does
 * not exist yet, and a plain textarea for HTML would be a worse tool than the
 * seed files these are currently written in.
 */
export default async function AdminBlogPage() {
  await enforceAdminArea('/admin/blog');

  const [posts, pages, faqs, testimonials] = await Promise.all([
    db.blogPost.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        publishedAt: true,
        readMinutes: true,
        author: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
    db.page.findMany({
      orderBy: { slug: 'asc' },
      select: { slug: true, title: true, status: true },
    }),
    db.faq.count({ where: { isPublished: true } }),
    db.testimonial.count({ where: { isPublished: true } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Content</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Blog posts, legal pages and marketing copy.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Newspaper className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-lg font-semibold tabular-nums">{posts.length}</p>
              <p className="text-xs text-muted-foreground">blog posts</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <MessageSquareQuote className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-lg font-semibold tabular-nums">{testimonials}</p>
              <p className="text-xs text-muted-foreground">testimonials</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <FileText className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-lg font-semibold tabular-nums">{faqs}</p>
              <p className="text-xs text-muted-foreground">published FAQs</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Blog posts
        </h2>

        {posts.length === 0 ? (
          <EmptyState className="mt-3" size="sm" icon={Newspaper} title="No posts" description="Blog posts are seeded from `prisma/seed.ts`." />
        ) : (
          <Card className="mt-3">
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {posts.map((post) => (
                  <li key={post.id} className="flex items-center gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium leading-tight">{post.title}</span>
                        <StatusBadge status={post.status} />
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {post.category?.name} · {post.author?.name} · {post.readMinutes} min ·{' '}
                        {post.publishedAt ? formatDate(post.publishedAt, 'short') : 'unpublished'}
                      </p>
                    </div>
                    {post.status === 'PUBLISHED' && (
                      <Button asChild variant="outline" size="sm" className="shrink-0">
                        <Link href={`/blog/${post.slug}`} target="_blank" rel="noreferrer">
                          View
                        </Link>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Pages
        </h2>
        <Card className="mt-3">
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {pages.map((page) => (
                <li key={page.slug} className="flex items-center gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium leading-tight">{page.title}</span>
                      <StatusBadge status={page.status} />
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">/{page.slug}</p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="shrink-0">
                    <Link href={`/${page.slug}`} target="_blank" rel="noreferrer">
                      View
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <p className="rounded-xl border border-border bg-muted/30 px-5 py-4 text-sm leading-relaxed text-muted-foreground">
        Editing is read-only here. These entries are authored in the seed files, and a plain
        textarea for raw HTML would be a worse tool than that — a proper rich-text editor is the
        right fix, not a half one.
      </p>
    </div>
  );
}
