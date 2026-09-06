import { PYQ_BUNDLE_SLUG, PYQ_SERIES_PREFIX } from '@/lib/enums';
import { db } from '@/server/db';

/**
 * Who may open a paid series.
 *
 * One purchase of the previous-year bundle unlocks every exam year, which is
 * how the papers are sold and how the pricing page describes them. Before this
 * existed each year was its own series with its own entitlement, so a student
 * who paid ₹49 for "KAS Previous Year Question Papers" received a single year
 * and was asked to pay again for the next one.
 *
 * The rule lives here rather than at each call site because access is checked
 * in three separate places — starting an attempt, opening an analysis, and
 * creating an order — and a bundle honoured in only two of them is worse than
 * no bundle at all: it sells access the site then refuses to serve.
 */

/** A series is one of the previous-year papers, so the bundle covers it. */
export function isPyqSeries(slug: string): boolean {
  return slug.startsWith(PYQ_SERIES_PREFIX) && slug !== PYQ_BUNDLE_SLUG;
}

/**
 * The series ids whose entitlement grants access to `seriesId`.
 *
 * Normally just the series itself. For a previous-year paper it also includes
 * the bundle, so one purchase opens every year.
 */
export async function grantingSeriesIds(seriesId: string): Promise<string[]> {
  const series = await db.testSeries.findUnique({
    where: { id: seriesId },
    select: { slug: true },
  });
  if (!series || !isPyqSeries(series.slug)) return [seriesId];

  const bundle = await db.testSeries.findFirst({
    where: { slug: PYQ_BUNDLE_SLUG, deletedAt: null },
    select: { id: true },
  });

  return bundle ? [seriesId, bundle.id] : [seriesId];
}

/**
 * Whether `userId` may open `seriesId` right now.
 *
 * Checks the series itself and anything that bundles it. Revoked, not-yet-
 * started and expired entitlements are all excluded, so lapsed access reads as
 * no access rather than silently continuing.
 */
export async function hasEntitlement(userId: string, seriesId: string): Promise<boolean> {
  const now = new Date();
  const ids = await grantingSeriesIds(seriesId);

  const found = await db.entitlement.findFirst({
    where: {
      userId,
      testSeriesId: { in: ids },
      revokedAt: null,
      startsAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true },
  });

  return found !== null;
}

/**
 * Every previous-year series the bundle covers, for the catalogue pages.
 *
 * Returned as ids so a page can mark each year "included" without asking the
 * database once per card.
 */
export async function pyqSeriesIds(): Promise<string[]> {
  const rows = await db.testSeries.findMany({
    where: { slug: { startsWith: PYQ_SERIES_PREFIX }, deletedAt: null },
    select: { id: true, slug: true },
  });
  return rows.filter((row) => isPyqSeries(row.slug)).map((row) => row.id);
}
