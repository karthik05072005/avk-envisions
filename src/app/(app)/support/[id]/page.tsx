import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UserAvatar } from '@/components/ui/avatar';
import { TicketThread } from '@/features/support/ticket-thread';
import { formatDate } from '@/lib/utils';
import { enforceStudent } from '@/server/auth/guards';
import { db } from '@/server/db';

export const metadata: Metadata = {
  title: 'Support ticket',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await enforceStudent(`/support/${id}`);

  const ticket = await db.supportTicket.findFirst({
    // Scoped by owner: a student may only ever read their own thread.
    where: { id, userId: user.id },
    select: {
      id: true,
      ticketNumber: true,
      subject: true,
      category: true,
      status: true,
      priority: true,
      createdAt: true,
      resolvedAt: true,
      messages: {
        // Internal notes are staff-only and must never reach the student.
        where: { isInternalNote: false },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { id: true, name: true, avatarUrl: true, role: true } },
        },
      },
    },
  });

  if (!ticket) notFound();

  const closed = ticket.status === 'CLOSED';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/support">
            <ArrowLeft aria-hidden="true" />
            All tickets
          </Link>
        </Button>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{ticket.ticketNumber}</span>
          <StatusBadge status={ticket.status} />
          {ticket.priority === 'HIGH' && (
            <Badge variant="warning" size="sm">
              Priority
            </Badge>
          )}
        </div>

        <h1 className="mt-2 text-balance text-2xl font-semibold tracking-tight">{ticket.subject}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Opened {formatDate(ticket.createdAt, 'full')}
          {ticket.resolvedAt && ` · resolved ${formatDate(ticket.resolvedAt, 'short')}`}
        </p>
      </div>

      {/* Thread ---------------------------------------------------------- */}
      <Card>
        <CardContent className="space-y-4 p-5 sm:p-6">
          {ticket.messages.map((message) => {
            const isStaff = message.author?.role !== 'STUDENT' && message.author !== null;
            const authorName = message.author?.name ?? 'AVK Visions';

            return (
              <div key={message.id} className="flex gap-3">
                <UserAvatar
                  name={authorName}
                  src={message.author?.avatarUrl ?? null}
                  className="size-8 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{authorName}</span>
                    {isStaff && (
                      <Badge variant="brand" size="sm">
                        Support
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDate(message.createdAt, 'full')}
                    </span>
                  </p>
                  <p className="mt-1.5 whitespace-pre-line rounded-lg bg-muted/40 px-3.5 py-3 text-sm leading-relaxed">
                    {message.body}
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {closed ? (
        <p className="rounded-xl border border-border bg-muted/30 px-5 py-4 text-sm text-muted-foreground">
          This ticket is closed. If the problem comes back, open a new one and reference{' '}
          <span className="font-mono">{ticket.ticketNumber}</span>.
        </p>
      ) : (
        <TicketThread ticketId={ticket.id} />
      )}
    </div>
  );
}
