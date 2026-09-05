import type { Metadata } from 'next';
import { MessageSquare } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { formatDate } from '@/lib/utils';
import { enforceAdminArea } from '@/server/auth/guards';
import { db } from '@/server/db';

export const metadata: Metadata = {
  title: 'Feedback',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * What students and visitors have written from the feedback widget.
 *
 * Newest first, with the page they were on — "this is confusing" is not
 * actionable without knowing where they were when they wrote it.
 */
export default async function AdminFeedbackPage() {
  await enforceAdminArea('/admin/feedback');

  const rows = await db.feedback.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      page: true,
      message: true,
      email: true,
      status: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Feedback</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rows.length === 0
            ? 'Nothing yet.'
            : `${rows.length} message${rows.length === 1 ? '' : 's'}, newest first.`}
        </p>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No feedback yet"
          description="Messages sent from the feedback button appear here."
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Card>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="muted" size="sm">
                      {row.page}
                    </Badge>
                    <span>{formatDate(row.createdAt)}</span>
                    <span className="ml-auto">
                      {row.user ? `${row.user.name} · ${row.user.email}` : (row.email ?? 'A guest')}
                    </span>
                  </div>

                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{row.message}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
