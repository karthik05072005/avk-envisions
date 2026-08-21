import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

import { AppError, errors } from '@/lib/api';
import { TERMINAL_ATTEMPT_STATUSES } from '@/lib/enums';
import { db } from '@/server/db';

/**
 * Question-wise analysis PDFs ("synopsis") for previous-year papers.
 *
 * The document is the paid product for a PYQ year, so it is never placed in a
 * publicly served directory. It lives beside the database, outside the web
 * root, and is streamed only through `/api/synopsis/[slug]` after the caller's
 * access has been checked.
 */

/**
 * Where synopsis PDFs live.
 *
 * Defaults to a `synopses/` directory next to the SQLite file, which puts it on
 * the persistent volume (`/var/lib/avkvisions`) in production and inside the
 * project in development — without a second path to configure. Deliberately
 * NOT under the uploads directory, which Caddy serves straight off disk.
 */
export function synopsisDir(): string {
  const explicit = process.env.SYNOPSIS_DIR;
  if (explicit) return path.resolve(explicit);

  const url = process.env.DATABASE_URL ?? '';
  if (url.startsWith('file:')) {
    return path.join(path.dirname(url.slice('file:'.length)), 'synopses');
  }
  return path.resolve('storage/synopses');
}

/** Resolves a stored file name to an absolute path, refusing anything that escapes the directory. */
export function resolveSynopsisPath(fileName: string): string {
  const dir = synopsisDir();
  // `basename` strips any directory component, so a stored value like
  // "../../etc/passwd" cannot be used to read outside the synopsis directory.
  const safe = path.basename(fileName);
  const full = path.join(dir, safe);

  if (!full.startsWith(dir + path.sep)) throw errors.notFound('Synopsis');
  return full;
}

export type SynopsisAccess =
  | { state: 'AVAILABLE'; fileName: string; seriesName: string }
  | { state: 'NOT_PUBLISHED' }
  | { state: 'PURCHASE_REQUIRED'; seriesName: string; priceInPaise: number }
  | { state: 'ATTEMPT_REQUIRED'; seriesName: string };

/**
 * Decides whether a user may read the synopsis for a series.
 *
 * Two gates, both required:
 *
 *   1. **Entitlement** — the series is free, or the user has bought it. This is
 *      what "once they pay they get the synopsis" means.
 *   2. **Attempt** — the user has actually finished a test in the series. The
 *      analysis is a revision aid for a paper you have sat; handing it over
 *      first would let someone read the answers and then take the test.
 *
 * Admins bypass both so they can check what students will see.
 */
export async function checkSynopsisAccess(
  seriesSlug: string,
  user: { id: string; role: string },
): Promise<SynopsisAccess> {
  const series = await db.testSeries.findFirst({
    where: { slug: seriesSlug, status: 'PUBLISHED', deletedAt: null },
    select: {
      id: true,
      name: true,
      synopsisFileName: true,
      priceInPaise: true,
      tests: { where: { deletedAt: null }, select: { id: true } },
    },
  });

  if (!series) throw errors.notFound('Paper');
  if (!series.synopsisFileName) return { state: 'NOT_PUBLISHED' };

  const available = {
    state: 'AVAILABLE' as const,
    fileName: series.synopsisFileName,
    seriesName: series.name,
  };

  if (user.role === 'ADMIN') return available;

  if (series.priceInPaise > 0) {
    const now = new Date();
    const entitled = await db.entitlement.findFirst({
      where: {
        userId: user.id,
        testSeriesId: series.id,
        revokedAt: null,
        startsAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { id: true },
    });

    if (!entitled) {
      return {
        state: 'PURCHASE_REQUIRED',
        seriesName: series.name,
        priceInPaise: series.priceInPaise,
      };
    }
  }

  const finished = await db.testAttempt.count({
    where: {
      userId: user.id,
      testId: { in: series.tests.map((t) => t.id) },
      status: { in: [...TERMINAL_ATTEMPT_STATUSES] },
    },
  });

  if (finished === 0) return { state: 'ATTEMPT_REQUIRED', seriesName: series.name };

  return available;
}

/** Opens the file for streaming. Throws if the record points at a file that is gone. */
export async function openSynopsis(fileName: string) {
  const full = resolveSynopsisPath(fileName);

  if (!existsSync(full)) {
    throw new AppError(
      'NOT_FOUND',
      'The analysis document is registered but its file is missing on the server.',
    );
  }

  const info = await stat(full);
  return { stream: createReadStream(full), size: info.size, path: full };
}
