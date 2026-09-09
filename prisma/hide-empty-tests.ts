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

  // Only a series with nothing behind it at all. A series that has laid out
  // its papers is a published timetable — a student is meant to read what
  // falls on which date before those papers are written, and that is what a
  // buyer is paying for — so having no questions yet is not a reason to take
  // it off the shelf. Hiding those turned KAS-50 and the paid series into
  // "Coming Soon" on the pricing page and an empty state on their own.
  // A priced series is never hidden. The previous-year bundle holds no tests
  // of its own — it is the parent that entitles every year — so counting its
  // tests takes the one previous-year product actually on sale off the
  // pricing page. Anything someone can pay for stays where they can pay for
  // it, and what it contains is the admin's business, not this job's.
  const hollow = series.filter(
    (s) => s.status === 'PUBLISHED' && s.priceInPaise === 0 && s.tests.length === 0,
  );

  for (const s of hollow) {
    console.log(`  ${DRY_RUN ? 'would hide series' : 'series hidden'}  ${s.slug}`);
    if (!DRY_RUN) {
      await db.testSeries.update({ where: { id: s.id }, data: { status: 'DRAFT' } });
    }
  }

  // The same rule the other way: a series drafted before this ran, which has
  // a schedule to show, belongs back on the shelf. Nothing stays hidden for
  // want of questions.
  const refilled = series.filter(
    (s) => s.status === 'DRAFT' && (s.tests.length > 0 || s.priceInPaise > 0),
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
