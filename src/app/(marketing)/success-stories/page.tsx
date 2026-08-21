import type { Metadata } from 'next';
import Link from 'next/link';
import { Quote, Trophy } from 'lucide-react';

import { PageHeader } from '@/components/site/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UserAvatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/states';
import { getSuccessStories, getTestimonials } from '@/server/services/marketing-service';

export const metadata: Metadata = {
  title: 'Success stories',
  description:
    'Students who prepared with AVK Envisions and what actually moved their scores.',
  alternates: { canonical: '/success-stories' },
};

export const revalidate = 3600;

export default async function SuccessStoriesPage() {
  const [stories, testimonials] = await Promise.all([
    getSuccessStories(24),
    getTestimonials(12),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Results"
        title="What students actually did"
        description="Every story below is from a student who used the platform. We publish what they told us, including the parts about what was hard."
      />

      <section className="container py-14 sm:py-16">
        {stories.length === 0 && testimonials.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No stories published yet"
            description="As students clear their exams and share their experience, their stories appear here."
            action={{ label: 'Start preparing', href: '/register' }}
          />
        ) : (
          <div className="space-y-14">
            {stories.length > 0 && (
              <section>
                <h2 className="text-display-sm">Selections</h2>

                <div className="mt-8 grid gap-6 lg:grid-cols-2">
                  {stories.map((story) => (
                    <Card key={story.id} variant="elevated">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <UserAvatar
                            name={story.studentName}
                            src={story.avatarUrl}
                            className="size-12 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold leading-tight">{story.studentName}</p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              {story.examName && <span>{story.examName}</span>}
                              {story.year && <span>· {story.year}</span>}
                              {story.city && <span>· {story.city}</span>}
                            </p>
                            {story.rank && (
                              <Badge variant="success" size="sm" className="mt-2">
                                <Trophy aria-hidden="true" />
                                {story.rank}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <blockquote className="mt-4 text-pretty leading-relaxed text-muted-foreground">
                          <Quote
                            className="mb-1.5 size-4 text-primary/40"
                            aria-hidden="true"
                          />
                          {story.quote}
                        </blockquote>

                        {story.achievement && (
                          <p className="mt-4 border-t border-border pt-3 text-sm font-medium">
                            {story.achievement}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {testimonials.length > 0 && (
              <section>
                <h2 className="text-display-sm">In their words</h2>

                <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {testimonials.map((item) => (
                    <Card key={item.id}>
                      <CardContent className="flex h-full flex-col p-5">
                        <blockquote className="flex-1 text-pretty text-sm leading-relaxed text-muted-foreground">
                          {item.quote}
                        </blockquote>

                        <div className="mt-4 flex items-center gap-2.5 border-t border-border pt-4">
                          <UserAvatar
                            name={item.studentName}
                            src={item.avatarUrl}
                            className="size-8 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{item.studentName}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {[item.examName, item.city].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        <div className="mt-14 rounded-xl border border-border bg-muted/30 p-6 text-center">
          <h2 className="font-semibold tracking-tight">Your turn</h2>
          <p className="mx-auto mt-1.5 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
            Start with a free mock test. Your first performance report takes under an hour.
          </p>
          <Button asChild variant="brand" className="mt-4">
            <Link href="/register">Start free</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
