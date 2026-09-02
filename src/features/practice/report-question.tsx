'use client';

import * as React from 'react';
import { Flag, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { QUESTION_REPORT_REASON_LABELS, QuestionReportReason } from '@/lib/enums';
import { ApiClientError, api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

/**
 * "Found an error? Report it here."
 *
 * A wrong answer key is invisible from the student's side — they answer
 * correctly, are marked wrong, and have no way to say so. This is that way.
 *
 * It stays collapsed until asked for, because it sits beside a question someone
 * is in the middle of answering and must not compete with it. Reporting works
 * without an account: the catalogue is open to guests, so requiring a login to
 * report a mistake would silence the people most likely to find one.
 */
export function ReportQuestion({
  questionId,
  className,
}: {
  questionId: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState<string>('WRONG_ANSWER');
  const [description, setDescription] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function submit() {
    setSending(true);
    try {
      await api.post(`/api/questions/${questionId}/report`, {
        reason,
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      setSent(true);
      setOpen(false);
      setDescription('');
      toast.success('Thank you — we will check this and correct it.');
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : 'That could not be sent. Please try again.',
      );
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>
        Reported. Thank you for helping us improve.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4',
          'transition-colors hover:text-foreground hover:underline',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded',
          className,
        )}
      >
        <Flag className="size-3.5" aria-hidden="true" />
        Found an error? Report it here
      </button>
    );
  }

  return (
    <div className={cn('rounded-lg border border-border bg-muted/30 p-3.5', className)}>
      <p className="text-sm font-medium">What is wrong with this question?</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Your feedback helps us improve. We read every report.
      </p>

      <div className="mt-3 space-y-1.5">
        {QuestionReportReason.values.map((value) => (
          <label
            key={value}
            className="flex cursor-pointer items-center gap-2.5 text-sm"
            htmlFor={`reason-${questionId}-${value}`}
          >
            <input
              id={`reason-${questionId}-${value}`}
              type="radio"
              name={`reason-${questionId}`}
              value={value}
              checked={reason === value}
              onChange={() => setReason(value)}
              className="size-4 accent-primary"
            />
            {QUESTION_REPORT_REASON_LABELS[value]}
          </label>
        ))}
      </div>

      <Textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        rows={2}
        className="mt-3"
        placeholder="Anything else we should know? (optional)"
        aria-label="More detail about the problem"
      />

      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={submit} disabled={sending}>
          {sending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Sending…
            </>
          ) : (
            'Send report'
          )}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={sending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
