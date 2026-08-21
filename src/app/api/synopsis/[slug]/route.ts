import type { ReadableStream as NodeWebStream } from 'node:stream/web';
import { Readable } from 'node:stream';

import { requireUser } from '@/server/auth/guards';
import { checkSynopsisAccess, openSynopsis } from '@/server/services/synopsis-service';

/**
 * GET /api/synopsis/[slug] — streams a paper's analysis PDF.
 *
 * Access is re-checked on every request rather than trusted from the page that
 * linked here: the URL is guessable, so the check has to live at the point the
 * bytes are served.
 *
 * The response is `inline` and marked no-store. That stops the browser
 * treating it as a download and stops intermediaries caching a document that
 * is behind a paywall — but note it does not, and cannot, prevent a determined
 * viewer from saving the file. Anything a browser can render, it can keep.
 */
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  let user;
  try {
    user = await requireUser();
  } catch {
    return new Response('Sign in to view this document.', { status: 401 });
  }

  const access = await checkSynopsisAccess(slug, user);

  if (access.state !== 'AVAILABLE') {
    const message =
      access.state === 'NOT_PUBLISHED'
        ? 'No analysis has been published for this paper yet.'
        : access.state === 'PURCHASE_REQUIRED'
          ? 'This analysis is part of the paid paper.'
          : 'Attempt the paper before opening its analysis.';
    return new Response(message, { status: 403 });
  }

  const { stream, size } = await openSynopsis(access.fileName);

  return new Response(Readable.toWeb(stream) as NodeWebStream as ReadableStream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(size),
      // `inline` with a generic name: the viewer shows it, and a save keeps a
      // name that does not advertise the original document.
      'Content-Disposition': 'inline; filename="analysis.pdf"',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      // Only this site may frame it.
      'Content-Security-Policy': "frame-ancestors 'self'",
    },
  });
}
