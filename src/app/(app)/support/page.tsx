import type { Metadata } from 'next';
import Link from 'next/link';
import { LifeBuoy, MessageSquare } from 'lucide-react';

import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TicketComposer } from '@/features/support/ticket-composer';
import { formatDate } from '@/lib/utils';
import { enforceStudent } from '@/server/auth/guards';
import { db } from '@/server/db';

export const metadata: Metadata = {
  title: 'Support',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const CATEGORY_LABELS: Record<string, string> = {
  TECHNICAL: 'Technical',
  PAYMENT: 'Payment',
  CONTENT: 'Content',
  ACCOUNT: 'Account',
  FEEDBACK: 'Feedback',
  OTHER: 'Other',
};

export default async function SupportPage() {
  const user = await enforceStudent('/support');

  const [tickets, faqs] = await Promise.all([
    db.supportTicket.findMany({
      where: { userId: user.id },
      orderBy: { lastMessageAt: 'desc' },
      take: 20,
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        category: true,
        status: true,
        priority: true,
        createdAt: true,
        lastMessageAt: true,
        _count: { select: { messages: true } },
      },
    }),
    db.faq.findMany({
      where: { isPublished: true, testSeriesId: null },
      orderBy: { sortOrder: 'asc' },
      take: 6,
      select: { id: true, question: true, answer: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Help &amp; support</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Check the common questions first — most issues are answered there. If not, open a ticket.
        </p>
      </header>

      {/* Your tickets ---------------------------------------------------- */}
      {tickets.length > 0 && (
        <section aria-labelledby="tickets-heading">
          <h2
            id="tickets-heading"
            className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Your tickets
          </h2>

          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
            <ul className="divide-y divide-border">
              {tickets.map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    href={`/support/${ticket.id}`}
                    className="group flex items-center gap-4 p-4 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {ticket.ticketNumber}
                        </span>
                        <StatusBadge status={ticket.status} />
                        {ticket.priority === 'HIGH' && (
                          <Badge variant="warning" size="sm">
                            Priority
                          </Badge>
                        )}
                      </p>
                      <p className="mt-1 truncate font-medium leading-tight transition-colors group-hover:text-primary">
                        {ticket.subject}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {CATEGORY_LABELS[ticket.category] ?? ticket.category} · updated{' '}
                        {formatDate(ticket.lastMessageAt, 'short')}
                      </p>
                    </div>

                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <MessageSquare className="size-3.5" aria-hidden="true" />
                      {ticket._count.messages}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* FAQs ------------------------------------------------------------ */}
      {faqs.length > 0 && (
        <Card>
          <CardContent className="p-5 sm:p-6">
            <h2 className="flex items-center gap-2 font-semibold tracking-tight">
              <LifeBuoy className="size-4 text-muted-foreground" aria-hidden="true" />
              Common questions
            </h2>

            <div className="mt-4 divide-y divide-border">
              {faqs.map((faq) => (
                <details key={faq.id} className="group py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                    {faq.question}
                    <span
                      aria-hidden="true"
                      className="grid size-5 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>

            <Button asChild variant="ghost" size="sm" className="mt-3">
              <Link href="/faq">See all questions</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <TicketComposer />
    </div>
  );
}
