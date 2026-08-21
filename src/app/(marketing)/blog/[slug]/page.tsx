import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { parseJsonColumn, stringArraySchema } from '@/lib/json';
import { formatDate } from '@/lib/utils';
import { publicEnv } from '@/lib/env';
import { getBlogPostBySlug, getBlogPosts } from '@/server/services/marketing-service';

export async function generateStaticParams() {
  const { posts } = await getBlogPosts(1, 50);
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);

  if (!post) return { title: 'Post not found', robots: { index: false, follow: false } };

  return {
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.excerpt ?? undefined,
    alternates: { canonical: post.canonicalUrl ?? `/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt ?? undefined,
      publishedTime: post.publishedAt?.toISOString(),
      authors: post.author?.name ? [post.author.name] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);

  if (!post) notFound();

  const tags = parseJsonColumn(post.tagsJson, stringArraySchema, []);

  /** Article structured data, so search engines render a rich result. */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt ?? undefined,
    datePublished: post.publishedAt?.toISOString(),
    author: post.author?.name ? { '@type': 'Person', name: post.author.name } : undefined,
    publisher: { '@type': 'Organization', name: publicEnv.appName },
    mainEntityOfPage: `${publicEnv.appUrl}/blog/${post.slug}`,
  };

  return (
    <article className="container max-w-3xl py-14 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href="/blog">
          <ArrowLeft aria-hidden="true" />
          All posts
        </Link>
      </Button>

      <header className="mt-6">
        {post.category && <Badge variant="brand">{post.category.name}</Badge>}

        <h1 className="mt-4 text-balance text-display-sm sm:text-display-md">{post.title}</h1>

        {post.excerpt && (
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            {post.excerpt}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3 border-y border-border py-4 text-sm text-muted-foreground">
          {post.author?.name && <span className="font-medium text-foreground">{post.author.name}</span>}
          {post.author?.name && <span aria-hidden="true">·</span>}
          <time dateTime={post.publishedAt?.toISOString()}>
            {formatDate(post.publishedAt, 'long')}
          </time>
          <span aria-hidden="true">·</span>
          <span className="flex items-center gap-1">
            <Clock className="size-4" aria-hidden="true" />
            {post.readMinutes} min read
          </span>
        </div>
      </header>

      {/* CMS-authored HTML, written by trusted staff through the admin CMS. */}
      <div className="prose-avk mt-8" dangerouslySetInnerHTML={{ __html: post.content }} />

      {tags.length > 0 && (
        <footer className="mt-10 flex flex-wrap items-center gap-2 border-t border-border pt-6">
          <span className="text-sm text-muted-foreground">Tagged</span>
          {tags.map((tag) => (
            <Badge key={tag} variant="muted" size="sm">
              {tag}
            </Badge>
          ))}
        </footer>
      )}

      <div className="mt-12 rounded-xl border border-border bg-muted/30 p-6 text-center">
        <h2 className="font-semibold tracking-tight">Put it into practice</h2>
        <p className="mx-auto mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
          Create a free account and attempt a mock test — your first performance report takes under
          an hour.
        </p>
        <Button asChild variant="brand" className="mt-5">
          <Link href="/register">Start free</Link>
        </Button>
      </div>
    </article>
  );
}
