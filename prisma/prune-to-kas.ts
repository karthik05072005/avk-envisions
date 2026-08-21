/**
 * Reduces the portal to a single exam: KAS (Karnataka Administrative Service).
 *
 * Removes every other exam along with its subjects, chapters, topics,
 * questions, tests, test series and PYQ papers.
 *
 * Deletion order matters. Several relations are `onDelete: Restrict` —
 * TestAnswer→Question, TestAttempt→Test, PracticeAnswer→Question and
 * QuestionReport→Question — so those children have to go first or the delete
 * is refused. Everything runs in one transaction: a half-pruned portal, with
 * tests whose questions have vanished, would be worse than either state.
 *
 * SAFETY: refuses to run against a non-file database unless ALLOW_REMOTE_SEED=1,
 * and refuses outright if a paid order references anything being removed.
 *
 * Run with: npm run db:prune:kas
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const KEEP_SLUG = 'kas';

async function main() {
  if (!(process.env.DATABASE_URL ?? '').startsWith('file:') && process.env.ALLOW_REMOTE_SEED !== '1') {
    throw new Error('Refusing to prune a non-file database. Set ALLOW_REMOTE_SEED=1 if intended.');
  }

  console.log('\nPruning the portal to KAS only...\n');

  const keep = await db.exam.findUnique({ where: { slug: KEEP_SLUG }, select: { id: true } });
  if (!keep) {
    throw new Error(
      `The "${KEEP_SLUG}" exam does not exist. Run \`npm run db:seed:kas\` before pruning, or nothing would be left.`,
    );
  }

  const doomed = await db.exam.findMany({
    where: { slug: { not: KEEP_SLUG } },
    select: { id: true, shortName: true, name: true },
  });

  if (doomed.length === 0) {
    console.log('  Nothing to remove — KAS is already the only exam.\n');
    return;
  }

  const ids = doomed.map((e) => e.id);
  console.log(`  Removing: ${doomed.map((e) => e.shortName).join(', ')}\n`);

  // --- Refuse to orphan a purchase ---------------------------------------
  const paidItems = await db.orderItem.count({
    where: {
      testSeries: { examId: { in: ids } },
      order: { status: { in: ['PAID', 'PARTIALLY_REFUNDED'] } },
    },
  });
  if (paidItems > 0) {
    throw new Error(
      `${paidItems} paid order item(s) reference these exams. Refund or migrate them before pruning — deleting would orphan a real purchase.`,
    );
  }

  const examFilter = { examId: { in: ids } };

  await db.$transaction(
    async (tx) => {
      // --- Attempt data (Restrict on both Question and Test) -------------
      const attemptFilter = { attempt: { test: examFilter } };

      const answers = await tx.testAnswer.deleteMany({ where: attemptFilter });
      const events = await tx.attemptEvent.deleteMany({ where: attemptFilter });
      const attempts = await tx.testAttempt.deleteMany({ where: { test: examFilter } });

      // --- Practice data (Restrict on Question) ---------------------------
      const practiceAnswers = await tx.practiceAnswer.deleteMany({
        where: { question: examFilter },
      });
      // Sessions scoped to a removed exam are meaningless once their answers
      // are gone; sessions that merely *touched* one keep their other answers.
      const practiceSessions = await tx.practiceSession.deleteMany({ where: examFilter });

      // --- Other Restrict references to Question --------------------------
      const bookmarks = await tx.bookmark.deleteMany({ where: { question: examFilter } });
      const reports = await tx.questionReport.deleteMany({ where: { question: examFilter } });

      // --- Join tables ----------------------------------------------------
      const testQuestions = await tx.testQuestion.deleteMany({ where: { test: examFilter } });
      const testSections = await tx.testSection.deleteMany({ where: { test: examFilter } });
      const blueprints = await tx.testBlueprintRule.deleteMany({ where: { test: examFilter } });

      // --- Commerce links -------------------------------------------------
      const planExams = await tx.planExam.deleteMany({ where: examFilter });
      const planSeries = await tx.planTestSeries.deleteMany({
        where: { testSeries: examFilter },
      });
      const entitlements = await tx.entitlement.deleteMany({
        where: { testSeries: examFilter },
      });
      const orderItems = await tx.orderItem.deleteMany({ where: { testSeries: examFilter } });

      // --- Performance rollups -------------------------------------------
      const snapshots = await tx.performanceSnapshot.deleteMany({ where: examFilter });
      const subjectPerf = await tx.subjectPerformance.deleteMany({
        where: { subject: examFilter },
      });
      const topicPerf = await tx.topicPerformance.deleteMany({
        where: { topic: { chapter: { subject: examFilter } } },
      });

      // --- Students targeting a removed exam ------------------------------
      // Cleared rather than cascaded: the student keeps their account, they
      // simply no longer have a target selected.
      const profiles = await tx.studentProfile.updateMany({
        where: { targetExamId: { in: ids } },
        data: { targetExamId: null },
      });
      const plans = await tx.studyPlan.updateMany({
        where: { examId: { in: ids } },
        data: { examId: null },
      });

      const materials = await tx.studyMaterial.deleteMany({ where: examFilter });
      const faqs = await tx.faq.deleteMany({ where: { testSeries: examFilter } });

      // --- The exams themselves -------------------------------------------
      // Cascades to subjects, chapters, topics, questions (and their options
      // and stats), tests and test series.
      const exams = await tx.exam.deleteMany({ where: { id: { in: ids } } });

      const report: [string, number][] = [
        ['test answers', answers.count],
        ['attempt events', events.count],
        ['test attempts', attempts.count],
        ['practice answers', practiceAnswers.count],
        ['practice sessions', practiceSessions.count],
        ['bookmarks', bookmarks.count],
        ['question reports', reports.count],
        ['test questions', testQuestions.count],
        ['test sections', testSections.count],
        ['blueprint rules', blueprints.count],
        ['plan-exam links', planExams.count],
        ['plan-series links', planSeries.count],
        ['entitlements', entitlements.count],
        ['order items', orderItems.count],
        ['performance snapshots', snapshots.count],
        ['subject performance', subjectPerf.count],
        ['topic performance', topicPerf.count],
        ['profiles retargeted', profiles.count],
        ['study plans retargeted', plans.count],
        ['study materials', materials.count],
        ['series FAQs', faqs.count],
        ['exams', exams.count],
      ];

      for (const [label, count] of report) {
        if (count > 0) console.log(`  removed  ${String(count).padStart(5)}  ${label}`);
      }
    },
    { timeout: 120_000, maxWait: 20_000 },
  );

  // --- What is left --------------------------------------------------------
  const [exams, questions, tests, series] = await Promise.all([
    db.exam.findMany({ select: { shortName: true, name: true } }),
    db.question.count({ where: { deletedAt: null } }),
    db.test.count({ where: { deletedAt: null } }),
    db.testSeries.count({ where: { deletedAt: null } }),
  ]);

  console.log('\n  Remaining:');
  for (const exam of exams) console.log(`    ${exam.shortName} — ${exam.name}`);
  console.log(`    ${questions} questions, ${tests} tests, ${series} test series\n`);

  if (exams.length !== 1) {
    throw new Error(`Expected exactly one exam to remain, found ${exams.length}.`);
  }

  console.log('Done.\n');
}

main()
  .catch((error) => {
    console.error('\nPrune failed — nothing was changed:\n', error.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
