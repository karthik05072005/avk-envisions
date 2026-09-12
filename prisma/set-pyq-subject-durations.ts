/**
 * Times the PYQ subject-wise tests at 1.2 seconds per question.
 *
 * The durations were fixed per subject and ignored how long the test actually
 * was: History ran 29 minutes whether it held 35 questions or none, and the
 * 2011 Current Affairs test gave 38 questions the same 14 minutes that
 * Geography got for 11. Whatever the rate, a duration that does not follow the
 * question count is wrong for most of the tests it applies to.
 *
 * The rate is the one the client specified, and it is deliberately severe:
 * 1.2 seconds per question puts every one of these tests at the one-minute
 * floor, so a 35-question paper allows roughly 1.7 seconds a question. That is
 * the instruction, recorded here so the number is not mistaken later for an
 * accident. The full-length papers are left alone at 120 minutes — they follow
 * the real Prelims pattern and were not part of the request.
 *
 * Tests with no questions yet keep what they have. Their count is unknown
 * rather than genuinely zero, and pinning them to the floor now would just have
 * to be undone the moment their questions are imported.
 *
 *   npm run db:pyq-durations -- --dry-run
 *
 * Run with: npm run db:pyq-durations
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

/** Seconds a student gets per question on these tests. */
const SECONDS_PER_QUESTION = 1.2;

/** No test can be shorter than this; the column is whole minutes. */
const FLOOR_MINUTES = 1;

export function durationFor(questionCount: number): number {
  return Math.max(FLOOR_MINUTES, Math.ceil((questionCount * SECONDS_PER_QUESTION) / 60));
}

async function main() {
  // Subject-wise only. The slug carries the distinction the title does not:
  // every one of these reads `kas-pyq-<year>-subject-<name>`, while the
  // full-length papers end in `-paper-1` / `-paper-2`.
  const tests = await db.test.findMany({
    where: {
      deletedAt: null,
      slug: { contains: '-subject-' },
      testSeries: { slug: { startsWith: 'kas-pyq-' } },
    },
    select: { id: true, slug: true, durationMinutes: true, totalQuestions: true },
    orderBy: { slug: 'asc' },
  });

  const changes = tests
    .filter((test) => test.totalQuestions > 0)
    .map((test) => ({ ...test, want: durationFor(test.totalQuestions) }))
    .filter((test) => test.want !== test.durationMinutes);

  const skipped = tests.filter((test) => test.totalQuestions === 0).length;

  console.log(
    `${tests.length} subject-wise PYQ tests · ${changes.length} to retime · ` +
      `${skipped} still empty, left as they are`,
  );

  for (const test of changes) {
    console.log(
      `  ${test.slug.padEnd(46)} ${String(test.durationMinutes).padStart(4)}m → ` +
        `${String(test.want).padStart(3)}m  (${test.totalQuestions} questions)`,
    );
  }

  if (DRY_RUN) {
    console.log('\nDry run: nothing was written.');
    return;
  }

  for (const test of changes) {
    await db.test.update({ where: { id: test.id }, data: { durationMinutes: test.want } });
  }

  console.log(`\nRetimed ${changes.length} tests.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
