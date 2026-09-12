/**
 * Phase 1 of the website corrections, checked in a real browser.
 *
 *   #2  the feedback button belongs on the home page and nowhere else
 *   #8  subject-wise drills no longer offer an analysed PDF; full papers still do
 *   #7c a paper's questions list in the paper's own order, not alphabetically
 */
import { chromium, type Page } from 'playwright';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const BASE = 'http://localhost:3000';
const ADMIN = 'e2e-p1-admin@avkvisions.test';
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

/** The floating widget, however it is labelled. */
async function feedbackCount(page: Page) {
  return page.getByRole('button', { name: /feedback/i }).count();
}

async function makeAdmin() {
  const donor = await db.user.findFirstOrThrow({
    where: { email: 'student@avkvisions.com' },
    select: { passwordHash: true },
  });
  await db.user.deleteMany({ where: { email: ADMIN } });
  const admin = await db.user.create({
    data: {
      email: ADMIN,
      emailNormal: ADMIN,
      name: 'Phase One Admin',
      role: 'ADMIN',
      passwordHash: donor.passwordHash,
      emailVerified: new Date(),
      status: 'ACTIVE',
    },
    select: { id: true },
  });
  return admin.id;
}

async function main() {
  console.log('\n=== Website corrections, phase 1 ===\n');
  await makeAdmin();

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

    // ------------------------------------------------ #2 feedback placement
    console.log('-- #2 Feedback button, home page only --');

    await page.goto(BASE, { waitUntil: 'networkidle' });
    log((await feedbackCount(page)) > 0, 'the home page shows it');

    for (const path of ['/pricing', '/test-series', '/courses', '/about']) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
      const n = await feedbackCount(page);
      log(n === 0, `not on ${path}`, n > 0 ? `${n} found` : '');
    }

    // ----------------------------------------------------- #8 analysed PDFs
    console.log('\n-- #8 Analysed PDF only on full-length papers --');

    // A year that has both kinds of paper, and a synopsis on each.
    const year = await db.testSeries.findFirst({
      where: {
        slug: { startsWith: 'kas-pyq-2' },
        deletedAt: null,
        tests: { some: { synopsisFileName: { not: null }, deletedAt: null } },
      },
      select: { slug: true },
    });

    if (!year) {
      log(false, 'found a year with analysed PDFs to check');
    } else {
      await page.goto(`${BASE}/pyq/${year.slug.replace('kas-pyq-', 'kas-pyq-')}`, {
        waitUntil: 'networkidle',
      });

      // The subject-wise section is the one headed "Subject-wise Tests".
      const heading = page.getByText(/Subject-wise Tests/i).first();
      const hasSection = (await heading.count()) > 0;
      log(hasSection, `the ${year.slug} page lists subject-wise tests`);

      if (hasSection) {
        // Checked by which test each button points at, not by where it sits in
        // the markup: "Subject-wise Tests" also appears in the summary near the
        // top of the page, so splitting the HTML on that phrase put the
        // full-length buttons on the wrong side and reported a false failure.
        const html = await page.content();
        const linked = new Set(
          [...html.matchAll(/\/synopsis\/test\/([a-z0-9]+)/g)].map((m) => m[1]!),
        );

        const offered = await db.test.findMany({
          where: { id: { in: [...linked] } },
          select: { slug: true, paperNumber: true, subjectId: true },
        });

        const subjectOnes = offered.filter((t) => t.subjectId !== null);
        const fullOnes = offered.filter((t) => t.subjectId === null);

        log(subjectOnes.length === 0, 'no analysed PDF on any subject-wise test',
            subjectOnes.length ? subjectOnes.map((t) => t.slug).join(', ') : '');
        log(fullOnes.length > 0, 'but the full-length papers keep theirs',
            fullOnes.map((t) => t.slug).join(', '));
      }
    }

    // --------------------------------------------- #7c question bank order
    console.log('\n-- #7c Question bank reads in the paper order --');

    const paper = await db.test.findFirst({
      where: { totalQuestions: { gte: 12 }, deletedAt: null },
      select: { id: true, slug: true, totalQuestions: true },
      orderBy: { totalQuestions: 'desc' },
    });

    if (!paper) {
      log(false, 'found a paper big enough to show the ordering');
    } else {
      // What the paper itself says the order is.
      const expected = await db.testQuestion.findMany({
        where: { testId: paper.id },
        orderBy: { sortOrder: 'asc' },
        take: 12,
        select: { question: { select: { code: true } } },
      });

      // Signed in through the API rather than the form. The form submits with
      // JavaScript, and clicking before it has hydrated posts the page as a
      // plain GET — which puts the password in the URL and signs nobody in.
      const res = await page.request.post(`${BASE}/api/auth/login`, {
        data: { email: ADMIN, password: PASSWORD },
      });
      log(res.status() === 200, 'the test admin signs in', `status ${res.status()}`);

      await page.goto(`${BASE}/admin/questions?testId=${paper.id}`, {
        waitUntil: 'networkidle',
      });
      const shown = await page.content();

      // Read the codes in the order they appear on the page.
      const order: string[] = [];
      for (const m of shown.matchAll(/KAS-[A-Z0-9-]+/g)) {
        if (!order.includes(m[0])) order.push(m[0]);
      }

      const want = expected.map((e) => e.question.code).filter(Boolean) as string[];
      const got = order.slice(0, want.length);

      log(got.length > 0, `the bank lists questions for ${paper.slug}`, `${got.length} read`);
      log(
        want.every((code, i) => got[i] === code),
        'in the paper order, not alphabetically',
        got.length ? `first: ${got.slice(0, 4).join(', ')}` : '',
      );

      // The specific symptom: Q10 must not sort before Q2.
      const two = got.findIndex((c) => /(?:^|-)Q2$/.test(c));
      const ten = got.findIndex((c) => /(?:^|-)Q10$/.test(c));
      if (two !== -1 && ten !== -1) {
        log(two < ten, 'Q2 comes before Q10', `Q2 at ${two + 1}, Q10 at ${ten + 1}`);
      } else {
        console.log('  --    (this paper does not use Q2/Q10 codes; order checked above)');
      }
    }

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
  .finally(async () => {
    await db.session.deleteMany({ where: { user: { email: ADMIN } } });
    await db.user.deleteMany({ where: { email: ADMIN } });
    await db.$disconnect();
  });
