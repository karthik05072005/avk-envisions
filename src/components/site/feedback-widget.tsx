'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquare, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea, Input } from '@/components/ui/input';
import { ApiClientError, api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

/**
 * "Your feedback helps us improve" — available on every page.
 *
 * A floating control rather than a page section, because the moment someone
 * wants to report something is while they are looking at it, not after they
 * have gone hunting for a contact form. It records the page they were on,
 * since "this is confusing" is not actionable without knowing where.
 *
 * Open to guests. Most of the site reads without an account, and the person
 * most likely to notice something wrong is the one still deciding whether to
 * sign up.
 */
export function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [sending, setSending] = React.useState(false);

  // Never over an exam. A floating button across a running paper is a misclick
  // waiting to happen, and the timer is the last thing to interrupt.
  const hidden =
    pathname.startsWith('/test/') && !pathname.endsWith('/result');

  if (hidden) return null;

  async function submit() {
    if (message.trim().length < 3) {
      toast.error('Tell us a little more.');
      return;
    }

    setSending(true);
    try {
      await api.post('/api/feedback', {
        message: message.trim(),
        page: pathname,
        ...(email.trim() ? { email: email.trim() } : {}),
      });

      toast.success('Thank you — your feedback helps us improve.');
      setMessage('');
      setEmail('');
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : 'That could not be sent.',
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full',
            'bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg',
            'transition-transform hover:scale-105',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <MessageSquare className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Feedback</span>
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-40 w-[calc(100vw-2.5rem)] max-w-sm rounded-2xl border border-border bg-card p-4 shadow-xl">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Found an issue? Tell us.</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Your feedback helps us improve.
              </p>
            </div>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setOpen(false)}
              aria-label="Close feedback"
            >
              <X aria-hidden="true" />
            </Button>
          </div>

          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            className="mt-3"
            placeholder="What went wrong, or what would you like to see?"
            aria-label="Your feedback"
          />

          <Input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            className="mt-2"
            placeholder="Email, if you would like a reply (optional)"
            aria-label="Your email, optional"
          />

          <Button fullWidth className="mt-3" onClick={submit} disabled={sending}>
            {sending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Sending…
              </>
            ) : (
              'Send feedback'
            )}
          </Button>
        </div>
      )}
    </>
  );
}
