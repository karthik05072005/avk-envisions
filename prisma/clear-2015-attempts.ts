/**
 * Removes the attempts on the 2015 papers so the block can be emptied.
 *
 * Those papers were built from the wrong document and their questions are
 * about to be detached and replaced by hand. An attempt outlives the questions
 * it was sat against — the result page reads them back to show what was asked —
 * so an attempt left behind would render an empty paper or fail outright.
 *
 * This is destructive and deliberately narrow: only attempts on
 * `kas-pyq-2015-*`, nothing else. Run the dry run first and read the list.
 *
 * Back up before running. On the VM:
 *   sudo /usr/local/bin/avk-backup
 *
 *   npm run db:clear-2015 -- --dry-run
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

const PREFIX = 'kas-pyq-2015';

async function main() {
  console.log(`\nClearing attempts on the ${PREFIX} papers${DRY_RUN ? ' (dry run)' : ''}...\n`);

  const tests = await db.test.findMany({
    where: { slug: { startsWith: PREFIX }, deletedAt: null },
    select: { id: true, slug: true },
  });

  const attempts = await db.testAttempt.findMany({
    where: { testId: { in: tests.map((t) => t.id) } },
    select: {
      id: true,
      status: true,
      score: true,
      maxScore: true,
      attemptedCount: true,
      startedAt: true,
      test: { select: { slug: true } },
      user: { select: { email: true } },
      _count: { select: { answers: true } },
    },
    orderBy: { startedAt: 'asc' },
  });

  if (attempts.length === 0) {
    console.log('  No attempts to clear.\n');
    return;
  }

  console.log(`  ${attempts.length} attempt(s) across ${tests.length} paper(s):\n`);
  for (const attempt of attempts) {
    console.log(
      `    ${attempt.user.email.padEnd(32)} ${attempt.status.padEnd(15)} ` +
        `${String(attempt.attemptedCount).padStart(3)} answered  ` +
        `score ${String(attempt.score).padStart(5)}/${attempt.maxScore}  ` +
        `${attempt.test.slug}`,
    );
  }

  const byUser = new Map<string, number>();
  for (const attempt of attempts) {
    byUser.set(attempt.user.email, (byUser.get(attempt.user.email) ?? 0) + 1);
  }
  console.log('\n  By account:');
  for (const [email, count] of [...byUser].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(count).padStart(3)}  ${email}`);
  }

  const answers = attempts.reduce((sum, a) => sum + a._count.answers, 0);
  console.log(`\n  ${answers} recorded answer(s) will go with them.`);

  if (DRY_RUN) {
    console.log('\n  Nothing deleted.\n');
    return;
  }

  const ids = attempts.map((a) => a.id);

  const result = await db.$transaction(async (tx) => {
    // Answers and events reference the attempt, so they go first.
    const removedAnswers = await tx.testAnswer.deleteMany({ where: { attemptId: { in: ids } } });
    await tx.attemptEvent.deleteMany({ where: { attemptId: { in: ids } } }).catch(() => null);
    const removed = await tx.testAttempt.deleteMany({ where: { id: { in: ids } } });
    return { attempts: removed.count, answers: removedAnswers.count };
  });

  // The counters on each test are derived from its attempts, so they have to
  // come back down with them rather than reporting attempts that no longer
  // exist.
  for (const test of tests) {
    const remaining = await db.testAttempt.count({ where: { testId: test.id } });
    await db.test.update({ where: { id: test.id }, data: { attemptCount: remaining } });
  }

  console.log(`\n  Deleted ${result.attempts} attempt(s) and ${result.answers} answer(s).`);
  console.log('  The swap can now run.\n');
}

main()
  .catch((error) => {
    console.error('\nFailed:\n', error?.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
