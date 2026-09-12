/**
 * The exam timer: does it run, and does the server enforce it?
 *
 * The clock a student sees is advisory — the server decides when an attempt
 * expires, from the paper's own durationMinutes. Both halves are checked here,
 * because a countdown that looks right while the server ignores it is worse
 * than no countdown at all.
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

const SLUG = `e2e-timer-${Date.now()}`;

async function cleanup() {
  const tests = await db.test.findMany({
    where: { slug: { startsWith: 'e2e-timer-' } },
    select: { id: true },
  });
  const ids = tests.map((t) => t.id);
  if (!ids.length) return;
  await db.testAnswer.deleteMany({ where: { attempt: { testId: { in: ids } } } });
  await db.testAttempt.deleteMany({ where: { testId: { in: ids } } });
  await db.testQuestion.deleteMany({ where: { testId: { in: ids } } });
  await db.test.deleteMany({ where: { id: { in: ids } } });
}

/** A short paper, so expiry can be reached without waiting. */
async function makePaper(durationMinutes: number) {
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
      slug: `${SLUG}-${durationMinutes}`,
      title: `Timed paper (${durationMinutes} min)`,
      category: 'PRACTICE',
      accessType: 'FREE',
      status: 'PUBLISHED',
      durationMinutes,
      totalQuestions: source.questions.length,
      totalMarks: source.questions.length * 2,
      maxAttempts: 0,
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

async function main() {
  console.log('\n=== The exam timer ===\n');
  await cleanup();

  const student = await db.user.findFirstOrThrow({
    where: { email: STUDENT },
    select: { id: true },
  });

  // ------------------------------------------- the server sets the deadline
  console.log('-- The server owns the clock --');

  const paperId = await makePaper(45);
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: STUDENT, password: PASSWORD }),
  });
  const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  log(login.status === 200, 'a student signs in');

  const started = await fetch(`${BASE}/api/attempts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ testId: paperId }),
  });
  const attemptId = ((await started.json()) as any)?.data?.attemptId;
  log(Boolean(attemptId), 'an attempt starts', `status ${started.status}`);

  const attempt = await db.testAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    select: { startedAt: true, expiresAt: true, status: true },
  });

  const minutes = Math.round(
    (attempt.expiresAt.getTime() - attempt.startedAt.getTime()) / 60_000,
  );
  log(minutes === 45, 'the deadline is the paper\'s own duration', `${minutes} minutes`);
  log(attempt.expiresAt > new Date(), 'and lies in the future');

  // -------------------------------------------------- the countdown on screen
  console.log('\n-- The countdown a student sees --');

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.request.post(`${BASE}/api/auth/login`, {
      data: { email: STUDENT, password: PASSWORD },
    });
    // A paper of its own, so the clock is read on an attempt that is genuinely
    // running — an expired attempt shows no countdown, correctly.
    const livePaperId = await makePaper(30);
    const liveStart = await page.request.post(`${BASE}/api/attempts`, {
      data: { testId: livePaperId },
    });
    const liveAttemptId = ((await liveStart.json()) as any)?.data?.attemptId;
    await page.goto(`${BASE}/test/${liveAttemptId}`, { waitUntil: 'networkidle' });

    // The clock reads mm:ss or hh:mm:ss somewhere on the page.
    const readClock = async () => {
      const text = await page.locator('body').innerText();
      const m = text.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/);
      return m ? m[1]! : null;
    };

    const first = await readClock();
    log(first !== null, 'a clock is shown', first ?? 'none found');

    // It has to actually move.
    await page.waitForTimeout(3500);
    const second = await readClock();
    log(
      first !== null && second !== null && first !== second,
      'and it is counting down',
      `${first} -> ${second}`,
    );

    // Counting DOWN, not up.
    const toSeconds = (clock: string) => {
      const parts = clock.split(':').map(Number);
      return parts.length === 3
        ? parts[0]! * 3600 + parts[1]! * 60 + parts[2]!
        : parts[0]! * 60 + parts[1]!;
    };
    if (first && second) {
      log(toSeconds(second) < toSeconds(first), 'downwards, not upwards',
          `${toSeconds(first)}s -> ${toSeconds(second)}s`);
    }

    await page.close();
  } finally {
    await browser.close();
  }

  // ------------------------------------------------ the server enforces it
  console.log('\n-- Expiry is enforced by the server --');

  // Wind the deadline into the past, as though the time had run out.
  await db.testAttempt.update({
    where: { id: attemptId },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });

  // Exactly the request the exam engine makes: PATCH, with `patches` keyed on
  // the testQuestion row. Two earlier versions of this check used POST and
  // then the wrong payload shape; both were rejected — 405, then 422 — and
  // both passed a "refused after expiry" assertion while proving nothing at
  // all about expiry.
  const row = await db.testQuestion.findFirstOrThrow({
    where: { testId: paperId },
    select: { id: true },
  });

  const late = await fetch(`${BASE}/api/attempts/${attemptId}/answers`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({
      patches: [{ testQuestionId: row.id, selectedOptionIds: [], state: 'ANSWERED' }],
    }),
  });
  // The endpoint answers 200 with `expired: true` and saves nothing, rather
  // than erroring — the client reads that flag to submit itself. So what
  // matters is that nothing was written, not the status code.
  const lateBody = (await late.json().catch(() => null)) as any;
  const result = lateBody?.data ?? {};
  log(result.expired === true, 'a late answer is reported as expired', JSON.stringify(result));
  log(result.saved === 0, 'and nothing is written', `saved=${result.saved}`);

  const stored = await db.testAnswer.count({
    where: { attemptId, testQuestionId: row.id, state: 'ANSWERED' },
  });
  log(stored === 0, 'the answer really did not reach the database', `${stored} rows`);

  // Starting again closes the expired attempt rather than resuming it.
  const restart = await fetch(`${BASE}/api/attempts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ testId: paperId }),
  });
  const restarted = ((await restart.json()) as any)?.data;
  log(restart.status === 201 || restart.status === 200, 'a new attempt can be started',
      `status ${restart.status}`);
  log(restarted?.attemptId !== attemptId, 'and it is a new one, not the expired attempt');

  const closed = await db.testAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    select: { status: true },
  });
  log(closed.status !== 'IN_PROGRESS', 'the expired attempt was closed out', closed.status);

  // -------------------------------------------------- duration is per paper
  console.log('\n-- Each paper carries its own duration --');

  const durations = await db.test.findMany({
    where: { deletedAt: null, status: 'PUBLISHED', totalQuestions: { gt: 0 } },
    select: { slug: true, durationMinutes: true },
    take: 200,
  });
  const zero = durations.filter((d) => d.durationMinutes <= 0);
  log(zero.length === 0, 'no live paper has a zero or negative duration',
      zero.length ? zero.slice(0, 3).map((d) => d.slug).join(', ') : `${durations.length} checked`);

  void student;
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
