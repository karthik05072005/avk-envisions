import {
  DAILY_CHALLENGE_SLUG,
  PYQ_BUNDLE_SLUG,
  PYQ_SERIES_PREFIX,
} from '@/lib/enums';
import { db } from '@/server/db';

/**
 * What a student has bought, and where each purchase is used.
 *
 * A series and the page a student actually studies on are not the same thing:
 * the previous-year papers are bought as one bundle but read at `/pyq`, and
 * KAS-50 is a series of fifty tests read at `/50-days`. Buying something and
 * then being left on a receipt page — with no route to the thing itself — is
 * the gap this closes.
 *
 * One definition serves both the post-payment redirect and the dashboard list,
 * so a student is sent to the same place the dashboard later links them to.
 */

export interface PurchasedCourse {
  /** The entitlement's series id, so a caller can dedupe. */
  id: string;
  /** What the student calls it, not the catalogue's full name. */
  name: string;
  /** Where the course is actually studied. */
  href: string;
  /** Shown under the name on the dashboard. */
  blurb: string;
  purchasedAt: Date;
}

/** Where a series is studied, and what to call it once bought. */
interface Destination {
  name: string;
  href: string;
  blurb: string;
}

/**
 * Resolves a series slug to the page its buyer should be sent to.
 *
 * Falls back to the series page, which always exists, so a series added later
 * still lands somewhere sensible rather than nowhere.
 */
export function destinationFor(slug: string, name: string): Destination {
  if (slug === PYQ_BUNDLE_SLUG || slug.startsWith(PYQ_SERIES_PREFIX)) {
    return {
      name: "PYQ's",
      href: '/pyq',
      blurb: 'Every previous year paper, full-length and subject-wise.',
    };
  }

  if (slug === DAILY_CHALLENGE_SLUG) {
    return {
      name: 'KAS-50',
      href: '/50-days',
      blurb: '50 questions a day for 50 days, with the full timetable.',
    };
  }

  if (slug === 'kas-prelims-paid-test-series') {
    return {
      name: 'Paid Test Series',
      href: '/test-series/kas-prelims-paid-test-series',
      blurb: 'Full-length mocks in the real prelims pattern.',
    };
  }

  if (slug === 'kas-prelims-free-test-series') {
    return {
      name: 'Free Test Series',
      href: '/test-series/kas-prelims-free-test-series',
      blurb: 'Ten free tests you can attempt any day, in any order.',
    };
  }

  if (slug.startsWith('chapterwise-')) {
    return {
      name,
      href: '/chapterwise',
      blurb: 'Chapter by chapter practice for this subject.',
    };
  }

  return { name, href: `/test-series/${slug}`, blurb: 'Your purchased test series.' };
}

/**
 * Everything `userId` currently holds, newest purchase first.
 *
 * Only live entitlements count: revoked, not-yet-started and expired ones are
 * excluded, so lapsed access disappears from the list rather than linking a
 * student to a page that will turn them away.
 */
export async function getPurchasedCourses(userId: string): Promise<PurchasedCourse[]> {
  const now = new Date();

  const rows = await db.entitlement.findMany({
    where: {
      userId,
      revokedAt: null,
      startsAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      testSeriesId: { not: null },
    },
    select: {
      createdAt: true,
      testSeries: { select: { id: true, slug: true, name: true, priceInPaise: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // A student holding both the bundle and a single year bought before it
  // exists twice here; the destination is the same page either way, so the
  // list shows it once.
  const seen = new Set<string>();
  const courses: PurchasedCourse[] = [];

  for (const row of rows) {
    const series = row.testSeries;
    if (!series) continue;

    const destination = destinationFor(series.slug, series.name);
    if (seen.has(destination.href)) continue;
    seen.add(destination.href);

    courses.push({
      id: series.id,
      name: destination.name,
      href: destination.href,
      blurb: destination.blurb,
      purchasedAt: row.createdAt,
    });
  }

  return courses;
}
