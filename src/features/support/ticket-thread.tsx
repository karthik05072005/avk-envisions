'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { ApiClientError, api } from '@/lib/api-client';

/** Reply box for an open ticket. Posting reopens a resolved thread. */
export function TicketThread({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [body, setBody] = React.useState('');
  const [sending, setSending] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;

    setSending(true);
    try {
      await api.patch('/api/support', { ticketId, body: body.trim() });
      setBody('');
      toast.success('Reply sent.');
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : 'We could not send that reply.',
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <form onSubmit={submit}>
          <label htmlFor="ticket-reply" className="text-sm font-medium">
            Add a reply
          </label>
          <Textarea
            id="ticket-reply"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Anything else that would help us resolve this…"
            rows={4}
            maxLength={5000}
            className="mt-1.5"
          />

          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {body.length}/5000 characters
            </span>
            <Button type="submit" loading={sending} disabled={!body.trim()}>
              <Send aria-hidden="true" />
              Send reply
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
