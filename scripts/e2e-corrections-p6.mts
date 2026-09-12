/**
 * Phase 6: the dashboard sidebar, moving questions, and the printable export.
 *
 *   #6   the nav list is fixed on the left from tablet width up, and the
 *        dashboard shows both what a student owns and what else is on offer
 *   #7d  questions misplaced onto the wrong paper can be moved in one step,
 *        keeping their order
 *   #7e  a paper can be printed with its answers and explanations
 */
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const BASE = 'http://localhost:3000';
const ADMIN = 'e2e-p6-admin@avkvisions.test';
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

const STAMP = Date.now();

async function cleanup() {
  const tests = await db.test.findMany({
    where: { slug: { startsWith: 'e2e-move-' } },
    select: { id: true },
  });
  const ids = tests.map((t) => t.id);
  if (ids.length) {
    await db.testQuestion.deleteMany({ where: { testId: { in: ids } } });
    await db.test.deleteMany({ where: { id: { in: ids } } });
  }
  await db.question.deleteMany({ where: { code: { startsWith: 'E2E-MOVE-' } } });
  await db.session.deleteMany({ where: { user: { email: ADMIN } } });
  await db.user.deleteMany({ where: { email: ADMIN } });
}

async function main() {
  console.log('\n=== Sidebar, moving questions, and export ===\n');
  await cleanup();

  const donor = await db.user.findFirstOrThrow({
    where: { email: STUDENT },
    select: { passwordHash: true },
  });
  const admin = await db.user.create({
    data: {
      email: ADMIN,
      emailNormal: ADMIN,
      name: 'Phase Six Admin',
      role: 'ADMIN',
      passwordHash: donor.passwordHash,
      emailVerified: new Date(),
      status: 'ACTIVE',
    },
    select: { id: true },
  });

  const browser = await chromium.launch();
  try {
    // -------------------------------------------------- #6 the fixed sidebar
    console.log('-- #6 The nav list --');

    const student = await browser.newPage({ viewport: { width: 1024, height: 900 } });
    await student.request.post(`${BASE}/api/auth/login`, {
      data: { email: STUDENT, password: PASSWORD },
    });

    // A tablet. The list used to be hidden below `lg`, which is where the
    // screenshot of a hidden list came from.
    await student.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    const sidebar = student.locator('aside').first();
    log(await sidebar.isVisible(), 'the sidebar is fixed open on a tablet', '1024px');

    const menuButton = student.getByRole('button', { name: /open navigation/i });
    log((await menuButton.count()) === 0 || !(await menuButton.isVisible()),
        'and the menu button is gone, so the list is not offered twice');

    // Still reachable on a phone, where a fixed column would crowd the page.
    await student.setViewportSize({ width: 390, height: 850 });
    await student.reload({ waitUntil: 'networkidle' });
    log(!(await sidebar.isVisible()), 'a phone keeps the slide-out instead', '390px');
    log(await student.getByRole('button', { name: /open navigation/i }).isVisible(),
        'and has the button to open it');

    // Back to a desktop for the course lists.
    await student.setViewportSize({ width: 1440, height: 1000 });
    await student.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });

    const body = await student.content();
    const owns = /Courses purchased by you/.test(body);
    const offers = /Courses available to purchase/.test(body);
    log(owns || offers, 'the dashboard lists courses',
        `${owns ? 'purchased' : ''}${owns && offers ? ' + ' : ''}${offers ? 'available' : ''}`);

    // Whatever the student owns must not also be offered for sale.
    const purchasedNames = await student
      .locator('section[aria-labelledby="purchased-heading"] a span.font-semibold')
      .allTextContents();
    const availableNames = await student
      .locator('section[aria-labelledby="available-heading"] a span.font-semibold')
      .allTextContents();
    const both = purchasedNames.filter((n) => availableNames.includes(n));
    log(both.length === 0, 'nothing owned is also offered for sale',
        both.length ? both.join(', ') : '');

    await student.close();

    // ------------------------------------------------ #7d moving questions
    console.log('\n-- #7d Moving questions to the right paper --');

    // A test that actually has a subject: a question requires one, and the
    // first test in the table happens to have none.
    const source = await db.test.findFirstOrThrow({
      where: { deletedAt: null, subjectId: { not: null } },
      select: { examId: true, subjectId: true },
    });
    const subjectId = source.subjectId!;

    const wrong = await db.test.create({
      data: {
        examId: source.examId,
        subjectId,
        slug: `e2e-move-wrong-${STAMP}`,
        title: 'Wrong destination',
        category: 'PRACTICE',
        accessType: 'FREE',
        status: 'DRAFT',
        durationMinutes: 30,
      },
      select: { id: true },
    });
    const right = await db.test.create({
      data: {
        examId: source.examId,
        subjectId,
        slug: `e2e-move-right-${STAMP}`,
        title: 'Right destination',
        category: 'PRACTICE',
        accessType: 'FREE',
        status: 'DRAFT',
        durationMinutes: 30,
      },
      select: { id: true },
    });

    // Five questions on the wrong paper, in a known order.
    const made: string[] = [];
    for (let n = 1; n <= 5; n += 1) {
      const question = await db.question.create({
        data: {
          code: `E2E-MOVE-Q${n}`,
          examId: source.examId,
          subjectId,
          type: 'SINGLE_CORRECT',
          status: 'PUBLISHED',
          difficulty: 'MEDIUM',
          body: `Misplaced question ${n}.`,
          marks: 2,
          negativeMarks: 0.5,
          createdById: admin.id,
          options: {
            create: [
              { label: 'A', body: 'Right', isCorrect: true, sortOrder: 0 },
              { label: 'B', body: 'Wrong', isCorrect: false, sortOrder: 1 },
            ],
          },
        },
        select: { id: true },
      });
      made.push(question.id);
      await db.testQuestion.create({
        data: { testId: wrong.id, questionId: question.id, sortOrder: n, marks: 2, negativeMarks: 0.5 },
      });
    }
    await db.test.update({
      where: { id: wrong.id },
      data: { totalQuestions: 5, totalMarks: 10 },
    });

    const adminPage = await browser.newPage();
    await adminPage.request.post(`${BASE}/api/auth/login`, {
      data: { email: ADMIN, password: PASSWORD },
    });

    const moved = await adminPage.request.post(`${BASE}/api/admin/tests/${wrong.id}/questions`, {
      data: { action: 'move', questionIds: made, destinationTestId: right.id },
    });
    log(moved.status() === 200, 'the move is accepted', `status ${moved.status()}`);

    const leftBehind = await db.testQuestion.count({ where: { testId: wrong.id } });
    const arrived = await db.testQuestion.findMany({
      where: { testId: right.id },
      orderBy: { sortOrder: 'asc' },
      select: { questionId: true },
    });
    log(leftBehind === 0, 'the source paper is empty', `${leftBehind} left`);
    log(arrived.length === 5, 'all five arrived', `${arrived.length}`);
    log(
      arrived.every((row, i) => row.questionId === made[i]),
      'in the order they were in',
    );

    const totals = await db.test.findMany({
      where: { id: { in: [wrong.id, right.id] } },
      select: { slug: true, totalQuestions: true },
    });
    const sourceTotal = totals.find((t) => t.slug.includes('wrong'))?.totalQuestions;
    const destTotal = totals.find((t) => t.slug.includes('right'))?.totalQuestions;
    log(sourceTotal === 0 && destTotal === 5, 'both papers recount themselves',
        `${sourceTotal} / ${destTotal}`);

    // A move to nowhere, or onto itself, is refused rather than silently done.
    const nowhere = await adminPage.request.post(`${BASE}/api/admin/tests/${right.id}/questions`, {
      data: { action: 'move', questionIds: made },
    });
    log(nowhere.status() >= 400, 'a move with no destination is refused',
        `status ${nowhere.status()}`);

    const itself = await adminPage.request.post(`${BASE}/api/admin/tests/${right.id}/questions`, {
      data: { action: 'move', questionIds: made, destinationTestId: right.id },
    });
    log(itself.status() >= 400, 'a move onto the same paper is refused',
        `status ${itself.status()}`);

    // ------------------------------------------------------ #7e the export
    console.log('\n-- #7e Printing a paper --');

    const exported = await adminPage.request.get(`${BASE}/api/admin/tests/${right.id}/export`);
    log(exported.status() === 200, 'the export answers', `status ${exported.status()}`);

    const printable = await exported.text();
    log(/<!doctype html>/i.test(printable), 'with a printable page');
    log(printable.includes('Misplaced question 1'), 'containing the questions');
    log(/class="key">correct/.test(printable), 'the answer key');
    log(printable.includes('Save as PDF'), 'and how to save it');

    const questionCount = (printable.match(/class="num"/g) ?? []).length;
    log(questionCount === 5, 'every question is on it', `${questionCount} printed`);

    // Never public: it prints the answers.
    const asStudent = await browser.newPage();
    await asStudent.request.post(`${BASE}/api/auth/login`, {
      data: { email: STUDENT, password: PASSWORD },
    });
    const refused = await asStudent.request.get(`${BASE}/api/admin/tests/${right.id}/export`);
    log(refused.status() >= 400, 'a student cannot open it', `status ${refused.status()}`);
    await asStudent.close();

    await adminPage.close();
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
    await cleanup();
    await db.$disconnect();
  });
