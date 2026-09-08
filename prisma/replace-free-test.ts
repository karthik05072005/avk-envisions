/**
 * Replaces one free test with a supplied paper.
 *
 * For the case where a slot holds the wrong content: the test row is kept, so
 * its slug, series, schedule and settings survive, and only its title,
 * questions and synopsis change. Rebuilding the row instead would break its
 * URL and detach it from the series.
 *
 * Attempts on the paper are cleared first, because a result page reads its
 * questions back to show what was asked — leaving them would point students at
 * a record of a test that no longer exists. The dry run lists whose they are
 * so that is a decision rather than a surprise.
 *
 *   npm run db:replace-free -- --test kas-free-2 --file "paper.pdf" --title "Free Test 2 – Paper 2" --dry-run
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

function flag(name: string): string | null {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? null : (process.argv[at + 1] ?? null);
}

async function main() {
  const slug = flag('test');
  const title = flag('title');
  if (!slug) throw new Error('Pass --test <slug>, e.g. --test kas-free-2');

  console.log(`\nReplacing ${slug}${DRY_RUN ? ' (dry run)' : ''}...\n`);

  const test = await db.test.findFirst({
    where: { slug, deletedAt: null },
    select: {
      id: true,
      title: true,
      status: true,
      totalQuestions: true,
      _count: { select: { questions: true } },
    },
  });
  if (!test) throw new Error(`No test with slug ${slug}.`);

  const attempts = await db.testAttempt.findMany({
    where: { testId: test.id },
    select: {
      id: true,
      status: true,
      score: true,
      attemptedCount: true,
      user: { select: { email: true } },
    },
    orderBy: { startedAt: 'asc' },
  });

  console.log(`  "${test.title}" — ${test.totalQuestions} question(s), ${test.status}`);
  if (title) console.log(`  will be retitled "${title}"`);

  if (attempts.length > 0) {
    console.log(`\n  ${attempts.length} attempt(s) will be cleared:`);
    for (const attempt of attempts) {
      console.log(
        `    ${attempt.user.email.padEnd(32)} ${attempt.status.padEnd(10)} ` +
          `${String(attempt.attemptedCount).padStart(3)} answered, score ${attempt.score}`,
      );
    }
    console.log(
      '\n    A result page reads back the questions it was sat against, so an\n' +
        '    attempt left behind would point at a test that no longer exists.',
    );
  }

  console.log(
    `\n  ${test._count.questions} question(s) will be detached — they stay in the bank.`,
  );

  if (DRY_RUN) {
    console.log('\n  Nothing written. Run the import afterwards to fill it.\n');
    return;
  }

  await db.$transaction(async (tx) => {
    for (const attempt of attempts) {
      await tx.testAnswer.deleteMany({ where: { attemptId: attempt.id } });
      await tx.attemptEvent.deleteMany({ where: { attemptId: attempt.id } }).catch(() => null);
    }
    await tx.testAttempt.deleteMany({ where: { testId: test.id } });
    await tx.testQuestion.deleteMany({ where: { testId: test.id } });
    await tx.test.update({
      where: { id: test.id },
      data: {
        ...(title ? { title } : {}),
        totalQuestions: 0,
        totalMarks: 0,
        passingMarks: 0,
        attemptCount: 0,
      },
    });
  });

  console.log(
    `\n  Cleared. Now run the import to fill it:\n` +
      `    npx tsx prisma/import-free-test-1.ts --test ${slug} --file <paper.pdf>\n`,
  );
}

main()
  .catch((error) => {
    console.error('\nFailed:\n', error?.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
