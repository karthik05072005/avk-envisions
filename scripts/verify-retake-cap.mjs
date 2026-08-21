/**
 * Verifies the "maximum 2 attempts" rule from the course plan.
 *
 * Drives the real HTTP API: starts and submits two attempts at a capped test,
 * then confirms a third is refused with ATTEMPT_LIMIT_REACHED rather than
 * silently allowed.
 *
 * Run with: node scripts/verify-retake-cap.mjs
 */
import { PrismaClient } from '@prisma/client';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const TEST_SLUG = 'kas-pyq-2024-december-subject-indian-polity';

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

async function main() {
  console.log('\nRetake cap verification\n');

  await call('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'student@avkvisions.com', password: 'Demo@Pass2024' }),
  });

  const test = await db.test.findUniqueOrThrow({
    where: { slug: TEST_SLUG },
    select: { id: true, title: true, maxAttempts: true },
  });
  console.log(`  test: ${test.title} (maxAttempts=${test.maxAttempts})\n`);
  check('test is capped at 2 attempts', test.maxAttempts === 2, `${test.maxAttempts}`);

  const student = await db.user.findUniqueOrThrow({
    where: { emailNormal: 'student@avkvisions.com' },
    select: { id: true },
  });

  // Start from a clean slate so the cap is measured, not inherited.
  await db.testAnswer.deleteMany({ where: { attempt: { testId: test.id, userId: student.id } } });
  await db.attemptEvent.deleteMany({ where: { attempt: { testId: test.id, userId: student.id } } });
  await db.testAttempt.deleteMany({ where: { testId: test.id, userId: student.id } });
  console.log('  cleared prior attempts\n');

  for (const round of [1, 2]) {
    const start = await call('/api/attempts', {
      method: 'POST',
      body: JSON.stringify({ testId: test.id }),
    });
    const attemptId = start.body?.data?.attemptId;
    check(`attempt ${round} starts`, Boolean(attemptId), `status ${start.status}`);
    if (!attemptId) break;

    const submit = await call(`/api/attempts/${attemptId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'MANUAL' }),
    });
    check(`attempt ${round} submits`, submit.body?.success === true);
  }

  // The third must be refused.
  const third = await call('/api/attempts', {
    method: 'POST',
    body: JSON.stringify({ testId: test.id }),
  });
  check('third attempt is refused', third.body?.success === false, `status ${third.status}`);
  check(
    'refusal uses ATTEMPT_LIMIT_REACHED',
    third.body?.error?.code === 'ATTEMPT_LIMIT_REACHED',
    third.body?.error?.code,
  );
  console.log(`  message: "${third.body?.error?.message ?? '—'}"`);

  const count = await db.testAttempt.count({ where: { testId: test.id, userId: student.id } });
  check('exactly 2 attempts recorded', count === 2, `${count}`);

  console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
  await db.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('\nAborted:\n', error);
  await db.$disconnect();
  process.exit(1);
});
