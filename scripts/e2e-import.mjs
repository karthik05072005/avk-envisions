/**
 * End-to-end verification of the PDF importer.
 *
 * Generates a real PDF in the KAS paper format, uploads it through the actual
 * endpoint, checks what the parser found, commits it, and then confirms a
 * student can attempt the resulting test and be scored correctly.
 *
 * Also asserts the guarantee that matters most: the commit endpoint refuses a
 * question whose answer key was never resolved.
 *
 * Run with: node scripts/e2e-import.mjs
 */
import { PrismaClient } from '@prisma/client';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@avkvisions.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!Admin2024';

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
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { Cookie: cookie } : {}),
      ...options.headers,
    },
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  return { status: response.status, body: await response.json().catch(() => null) };
}

/**
 * Builds a minimal but genuinely valid PDF containing the given lines.
 *
 * Hand-rolled rather than pulled from a library: the point is to exercise the
 * real extraction path with a real file, and a generator here keeps the test
 * self-contained.
 */
function makePdf(lines) {
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

  const content =
    `BT /F1 10 Tf 40 780 Td 12 TL\n` +
    lines.map((line) => `(${esc(line)}) Tj T*`).join('\n') +
    `\nET`;

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefAt = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;

  return Buffer.from(pdf, 'latin1');
}

async function main() {
  console.log('\nPDF importer verification\n');

  await call('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });

  // --- 1. Build a paper in the real KAS format ---------------------------
  console.log('1. Parsing a generated paper');

  const lines = [];
  // Sized to fit one page of the generated PDF — see makePdf.
  const QUESTIONS = 6;
  for (let n = 1; n <= QUESTIONS; n++) {
    lines.push(`Q${n}. Import verification question number ${n}?`);
    lines.push('Options:');
    lines.push(`1. Alpha option for ${n}`);
    lines.push(`2. Beta option for ${n}`);
    lines.push(`3. Gamma option for ${n}`);
    lines.push(`4. Delta option for ${n}`);
    // Vary the key so a parser that always picks option 1 would be caught.
    lines.push(`CORRECT ANSWER: ${((n - 1) % 4) + 1}`);
    lines.push('');
  }
  // One question with no answer line — this must NOT be guessed at.
  lines.push(`Q${QUESTIONS + 1}. A question the paper forgot to key?`);
  lines.push('Options:');
  lines.push('1. First');
  lines.push('2. Second');

  const pdf = makePdf(lines);

  const form = new FormData();
  form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'verification-paper.pdf');

  const parsed = await call('/api/admin/import/parse', { method: 'POST', body: form });
  const data = parsed.body?.data;

  check('PDF accepted and parsed', parsed.body?.success === true, `status ${parsed.status}`);
  check('all questions found', data?.stats?.found === QUESTIONS + 1, `${data?.stats?.found}`);
  check('keyed questions resolved', data?.stats?.withAnswer === QUESTIONS,
    `${data?.stats?.withAnswer}`);
  check('unkeyed question left unresolved', data?.stats?.withoutAnswer === 1);

  // The key must actually vary, not default to the first option.
  const keys = (data?.questions ?? []).slice(0, QUESTIONS).map((q) => q.correctIndex);
  check('answer keys are read, not guessed', new Set(keys).size === 4, `distinct keys: ${new Set(keys).size}`);
  check('question 1 keyed to option A', keys[0] === 0);
  check('question 4 keyed to option D', keys[3] === 3);
  check('options extracted in order',
    data?.questions?.[0]?.options?.map((o) => o.body)[1] === 'Beta option for 1');
  check('nothing written yet',
    (await db.question.count({ where: { source: 'E2E Import Verification' } })) === 0);

  // --- 2. Commit must refuse an unresolved key ---------------------------
  console.log('\n2. Commit refuses an unresolved answer');

  const exam = await db.exam.findFirstOrThrow({
    where: { slug: 'kas' },
    select: { id: true, subjects: { take: 1, select: { id: true } } },
  });
  const subjectId = exam.subjects[0].id;

  const badCommit = await call('/api/admin/import/commit', {
    method: 'POST',
    body: JSON.stringify({
      examId: exam.id,
      subjectId,
      target: 'BANK_ONLY',
      questions: [
        {
          number: 1,
          body: 'A question whose key points past the last option',
          options: [{ body: 'One' }, { body: 'Two' }],
          correctIndex: 5,
        },
      ],
    }),
  });
  check('refuses an out-of-range key', badCommit.body?.success === false,
    badCommit.body?.error?.code);

  // --- 3. Commit the reviewed questions ----------------------------------
  console.log('\n3. Committing');

  const reviewed = data.questions
    .filter((q) => q.correctIndex !== null)
    .map((q) => ({
      number: q.number,
      body: q.body,
      options: q.options.map((o) => ({ body: o.body })),
      correctIndex: q.correctIndex,
    }));

  const committed = await call('/api/admin/import/commit', {
    method: 'POST',
    body: JSON.stringify({
      examId: exam.id,
      subjectId,
      target: 'NEW_TEST',
      title: `E2E Import Verification ${Date.now()}`,
      category: 'PREVIOUS_YEAR',
      accessType: 'FREE',
      durationMinutes: 20,
      maxAttempts: 0,
      marks: 1,
      negativeMarks: 0.25,
      source: 'E2E Import Verification',
      publish: true,
      questions: reviewed,
    }),
  });

  const testId = committed.body?.data?.testId;
  check('import committed', committed.body?.success === true, `status ${committed.status}`);
  check('all questions created', committed.body?.data?.created === QUESTIONS);
  check('a test was created', Boolean(testId));

  const stored = await db.question.findMany({
    where: { source: 'E2E Import Verification' },
    select: { body: true, options: { orderBy: { sortOrder: 'asc' }, select: { body: true, isCorrect: true } } },
    orderBy: { code: 'asc' },
  });
  check('every stored question has exactly one key',
    stored.every((q) => q.options.filter((o) => o.isCorrect).length === 1));

  // Spot-check that the stored key matches the printed paper.
  const q4 = stored.find((q) => q.body.includes('number 4?'));
  check('question 4 stored with the right key',
    q4?.options.findIndex((o) => o.isCorrect) === 3,
    `index ${q4?.options.findIndex((o) => o.isCorrect)}`);

  const test = await db.test.findUniqueOrThrow({
    where: { id: testId },
    select: { status: true, totalQuestions: true, totalMarks: true },
  });
  check('test totals recomputed', test.totalQuestions === QUESTIONS && test.totalMarks === QUESTIONS,
    `${test.totalQuestions}q / ${test.totalMarks}m`);
  check('new test is a draft, not auto-published', test.status === 'DRAFT', test.status);

  // --- 4. A student can attempt it ---------------------------------------
  console.log('\n4. The imported test works');

  await db.test.update({ where: { id: testId }, data: { status: 'PUBLISHED' } });

  cookie = '';
  await call('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'student@avkvisions.com', password: 'Demo@Pass2024' }),
  });

  const start = await call('/api/attempts', {
    method: 'POST',
    body: JSON.stringify({ testId }),
  });
  const attemptId = start.body?.data?.attemptId;
  check('student can start the imported test', Boolean(attemptId), `status ${start.status}`);

  if (attemptId) {
    const state = await call(`/api/attempts/${attemptId}`);
    const served = state.body?.data?.questions ?? [];
    check('all imported questions served', served.length === QUESTIONS, `${served.length}`);

    const keyRows = await db.testQuestion.findMany({
      where: { testId },
      select: {
        id: true,
        question: { select: { options: { where: { isCorrect: true }, select: { id: true } } } },
      },
    });
    const keyByTq = new Map(keyRows.map((r) => [r.id, r.question.options.map((o) => o.id)]));

    await call(`/api/attempts/${attemptId}/answers`, {
      method: 'PATCH',
      body: JSON.stringify({
        patches: served.map((q) => ({
          testQuestionId: q.testQuestionId,
          selectedOptionIds: keyByTq.get(q.testQuestionId) ?? [],
          state: 'ANSWERED',
        })),
      }),
    });

    const submit = await call(`/api/attempts/${attemptId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'MANUAL' }),
    });
    check('scores full marks with the imported keys',
      submit.body?.data?.score === QUESTIONS,
      `${submit.body?.data?.score}/${submit.body?.data?.maxScore}`);
  }

  // --- Cleanup ------------------------------------------------------------
  const ids = (
    await db.question.findMany({
      where: { source: 'E2E Import Verification' },
      select: { id: true },
    })
  ).map((q) => q.id);

  await db.testAnswer.deleteMany({ where: { attempt: { testId } } });
  await db.attemptEvent.deleteMany({ where: { attempt: { testId } } });
  await db.testAttempt.deleteMany({ where: { testId } });
  await db.testQuestion.deleteMany({ where: { testId } });
  await db.test.delete({ where: { id: testId } });
  await db.questionOption.deleteMany({ where: { questionId: { in: ids } } });
  await db.questionStat.deleteMany({ where: { questionId: { in: ids } } });
  await db.question.deleteMany({ where: { id: { in: ids } } });
  console.log('\n  cleaned up import fixtures');

  console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
  await db.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('\nAborted:\n', error);
  await db.$disconnect();
  process.exit(1);
});
