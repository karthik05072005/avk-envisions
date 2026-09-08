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

  // --- And publish the ones that have since been filled --------------------
  // Hiding was one-directional: a paper drafted while empty stayed drafted
  // after its questions arrived, so work an admin had finished never reached a
  // student. This runs on every deploy, so the rule has to hold both ways.
  //
  // A question that is itself unpublished is skipped when a paper is served,
  // so a paper holding only drafts would be published and still show nothing.
  // Those are counted, not published: whether an unreviewed question should go
  // live is the admin's call, not this job's.
  const filled = await db.test.findMany({
    where: {
      deletedAt: null,
      status: 'DRAFT',
      questions: { some: { question: { status: 'PUBLISHED', deletedAt: null } } },
    },
    select: {
      id: true,
      slug: true,
      _count: { select: { questions: true } },
    },
    orderBy: { slug: 'asc' },
  });

  console.log(`
${filled.length} draft test(s) now have questions.
`);
  for (const test of filled) {
    console.log(
      `  ${DRY_RUN ? 'would publish' : 'published'}  ${String(test._count.questions).padStart(4)}q  ${test.slug}`,
    );
  }

  if (!DRY_RUN && filled.length > 0) {
    await db.test.updateMany({
      where: { id: { in: filled.map((t) => t.id) } },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
  }

  // A series whose every test is now hidden should not advertise itself either.
  const series = await db.testSeries.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      slug: true,
      status: true,
      priceInPaise: true,
      tests: { where: { deletedAt: null }, select: { status: true, totalQuestions: true } },
    },
  });

  // A series with no tests at all is just as empty as one whose tests are all
  // empty — and slipped through when this only checked the latter. Five
  // chapterwise series were advertised on the catalogue with nothing behind
  // them, so a student clicking "Chapterwise Polity" got an empty page.
  // A priced series is a deliberate offer whose content is still being
  // written, and its page says so — locked cards, an unlock button, no claim
  // that anything is attemptable. Hiding those would take the shelf down
  // rather than the empty promise, which is the opposite of the intent here.
  const hollow = series.filter(
    (s) =>
      s.status === 'PUBLISHED' &&
      s.priceInPaise === 0 &&
      (s.tests.length === 0 || s.tests.every((t) => t.totalQuestions === 0)),
  );

  for (const s of hollow) {
    console.log(`  ${DRY_RUN ? 'would hide series' : 'series hidden'}  ${s.slug}`);
    if (!DRY_RUN) {
      await db.testSeries.update({ where: { id: s.id }, data: { status: 'DRAFT' } });
    }
  }

  // The same rule the other way: a series drafted while hollow, whose tests
  // now hold questions, should be back on the shelf.
  const refilled = series.filter(
    (s) =>
      s.status === 'DRAFT' &&
      s.tests.some((t) => t.totalQuestions > 0),
  );

  for (const s of refilled) {
    console.log(`  ${DRY_RUN ? 'would publish series' : 'series published'}  ${s.slug}`);
    if (!DRY_RUN) {
      await db.testSeries.update({ where: { id: s.id }, data: { status: 'PUBLISHED' } });
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
