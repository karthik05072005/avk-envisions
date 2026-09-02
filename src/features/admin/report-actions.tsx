'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ApiClientError, api } from '@/lib/api-client';

/**
 * Marking a report done.
 *
 * Deliberately three plain buttons rather than a status dropdown: the whole
 * interaction is "I fixed it" or "nothing to fix", and an admin working through
 * a queue should not have to open a menu for each one.
 */
export function ReportActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function set(next: string, label: string) {
    setBusy(true);
    try {
      await api.patch(`/api/admin/reports/${id}`, { status: next });
      toast.success(label);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : 'That could not be saved.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ml-auto flex gap-2">
      {status === 'REPORTED' && (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => set('REVIEWING', 'Marked as being looked at.')}>
          Looking into it
        </Button>
      )}
      {status !== 'RESOLVED' && (
        <Button size="sm" disabled={busy} onClick={() => set('RESOLVED', 'Marked as fixed.')}>
          Fixed
        </Button>
      )}
      {status !== 'REJECTED' && (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => set('REJECTED', 'Dismissed.')}>
          No change needed
        </Button>
      )}
    </div>
  );
}
