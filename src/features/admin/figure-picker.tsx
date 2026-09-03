'use client';

import * as React from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ApiClientError } from '@/lib/api-client';
import { cn } from '@/lib/utils';

/**
 * Attaching a diagram to a question.
 *
 * Many KAS questions cannot be answered without their figure, and the scanned
 * papers bake diagrams into the page image where no extractor can reach them —
 * so somebody has to be able to crop one and attach it by hand. Asking for a
 * URL was not that: it assumed a file already hosted somewhere, which is a step
 * the person doing the content work has no way to perform.
 *
 * Shows what is attached, because a wrong figure is as bad as none.
 */
export function FigurePicker({
  value,
  onChange,
  label = 'Figure',
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);

      // Not `api.post` — multipart, so the browser must set the boundary.
      const response = await fetch('/api/admin/figures', {
        method: 'POST',
        body: form,
        credentials: 'same-origin',
      });
      const payload = await response.json();

      if (!payload.success) {
        toast.error(payload.error?.message ?? 'That image could not be uploaded.');
        return;
      }

      onChange(payload.data.url as string);
      toast.success('Image attached.');
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : 'Upload failed. Please try again.',
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
          aria-label={`Upload ${label.toLowerCase()}`}
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Uploading…
            </>
          ) : (
            <>
              <ImagePlus className="size-4" aria-hidden="true" />
              {value ? 'Replace image' : 'Upload image'}
            </>
          )}
        </Button>

        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => onChange(null)}
          >
            <X className="size-4" aria-hidden="true" />
            Remove
          </Button>
        )}
      </div>

      {value ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={`The ${label.toLowerCase()} shown with this question`}
            className="mt-2 max-h-56 rounded-lg border border-border bg-white"
          />
          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{value}</p>
        </>
      ) : (
        <p className="mt-1.5 text-xs text-muted-foreground">
          PNG, JPEG, GIF or WebP, up to 5 MB. Shown above the options.
        </p>
      )}
    </div>
  );
}
