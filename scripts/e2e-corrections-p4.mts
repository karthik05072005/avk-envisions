/**
 * Phase 4: the quiz section, student and admin.
 *
 * The point of giving the quiz its own section is that it draws from its own
 * questions — practice used to pull from the entire published bank, so quiz
 * material could surface inside a mock. That separation is what most of this
 * checks; the rest is that both pages exist and behave.
 */
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';

import { QUIZ_SERIES_SLUG } from '../src/lib/enums';

const db = new PrismaClient();
const BASE = 'http://localhost:3000';
const ADMIN = 'e2e-p4-admin@avkvisions.test';
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
const QUIZ_SLUG = `e2e-quiz-${STAMP}`;

async function cleanup() {
  const tests = await db.test.findMany({
    where: { slug: { startsWith: 'e2e-quiz-' } },
    select: { id: true },
  });
  const ids = tests.map((t) => t.id);
  if (ids.length) {
    await db.testAttempt.deleteMany({ where: { testId: { in: ids } } });
    await db.testQuestion.deleteMany({ where: { testId: { in: ids } } });
    await db.test.deleteMany({ where: { id: { in: ids } } });
  }
  await db.question.deleteMany({ where: { code: { startsWith: 'E2E-QUIZ-' } } });
  await db.session.deleteMany({ where: { user: { email: ADMIN } } });
  await db.user.deleteMany({ where: { email: ADMIN } });
}

async function main() {
  console.log('\n=== The quiz section ===\n');
  await cleanup();

  const donor = await db.user.findFirstOrThrow({
    where: { email: STUDENT },
    select: { id: true, passwordHash: true },
  });
  const admin = await db.user.create({
    data: {
      email: ADMIN,
      emailNormal: ADMIN,
      name: 'Phase Four Admin',
      role: 'ADMIN',
      passwordHash: donor.passwordHash,
      emailVerified: new Date(),
      status: 'ACTIVE',
    },
    select: { id: true },
  });

  // ------------------------------------------------------- a quiz to look at
  console.log('-- Setting up --');

  const series = await db.testSeries.findFirst({
    where: { slug: QUIZ_SERIES_SLUG },
    select: { id: true },
  });
  log(series !== null, 'the quiz series exists', QUIZ_SERIES_SLUG);

  const exam = await db.exam.findFirstOrThrow({ select: { id: true } });
  const subject = await db.subject.findFirstOrThrow({ select: { id: true } });

  const quiz = await db.test.create({
    data: {
      examId: exam.id,
      subjectId: subject.id,
      testSeriesId: series?.id,
      slug: QUIZ_SLUG,
      title: 'End to end quiz',
      description: 'A quiz created by the test.',
      category: 'QUIZ',
      accessType: 'FREE',
      status: 'PUBLISHED',
      durationMinutes: 10,
      totalQuestions: 3,
      totalMarks: 6,
      maxAttempts: 0,
    },
    select: { id: true },
  });

  // Questions that belong to this quiz and nothing else.
  const quizQuestionIds: string[] = [];
  for (let n = 1; n <= 3; n += 1) {
    const question = await db.question.create({
      data: {
        code: `E2E-QUIZ-Q${n}`,
        examId: exam.id,
        subjectId: subject.id,
        type: 'SINGLE_CORRECT',
        status: 'PUBLISHED',
        difficulty: 'MEDIUM',
        body: `A quiz-only question, number ${n}.`,
        marks: 2,
        negativeMarks: 0,
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
    quizQuestionIds.push(question.id);
    await db.testQuestion.create({
      data: { testId: quiz.id, questionId: question.id, sortOrder: n, marks: 2, negativeMarks: 0 },
    });
  }
  log(quizQuestionIds.length === 3, 'a quiz with three of its own questions');

  // ------------------------------------- quiz questions stay out of practice
  console.log('\n-- Quiz questions are held back from practice --');

  // Read from the database rather than by importing the service, which is
  // marked server-only and cannot load outside Next. This asks the same
  // question the service asks.
  const heldRows = await db.testQuestion.findMany({
    where: { test: { category: 'QUIZ', deletedAt: null } },
    select: { questionId: true },
  });
  const held = [...new Set(heldRows.map((r) => r.questionId))];
  log(
    quizQuestionIds.every((id) => held.includes(id)),
    'they are recognised as quiz questions',
    `${held.length} held back`,
  );

  // Start a practice session and read what it drew.
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: STUDENT, password: PASSWORD }),
  });
  const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  log(login.status === 200, 'a student signs in');

  // Close any session already open, so this one is freshly drawn.
  await db.practiceSession.updateMany({
    where: { userId: donor.id, status: 'IN_PROGRESS' },
    data: { status: 'ABANDONED' },
  });

  const started = await fetch(`${BASE}/api/practice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ source: 'ALL', count: 50 }),
  });
  const startedBody = (await started.json()) as any;
  const sessionId = startedBody?.data?.sessionId;
  log(Boolean(sessionId), 'a practice session starts', `status ${started.status}`);

  if (sessionId) {
    const session = await db.practiceSession.findUniqueOrThrow({
      where: { id: sessionId },
      select: { questionIdsJson: true },
    });
    const drawn: string[] = JSON.parse(session.questionIdsJson || '[]');
    const leaked = drawn.filter((id) => quizQuestionIds.includes(id));
    log(drawn.length > 0, 'and drew questions', `${drawn.length} drawn`);
    log(leaked.length === 0, 'none of them from the quiz', leaked.length ? `${leaked.length} leaked` : '');
  }

  // ------------------------------------------------------------ the pages
  console.log('\n-- The pages --');
  const browser = await chromium.launch();
  try {
    // Student
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.request.post(`${BASE}/api/auth/login`, {
      data: { email: STUDENT, password: PASSWORD },
    });
    await page.goto(`${BASE}/quiz`, { waitUntil: 'networkidle' });

    log(!page.url().includes('/login'), 'a student can open /quiz', page.url().replace(BASE, ''));
    log((await page.getByText('End to end quiz').count()) > 0, 'the quiz is listed');
    log(
      (await page.getByRole('link', { name: /start quiz|attempt again/i }).count()) > 0,
      'with a way to start it',
    );

    // The quiz is startable — it goes through the same engine as a test.
    const startHref = await page
      .getByRole('link', { name: /start quiz|attempt again/i })
      .first()
      .getAttribute('href');
    log(startHref?.includes(quiz.id) ?? false, 'that points at the quiz', startHref ?? '');

    await page.close();

    // Admin
    const adminPage = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    await adminPage.request.post(`${BASE}/api/auth/login`, {
      data: { email: ADMIN, password: PASSWORD },
    });
    await adminPage.goto(`${BASE}/admin/quiz`, { waitUntil: 'networkidle' });

    log(!adminPage.url().includes('/login'), 'an admin can open /admin/quiz');
    log((await adminPage.getByText('End to end quiz').count()) > 0, 'the quiz is listed there too');
    log(
      (await adminPage.getByRole('link', { name: /new quiz|create the first quiz/i }).count()) > 0,
      'with a way to make another',
    );
    log(
      (await adminPage.getByRole('link', { name: /^Questions$/ }).count()) > 0,
      'and a link to its questions',
    );

    // The admin nav offers it, so it is findable without knowing the URL.
    log(
      (await adminPage.getByRole('link', { name: 'Quizzes' }).count()) > 0,
      'the admin nav links to it',
    );

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
