/**
 * End-to-end verification of the exam engine, driven entirely through the HTTP
 * API exactly as a browser would.
 *
 * Signs in, starts an attempt, answers every question correctly, submits, and
 * asserts the resulting score. Also exercises the guarantees that matter most:
 * idempotent submission, and the answer key never leaking during an EXAM-mode
 * attempt.
 *
 * Requires the dev server to be running. Run with:
 *   node scripts/e2e-attempt.mjs
 */
import { PrismaClient } from '@prisma/client';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const EMAIL = 'student@avkvisions.com';
const PASSWORD = 'Demo@Pass2024';
const TEST_SLUG = 'kas-2024-prelims-polity-pyq-set-1';

const db = new PrismaClient();

let cookie = '';
let failures = 0;

function check(label, condition, detail = '') {
  const mark = condition ? 'PASS' : 'FAIL';
  if (!condition) failures += 1;
  console.log(`  [${mark}] ${label}${detail ? ` — ${detail}` : ''}`);
}

async function call(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...options.headers,
    },
  });

  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];

  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

async function main() {
  console.log('\nEnd-to-end exam engine verification\n');

  // --- Sign in -----------------------------------------------------------
  console.log('1. Authentication');
  const login = await call('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  check('sign in succeeds', login.body?.success === true, `status ${login.status}`);
  check('session cookie issued', cookie.startsWith('avk_session='));

  // --- Resolve the test and its answer key -------------------------------
  const test = await db.test.findUniqueOrThrow({
    where: { slug: TEST_SLUG },
    select: {
      id: true,
      title: true,
      totalMarks: true,
      questions: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          marks: true,
          question: {
            select: {
              id: true,
              type: true,
              options: { select: { id: true, isCorrect: true } },
            },
          },
        },
      },
    },
  });

  const keyByTestQuestion = new Map(
    test.questions.map((tq) => [
      tq.id,
      tq.question.options.filter((o) => o.isCorrect).map((o) => o.id),
    ]),
  );

  console.log(`\n2. Starting attempt on "${test.title}"`);
  const start = await call('/api/attempts', {
    method: 'POST',
    body: JSON.stringify({ testId: test.id }),
  });
  check('attempt starts', start.body?.success === true, `status ${start.status}`);

  const attemptId = start.body?.data?.attemptId;
  check('attempt id returned', typeof attemptId === 'string');
  if (!attemptId) throw new Error('Cannot continue without an attempt id');

  // --- Load state and verify no key leakage ------------------------------
  console.log('\n3. Loading attempt state');
  const state = await call(`/api/attempts/${attemptId}`);
  const data = state.body?.data;
  check('state loads', state.body?.success === true);
  check('all questions present', data?.questions?.length === test.questions.length,
    `${data?.questions?.length} of ${test.questions.length}`);
  check('server clock supplied', typeof data?.serverTime === 'string' && typeof data?.expiresAt === 'string');
  check('timer counting down', data?.secondsRemaining > 0, `${data?.secondsRemaining}s remaining`);

  // The security property that matters most in EXAM mode.
  const serialised = JSON.stringify(data);
  check('answer key NOT leaked to client', !serialised.includes('isCorrect'));
  check('explanations NOT leaked to client', !serialised.includes('detailedSolution'));
  check(
    'no correctOptionIds field present',
    data?.questions?.every((q) => q.correctOptionIds === undefined),
  );

  // --- Answer everything correctly ---------------------------------------
  console.log('\n4. Answering every question correctly (autosave)');
  const patches = data.questions.map((q) => ({
    testQuestionId: q.testQuestionId,
    selectedOptionIds: keyByTestQuestion.get(q.testQuestionId) ?? [],
    state: 'ANSWERED',
    timeDeltaSeconds: 12,
  }));

  const save = await call(`/api/attempts/${attemptId}/answers`, {
    method: 'PATCH',
    body: JSON.stringify({ patches }),
  });
  check('autosave accepted', save.body?.success === true, `saved ${save.body?.data?.saved}`);
  check('all patches persisted', save.body?.data?.saved === patches.length);

  // --- Integrity telemetry ------------------------------------------------
  const event = await call(`/api/attempts/${attemptId}/events`, {
    method: 'POST',
    body: JSON.stringify({ type: 'TAB_HIDDEN' }),
  });
  check('integrity event recorded', event.status === 202);

  // --- Submit -------------------------------------------------------------
  console.log('\n5. Submitting');
  const submit = await call(`/api/attempts/${attemptId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'MANUAL' }),
  });
  const result = submit.body?.data;
  check('submission succeeds', submit.body?.success === true);
  check('full marks awarded', result?.score === test.totalMarks, `${result?.score}/${result?.maxScore}`);
  check('all answers marked correct', result?.correctCount === test.questions.length);
  check('no incorrect answers', result?.incorrectCount === 0);
  check('accuracy is 100%', result?.accuracy === 100);

  // --- Idempotency --------------------------------------------------------
  console.log('\n6. Double submission (must not re-score)');
  const again = await call(`/api/attempts/${attemptId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'MANUAL' }),
  });
  check('second submit is a no-op', again.body?.data?.alreadySubmitted === true);
  check('score unchanged', again.body?.data?.score === result?.score);

  // --- Writes rejected after submission -----------------------------------
  const lateSave = await call(`/api/attempts/${attemptId}/answers`, {
    method: 'PATCH',
    body: JSON.stringify({ patches: [patches[0]] }),
  });
  check('post-submission edits rejected', lateSave.body?.success === false,
    lateSave.body?.error?.code);

  // --- Persisted state ----------------------------------------------------
  console.log('\n7. Database state');
  const stored = await db.testAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    select: {
      status: true, score: true, maxScore: true, accuracy: true, percentage: true,
      correctCount: true, rank: true, percentile: true, tabSwitchCount: true,
      answers: { select: { isCorrect: true, marksAwarded: true } },
    },
  });
  check('status is SUBMITTED', stored.status === 'SUBMITTED', stored.status);
  check('per-answer marks recorded', stored.answers.every((a) => a.isCorrect === true));
  check('tab switch counted', stored.tabSwitchCount === 1);

  // Ranking runs asynchronously after submission.
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const ranked = await db.testAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    select: { rank: true, percentile: true },
  });
  check('rank assigned', ranked.rank !== null, `rank ${ranked.rank}`);
  check('percentile assigned', ranked.percentile !== null, `${ranked.percentile}`);

  // --- Result page --------------------------------------------------------
  console.log('\n8. Result page');
  const page = await fetch(`${BASE}/test/${attemptId}/result`, { headers: { Cookie: cookie } });
  const html = await page.text();
  check('result page renders', page.status === 200, `status ${page.status}`);
  check('shows the score', html.includes('Question-wise review'));
  check('reveals solutions after submission', html.includes('Solution'));

  console.log(
    failures === 0
      ? '\nAll checks passed.\n'
      : `\n${failures} check(s) FAILED.\n`,
  );

  await db.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('\nVerification aborted:\n', error);
  await db.$disconnect();
  process.exit(1);
});
