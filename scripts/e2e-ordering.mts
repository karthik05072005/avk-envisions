/**
 * Every list of papers reads in the series' own order.
 *
 * Sorting papers by title or slug sorts them as text, so "Day 10" lands before
 * "Day 2" and `kas-paid-10` before `kas-paid-2`. A fifty-day series then reads
 * 1, 10, 11, 12 … and finding day 7 becomes a hunt. This has now been found in
 * four separate places — the question bank, the import picker, the synopsis
 * manager and the paper groups — so it is checked rather than remembered.
 *
 * The rule: wherever a series' papers are listed, position wins over name.
 */
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const BASE = 'http://localhost:3000';
const ADMIN = 'e2e-order-admin@avkvisions.test';
const PASSWORD = 'Demo@Pass2024';

let passed = 0;
let failed = 0;

function log(ok: boolean, label: string, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
  if (ok) passed += 1;
  else {
    failed += 1;
    process.exitCode = 1;
  }
}

/** The day or test number a title announces, if any. */
function numberIn(title: string): number | null {
  const m = title.match(/\b(?:Day|Test)\s+(\d{1,3})\b/i);
  return m ? Number(m[1]) : null;
}

/** True when the numbers only ever go up. */
function ascending(numbers: number[]): boolean {
  return numbers.every((n, i) => i === 0 || n >= numbers[i - 1]!);
}

/**
 * True when a page's numbers are ordered.
 *
 * A page holds several lists — a series per group, a sidebar, a summary — so
 * the numbers restart legitimately. What must never happen is a jump *within*
 * one run: 1, 10, 11, 2 is the bug, while 1, 2, 3, 1, 2, 3 is two lists.
 * Runs are split wherever the number drops to at or below where a run began.
 */
function runsAreOrdered(numbers: number[]): { ok: boolean; badRun: number[] } {
  // Splitting on every decrease would make this trivially true, since any
  // sequence is a series of ascending runs. What distinguishes a second list
  // from a scrambled one is where the descent lands: a fresh list restarts at
  // or near its own beginning, while text-sorting drops back into the middle
  // of the numbers already seen — 1, 10, 11, 2 goes to 2 with 10 and 11 above
  // it, and then climbs again.
  //
  // So a descent is only allowed when it restarts the list: the new number is
  // at or below the lowest seen so far in the current run.
  let run: number[] = [];

  for (const n of numbers) {
    const previous = run[run.length - 1];
    if (previous !== undefined && n < previous) {
      // Compared against where this run STARTED, not the lowest it reached.
      // A page repeats its list in the React payload, so the second pass
      // restarts at 1 and climbs again; using the running minimum treated
      // "Day 9" in that second pass as a dip, because 9 > 1.
      if (n <= run[0]!) {
        run = [];
      } else {
        // Down into the middle of what this run has already shown, then it
        // will climb again — the 1, 10, 11, 2 signature.
        return { ok: false, badRun: [...run.slice(-6), n] };
      }
    }
    run.push(n);
  }

  return { ok: true, badRun: [] };
}

async function main() {
  console.log('\n=== Papers are listed in order, everywhere ===\n');

  const donor = await db.user.findFirstOrThrow({
    where: { email: 'student@avkvisions.com' },
    select: { passwordHash: true },
  });
  await db.user.deleteMany({ where: { email: ADMIN } });
  await db.user.create({
    data: {
      email: ADMIN,
      emailNormal: ADMIN,
      name: 'Ordering Admin',
      role: 'ADMIN',
      passwordHash: donor.passwordHash,
      emailVerified: new Date(),
      status: 'ACTIVE',
    },
  });

  // The two series that expose the bug: one zero-padded, one not.
  const series = await db.testSeries.findMany({
    where: { slug: { in: ['kas-50-questions-50-days', 'kas-prelims-paid-test-series'] } },
    select: { id: true, slug: true, name: true },
  });
  log(series.length === 2, 'found the series that show the problem');

  // ------------------------------------------------------- the data itself
  console.log('-- What the database returns --');

  for (const s of series) {
    const papers = await db.test.findMany({
      where: { testSeriesId: s.id, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { startDate: 'asc' }, { slug: 'asc' }],
      select: { title: true, sortOrder: true },
    });

    // Checked on sortOrder rather than the title: the paid series names its
    // papers by subject ("Polity + Current Affairs"), so there is no number in
    // the title to read. Position is what the ordering claims to follow.
    const positions = papers.map((p) => p.sortOrder);
    log(
      positions.length > 0 && ascending(positions),
      `${s.slug} reads in order`,
      `${positions.length} papers, ${positions.slice(0, 6).join(', ')}${positions.length > 6 ? ' …' : ''}`,
    );

    // And the wrong way round, to prove the ordering is doing the work.
    const byTitle = await db.test.findMany({
      where: { testSeriesId: s.id, deletedAt: null },
      orderBy: { title: 'asc' },
      select: { title: true },
    });
    const titleNumbers = byTitle
      .map((p) => numberIn(p.title))
      .filter((n): n is number => n !== null);
    if (titleNumbers.length > 9) {
      log(
        !ascending(titleNumbers),
        `  (sorting ${s.slug} by title would scramble it, as it did)`,
        titleNumbers.slice(0, 5).join(', '),
      );
    }
  }

  // -------------------------------------------------------- the admin pages
  console.log('\n-- What the admin pages show --');

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.request.post(`${BASE}/api/auth/login`, {
      data: { email: ADMIN, password: PASSWORD },
    });

    /**
     * The day/test numbers a person actually sees, in order.
     *
     * Read from the rendered text rather than the HTML source. The source also
     * carries React's payload, which repeats every string and emits them in
     * its own deduplicated order — "1…8, 11, 12" then 9 and 10 later — so
     * scanning it reports an ordering fault that is not on the screen.
     */
    async function numbersOnPage(path: string): Promise<number[]> {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });

      // A redirect to /login means the page was never read, and an empty
      // result would then pass every ordering check without testing anything.
      if (page.url().includes('/login')) {
        throw new Error(`${path} redirected to sign-in; the admin session did not carry.`);
      }

      // Some of these pages keep their lists inside a collapsed group, so the
      // rendered text does not include them until they are opened.
      for (const toggle of await page.locator('summary, [aria-expanded="false"]').all()) {
        await toggle.click({ timeout: 1500 }).catch(() => {});
      }
      await page.waitForTimeout(400);

      const text = (await page.locator('body').innerText()) ?? '';
      const found: number[] = [];
      for (const m of text.matchAll(/\b(?:Day|Test)\s+(\d{1,3})\b/g)) {
        found.push(Number(m[1]));
      }
      return found;
    }

    // The import picker — where this was reported.
    const importNumbers = await numbersOnPage('/admin/import');
    log(
      runsAreOrdered(importNumbers).ok,
      'the PDF import picker lists days in order',
      runsAreOrdered(importNumbers).ok
        ? `${importNumbers.length} numbers read`
        : `out of order: ${runsAreOrdered(importNumbers).badRun.slice(0, 8).join(', ')}`,
    );

    // The synopsis manager.
    const synopsisNumbers = await numbersOnPage('/admin/synopsis');
    log(
      runsAreOrdered(synopsisNumbers).ok,
      'the analysis PDF manager lists them in order',
      runsAreOrdered(synopsisNumbers).ok
        ? `${synopsisNumbers.length} numbers read`
        : `out of order: ${runsAreOrdered(synopsisNumbers).badRun.slice(0, 8).join(', ')}`,
    );

    // The question bank's list of papers.
    const bankNumbers = await numbersOnPage('/admin/questions');
    log(
      runsAreOrdered(bankNumbers).ok,
      'the question bank lists papers in order',
      runsAreOrdered(bankNumbers).ok
        ? `${bankNumbers.length} numbers read`
        : `out of order: ${runsAreOrdered(bankNumbers).badRun.slice(0, 8).join(', ')}`,
    );

    // The fifty-day admin, which was already correct — checked so it stays so.
    const fiftyNumbers = await numbersOnPage('/admin/50-days');
    log(
      runsAreOrdered(fiftyNumbers).ok,
      'the 50-day admin lists them in order',
      runsAreOrdered(fiftyNumbers).ok
        ? `${fiftyNumbers.length} numbers read`
        : `out of order: ${runsAreOrdered(fiftyNumbers).badRun.slice(0, 8).join(', ')}`,
    );

    await page.close();
  } finally {
    await browser.close();
  }

  // ------------------------------------------------- and the student's view
  console.log('\n-- What a student sees --');

  const browser2 = await chromium.launch();
  try {
    const page = await browser2.newPage({ viewport: { width: 1280, height: 1000 } });

    for (const [label, path] of [
      ['the 50-day timetable', '/50-days'],
      ['the paid series', '/test-series/kas-prelims-paid-test-series'],
    ] as [string, string][]) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
      // Rendered text, not the HTML source — the source also carries React's
      // payload, which repeats every string in its own deduplicated order and
      // reports a fault that is not on the screen.
      const text = (await page.locator('body').innerText()) ?? '';
      const found: number[] = [];
      for (const m of text.matchAll(/\b(?:Day|Test)\s+(\d{1,3})\b/g)) found.push(Number(m[1]));
      const verdict = runsAreOrdered(found);
      log(verdict.ok, `${label} reads in order`,
          verdict.ok ? `${found.length} numbers read`
                     : `out of order: ${verdict.badRun.slice(0, 8).join(', ')}`);
    }

    await page.close();
  } finally {
    await browser2.close();
  }

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
}

main()
  .catch((error) => {
    console.error('\nFailed:\n', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.session.deleteMany({ where: { user: { email: ADMIN } } });
    await db.user.deleteMany({ where: { email: ADMIN } });
    await db.$disconnect();
  });
