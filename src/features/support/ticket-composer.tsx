'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { FormField } from '@/components/ui/label';
import { ApiClientError, api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

/**
 * New-ticket form.
 *
 * The category selector is prominent because it decides routing and priority —
 * a payment problem reaches a human faster than a feature request, and burying
 * that choice in a dropdown gets it picked at random.
 */
const CATEGORIES = [
  { value: 'TECHNICAL', label: 'Technical issue', hint: 'Something is broken or not loading' },
  { value: 'PAYMENT', label: 'Payment', hint: 'Billing, refunds or access after purchase' },
  { value: 'CONTENT', label: 'Question or content', hint: 'A mistake in a question or solution' },
  { value: 'ACCOUNT', label: 'My account', hint: 'Sign-in, profile or data' },
  { value: 'FEEDBACK', label: 'Feedback', hint: 'A suggestion or request' },
  { value: 'OTHER', label: 'Something else', hint: '' },
] as const;

export function TicketComposer() {
  const router = useRouter();

  const [subject, setSubject] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState<string>('TECHNICAL');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSending(true);

    try {
      const result = await api.post<{ ticketNumber: string }>('/api/support', {
        subject: subject.trim(),
        description: description.trim(),
        category,
      });

      toast.success(`Ticket ${result.ticketNumber} created.`);
      setSubject('');
      setDescription('');
      router.refresh();
    } catch (caught) {
      const message =
        caught instanceof ApiClientError
          ? (caught.fieldErrors?.description?.[0] ??
            caught.fieldErrors?.subject?.[0] ??
            caught.message)
          : 'We could not create that ticket. Please try again.';
      setError(message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <h2 className="font-semibold tracking-tight">Contact support</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We usually reply within one working day.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <fieldset>
            <legend className="text-sm font-medium">What is this about?</legend>
            <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
              {CATEGORIES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setCategory(item.value)}
                  aria-pressed={category === item.value}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    category === item.value
                      ? 'border-primary bg-primary-muted'
                      : 'border-border hover:bg-muted/50',
                  )}
                >
                  <span className="block text-sm font-medium">{item.label}</span>
                  {item.hint && (
                    <span className="mt-0.5 block text-xs text-muted-foreground">{item.hint}</span>
                  )}
                </button>
              ))}
            </div>
          </fieldset>

          <FormField label="Subject" htmlFor="ticket-subject" required>
            <Input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="A short summary"
              maxLength={200}
            />
          </FormField>

          <FormField
            label="Details"
            htmlFor="ticket-description"
            required
            hint="What happened, what you expected, and anything you have already tried. At least 20 characters."
          >
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Tell us what is going on…"
              rows={5}
              maxLength={5000}
            />
          </FormField>

          <Button
            type="submit"
            loading={sending}
            loadingText="Sending…"
            disabled={subject.trim().length < 5 || description.trim().length < 20}
          >
            <Send aria-hidden="true" />
            Create ticket
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
