'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiClientError, api } from '@/lib/api-client';

/**
 * Empties every paper in a series.
 *
 * For a year built from the wrong document: the papers, their subject tests
 * and the series all stay, and only the questions come off, leaving the
 * structure ready to be refilled by hand or by a fresh import.
 *
 * The series name has to be typed. This removes hundreds of questions across a
 * dozen papers at once, so the confirmation is a deliberate obstacle — the
 * kind of action that should be hard to do by accident on the way to something
 * else.
 */
export function ClearSeriesQuestions({
  seriesId,
  seriesName,
  questionCount,
}: {
  seriesId: string;
  seriesName: string;
  questionCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const matches = confirm.trim().toLowerCase() === seriesName.trim().toLowerCase();

  async function submit() {
    setBusy(true);
    try {
      const result = await api.post<{ cleared: number; papers: number }>(
        '/api/admin/test-series/clear-questions',
        { seriesId, confirm },
      );
      toast.success(
        `Cleared ${result.cleared} question${result.cleared === 1 ? '' : 's'} from ` +
          `${result.papers} paper${result.papers === 1 ? '' : 's'}.`,
        { duration: 8_000 },
      );
      setOpen(false);
      setConfirm('');
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : 'The questions could not be cleared.',
        { duration: 10_000 },
      );
    } finally {
      setBusy(false);
    }
  }

  if (questionCount === 0) return null;

  if (!open) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 aria-hidden="true" />
        Clear questions
      </Button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-destructive/30 bg-destructive/5 p-3">
      <p className="text-sm font-medium">
        Remove all {questionCount} question{questionCount === 1 ? '' : 's'} from {seriesName}?
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Every paper in the series stays, along with its title, schedule and settings. The questions
        stay in the question bank and can be attached again. A paper any student has attempted is
        refused, so their results are never orphaned.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          placeholder={`Type “${seriesName}” to confirm`}
          aria-label={`Type ${seriesName} to confirm`}
          className="h-9 max-w-xs"
        />
        <Button size="sm" variant="destructive" disabled={!matches || busy} onClick={submit}>
          {busy ? 'Clearing…' : 'Clear them'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setConfirm('');
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
