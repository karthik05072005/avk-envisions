'use client';

import * as React from 'react';

/**
 * Read-only viewer for a paper's analysis PDF.
 *
 * `#toolbar=0&navpanes=0` asks the browser's built-in PDF viewer to hide its
 * chrome, which is what removes the download and print buttons in Chrome and
 * Edge. Combined with the keyboard and context-menu handlers below, that stops
 * casual saving.
 *
 * It is not DRM and is not presented as such. A viewer who opens developer
 * tools, or simply screenshots the page, keeps the content — that is true of
 * every document a browser can display. Firefox's viewer also ignores the
 * toolbar parameter and will still show its own download control.
 */
export function SynopsisViewer({ src, title }: { src: string; title: string }) {
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && (key === 's' || key === 'p')) {
        event.preventDefault();
      }
    };
    const onContextMenu = (event: MouseEvent) => event.preventDefault();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('contextmenu', onContextMenu);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('contextmenu', onContextMenu);
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
      <object
        data={`${src}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
        type="application/pdf"
        title={title}
        className="h-[80vh] min-h-[520px] w-full"
      >
        {/* Shown only when the browser cannot render a PDF inline. */}
        <div className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Your browser cannot display PDFs inline. Please open this page in a recent version of
            Chrome, Edge, Safari or Firefox.
          </p>
        </div>
      </object>
    </div>
  );
}
