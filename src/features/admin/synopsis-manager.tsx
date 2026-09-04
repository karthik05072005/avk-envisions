'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ApiClientError, api } from '@/lib/api-client';

/**
 * Upload or remove one analysis PDF.
 *
 * Deliberately inline rather than a dialog: an admin working down a list of
 * twelve papers is checking which ones are missing a document, and a modal per
 * row would turn that into twelve open-and-close cycles.
 */
export function SynopsisManager({
  kind,
  id,
  fileName,
  sizeBytes,
  present,
}: {
  kind: 'test' | 'series';
  id: string;
  fileName: string | null;
  sizeBytes: number;
  present: boolean;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', kind);
      form.append('id', id);

      // Not `api.post` — multipart, so the browser must set the boundary.
      const response = await fetch('/api/admin/synopsis', {
        method: 'POST',
        body: form,
        credentials: 'same-origin',
      });
      const payload = await response.json();

      if (!payload.success) {
        toast.error(payload.error?.message ?? 'That file could not be uploaded.');
        return;
      }

      toast.success('Analysis PDF uploaded.');
      router.refresh();
    } catch {
      toast.error('Upload failed. Check your connection and try again.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function remove() {
    if (!window.confirm('Remove this analysis PDF? Students will no longer see it.')) return;

    setBusy(true);
    try {
      await api.delete(`/api/admin/synopsis?kind=${kind}&id=${id}`);
      toast.success('Analysis PDF removed.');
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : 'That could not be removed.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      {fileName ? (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileText className="size-3.5" aria-hidden="true" />
          {present ? (
            `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`
          ) : (
            // The row can point at a file that is not on disk — a restored
            // database, or a half-finished install. Saying "registered" rather
            // than showing a size makes that visible instead of implying the
            // document is there.
            <span className="text-warning">registered, but the file is missing</span>
          )}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">No analysis PDF</span>
      )}

      <Button
        size="sm"
        variant="ghost"
        className="h-8 text-xs"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Upload className="size-3.5" aria-hidden="true" />
        )}
        {fileName ? 'Replace' : 'Upload'}
      </Button>

      {fileName && (
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs text-muted-foreground hover:text-destructive"
          disabled={busy}
          onClick={remove}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          Remove
        </Button>
      )}
    </div>
  );
}
