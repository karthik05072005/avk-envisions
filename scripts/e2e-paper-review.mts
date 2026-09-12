/**
 * Reviewing a paper in the question bank.
 *
 * Opening a paper used to give a two-line preview per question, so correcting
 * a hundred-question paper meant a hundred round trips through a separate edit
 * screen. The PDF import already showed the whole thing at once — question,
 * options with the keyed one marked, explanation, all editable — and the bank
 * is the same job done later.
 *
 * What has to hold: every question is there, in paper order, editable in
 * place, and a save writes through to the database rather than only looking
 * saved on screen.
 */
import { chromium, type Page } from 'playwright';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const BASE = 'http://localhost:3000';
const ADMIN = 'e2e-review-admin@avkvisions.test';
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

async function makeAdmin() {
  const donor = await db.user.findFirstOrThrow({
    where: { email: 'student@avkvisions.com' },
    select: { passwordHash: true },
  });
  await db.user.deleteMany({ where: { email: ADMIN } });
  await db.user.create({
    data: {
      email: ADMIN,
      emailNormal: ADMIN,
      name: 'Paper Review Admin',
      role: 'ADMIN',
      passwordHash: donor.passwordHash,
      emailVerified: new Date(),
      status: 'ACTIVE',
    },
  });
}

/** The paper with the most questions, which is the worst case for this screen. */
async function biggestPaper() {
  const tests = await db.test.findMany({
    where: { deletedAt: null },
    select: { id: true, title: true, _count: { select: { questions: true } } },
  });
  const best = tests
    .filter((t) => t._count.questions > 0)
    .sort((a, b) => b._count.questions - a._count.questions)[0];
  if (!best) throw new Error('No paper in the database holds any questions.');
  return best;
}

async function signIn(page: Page) {
  const response = await page.request.post(`${BASE}/api/auth/login`, {
    data: { email: ADMIN, password: PASSWORD },
  });
  if (!response.ok()) throw new Error(`Sign-in failed: ${response.status()}`);
}

async function main() {
  console.log('\n=== Reviewing a paper in the question bank ===\n');
  await makeAdmin();
  const paper = await biggestPaper();
  console.log(`  paper: ${paper.title} (${paper._count.questions} questions)\n`);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await signIn(page);

    // ---------------------------------------------- the whole paper is there
    console.log('-- The paper opens whole --');

    await page.goto(`${BASE}/admin/questions?testId=${paper.id}`, { waitUntil: 'networkidle' });

    const cards = page.locator('li:has(textarea[aria-label^="Question "])');
    const shown = await cards.count();
    log(
      shown === paper._count.questions,
      'every question on the paper is on the page',
      `${shown} shown of ${paper._count.questions}`,
    );

    log(
      (await page.getByRole('heading', { name: /review every question/i }).count()) === 1,
      'the review layout is the one in use, not the old preview list',
    );

    // The old paged list capped at 25 and paginated. Neither belongs here.
    log(
      (await page.getByRole('navigation', { name: /pagination/i }).count()) === 0,
      'there is no pagination to click through',
    );

    // ------------------------------------------------------ in paper order
    console.log('\n-- In the order the paper runs --');

    const numbers = await page.locator('textarea[aria-label^="Question "]').evaluateAll((nodes) =>
      nodes.map((n) => Number((n.getAttribute('aria-label') ?? '').match(/\d+/)?.[0] ?? -1)),
    );
    const ordered = numbers.every((n, i) => n === i + 1);
    log(ordered, 'questions run 1, 2, 3 … not 1, 10, 11', `first five: ${numbers.slice(0, 5).join(', ')}`);

    // Against the database, so screen order matching itself is not enough.
    const stored = await db.testQuestion.findMany({
      where: { testId: paper.id, question: { deletedAt: null } },
      orderBy: { sortOrder: 'asc' },
      select: { question: { select: { id: true, body: true } } },
    });
    const firstOnScreen = (await page.locator('textarea[aria-label="Question 1 text"]').inputValue()).trim();
    log(
      firstOnScreen === stored[0]!.question.body.trim(),
      'and in the paper\'s own order, not some other one',
    );

    // -------------------------------------------------- editable in place
    console.log('\n-- Editable where it sits --');

    const first = cards.first();
    log((await first.locator('textarea').count()) >= 3, 'the question text and its options are all editable');

    const keyed = await first.locator('button[aria-pressed="true"]').count();
    log(keyed === 1, 'the keyed option is marked', `${keyed} marked`);

    log(
      (await first.getByLabel(/^Explanation$/i).count()) === 1 ||
        (await first.locator('textarea[id^="explanation-"]').count()) === 1,
      'the explanation is there to correct',
    );

    // Save is inert until something changes, so an untouched paper cannot be
    // half-rewritten by stray clicks.
    const saveButton = first.getByRole('button', { name: /^save$/i });
    log(await saveButton.isDisabled(), 'Save is disabled until something is edited');

    // ------------------------------------------------------- a save persists
    console.log('\n-- A save reaches the database --');

    const target = stored[0]!.question;
    const before = await db.question.findUniqueOrThrow({
      where: { id: target.id },
      select: { body: true, explanation: true },
    });

    const marker = `  [reviewed ${Date.now()}]`;
    const bodyBox = page.locator('textarea[aria-label="Question 1 text"]');
    await bodyBox.fill(`${before.body}${marker}`);

    log(await saveButton.isEnabled(), 'Save wakes up once the text changes');

    await saveButton.click();
    await page.getByText(/^Q1 saved\.$/).waitFor({ timeout: 10_000 });

    const after = await db.question.findUniqueOrThrow({
      where: { id: target.id },
      select: { body: true, explanation: true, options: { select: { body: true, isCorrect: true } } },
    });
    log(after.body === `${before.body}${marker}`, 'the edit is in the database, not only on screen');

    const stillKeyed = after.options.filter((o) => o.isCorrect).length;
    log(stillKeyed === 1, 'and the answer key survived the save', `${stillKeyed} correct option`);

    // Scroll position is the reason this saves without reloading: on a
    // hundred-question paper a reload sends the reviewer back to the top after
    // every single correction.
    log(
      (await page.evaluate(() => document.querySelectorAll('textarea').length)) > 3,
      'the page did not reload away from the review',
    );

    // Put it back the way it was.
    await db.question.update({ where: { id: target.id }, data: { body: before.body } });

    // ------------------------------------------- filters still get a list
    console.log('\n-- Filtering inside a paper still lists matches --');

    const word = before.body.trim().split(/\s+/).find((w) => w.length > 5) ?? 'the';
    await page.goto(`${BASE}/admin/questions?testId=${paper.id}&q=${encodeURIComponent(word)}`, {
      waitUntil: 'networkidle',
    });
    log(
      (await page.getByRole('heading', { name: /review every question/i }).count()) === 0,
      'a search inside a paper narrows to matches rather than showing all of them',
    );

    await page.close();
  } finally {
    await browser.close();
    await db.user.deleteMany({ where: { email: ADMIN } });
  }

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
}

main()
  .catch((error) => {
    console.error('\nFailed:\n', error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
