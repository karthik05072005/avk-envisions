/**
 * Retires the paid series' stale tests.
 *
 * The series is the twelve tests on the published timetable, which the
 * schedule importer creates as `kas-paid-1` … `kas-paid-12`. An earlier seed
 * laid out a longer plan, and because the importer only creates and
 * reschedules — it never removes — those older papers stayed in the series.
 * Students saw twenty-one tests where the timetable promises twelve, the extra
 * nine permanently "Questions being added".
 *
 * Anything in the series outside the timetable's own slugs is retired.
 *
 * Soft-deleted, not destroyed: `deletedAt` takes a test out of every listing
 * while leaving its row intact, so if one of these turns out to be wanted it
 * comes back by clearing one column. A test somebody has actually attempted is
 * never touched at all — that would orphan their result.
 *
 *   npm run db:paid:prune -- --dry-run
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

const SERIES_SLUG = 'kas-prelims-paid-test-series';
/** What the published timetable lays out: kas-paid-1 … kas-paid-12. */
const TIMETABLE_COUNT = 12;

async function main() {
  console.log(`\nPruning the paid test series${DRY_RUN ? ' (dry run)' : ''}...\n`);

  const series = await db.testSeries.findFirst({
    where: { slug: SERIES_SLUG, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!series) throw new Error('The paid series is missing.');

  const keep = new Set(
    Array.from({ length: TIMETABLE_COUNT }, (_, i) => `kas-paid-${i + 1}`),
  );

  const tests = await db.test.findMany({
    where: { testSeriesId: series.id, deletedAt: null },
    select: {
      id: true,
      slug: true,
      title: true,
      totalQuestions: true,
      _count: { select: { attempts: true } },
    },
    orderBy: { slug: 'asc' },
  });

  const stale = tests.filter((test) => !keep.has(test.slug));
  const kept = tests.length - stale.length;

  console.log(`  ${series.name}`);
  console.log(`  ${tests.length} test(s) in the series; the timetable lists ${TIMETABLE_COUNT}.\n`);

  if (stale.length === 0) {
    console.log('  Nothing to prune — the series already matches the timetable.\n');
    return;
  }

  // A paper somebody sat is left alone whatever its slug: retiring it would
  // take a student's result page with it.
  const attempted = stale.filter((test) => test._count.attempts > 0);
  const removable = stale.filter((test) => test._count.attempts === 0);

  console.log(`  ${stale.length} test(s) are not on the timetable:`);
  for (const test of stale) {
    const note =
      test._count.attempts > 0
        ? `KEPT — ${test._count.attempts} attempt(s)`
        : test.totalQuestions > 0
          ? `retiring — has ${test.totalQuestions} question(s)`
          : 'retiring';
    console.log(`    ${test.slug.padEnd(28)} ${note.padEnd(30)} ${test.title.slice(0, 40)}`);
  }

  if (attempted.length > 0) {
    console.log(
      `\n  ${attempted.length} of them have been attempted and are left in place.\n` +
        '  Remove those by hand once you are sure nobody needs the result.',
    );
  }

  console.log(`\n  ${kept} on the timetable stay, ${removable.length} to retire.`);

  if (DRY_RUN) {
    console.log('\n  Nothing written.\n');
    return;
  }

  const result = await db.test.updateMany({
    where: { id: { in: removable.map((test) => test.id) } },
    data: { deletedAt: new Date(), status: 'ARCHIVED' },
  });

  const left = await db.test.count({ where: { testSeriesId: series.id, deletedAt: null } });
  console.log(`\n  ${result.count} retired. The series now shows ${left} test(s).\n`);
}

main()
  .catch((error) => {
    console.error('\nFailed:\n', error?.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
