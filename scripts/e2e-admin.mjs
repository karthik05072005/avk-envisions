/**
 * End-to-end verification of the admin portal, driven through the HTTP API.
 *
 * Covers the two things that matter most: that an admin can actually author a
 * question and build a working test end to end, and that a student cannot
 * reach any of it.
 *
 * Run with: node scripts/e2e-admin.mjs
 */
import { PrismaClient } from '@prisma/client';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@avkvisions.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!Admin2024';

const db = new PrismaClient();
let failures = 0;

function check(label, ok, detail = '') {
  if (!ok) failures += 1;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ` — ${detail}` : ''}`);
}

/** Each session gets its own cookie jar so both roles can be held at once. */
function makeClient() {
  let cookie = '';
  return {
    get cookie() {
      return cookie;
    },
    async call(path, options = {}) {
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
    },
    async page(path) {
      const response = await fetch(`${BASE}${path}`, {
        headers: { Cookie: cookie },
        redirect: 'manual',
      });
      return { status: response.status, location: response.headers.get('location') };
    },
  };
}

async function main() {
  console.log('\nAdmin portal verification\n');

  const admin = makeClient();
  const student = makeClient();

  // --- Sign in -----------------------------------------------------------
  console.log('1. Access control');
  const adminLogin = await admin.call('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  check('admin signs in', adminLogin.body?.data?.user?.role === 'ADMIN');
  check('admin routes to /admin', adminLogin.body?.data?.redirectTo === '/admin');

  await student.call('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'student@avkvisions.com', password: 'Demo@Pass2024' }),
  });

  // A student must be bounced out of the admin area, not shown it.
  const studentAtAdmin = await student.page('/admin');
  check(
    'student is redirected away from /admin',
    studentAtAdmin.status >= 300 && studentAtAdmin.status < 400,
    `status ${studentAtAdmin.status} -> ${studentAtAdmin.location ?? '-'}`,
  );

  const studentWrite = await student.call('/api/admin/questions', {
    method: 'POST',
    body: JSON.stringify({ examId: 'x', subjectId: 'x', type: 'SINGLE_CORRECT', body: 'test' }),
  });
  check('student cannot call an admin API', studentWrite.body?.success === false,
    studentWrite.body?.error?.code);

  // --- Authoring ---------------------------------------------------------
  console.log('\n2. Authoring a question');
  const exam = await db.exam.findFirstOrThrow({
    where: { slug: 'kas' },
    select: { id: true, subjects: { take: 1, select: { id: true } } },
  });
  const subjectId = exam.subjects[0].id;

  const created = await admin.call('/api/admin/questions', {
    method: 'POST',
    body: JSON.stringify({
      examId: exam.id,
      subjectId,
      type: 'SINGLE_CORRECT',
      difficulty: 'MEDIUM',
      status: 'PUBLISHED',
      body: 'E2E verification question — what is 2 + 2?',
      marks: 1,
      negativeMarks: 0.25,
      explanation: 'Created by the admin end-to-end verification script.',
      options: [
        { body: 'Three', isCorrect: false },
        { body: 'Four', isCorrect: true },
        { body: 'Five', isCorrect: false },
        { body: 'Six', isCorrect: false },
      ],
    }),
  });
  const questionId = created.body?.data?.id;
  check('question created', Boolean(questionId), created.body?.data?.code);

  const stored = await db.question.findUnique({
    where: { id: questionId },
    select: { options: { select: { body: true, isCorrect: true } }, status: true },
  });
  check('exactly one option keyed correct', stored?.options.filter((o) => o.isCorrect).length === 1);
  check('keyed option is the right one',
    stored?.options.find((o) => o.isCorrect)?.body === 'Four');
  check('published', stored?.status === 'PUBLISHED');

  // --- Validation refuses unscoreable questions --------------------------
  console.log('\n3. Validation');
  const noKey = await admin.call('/api/admin/questions', {
    method: 'POST',
    body: JSON.stringify({
      examId: exam.id,
      subjectId,
      type: 'SINGLE_CORRECT',
      body: 'A question with no correct option marked at all',
      options: [
        { body: 'One', isCorrect: false },
        { body: 'Two', isCorrect: false },
      ],
    }),
  });
  check('refuses a question with no correct option', noKey.body?.success === false,
    noKey.body?.error?.code);

  const twoKeys = await admin.call('/api/admin/questions', {
    method: 'POST',
    body: JSON.stringify({
      examId: exam.id,
      subjectId,
      type: 'SINGLE_CORRECT',
      body: 'A single-correct question with two correct options',
      options: [
        { body: 'One', isCorrect: true },
        { body: 'Two', isCorrect: true },
      ],
    }),
  });
  check('refuses two keys on a single-correct question', twoKeys.body?.success === false);

  // --- Building a test ---------------------------------------------------
  console.log('\n4. Building a test');
  const slug = `e2e-admin-test-${Date.now()}`;
  const testCreated = await admin.call('/api/admin/tests', {
    method: 'POST',
    body: JSON.stringify({
      examId: exam.id,
      title: 'E2E Admin Verification Test',
      slug,
      category: 'CUSTOM',
      status: 'DRAFT',
      accessType: 'FREE',
      durationMinutes: 10,
      maxAttempts: 0,
    }),
  });
  const testId = testCreated.body?.data?.id;
  check('test created', Boolean(testId), `status ${testCreated.status}`);

  // Publishing an empty test must be refused.
  const publishEmpty = await admin.call(`/api/admin/tests/${testId}`, {
    method: 'PUT',
    body: JSON.stringify({
      examId: exam.id,
      title: 'E2E Admin Verification Test',
      slug,
      category: 'CUSTOM',
      status: 'PUBLISHED',
      accessType: 'FREE',
      durationMinutes: 10,
      maxAttempts: 0,
    }),
  });
  check('refuses to publish a test with no questions', publishEmpty.body?.success === false,
    publishEmpty.body?.error?.code);

  const attached = await admin.call(`/api/admin/tests/${testId}/questions`, {
    method: 'POST',
    body: JSON.stringify({ action: 'attach', questionIds: [questionId] }),
  });
  check('question attached', attached.body?.data?.attached === 1);
  check('totals recomputed', attached.body?.data?.totalQuestions === 1,
    `${attached.body?.data?.totalQuestions}q / ${attached.body?.data?.totalMarks}m`);

  const publishNow = await admin.call(`/api/admin/tests/${testId}`, {
    method: 'PUT',
    body: JSON.stringify({
      examId: exam.id,
      title: 'E2E Admin Verification Test',
      slug,
      category: 'CUSTOM',
      status: 'PUBLISHED',
      accessType: 'FREE',
      durationMinutes: 10,
      maxAttempts: 0,
    }),
  });
  check('publishes once it has a question', publishNow.body?.success === true);

  // --- The student can now actually attempt it ---------------------------
  console.log('\n5. The built test is attemptable');
  const start = await student.call('/api/attempts', {
    method: 'POST',
    body: JSON.stringify({ testId }),
  });
  const attemptId = start.body?.data?.attemptId;
  check('student can start the admin-built test', Boolean(attemptId), `status ${start.status}`);

  if (attemptId) {
    const state = await student.call(`/api/attempts/${attemptId}`);
    const q = state.body?.data?.questions?.[0];
    check('question is served', Boolean(q));

    const key = await db.questionOption.findFirst({
      where: { questionId, isCorrect: true },
      select: { id: true },
    });

    await student.call(`/api/attempts/${attemptId}/answers`, {
      method: 'PATCH',
      body: JSON.stringify({
        patches: [
          { testQuestionId: q.testQuestionId, selectedOptionIds: [key.id], state: 'ANSWERED' },
        ],
      }),
    });

    const submit = await student.call(`/api/attempts/${attemptId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'MANUAL' }),
    });
    check('scores correctly', submit.body?.data?.score === 1,
      `${submit.body?.data?.score}/${submit.body?.data?.maxScore}`);
  }

  // --- Last-admin protection ---------------------------------------------
  console.log('\n6. Last-admin protection');
  const adminUser = await db.user.findUniqueOrThrow({
    where: { emailNormal: ADMIN_EMAIL.toLowerCase() },
    select: { id: true },
  });

  const self = await admin.call('/api/admin/users', {
    method: 'PATCH',
    body: JSON.stringify({ userId: adminUser.id, action: 'suspend' }),
  });
  check('admin cannot act on their own account', self.body?.success === false,
    self.body?.error?.code);

  const adminCount = await db.user.count({ where: { role: 'ADMIN', deletedAt: null } });
  if (adminCount === 1) {
    console.log('       (only one admin exists — the last-admin guard is what blocks self-action)');
  }

  // --- Cleanup ------------------------------------------------------------
  await db.testAnswer.deleteMany({ where: { attempt: { testId } } });
  await db.attemptEvent.deleteMany({ where: { attempt: { testId } } });
  await db.testAttempt.deleteMany({ where: { testId } });
  await db.testQuestion.deleteMany({ where: { testId } });
  await db.test.delete({ where: { id: testId } });
  await db.questionOption.deleteMany({ where: { questionId } });
  await db.questionStat.deleteMany({ where: { questionId } });
  await db.question.delete({ where: { id: questionId } });
  console.log('\n  cleaned up test fixtures');

  console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
  await db.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('\nAborted:\n', error);
  await db.$disconnect();
  process.exit(1);
});
