import type { Metadata } from 'next';
import Link from 'next/link';
import { LifeBuoy, MessageSquare } from 'lucide-react';

import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { formatDate } from '@/lib/utils';
import { enforceAdminArea } from '@/server/auth/guards';
import { db } from '@/server/db';

export const metadata: Metadata = {
  title: 'Support inbox',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await enforceAdminArea('/admin/support');
  const params = await searchParams;

  // Default to the queue that needs work, not everything ever filed.
  const status = params.status ?? 'OPEN';

  const tickets = await db.supportTicket.findMany({
    where: status === 'ALL' ? {} : { status },
    // Priority first, then oldest-waiting — the queue order a human should work.
    orderBy: [{ priority: 'desc' }, { lastMessageAt: 'asc' }],
    take: 50,
    select: {
      id: true,
      ticketNumber: true,
      subject: true,
      category: true,
      status: true,
      priority: true,
      createdAt: true,
      lastMessageAt: true,
      firstRespondedAt: true,
      user: { select: { name: true, email: true } },
      _count: { select: { messages: true } },
    },
  });

  const counts = await db.supportTicket.groupBy({ by: ['status'], _count: true });
  const countFor = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Support inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Highest priority first, then whoever has been waiting longest.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {['OPEN', 'WAITING', 'RESOLVED', 'CLOSED', 'ALL'].map((s) => (
          <Button
            key={s}
            asChild
            variant={status === s ? 'default' : 'outline'}
            size="sm"
          >
            <Link href={`/admin/support?status=${s}`}>
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              {s !== 'ALL' && countFor(s) > 0 && (
                <span className="ml-1.5 tabular-nums opacity-70">{countFor(s)}</span>
              )}
            </Link>
          </Button>
        ))}
      </div>

      {tickets.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title={status === 'OPEN' ? 'Inbox zero' : 'Nothing here'}
          description={
            status === 'OPEN'
              ? 'No open tickets. Students are not waiting on anything.'
              : 'No tickets with that status.'
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {tickets.map((ticket) => {
                const waitingHours = Math.floor(
                  (Date.now() - ticket.lastMessageAt.getTime()) / 3_600_000,
                );
                const stale = ticket.status === 'OPEN' && waitingHours >= 24;

                return (
                  <li key={ticket.id}>
                    <Link
                      href={`/admin/support/${ticket.id}`}
                      className="group flex items-start gap-4 p-4 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            {ticket.ticketNumber}
                          </span>
                          <StatusBadge status={ticket.status} />
                          {ticket.priority === 'HIGH' && (
                            <Badge variant="warning" size="sm">
                              Priority
                            </Badge>
                          )}
                          {stale && (
                            <Badge variant="danger" size="sm">
                              Waiting {waitingHours}h
                            </Badge>
                          )}
                          {!ticket.firstRespondedAt && ticket.status === 'OPEN' && (
                            <Badge variant="info" size="sm">
                              No reply yet
                            </Badge>
                          )}
                        </div>

                        <p className="mt-1 truncate font-medium leading-tight transition-colors group-hover:text-primary">
                          {ticket.subject}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {ticket.user.name} · {ticket.category.toLowerCase()} ·{' '}
                          {formatDate(ticket.lastMessageAt, 'short')}
                        </p>
                      </div>

                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <MessageSquare className="size-3.5" aria-hidden="true" />
                        {ticket._count.messages}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
