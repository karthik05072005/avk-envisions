/**
 * Swaps the 2015 and 2017 previous-year blocks.
 *
 * The two years were built from the wrong documents: what the site calls 2015
 * was parsed from the 2017 paper and the other way round. Rather than reimport
 * both, the blocks trade places — names, slugs, exam years and synopsis files —
 * so each set of questions sits under the year it actually belongs to.
 *
 * The block becoming 2017 has its questions emptied, because those questions
 * are the 2015 paper and will be replaced by hand. Emptying means detaching:
 * the papers, their subject tests and every synopsis stay exactly as they are,
 * so what is left is the structure ready to be filled.
 *
 * The block becoming 2015 keeps everything.
 *
 * Slugs move through a temporary name because they are unique — assigning
 * "kas-pyq-2017" while another row still holds it would collide.
 *
 *   npm run db:swap-years -- --dry-run
 */
import { rename, stat } from 'node:fs/promises';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';

import { synopsisDir } from '../src/server/services/synopsis-service';

const db = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

/** The block whose questions are discarded and which becomes 2017. */
const EMPTIED = { from: 2015, to: 2017 };
/** The block that keeps its questions and becomes 2015. */
const KEPT = { from: 2017, to: 2015 };

const TEMP = 'kas-pyq-swap-tmp';

/** `kas-pyq-2015-paper-1` → `kas-pyq-2017-paper-1`. */
function reslug(slug: string, from: number, to: number): string {
  return slug.replace(`kas-pyq-${from}`, `kas-pyq-${to}`);
}

async function main() {
  console.log(`\nSwapping the 2015 and 2017 blocks${DRY_RUN ? ' (dry run)' : ''}...\n`);

  const emptied = await db.testSeries.findFirst({
    where: { slug: `kas-pyq-${EMPTIED.from}`, deletedAt: null },
    select: { id: true, name: true },
  });
  const kept = await db.testSeries.findFirst({
    where: { slug: `kas-pyq-${KEPT.from}`, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!emptied || !kept) throw new Error('One of the two series is missing.');

  const emptiedTests = await db.test.findMany({
    where: { testSeriesId: emptied.id, deletedAt: null },
    select: {
      id: true,
      slug: true,
      title: true,
      synopsisFileName: true,
      _count: { select: { questions: true, attempts: true } },
    },
    orderBy: { slug: 'asc' },
  });
  const keptTests = await db.test.findMany({
    where: { testSeriesId: kept.id, deletedAt: null },
    select: { id: true, slug: true, title: true, synopsisFileName: true },
    orderBy: { slug: 'asc' },
  });

  const questionCount = emptiedTests.reduce((n, t) => n + t._count.questions, 0);
  const attemptCount = emptiedTests.reduce((n, t) => n + t._count.attempts, 0);

  console.log(`  ${EMPTIED.from} → ${EMPTIED.to}: ${emptiedTests.length} tests`);
  console.log(`      ${questionCount} question(s) detached, structure kept`);
  console.log(`  ${KEPT.from} → ${KEPT.to}: ${keptTests.length} tests, questions untouched\n`);

  // A paper somebody has sat must not be emptied: the result page reads the
  // questions back, and detaching them would leave it unable to render.
  if (attemptCount > 0) {
    throw new Error(
      `${attemptCount} attempt(s) exist on the ${EMPTIED.from} papers. ` +
        'Emptying them would break those result pages. Resolve those attempts first.',
    );
  }

  if (DRY_RUN) {
    console.log('  Nothing written.\n');
    return;
  }

  await db.$transaction(
    async (tx) => {
      // --- Park the block being emptied on temporary slugs ------------------
      await tx.testSeries.update({
        where: { id: emptied.id },
        data: { slug: TEMP },
      });
      for (const test of emptiedTests) {
        await tx.test.update({
          where: { id: test.id },
          data: { slug: test.slug.replace(`kas-pyq-${EMPTIED.from}`, TEMP) },
        });
      }

      // --- Move the keeper into its new year -------------------------------
      await tx.testSeries.update({
        where: { id: kept.id },
        data: {
          slug: `kas-pyq-${KEPT.to}`,
          name: `${KEPT.to} KAS Prelims`,
          examYear: KEPT.to,
        },
      });
      for (const test of keptTests) {
        await tx.test.update({
          where: { id: test.id },
          data: {
            slug: reslug(test.slug, KEPT.from, KEPT.to),
            title: test.title.replaceAll(String(KEPT.from), String(KEPT.to)),
            synopsisFileName: test.synopsisFileName
              ? reslug(test.synopsisFileName, KEPT.from, KEPT.to)
              : null,
          },
        });
      }

      // --- Move the emptied block into the year it vacated ------------------
      await tx.testSeries.update({
        where: { id: emptied.id },
        data: {
          slug: `kas-pyq-${EMPTIED.to}`,
          name: `${EMPTIED.to} KAS Prelims`,
          examYear: EMPTIED.to,
        },
      });
      for (const test of emptiedTests) {
        await tx.test.update({
          where: { id: test.id },
          data: {
            slug: reslug(test.slug, EMPTIED.from, EMPTIED.to),
            title: test.title.replaceAll(String(EMPTIED.from), String(EMPTIED.to)),
            synopsisFileName: test.synopsisFileName
              ? reslug(test.synopsisFileName, EMPTIED.from, EMPTIED.to)
              : null,
          },
        });
      }

      // --- Empty the questions out of the block that is now 2017 -----------
      // Detached, not deleted. The questions themselves stay in the bank so
      // nothing else referencing them breaks; they simply belong to no paper.
      for (const test of emptiedTests) {
        await tx.testQuestion.deleteMany({ where: { testId: test.id } });
        await tx.test.update({
          where: { id: test.id },
          data: { totalQuestions: 0, totalMarks: 0, passingMarks: 0 },
        });
      }
    },
    { timeout: 120_000, maxWait: 20_000 },
  );

  // --- Synopsis files follow their tests ----------------------------------
  // Renamed through a temporary name for the same reason the slugs were: the
  // two sets trade names and would otherwise overwrite each other.
  const dir = synopsisDir();
  const moved: string[] = [];

  async function move(from: string, to: string) {
    const source = path.join(dir, from);
    if (!(await stat(source).catch(() => null))) return;
    await rename(source, path.join(dir, to));
    moved.push(`${from} → ${to}`);
  }

  for (const test of emptiedTests) {
    if (test.synopsisFileName) {
      await move(test.synopsisFileName, test.synopsisFileName.replace(`kas-pyq-${EMPTIED.from}`, TEMP));
    }
  }
  for (const test of keptTests) {
    if (test.synopsisFileName) {
      await move(test.synopsisFileName, reslug(test.synopsisFileName, KEPT.from, KEPT.to));
    }
  }
  for (const test of emptiedTests) {
    if (test.synopsisFileName) {
      const parked = test.synopsisFileName.replace(`kas-pyq-${EMPTIED.from}`, TEMP);
      await move(parked, reslug(test.synopsisFileName, EMPTIED.from, EMPTIED.to));
    }
  }

  console.log(`  Done. ${moved.length} synopsis file(s) renamed.`);
  console.log(`  ${EMPTIED.to} is now empty and ready for its questions.`);
  console.log(`  ${KEPT.to} keeps all ${keptTests.length} of its papers.\n`);
}

main()
  .catch((error) => {
    console.error('\nFailed:\n', error?.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
