/**
 * Verifies the KAS 2011 Paper I load.
 *
 * Round-trips every stored question against the transcription: option text,
 * option order and — most importantly — which option is flagged correct. A
 * silently-wrong key is the single worst defect this platform can ship, so it
 * is checked mechanically rather than by eye.
 *
 * Then attempts the paper through the real HTTP API, answering every question
 * correctly, and asserts a perfect score.
 *
 * Run with: node scripts/verify-2011-paper.mjs
 */
import { PrismaClient } from '@prisma/client';

import { KAS_2011_PAPER1 } from '../prisma/data/kas-2011-paper1.ts';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const FULL_TEST_SLUG = 'kas-pyq-2011-paper-1';

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
  console.log('\nKAS 2011 Paper I verification\n');

  // --- 1. Key integrity, question by question ----------------------------
  console.log('1. Answer key integrity (all 100)');

  const stored = await db.question.findMany({
    where: { code: { startsWith: 'KAS-2011-P1-' } },
    select: {
      code: true,
      body: true,
      source: true,
      examYear: true,
      status: true,
      subject: { select: { name: true } },
      options: { orderBy: { sortOrder: 'asc' }, select: { body: true, isCorrect: true } },
    },
  });

  check('all 100 questions present', stored.length === 100, `${stored.length}`);

  const byCode = new Map(stored.map((q) => [q.code, q]));
  let keyMismatches = 0;
  let optionMismatches = 0;
  let multiKeyed = 0;

  for (const source of KAS_2011_PAPER1) {
    const code = `KAS-2011-P1-${String(source.n).padStart(3, '0')}`;
    const record = byCode.get(code);
    if (!record) {
      keyMismatches += 1;
      console.log(`      Q${source.n}: MISSING`);
      continue;
    }

    // Exactly one correct option.
    const correctCount = record.options.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) {
      multiKeyed += 1;
      console.log(`      Q${source.n}: ${correctCount} options flagged correct`);
    }

    // Option text and order preserved.
    const storedText = record.options.map((o) => o.body);
    if (JSON.stringify(storedText) !== JSON.stringify(source.options)) {
      optionMismatches += 1;
      console.log(`      Q${source.n}: option text/order differs`);
    }

    // The keyed option is the one the paper says.
    const keyedIndex = record.options.findIndex((o) => o.isCorrect);
    if (keyedIndex !== source.correct) {
      keyMismatches += 1;
      console.log(
        `      Q${source.n}: key is option ${keyedIndex + 1}, paper says ${source.correct + 1}`,
      );
    }
  }

  check('every answer key matches the paper', keyMismatches === 0, `${keyMismatches} mismatches`);
  check('every question has exactly one key', multiKeyed === 0, `${multiKeyed} bad`);
  check('option text and order preserved', optionMismatches === 0, `${optionMismatches} differ`);
  check('all published', stored.every((q) => q.status === 'PUBLISHED'));
  check('provenance recorded', stored.every((q) => q.source && q.examYear === 2011));

  // --- 2. Test wiring -----------------------------------------------------
  console.log('\n2. Test wiring');

  const test = await db.test.findUniqueOrThrow({
    where: { slug: FULL_TEST_SLUG },
    select: {
      id: true,
      title: true,
      totalQuestions: true,
      totalMarks: true,
      durationMinutes: true,
      status: true,
      _count: { select: { questions: true } },
    },
  });

  check('full paper has 100 questions', test._count.questions === 100, `${test._count.questions}`);
  check('totals recorded', test.totalQuestions === 100 && test.totalMarks === 100,
    `${test.totalQuestions}q / ${test.totalMarks}m`);
  check('duration is 2 hours', test.durationMinutes === 120, `${test.durationMinutes} min`);

  const subjectTests = await db.test.findMany({
    where: { slug: { startsWith: 'kas-pyq-2011-subject-' } },
    select: { title: true, totalQuestions: true },
    orderBy: { totalQuestions: 'desc' },
  });
  const subjectTotal = subjectTests.reduce((sum, t) => sum + t.totalQuestions, 0);
  check('subject tests sum to 100', subjectTotal === 100, `${subjectTotal}`);

  // --- 3. Attempt it for real --------------------------------------------
  console.log('\n3. Full attempt through the API');

  await call('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'student@avkvisions.com', password: 'Demo@Pass2024' }),
  });

  const student = await db.user.findUniqueOrThrow({
    where: { emailNormal: 'student@avkvisions.com' },
    select: { id: true },
  });
  await db.testAnswer.deleteMany({ where: { attempt: { testId: test.id, userId: student.id } } });
  await db.attemptEvent.deleteMany({ where: { attempt: { testId: test.id, userId: student.id } } });
  await db.testAttempt.deleteMany({ where: { testId: test.id, userId: student.id } });

  const start = await call('/api/attempts', {
    method: 'POST',
    body: JSON.stringify({ testId: test.id }),
  });
  const attemptId = start.body?.data?.attemptId;
  check('attempt starts', Boolean(attemptId), `status ${start.status}`);
  if (!attemptId) throw new Error('cannot continue');

  const state = await call(`/api/attempts/${attemptId}`);
  const questions = state.body?.data?.questions ?? [];
  check('all 100 served to the client', questions.length === 100, `${questions.length}`);
  check('answer key not leaked', !JSON.stringify(state.body?.data).includes('isCorrect'));

  // Build the correct answer for each served question from the database.
  const keys = await db.testQuestion.findMany({
    where: { testId: test.id },
    select: {
      id: true,
      question: { select: { options: { where: { isCorrect: true }, select: { id: true } } } },
    },
  });
  const keyByTq = new Map(keys.map((k) => [k.id, k.question.options.map((o) => o.id)]));

  // Two flushes, mirroring how the client batches.
  const patches = questions.map((q) => ({
    testQuestionId: q.testQuestionId,
    selectedOptionIds: keyByTq.get(q.testQuestionId) ?? [],
    state: 'ANSWERED',
    timeDeltaSeconds: 30,
  }));

  for (let i = 0; i < patches.length; i += 50) {
    const batch = patches.slice(i, i + 50);
    const saved = await call(`/api/attempts/${attemptId}/answers`, {
      method: 'PATCH',
      body: JSON.stringify({ patches: batch }),
    });
    check(`autosave batch ${i / 50 + 1}`, saved.body?.data?.saved === batch.length,
      `${saved.body?.data?.saved}/${batch.length}`);
  }

  const submit = await call(`/api/attempts/${attemptId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'MANUAL' }),
  });
  const result = submit.body?.data;
  check('submits', submit.body?.success === true);
  check('scores 100/100', result?.score === 100, `${result?.score}/${result?.maxScore}`);
  check('all marked correct', result?.correctCount === 100, `${result?.correctCount}`);
  check('accuracy 100%', result?.accuracy === 100);

  // --- 4. Review notes preserved -----------------------------------------
  console.log('\n4. Flagged questions');
  const flagged = await db.question.count({
    where: { code: { startsWith: 'KAS-2011-P1-' }, reviewNote: { not: null } },
  });
  const expectedFlags = KAS_2011_PAPER1.filter((q) => q.note).length;
  check('review notes preserved', flagged === expectedFlags, `${flagged} of ${expectedFlags}`);

  console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
  await db.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('\nAborted:\n', error);
  await db.$disconnect();
  process.exit(1);
});
