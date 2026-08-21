/**
 * Dry run: reports everything that would be removed if the portal were reduced
 * to KAS only. Writes nothing.
 *
 * Run with: node scripts/survey-non-kas.cjs
 */
const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();
const KEEP = 'kas';

(async () => {
  const exams = await db.exam.findMany({
    select: {
      id: true,
      name: true,
      shortName: true,
      slug: true,
      _count: {
        select: {
          subjects: true,
          questions: true,
          tests: true,
          testSeries: true,
          studentProfiles: true,
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  console.log('\nExams currently in the portal\n');
  for (const exam of exams) {
    const mark = exam.slug === KEEP ? 'KEEP  ' : 'REMOVE';
    console.log(
      `  [${mark}] ${exam.shortName.padEnd(6)} ${exam.name.padEnd(38)} ` +
        `${String(exam._count.subjects).padStart(3)} subj  ` +
        `${String(exam._count.questions).padStart(4)} q  ` +
        `${String(exam._count.tests).padStart(4)} tests  ` +
        `${String(exam._count.testSeries).padStart(3)} series`,
    );
  }

  const doomed = exams.filter((e) => e.slug !== KEEP);
  const doomedIds = doomed.map((e) => e.id);

  if (doomedIds.length === 0) {
    console.log('\nNothing to remove — only KAS is present.\n');
    await db.$disconnect();
    return;
  }

  // --- Student data attached to what would be deleted ---------------------
  const [attempts, answers, practiceAnswers, bookmarks, entitlements, orders, profiles] =
    await Promise.all([
      db.testAttempt.count({ where: { test: { examId: { in: doomedIds } } } }),
      db.testAnswer.count({ where: { attempt: { test: { examId: { in: doomedIds } } } } }),
      db.practiceAnswer.count({ where: { question: { examId: { in: doomedIds } } } }),
      db.bookmark.count({ where: { question: { examId: { in: doomedIds } } } }),
      db.entitlement.count({ where: { testSeries: { examId: { in: doomedIds } } } }),
      db.orderItem.count({ where: { testSeries: { examId: { in: doomedIds } } } }),
      db.studentProfile.count({ where: { targetExamId: { in: doomedIds } } }),
    ]);

  console.log('\nStudent data attached to those exams\n');
  console.log(`  test attempts        ${attempts}`);
  console.log(`  test answers         ${answers}`);
  console.log(`  practice answers     ${practiceAnswers}`);
  console.log(`  bookmarks            ${bookmarks}`);
  console.log(`  entitlements         ${entitlements}`);
  console.log(`  paid order items     ${orders}`);
  console.log(`  profiles targeting   ${profiles}`);

  if (orders > 0) {
    console.log('\n  ⚠  PAID ORDER ITEMS EXIST. Deleting these exams would orphan a purchase.');
  }

  console.log('\nRun `npm run db:prune:kas` to apply.\n');
  await db.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
