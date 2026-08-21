'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Send } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { ApiClientError, api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

/**
 * Admin reply box.
 *
 * The internal-note toggle visibly changes the composer's appearance, because
 * accidentally sending an internal note to a student is the mistake this
 * control exists to prevent.
 */
const STATUSES = [
  { value: '', label: 'Keep status' },
  { value: 'WAITING', label: 'Waiting on student' },
  { value: 'RESOLVED', label: 'Resolve' },
  { value: 'CLOSED', label: 'Close' },
] as const;

export function TicketResponder({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [body, setBody] = React.useState('');
  const [internal, setInternal] = React.useState(false);
  const [status, setStatus] = React.useState('');
  const [sending, setSending] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;

    setSending(true);
    try {
      await api.patch('/api/admin/support', {
        ticketId,
        body: body.trim(),
        isInternalNote: internal,
        ...(status ? { status } : {}),
      });

      setBody('');
      setStatus('');
      toast.success(internal ? 'Internal note added.' : 'Reply sent.');
      router.refresh();
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : 'Could not send.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className={cn(internal && 'border-warning/40')}>
      <CardContent className="p-5">
        <form onSubmit={submit}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="admin-reply" className="text-sm font-medium">
              {internal ? 'Internal note (the student will not see this)' : 'Reply to the student'}
            </label>

            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={internal}
                onChange={(event) => setInternal(event.target.checked)}
                className="size-4 rounded border-input"
              />
              <Lock className="size-3.5" aria-hidden="true" />
              Internal note
            </label>
          </div>

          <Textarea
            id="admin-reply"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={5}
            maxLength={5000}
            className={cn('mt-2', internal && 'bg-warning/5')}
            placeholder={
              internal ? 'Context for other admins…' : 'Write your reply to the student…'
            }
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Change ticket status"
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
            >
              {STATUSES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <Button type="submit" loading={sending} disabled={!body.trim()}>
              <Send aria-hidden="true" />
              {internal ? 'Add note' : 'Send reply'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
