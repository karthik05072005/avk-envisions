/**
 * Phase 3: a scheduled paper opens itself, fifteen minutes early.
 *
 * Papers are written and uploaded well ahead of the date they are meant to be
 * sat. Before this, `startDate` was stored but a paper either sat in DRAFT —
 * invisible, and published only by hand — or was PUBLISHED and open at once.
 *
 * Checked around the boundary rather than at a single moment: a paper due in
 * an hour must refuse, one due in ten minutes must admit, and the two lists a
 * student reads ("available" and "upcoming") must agree with the gate.
 */
import { PrismaClient } from '@prisma/client';

import { TEST_OPENS_EARLY_MINUTES, isTestOpen, openThreshold, testOpensAt } from '../src/lib/enums';

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

const STAMP = Date.now();
const SLUG = `e2e-scheduled-${STAMP}`;

function minutesFromNow(n: number) {
  return new Date(Date.now() + n * 60_000);
}

async function cleanup() {
  const tests = await db.test.findMany({
    where: { slug: { startsWith: 'e2e-scheduled-' } },
    select: { id: true },
  });
  const ids = tests.map((t) => t.id);
  if (!ids.length) return;
  await db.testAttempt.deleteMany({ where: { testId: { in: ids } } });
  await db.testQuestion.deleteMany({ where: { testId: { in: ids } } });
  await db.test.deleteMany({ where: { id: { in: ids } } });
}

/** A published paper with real questions, due at `startDate`. */
async function makePaper(startDate: Date | null) {
  const source = await db.test.findFirstOrThrow({
    where: { totalQuestions: { gte: 3 }, deletedAt: null },
    select: {
      examId: true,
      subjectId: true,
      questions: { take: 3, select: { questionId: true, marks: true, negativeMarks: true } },
    },
  });

  const test = await db.test.create({
    data: {
      examId: source.examId,
      subjectId: source.subjectId,
      slug: `${SLUG}-${startDate ? startDate.getTime() : 'open'}`,
      title: 'Scheduled paper under test',
      category: 'PRACTICE',
      accessType: 'FREE',
      status: 'PUBLISHED',
      durationMinutes: 30,
      totalQuestions: source.questions.length,
      totalMarks: source.questions.length * 2,
      maxAttempts: 0,
      startDate,
    },
    select: { id: true },
  });

  await db.testQuestion.createMany({
    data: source.questions.map((q, i) => ({
      testId: test.id,
      questionId: q.questionId,
      sortOrder: i + 1,
      marks: q.marks,
      negativeMarks: q.negativeMarks,
    })),
  });

  return test.id;
}

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: STUDENT, password: PASSWORD }),
  });
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
}

async function tryStart(cookie: string, testId: string) {
  const res = await fetch(`${BASE}/api/attempts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ testId }),
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, message: body?.error?.message ?? body?.message ?? '' };
}

async function main() {
  console.log('\n=== Scheduled tests open themselves ===\n');
  await cleanup();

  // ------------------------------------------------------- the rule itself
  console.log('-- The opening rule --');
  log(TEST_OPENS_EARLY_MINUTES === 15, 'papers open fifteen minutes early',
      `${TEST_OPENS_EARLY_MINUTES} min`);

  const at10 = new Date('2026-11-01T10:00:00Z');
  log(testOpensAt(at10).toISOString() === '2026-11-01T09:45:00.000Z',
      'a ten o\'clock paper opens at 09:45', testOpensAt(at10).toISOString());

  log(isTestOpen(null), 'an unscheduled paper is always open');
  log(!isTestOpen(minutesFromNow(60)), 'a paper due in an hour is shut');
  log(!isTestOpen(minutesFromNow(16)), 'a paper due in sixteen minutes is shut');
  log(isTestOpen(minutesFromNow(14)), 'a paper due in fourteen minutes is open');
  log(isTestOpen(minutesFromNow(-5)), 'a paper due five minutes ago is open');

  // The query threshold and the boolean must agree, or a paper shows in one
  // list while the other lets someone in.
  const due = minutesFromNow(10);
  log(
    (due <= openThreshold()) === isTestOpen(due),
    'the query threshold agrees with the gate',
  );

  // ------------------------------------------------------ the attempt gate
  console.log('\n-- Starting a scheduled paper --');
  const cookie = await login();
  log(cookie.length > 0, 'a student signs in');

  const future = await makePaper(minutesFromNow(90));
  const shut = await tryStart(cookie, future);
  log(shut.status >= 400, 'a paper due in ninety minutes refuses', `status ${shut.status}`);
  log(/opens at/i.test(shut.message), 'and says when it opens', shut.message.slice(0, 72));

  const soon = await makePaper(minutesFromNow(10));
  const open = await tryStart(cookie, soon);
  log(open.status === 200 || open.status === 201,
      'a paper due in ten minutes lets the student in', `status ${open.status}`);

  const past = await makePaper(minutesFromNow(-30));
  const started = await tryStart(cookie, past);
  log(started.status === 200 || started.status === 201,
      'a paper whose time has passed is open', `status ${started.status}`);

  const anytime = await makePaper(null);
  const always = await tryStart(cookie, anytime);
  log(always.status === 200 || always.status === 201,
      'an unscheduled paper is unaffected', `status ${always.status}`);

  // ------------------------------------------- the two lists a student sees
  console.log('\n-- Available and upcoming --');

  const availableIds = await db.test.findMany({
    where: {
      status: 'PUBLISHED',
      deletedAt: null,
      OR: [{ startDate: null }, { startDate: { lte: openThreshold() } }],
      slug: { startsWith: 'e2e-scheduled-' },
    },
    select: { id: true },
  });
  const upcomingIds = await db.test.findMany({
    where: {
      status: 'PUBLISHED',
      deletedAt: null,
      startDate: { gt: openThreshold() },
      slug: { startsWith: 'e2e-scheduled-' },
    },
    select: { id: true },
  });

  const available = new Set(availableIds.map((t) => t.id));
  const upcoming = new Set(upcomingIds.map((t) => t.id));

  log(upcoming.has(future), 'the ninety-minute paper is listed as upcoming');
  log(!available.has(future), 'and not as available');
  log(available.has(soon), 'the ten-minute paper is listed as available');
  log(!upcoming.has(soon), 'and not as upcoming');

  const both = [...available].filter((id) => upcoming.has(id));
  log(both.length === 0, 'no paper appears in both lists', both.length ? `${both.length} do` : '');

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
