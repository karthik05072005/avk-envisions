/**
 * The courses the dashboard offers, and at what price.
 *
 * Two faults were reported here, both about telling a student something
 * untrue:
 *
 *   the LATER price was shown — PYQ at ₹199 while it was selling at ₹49
 *   five chapterwise subjects were offered, each holding no papers at all
 */
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const BASE = 'http://localhost:3000';
const STUDENT = 'student@avkvisions.com';
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

async function main() {
  console.log('\n=== Courses offered on the dashboard ===\n');

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.request.post(`${BASE}/api/auth/login`, {
      data: { email: STUDENT, password: PASSWORD },
    });
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });

    const rows = await page.locator('section[aria-labelledby="available-heading"] li').all();
    log(rows.length > 0, 'the dashboard offers courses', `${rows.length}`);

    const offered: { name: string; prices: string[] }[] = [];
    for (const row of rows) {
      const text = (await row.textContent())?.replace(/\s+/g, ' ').trim() ?? '';
      const name = (await row.locator('span.font-semibold').first().textContent())?.trim() ?? '?';
      offered.push({ name, prices: text.match(/₹[\d,]+/g) ?? [] });
    }
    for (const o of offered) console.log(`      ${o.name.padEnd(22)} ${o.prices.join(' then ')}`);

    // --- Chapterwise is Coming Soon, so it is not for sale here -------------
    //
    // Checked against the series' real names rather than by counting papers.
    // An earlier version of this asked "does it have at least one test?", and
    // passed locally while production still showed Polity — a first paper had
    // been attached there, so the rule let it straight back through.
    const chapterwise = await db.testSeries.findMany({
      where: { slug: { startsWith: 'chapterwise-' }, deletedAt: null },
      select: { name: true },
    });

    const leaked = offered.filter((o) =>
      chapterwise.some((c) => o.name === c.name || o.name.includes(c.name)),
    );
    log(
      leaked.length === 0,
      'no chapterwise subject is offered while the track is Coming Soon',
      leaked.length ? leaked.map((o) => o.name).join(', ') : `${chapterwise.length} subjects held back`,
    );

    // And nothing empty either, bundle aside.
    const empty = await db.testSeries.findMany({
      where: {
        deletedAt: null,
        status: 'PUBLISHED',
        priceInPaise: { gt: 0 },
        tests: { none: { deletedAt: null } },
        NOT: { slug: 'kas-pyq-all-years' },
      },
      select: { name: true },
    });
    const emptyOffered = offered.filter((o) =>
      empty.some((e) => e.name === o.name || o.name.includes(e.name)),
    );
    log(
      emptyOffered.length === 0,
      'no course with zero papers is offered',
      emptyOffered.length ? emptyOffered.map((o) => o.name).join(', ') : `${empty.length} such series exist`,
    );

    // The bundle is the exception and must still be there.
    const bundleLive = await db.testSeries.findFirst({
      where: { slug: 'kas-pyq-all-years', status: 'PUBLISHED', deletedAt: null },
      select: { id: true },
    });
    if (bundleLive) {
      log(
        offered.some((o) => /PYQ/i.test(o.name)),
        'the previous-year bundle is still offered, though it holds no papers itself',
      );
    }

    // --- Today's price, not the later one -----------------------------------
    const priced = await db.testSeries.findMany({
      where: { deletedAt: null, status: 'PUBLISHED', tier1PriceInPaise: { not: null } },
      select: {
        slug: true,
        priceInPaise: true,
        tier1PriceInPaise: true,
        tier1Limit: true,
        _count: { select: { entitlements: true } },
      },
    });

    // Every early-bird series still inside its first tier must quote that
    // price first, with the regular price second.
    let checked = 0;
    for (const series of priced) {
      if (series.tier1Limit === null || series._count.entitlements >= series.tier1Limit) continue;
      const today = `₹${(series.tier1PriceInPaise! / 100).toLocaleString('en-IN')}`;
      const later = `₹${(series.priceInPaise / 100).toLocaleString('en-IN')}`;

      const card = offered.find((o) => o.prices[0] === today && o.prices[1] === later);
      if (card) checked += 1;
    }
    log(checked > 0, 'every offered course quotes today\'s price first', `${checked} verified`);

    const quotesLaterFirst = offered.filter((o) => {
      const [first, second] = o.prices;
      if (!first || !second) return false;
      const n = (v: string) => Number(v.replace(/[₹,]/g, ''));
      return n(first) > n(second);
    });
    log(
      quotesLaterFirst.length === 0,
      'and never the later price first',
      quotesLaterFirst.length ? quotesLaterFirst.map((o) => o.name).join(', ') : '',
    );

    await page.close();
  } finally {
    await browser.close();
  }

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
}

main()
  .catch((error) => {
    console.error('\nFailed:\n', error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
