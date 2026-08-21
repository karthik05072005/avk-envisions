import { PrismaClient } from '@prisma/client';

import { isProduction } from '@/lib/env';

/**
 * Prisma client singleton.
 *
 * Next.js dev-mode hot reloading re-evaluates modules on every change, which
 * would otherwise open a new connection pool per reload and exhaust SQLite's
 * file handles. Caching the instance on `globalThis` keeps exactly one client
 * per process.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction() ? ['error', 'warn'] : ['error', 'warn'],
  });

if (!isProduction()) {
  globalForPrisma.prisma = db;
}

/**
 * Runs `fn` inside a transaction.
 *
 * SQLite serialises writers, so long transactions block the whole database.
 * Keep the callback short: do reads and computation before calling this, and
 * perform only the writes inside.
 */
export async function transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
  return db.$transaction(fn, {
    maxWait: 5_000,
    timeout: 15_000,
  });
}

/** The narrowed client type available inside a `transaction` callback. */
export type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/** Accepts either the root client or a transaction client. */
export type DbClient = PrismaClient | TransactionClient;

/**
 * SQLite pragmas that materially affect concurrency and durability under a web
 * workload. Called once at startup by the server bootstrap and the seed script.
 *
 * - WAL lets readers proceed while a writer holds the lock (the single biggest
 *   win for a read-heavy exam platform).
 * - `busy_timeout` makes concurrent writers wait instead of instantly failing
 *   with SQLITE_BUSY, which is essential during test-submission bursts.
 * - `foreign_keys` is OFF by default in SQLite; without it the schema's
 *   referential guarantees are advisory only.
 */
export async function applySqlitePragmas(): Promise<{ applied: string[]; failed: string[] }> {
  const applied: string[] = [];
  const failed: string[] = [];

  if (!process.env.DATABASE_URL?.startsWith('file:')) return { applied, failed };

  const pragmas = [
    'PRAGMA journal_mode = WAL',
    'PRAGMA busy_timeout = 5000',
    'PRAGMA foreign_keys = ON',
    'PRAGMA synchronous = NORMAL',
  ];

  for (const pragma of pragmas) {
    try {
      // `$queryRawUnsafe`, not `$executeRawUnsafe`: several PRAGMA statements
      // (notably `journal_mode`) return the resulting value as a row, which
      // the execute variant rejects because it expects an affected-row count.
      await db.$queryRawUnsafe(pragma);
      applied.push(pragma);
    } catch {
      failed.push(pragma);
    }
  }

  return { applied, failed };
}
