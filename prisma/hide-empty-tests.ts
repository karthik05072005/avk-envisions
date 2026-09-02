/**
 * Takes empty tests out of the catalogue.
 *
 * A published test with no questions is worse than a missing one: a student
 * picks it out of the list, commits to sitting it, and lands on nothing. 53 of
 * them were live at once, which is most of what a browsing student would have
 * clicked.
 *
 * They are moved to DRAFT rather than deleted. Every one of them is a real
 * paper we intend to fill, and the series, pricing and synopsis attached to it
 * are worth keeping — publishing again is then a one-line change once the
 * questions are in.
 *
 *   npm run db:hide-empty -- --dry-run
 *
 * Run with: npm run db:hide-empty
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const empty = await db.test.findMany({
    where: { deletedAt: null, status: 'PUBLISHED', totalQuestions: 0 },
    select: { id: true, slug: true, title: true },
    orderBy: { slug: 'asc' },
  });

  console.log(
    `\n${empty.length} published test(s) have no questions${DRY_RUN ? ' (dry run)' : ''}.\n`,
  );

  for (const test of empty) {
    console.log(`  ${DRY_RUN ? 'would hide' : 'hidden'}  ${test.slug}`);
  }

  if (!DRY_RUN && empty.length > 0) {
    await db.test.updateMany({
      where: { id: { in: empty.map((t) => t.id) } },
      data: { status: 'DRAFT' },
    });
  }

  // A series whose every test is now hidden should not advertise itself either.
  const series = await db.testSeries.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      slug: true,
      status: true,
      tests: { where: { deletedAt: null }, select: { status: true, totalQuestions: true } },
    },
  });

  // A series with no tests at all is just as empty as one whose tests are all
  // empty — and slipped through when this only checked the latter. Five
  // chapterwise series were advertised on the catalogue with nothing behind
  // them, so a student clicking "Chapterwise Polity" got an empty page.
  const hollow = series.filter(
    (s) =>
      s.status === 'PUBLISHED' &&
      (s.tests.length === 0 || s.tests.every((t) => t.totalQuestions === 0)),
  );

  for (const s of hollow) {
    console.log(`  ${DRY_RUN ? 'would hide series' : 'series hidden'}  ${s.slug}`);
    if (!DRY_RUN) {
      await db.testSeries.update({ where: { id: s.id }, data: { status: 'DRAFT' } });
    }
  }

  const live = await db.test.count({
    where: { deletedAt: null, status: 'PUBLISHED', totalQuestions: { gt: 0 } },
  });
  console.log(`\n  ${live} test(s) remain published, all with questions.\n`);
}

main()
  .catch((error) => {
    console.error('\nFailed:\n', error?.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
