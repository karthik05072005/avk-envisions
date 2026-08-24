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

/**
 * Shared gate for both the series-level and per-test documents.
 *
 * Two conditions, both required: the caller has paid (or the series is free),
 * and they have actually finished a paper in the series. The analysis contains
 * every answer, so handing it over first would turn it into an answer key.
 */
async function gate(
  series: { id: string; name: string; priceInPaise: number; testIds: string[] },
  user: { id: string; role: string },
): Promise<Exclude<SynopsisAccess, { state: 'AVAILABLE' } | { state: 'NOT_PUBLISHED' }> | null> {
  if (user.role === 'ADMIN') return null;

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

  // Nothing to attempt yet? Then requiring an attempt would lock the analysis
  // away permanently. Papers are published with their analysis before the
  // questions are keyed in, and a buyer is entitled to what they paid for.
  const attemptable = await db.test.count({
    where: { id: { in: series.testIds }, deletedAt: null, totalQuestions: { gt: 0 } },
  });
  if (attemptable === 0) return null;

  const finished = await db.testAttempt.count({
    where: {
      userId: user.id,
      testId: { in: series.testIds },
      status: { in: [...TERMINAL_ATTEMPT_STATUSES] },
    },
  });

  if (finished === 0) return { state: 'ATTEMPT_REQUIRED', seriesName: series.name };
  return null;
}

/**
 * Access to one test's own analysis.
 *
 * Falls back to the series document when the test has none of its own, which
 * is how a single paper-wide analysis serves the full-length test and every
 * subject-wise drill cut from the same paper.
 */
export async function checkTestSynopsisAccess(
  testId: string,
  user: { id: string; role: string },
): Promise<SynopsisAccess> {
  const test = await db.test.findFirst({
    where: { id: testId, deletedAt: null },
    select: {
      id: true,
      title: true,
      synopsisFileName: true,
      testSeries: {
        select: {
          id: true,
          name: true,
          priceInPaise: true,
          synopsisFileName: true,
          tests: { where: { deletedAt: null }, select: { id: true } },
        },
      },
    },
  });

  if (!test?.testSeries) throw errors.notFound('Test');

  const fileName = test.synopsisFileName ?? test.testSeries.synopsisFileName;
  if (!fileName) return { state: 'NOT_PUBLISHED' };

  const blocked = await gate(
    {
      id: test.testSeries.id,
      name: test.testSeries.name,
      priceInPaise: test.testSeries.priceInPaise,
      testIds: test.testSeries.tests.map((t) => t.id),
    },
    user,
  );
  if (blocked) return blocked;

  return { state: 'AVAILABLE', fileName, seriesName: test.title };
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

  const blocked = await gate(
    {
      id: series.id,
      name: series.name,
      priceInPaise: series.priceInPaise,
      testIds: series.tests.map((t) => t.id),
    },
    user,
  );

  return blocked ?? available;
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
