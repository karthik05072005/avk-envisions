import 'server-only';

import { cache } from 'react';

import { parseJsonColumn, stringArraySchema } from '@/lib/json';
import { db } from '@/server/db';
import {
  countEnrolledMany,
  resolvePricing,
  type SeriesPricing,
} from '@/server/services/pricing-service';

/**
 * The course catalogue — the four tracks a student chooses between.
 *
 * Question counts returned here are the *real* number of questions attached to
 * each test, never a planned figure. A test still being built reports zero, and
 * the UI renders it as "content being added" rather than offering a Start button
 * that would fail at the API. Advertising a paper that cannot be opened is
 * worse than admitting it is not ready.
 */

export type TrackKey = 'FREE_SERIES' | 'PAID_SERIES' | 'PYQ' | 'CHAPTERWISE';

export interface TrackSummary {
  key: TrackKey;
  title: string;
  blurb: string;
  href: string;
  ctaLabel: string;
  iconName: string;
  /** Series belonging to this track. */
  seriesCount: number;
  testCount: number;
  /** Tests that actually have questions attached and can be attempted today. */
  readyCount: number;
  /** Lowest non-zero price across the track, in paise. 0 = the track is free. */
  fromPriceInPaise: number;
  isFree: boolean;
}

/** Static presentation for each track; counts are filled from the database. */
const TRACK_META: Record<TrackKey, Omit<TrackSummary, 'seriesCount' | 'testCount' | 'readyCount' | 'fromPriceInPaise' | 'isFree'>> = {
  FREE_SERIES: {
    key: 'FREE_SERIES',
    title: 'Free Test Series',
    blurb: 'Attempt free tests and evaluate your preparation level.',
    href: '/courses/free-test-series',
    ctaLabel: 'Start free test',
    iconName: 'ClipboardCheck',
  },
  PAID_SERIES: {
    key: 'PAID_SERIES',
    title: 'Paid Test Series',
    blurb: 'Full-length tests with detailed analysis and All India Ranking.',
    href: '/courses/paid-test-series',
    ctaLabel: 'Explore tests',
    iconName: 'ClipboardList',
  },
  PYQ: {
    key: 'PYQ',
    title: 'Solve Previous Question Papers',
    blurb: 'Experience the real exam environment by solving previous year papers.',
    href: '/pyq',
    ctaLabel: 'Solve papers',
    iconName: 'FileQuestion',
  },
  CHAPTERWISE: {
    key: 'CHAPTERWISE',
    title: 'Solve Chapterwise',
    blurb: 'Practice chapterwise questions by subject.',
    href: '/chapterwise',
    ctaLabel: 'Explore chapterwise',
    iconName: 'Layers',
  },
};

const TRACK_ORDER: TrackKey[] = ['FREE_SERIES', 'PAID_SERIES', 'PYQ', 'CHAPTERWISE'];

/** The four widgets on the landing page and /courses. */
export const getCourseTracks = cache(async (): Promise<TrackSummary[]> => {
  const series = await db.testSeries.findMany({
    where: { status: 'PUBLISHED', deletedAt: null },
    select: {
      track: true,
      priceInPaise: true,
      tests: {
        where: { status: 'PUBLISHED', deletedAt: null },
        select: { totalQuestions: true },
      },
    },
  });

  return TRACK_ORDER.map((key) => {
    const mine = series.filter((s) => s.track === key);
    const tests = mine.flatMap((s) => s.tests);
    const prices = mine.map((s) => s.priceInPaise).filter((p) => p > 0);

    return {
      ...TRACK_META[key],
      seriesCount: mine.length,
      testCount: tests.length,
      readyCount: tests.filter((t) => t.totalQuestions > 0).length,
      fromPriceInPaise: prices.length > 0 ? Math.min(...prices) : 0,
      isFree: key === 'FREE_SERIES',
    };
  });
});

// ---------------------------------------------------------------------------
// Previous year papers
// ---------------------------------------------------------------------------

export interface PyqYearSummary {
  id: string;
  slug: string;
  name: string;
  examYear: number;
  sessionLabel: string | null;
  priceInPaise: number;
  comparePriceInPaise: number;
  /** True when the paper costs nothing — currently the 2011 sample. */
  isFree: boolean;
  pricing: SeriesPricing;
  fullLengthCount: number;
  subjectCount: number;
  totalQuestions: number;
  readyCount: number;
}

/** The year grid on /pyq, oldest paper first so the free year leads. */
export const getPyqYears = cache(async (): Promise<PyqYearSummary[]> => {
  const series = await db.testSeries.findMany({
    where: { track: 'PYQ', status: 'PUBLISHED', deletedAt: null },
    // Oldest first, so the free 2011 paper is the first thing a visitor meets
    // and the years read as a progression rather than a reverse-chronological
    // list with the free sample buried at the bottom.
    orderBy: [{ examYear: 'asc' }, { sessionLabel: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      examYear: true,
      sessionLabel: true,
      priceInPaise: true,
      comparePriceInPaise: true,
      tier1PriceInPaise: true,
      tier1Limit: true,
      tier2PriceInPaise: true,
      tier2Limit: true,
      tests: {
        where: { status: 'PUBLISHED', deletedAt: null },
        select: { paperNumber: true, subjectId: true, totalQuestions: true },
      },
    },
  });

  const enrolments = await countEnrolledMany(series.map((s) => s.id));

  return series.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    examYear: s.examYear ?? 0,
    sessionLabel: s.sessionLabel,
    priceInPaise: s.priceInPaise,
    comparePriceInPaise: s.comparePriceInPaise,
    /** Free papers are open to everyone; every other year is locked until bought. */
    isFree: s.priceInPaise === 0,
    /** Live early-bird state — price and seats reflect real enrolments. */
    pricing: resolvePricing(s, enrolments.get(s.id) ?? 0),
    fullLengthCount: s.tests.filter((t) => t.paperNumber !== null).length,
    subjectCount: s.tests.filter((t) => t.subjectId !== null).length,
    totalQuestions: s.tests
      .filter((t) => t.paperNumber !== null)
      .reduce((sum, t) => sum + t.totalQuestions, 0),
    readyCount: s.tests.filter((t) => t.totalQuestions > 0).length,
  }));
});

export interface PyqTestRow {
  id: string;
  title: string;
  /** Whether an analysis document is published for this test. */
  hasSynopsis?: boolean;
  slug: string;
  durationMinutes: number;
  totalQuestions: number;
  totalMarks: number;
  accessType: string;
  maxAttempts: number;
  paperNumber: number | null;
  subject: { id: string; name: string; colorHex: string | null } | null;
  /** False when no questions are attached yet. */
  isReady: boolean;
}

/** One PYQ paper: its full-length tests and its subject-wise practice tests. */
export const getPyqPaper = cache(async (slug: string) => {
  const series = await db.testSeries.findFirst({
    where: { slug, track: 'PYQ', status: 'PUBLISHED', deletedAt: null },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      tagline: true,
      examYear: true,
      sessionLabel: true,
      priceInPaise: true,
      comparePriceInPaise: true,
      featuresJson: true,
      synopsisFileName: true,
      tests: {
        where: { status: 'PUBLISHED', deletedAt: null },
        orderBy: [{ paperNumber: 'asc' }, { title: 'asc' }],
        select: {
          id: true,
          title: true,
          slug: true,
          durationMinutes: true,
          totalQuestions: true,
          totalMarks: true,
          accessType: true,
          maxAttempts: true,
          paperNumber: true,
          synopsisFileName: true,
          subject: { select: { id: true, name: true, colorHex: true } },
        },
      },
    },
  });

  if (!series) return null;

  const rows: PyqTestRow[] = series.tests.map((t) => ({
    ...t,
    isReady: t.totalQuestions > 0,
    // A test uses its own analysis when it has one, otherwise the paper-wide
    // document — which is how one 2011 analysis serves the full paper and
    // every subject drill cut from it.
    hasSynopsis: Boolean(t.synopsisFileName ?? series.synopsisFileName),
  }));

  return {
    ...series,
    features: parseJsonColumn(series.featuresJson, stringArraySchema, []),
    /** Whether an analysis document exists. The file name itself never leaves the server. */
    hasSynopsis: Boolean(series.synopsisFileName),
    fullLength: rows.filter((t) => t.paperNumber !== null),
    subjectWise: rows.filter((t) => t.subject !== null),
  };
});

// ---------------------------------------------------------------------------
// Chapterwise
// ---------------------------------------------------------------------------

export const getChapterwiseSubjects = cache(async () => {
  const series = await db.testSeries.findMany({
    where: { track: 'CHAPTERWISE', status: 'PUBLISHED', deletedAt: null },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      description: true,
      iconName: true,
      accentHex: true,
      priceInPaise: true,
      comparePriceInPaise: true,
      featuresJson: true,
      tests: {
        where: { status: 'PUBLISHED', deletedAt: null },
        select: { totalQuestions: true },
      },
    },
  });

  return series.map((s) => ({
    ...s,
    features: parseJsonColumn(s.featuresJson, stringArraySchema, []),
    chapterCount: s.tests.length,
    readyCount: s.tests.filter((t) => t.totalQuestions > 0).length,
  }));
});

// ---------------------------------------------------------------------------
// A single track's series + schedule
// ---------------------------------------------------------------------------

/**
 * The scheduled test list for the free/paid series.
 *
 * `state` mirrors the course plan's vocabulary: a test is LOCKED until its
 * scheduled date, AVAILABLE once it opens, and COMPLETED after the student has
 * used up their attempts.
 */
export type ScheduleState = 'COMPLETED' | 'IN_PROGRESS' | 'AVAILABLE' | 'LOCKED' | 'COMING_SOON';

export interface ScheduleRow {
  id: string;
  title: string;
  slug: string;
  startDate: Date | null;
  durationMinutes: number;
  totalQuestions: number;
  totalMarks: number;
  maxAttempts: number;
  attemptsUsed: number;
  state: ScheduleState;
  /** Attempt id to resume or review, when one exists. */
  attemptId: string | null;
}

export async function getTrackSeries(track: TrackKey, userId?: string) {
  const series = await db.testSeries.findMany({
    where: { track, status: 'PUBLISHED', deletedAt: null },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      description: true,
      priceInPaise: true,
      comparePriceInPaise: true,
      accessDurationDays: true,
      featuresJson: true,
      tests: {
        where: { status: 'PUBLISHED', deletedAt: null },
        orderBy: [{ startDate: 'asc' }, { title: 'asc' }],
        select: {
          id: true,
          title: true,
          slug: true,
          startDate: true,
          durationMinutes: true,
          totalQuestions: true,
          totalMarks: true,
          maxAttempts: true,
        },
      },
    },
  });

  // One query for every attempt the student has on any of these tests, rather
  // than a per-test lookup.
  const testIds = series.flatMap((s) => s.tests.map((t) => t.id));
  const attempts = userId && testIds.length > 0
    ? await db.testAttempt.findMany({
        where: { userId, testId: { in: testIds } },
        orderBy: { startedAt: 'desc' },
        select: { id: true, testId: true, status: true },
      })
    : [];

  const byTest = new Map<string, typeof attempts>();
  for (const attempt of attempts) {
    const list = byTest.get(attempt.testId) ?? [];
    list.push(attempt);
    byTest.set(attempt.testId, list);
  }

  const now = new Date();

  return series.map((s) => ({
    ...s,
    features: parseJsonColumn(s.featuresJson, stringArraySchema, []),
    schedule: s.tests.map((test): ScheduleRow => {
      const mine = byTest.get(test.id) ?? [];
      const live = mine.find((a) => a.status === 'IN_PROGRESS');
      const finished = mine.filter((a) => a.status !== 'IN_PROGRESS');
      const attemptsUsed = finished.length;

      const state: ScheduleState = (() => {
        if (live) return 'IN_PROGRESS';
        if (test.totalQuestions === 0) return 'COMING_SOON';
        if (test.startDate && test.startDate > now) return 'LOCKED';
        if (test.maxAttempts > 0 && attemptsUsed >= test.maxAttempts) return 'COMPLETED';
        return 'AVAILABLE';
      })();

      return {
        ...test,
        attemptsUsed,
        state,
        attemptId: live?.id ?? finished[0]?.id ?? null,
      };
    }),
  }));
}
