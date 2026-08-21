/**
 * One-off verification for the KAS Polity seed: prints the stored answer key
 * for each question and the resulting test/series configuration.
 *
 * Run with: node scripts/verify-kas.cjs
 */
const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();

(async () => {
  const questions = await db.question.findMany({
    where: { code: { startsWith: 'KAS-PYQ-2024' } },
    orderBy: { code: 'asc' },
    select: {
      code: true,
      difficulty: true,
      marks: true,
      negativeMarks: true,
      source: true,
      examYear: true,
      status: true,
      reviewNote: true,
      topic: { select: { name: true } },
      options: {
        orderBy: { sortOrder: 'asc' },
        select: { label: true, body: true, isCorrect: true },
      },
    },
  });

  for (const q of questions) {
    const key = q.options.find((o) => o.isCorrect);
    const correctCount = q.options.filter((o) => o.isCorrect).length;
    console.log(`${q.code}  [${q.difficulty}]  ${q.topic.name}`);
    console.log(`   status=${q.status} marks=${q.marks}/-${q.negativeMarks} source="${q.source}" year=${q.examYear}`);
    console.log(`   KEY -> ${key.label}) ${key.body}   (options marked correct: ${correctCount})`);
    if (q.reviewNote) console.log('   ** carries a faculty review note **');
    console.log('');
  }

  const test = await db.test.findFirst({
    where: { slug: 'kas-2024-prelims-polity-pyq-set-1' },
    select: {
      title: true,
      status: true,
      accessType: true,
      durationMinutes: true,
      totalQuestions: true,
      totalMarks: true,
      maxAttempts: true,
      randomizeOptions: true,
      _count: { select: { questions: true } },
    },
  });

  const series = await db.testSeries.findFirst({
    where: { slug: 'kas-polity-previous-year-questions' },
    select: {
      name: true,
      status: true,
      priceInPaise: true,
      _count: { select: { tests: true, faqs: true } },
    },
  });

  console.log('TEST  :', JSON.stringify(test));
  console.log('SERIES:', JSON.stringify(series));

  await db.$disconnect();
})();
