import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Lock } from 'lucide-react';

import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UserAvatar } from '@/components/ui/avatar';
import { TicketResponder } from '@/features/admin/ticket-responder';
import { formatDate } from '@/lib/utils';
import { enforceAdminArea } from '@/server/auth/guards';
import { db } from '@/server/db';

export const metadata: Metadata = {
  title: 'Ticket',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await enforceAdminArea(`/admin/support/${id}`);

  const ticket = await db.supportTicket.findUnique({
    where: { id },
    select: {
      id: true,
      ticketNumber: true,
      subject: true,
      description: true,
      category: true,
      status: true,
      priority: true,
      createdAt: true,
      firstRespondedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          createdAt: true,
          _count: { select: { attempts: true, orders: true } },
        },
      },
      // Admins see internal notes too — that is the point of them.
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          body: true,
          isInternalNote: true,
          createdAt: true,
          author: { select: { name: true, role: true, avatarUrl: true } },
        },
      },
    },
  });

  if (!ticket) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/admin/support">
            <ArrowLeft aria-hidden="true" />
            Inbox
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
          <Badge variant="muted" size="sm">
            {ticket.category.toLowerCase()}
          </Badge>
        </div>

        <h1 className="mt-2 text-balance text-2xl font-semibold tracking-tight">{ticket.subject}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Opened {formatDate(ticket.createdAt, 'full')}
          {ticket.firstRespondedAt
            ? ` · first reply ${formatDate(ticket.firstRespondedAt, 'short')}`
            : ' · not yet replied to'}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
        <div className="space-y-5">
          <Card>
            <CardContent className="space-y-4 p-5">
              {ticket.messages.map((message) => {
                const isStaff = message.author?.role === 'ADMIN';

                return (
                  <div
                    key={message.id}
                    className={
                      message.isInternalNote
                        ? 'rounded-lg border border-warning/30 bg-warning/5 p-3'
                        : ''
                    }
                  >
                    <div className="flex gap-3">
                      <UserAvatar
                        name={message.author?.name ?? 'System'}
                        src={message.author?.avatarUrl ?? null}
                        className="size-8 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium">{message.author?.name ?? 'System'}</span>
                          {isStaff && (
                            <Badge variant="brand" size="sm">
                              Admin
                            </Badge>
                          )}
                          {message.isInternalNote && (
                            <Badge variant="warning" size="sm">
                              <Lock aria-hidden="true" />
                              Internal
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatDate(message.createdAt, 'full')}
                          </span>
                        </p>
                        <p
                          className={
                            message.isInternalNote
                              ? 'mt-1.5 whitespace-pre-line text-sm leading-relaxed'
                              : 'mt-1.5 whitespace-pre-line rounded-lg bg-muted/40 px-3.5 py-3 text-sm leading-relaxed'
                          }
                        >
                          {message.body}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <TicketResponder ticketId={ticket.id} />
        </div>

        {/* Student context ------------------------------------------------ */}
        <aside>
          <Card>
            <CardContent className="p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Student
              </h2>

              <div className="mt-3 flex items-center gap-2.5">
                <UserAvatar
                  name={ticket.user.name}
                  src={ticket.user.avatarUrl}
                  className="size-9"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{ticket.user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{ticket.user.email}</p>
                </div>
              </div>

              <dl className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Joined</dt>
                  <dd>{formatDate(ticket.user.createdAt, 'short')}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Attempts</dt>
                  <dd className="tabular-nums">{ticket.user._count.attempts}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Orders</dt>
                  <dd className="tabular-nums">{ticket.user._count.orders}</dd>
                </div>
              </dl>

              <Button asChild fullWidth variant="outline" size="sm" className="mt-4">
                <Link href={`/admin/users?q=${encodeURIComponent(ticket.user.email)}`}>
                  View account
                </Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
