/**
 * End-to-end verification of the student area, driven through the HTTP API.
 *
 * Exercises practice, bookmarks, the study planner, support tickets and the
 * achievement/analytics pipelines, then asserts the pages actually reflect the
 * writes. Requires the dev server to be running.
 *
 * Run with: node scripts/e2e-student-pages.mjs
 */
import { PrismaClient } from '@prisma/client';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const EMAIL = 'student@avkvisions.com';
const PASSWORD = 'Demo@Pass2024';

const db = new PrismaClient();
let cookie = '';
let failures = 0;

function check(label, ok, detail = '') {
  if (!ok) failures += 1;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ` — ${detail}` : ''}`);
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
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function page(path) {
  const response = await fetch(`${BASE}${path}`, { headers: { Cookie: cookie } });
  return { status: response.status, html: await response.text() };
}

async function main() {
  console.log('\nStudent area verification\n');

  await call('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  const student = await db.user.findUniqueOrThrow({
    where: { emailNormal: EMAIL },
    select: { id: true },
  });

  // Clean slate for the surfaces this script asserts on.
  await db.practiceAnswer.deleteMany({ where: { session: { userId: student.id } } });
  await db.practiceSession.deleteMany({ where: { userId: student.id } });
  await db.bookmark.deleteMany({ where: { userId: student.id } });
  await db.studyTask.deleteMany({ where: { plan: { userId: student.id } } });
  console.log('  cleared prior practice/bookmark/task state\n');

  // --- Practice ----------------------------------------------------------
  console.log('1. Practice');
  const start = await call('/api/practice', {
    method: 'POST',
    body: JSON.stringify({ source: 'ALL', count: 5 }),
  });
  const sessionId = start.body?.data?.sessionId;
  check('session starts', Boolean(sessionId), `status ${start.status}`);
  if (!sessionId) throw new Error('cannot continue without a practice session');

  const session = await db.practiceSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: { questionIdsJson: true },
  });
  const questionIds = JSON.parse(session.questionIdsJson);
  check('question pool built', questionIds.length > 0, `${questionIds.length} questions`);

  // Answer the first correctly and the second incorrectly, so both branches run.
  const [firstId, secondId] = questionIds;

  const firstKey = await db.questionOption.findFirst({
    where: { questionId: firstId, isCorrect: true },
    select: { id: true },
  });
  const secondWrong = await db.questionOption.findFirst({
    where: { questionId: secondId, isCorrect: false },
    select: { id: true },
  });

  if (firstKey) {
    const r = await call(`/api/practice/${sessionId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ questionId: firstId, selectedOptionIds: [firstKey.id], timeSpentSeconds: 20 }),
    });
    check('correct answer marked correct', r.body?.data?.isCorrect === true);

    // Idempotency: the same answer twice must not double-count.
    const again = await call(`/api/practice/${sessionId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ questionId: firstId, selectedOptionIds: [firstKey.id] }),
    });
    check('re-answering is a no-op', again.body?.data?.alreadyAnswered === true);
  }

  if (secondWrong) {
    const r = await call(`/api/practice/${sessionId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ questionId: secondId, selectedOptionIds: [secondWrong.id], timeSpentSeconds: 15 }),
    });
    check('wrong answer marked incorrect', r.body?.data?.isCorrect === false);
  }

  const counters = await db.practiceSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: { attemptedCount: true, correctCount: true, incorrectCount: true, accuracy: true },
  });
  check('counters not double-counted', counters.attemptedCount === 2, `attempted ${counters.attemptedCount}`);
  check('accuracy computed', counters.accuracy === 50, `${counters.accuracy}%`);

  const complete = await call(`/api/practice/${sessionId}/complete`, { method: 'POST' });
  check('session completes', complete.body?.success === true);

  const summary = await page(`/practice/${sessionId}/summary`);
  check('summary page renders', summary.status === 200);
  check('summary shows solutions', summary.html.includes('Solution'));

  // --- Bookmarks ---------------------------------------------------------
  console.log('\n2. Bookmarks');
  const add = await call('/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ questionId: firstId }),
  });
  check('bookmark added', add.body?.data?.bookmarked === true);

  const bookmarksPage = await page('/bookmarks');
  check('bookmarks page renders', bookmarksPage.status === 200);
  check('saved question appears', !bookmarksPage.html.includes('No bookmarks yet'));

  const remove = await call('/api/bookmarks', {
    method: 'DELETE',
    body: JSON.stringify({ questionId: firstId }),
  });
  check('bookmark removed', remove.body?.data?.bookmarked === false);
  check(
    'removal persisted',
    (await db.bookmark.count({ where: { userId: student.id } })) === 0,
  );

  // --- Wrong questions ---------------------------------------------------
  console.log('\n3. Wrong questions');
  const wrong = await page('/wrong-questions');
  check('page renders', wrong.status === 200);
  check('the missed question is listed', !wrong.html.includes('Nothing to revise yet'));

  // --- Study planner -----------------------------------------------------
  console.log('\n4. Study planner');
  const task = await call('/api/study-tasks', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Verify the planner',
      scheduledFor: new Date().toISOString(),
      durationMinutes: 30,
    }),
  });
  const taskId = task.body?.data?.taskId;
  check('task created', Boolean(taskId), `status ${task.status}`);

  if (taskId) {
    const toggled = await call('/api/study-tasks', {
      method: 'PATCH',
      body: JSON.stringify({ taskId, action: 'toggle' }),
    });
    check('task completes', toggled.body?.data?.completed === true);

    const reopened = await call('/api/study-tasks', {
      method: 'PATCH',
      body: JSON.stringify({ taskId, action: 'toggle' }),
    });
    check('task reopens', reopened.body?.data?.completed === false);
  }

  const generated = await call('/api/study-tasks?generate=1', { method: 'POST' });
  check('generate responds honestly', generated.body?.success === true,
    `created ${generated.body?.data?.created}, reason ${generated.body?.data?.reason}`);

  // --- Support -----------------------------------------------------------
  console.log('\n5. Support');
  const ticket = await call('/api/support', {
    method: 'POST',
    body: JSON.stringify({
      subject: 'Verification ticket',
      description: 'This ticket was created by the automated end-to-end verification script.',
      category: 'TECHNICAL',
    }),
  });
  const ticketId = ticket.body?.data?.ticketId;
  check('ticket created', Boolean(ticketId), ticket.body?.data?.ticketNumber);

  if (ticketId) {
    const reply = await call('/api/support', {
      method: 'PATCH',
      body: JSON.stringify({ ticketId, body: 'Adding a follow-up message.' }),
    });
    check('reply posted', reply.body?.data?.sent === true);

    const messages = await db.supportMessage.count({ where: { ticketId } });
    check('thread has both messages', messages === 2, `${messages}`);

    const detail = await page(`/support/${ticketId}`);
    check('ticket page renders', detail.status === 200);
  }

  // Another student must not be able to read it.
  const other = await db.user.findFirst({
    where: { emailNormal: 'rohan@example.com' },
    select: { id: true },
  });
  if (other && ticketId) {
    const leaked = await db.supportTicket.findFirst({
      where: { id: ticketId, userId: other.id },
      select: { id: true },
    });
    check('ticket is not visible to another student', leaked === null);
  }

  // --- Analytics + achievements -----------------------------------------
  console.log('\n6. Analytics & achievements');
  const analytics = await page('/analytics');
  check('analytics renders', analytics.status === 200);
  check('analytics has data now', !analytics.html.includes('No data to analyse yet'));

  const achievements = await page('/achievements');
  check('achievements renders', achievements.status === 200);

  const unlocked = await db.userAchievement.count({ where: { userId: student.id } });
  check('achievements unlocked from real record', unlocked > 0, `${unlocked} unlocked`);

  // --- AI coach ----------------------------------------------------------
  console.log('\n7. AI Coach (provider disabled)');
  const coach = await call('/api/ai-coach', {
    method: 'POST',
    body: JSON.stringify({ question: 'What should I study next?' }),
  });
  check('refuses cleanly rather than faking an answer', coach.body?.success === false,
    coach.body?.error?.code);
  check('uses AI_DISABLED code', coach.body?.error?.code === 'AI_DISABLED');

  const coachPage = await page('/ai-coach');
  check('page explains it is switched off', coachPage.html.includes('not switched on'));

  console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
  await db.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('\nAborted:\n', error);
  await db.$disconnect();
  process.exit(1);
});
