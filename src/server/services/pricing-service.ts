import { db } from '@/server/db';

/**
 * Early-bird pricing.
 *
 * A series can advertise a price that steps up as seats fill: tier 1 until
 * `tier1Limit` people have enrolled, tier 2 until `tier2Limit`, then the
 * regular `priceInPaise`.
 *
 * The seats-taken figure is always counted from live entitlements. It is never
 * stored, and never seeded with a flattering starting number — a countdown
 * that does not correspond to real sales is a lie told to every visitor, and it
 * would also let the advertised price drift away from what checkout charges.
 */

export interface SeriesPricing {
  /** What a new buyer pays right now, in paise. */
  priceInPaise: number;
  /** The regular price once every tier is exhausted. */
  regularPriceInPaise: number;
  /** Which tier is live: 1, 2, or null when selling at the regular price. */
  activeTier: 1 | 2 | null;
  /** People who already hold access. Counted, not stored. */
  enrolled: number;
  /** Seats left in the current tier, or null when there is no tier running. */
  seatsLeftInTier: number | null;
  /** The ceiling of the current tier, or null at regular price. */
  tierLimit: number | null;
  /** Price of the next step up, or null when this is already the last step. */
  nextPriceInPaise: number | null;
}

interface SeriesPricingInput {
  priceInPaise: number;
  tier1PriceInPaise: number | null;
  tier1Limit: number | null;
  tier2PriceInPaise: number | null;
  tier2Limit: number | null;
}

/** Counts everyone holding live, unrevoked access to a series. */
export async function countEnrolled(testSeriesId: string): Promise<number> {
  const now = new Date();
  return db.entitlement.count({
    where: {
      testSeriesId,
      revokedAt: null,
      startsAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });
}

/**
 * Resolves the price a buyer pays, given how many have already enrolled.
 *
 * Pure, so the ladder can be unit-tested without a database.
 */
export function resolvePricing(series: SeriesPricingInput, enrolled: number): SeriesPricing {
  const regular = series.priceInPaise;

  const base: SeriesPricing = {
    priceInPaise: regular,
    regularPriceInPaise: regular,
    activeTier: null,
    enrolled,
    seatsLeftInTier: null,
    tierLimit: null,
    nextPriceInPaise: null,
  };

  // Free series have no ladder to climb.
  if (regular === 0) return base;

  const t1 = series.tier1PriceInPaise;
  const l1 = series.tier1Limit;
  const t2 = series.tier2PriceInPaise;
  const l2 = series.tier2Limit;

  if (t1 !== null && l1 !== null && enrolled < l1) {
    return {
      ...base,
      priceInPaise: t1,
      activeTier: 1,
      seatsLeftInTier: l1 - enrolled,
      tierLimit: l1,
      nextPriceInPaise: t2 ?? regular,
    };
  }

  if (t2 !== null && l2 !== null && enrolled < l2) {
    return {
      ...base,
      priceInPaise: t2,
      activeTier: 2,
      seatsLeftInTier: l2 - enrolled,
      tierLimit: l2,
      nextPriceInPaise: regular,
    };
  }

  return base;
}

/** Convenience wrapper: reads the ladder and the live count together. */
export async function getSeriesPricing(testSeriesId: string): Promise<SeriesPricing | null> {
  const series = await db.testSeries.findUnique({
    where: { id: testSeriesId },
    select: {
      priceInPaise: true,
      tier1PriceInPaise: true,
      tier1Limit: true,
      tier2PriceInPaise: true,
      tier2Limit: true,
    },
  });

  if (!series) return null;
  return resolvePricing(series, await countEnrolled(testSeriesId));
}

/**
 * Enrolment counts for many series at once.
 *
 * A listing page needs one count per series; doing that with a query each
 * turns a six-card grid into seven round trips. Series with nobody enrolled
 * are absent from `groupBy`, so the caller must treat a missing key as zero.
 */
export async function countEnrolledMany(testSeriesIds: string[]): Promise<Map<string, number>> {
  if (testSeriesIds.length === 0) return new Map();

  const now = new Date();
  const rows = await db.entitlement.groupBy({
    by: ['testSeriesId'],
    where: {
      testSeriesId: { in: testSeriesIds },
      revokedAt: null,
      startsAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    _count: { _all: true },
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.testSeriesId) counts.set(row.testSeriesId, row._count._all);
  }
  return counts;
}
