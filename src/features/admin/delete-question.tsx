'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ApiClientError, api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

/**
 * Deletes one question from the bank.
 *
 * Archived rather than destroyed, because a question can be referenced by
 * attempts that students have already sat: removing the row outright would
 * corrupt results they have seen. Archiving takes it out of every listing and
 * out of any paper it would otherwise be served in, while leaving those
 * results intact.
 *
 * Distinct from removing a question from a paper, which detaches it and leaves
 * it in the bank. This is the stronger action, so the confirmation says which
 * one is about to happen and how many papers it will disappear from.
 */
export function DeleteQuestion({
  questionId,
  code,
  attachedTo,
  variant = 'icon',
  onDeleted,
}: {
  questionId: string;
  /** Shown in the confirmation, so the right question is obviously the one going. */
  code: string | null;
  /** How many papers currently use it. */
  attachedTo: number;
  variant?: 'icon' | 'button';
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function remove() {
    const where =
      attachedTo > 0
        ? `\n\nIt is on ${attachedTo} paper${attachedTo === 1 ? '' : 's'} and will disappear from ${attachedTo === 1 ? 'it' : 'them'}.`
        : '';

    const ok = window.confirm(
      `Delete ${code ?? 'this question'}?${where}\n\n` +
        'It is archived rather than erased, so results students have already ' +
        'seen stay correct.',
    );
    if (!ok) return;

    setBusy(true);
    try {
      await api.delete(`/api/admin/questions/${questionId}`);
      toast.success(`${code ?? 'Question'} deleted.`);
      onDeleted?.();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : 'That question could not be deleted.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (variant === 'button') {
    return (
      <Button variant="outline" size="sm" onClick={remove} disabled={busy}>
        <Trash2 aria-hidden="true" />
        {busy ? 'Deleting…' : 'Delete question'}
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={remove}
      disabled={busy}
      aria-label={`Delete ${code ?? 'question'}`}
      className={cn('shrink-0 text-muted-foreground hover:text-destructive')}
    >
      <Trash2 aria-hidden="true" />
    </Button>
  );
}
