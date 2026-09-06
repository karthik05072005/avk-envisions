/**
 * Promotes the complete August 2024 Paper 1 import into the live paper.
 *
 * The paper was imported through the admin console with all 100 questions and
 * a key on every one — better than anything the analysis documents yielded, so
 * it replaces what is published rather than being merged into it.
 *
 * The live test row is kept and its questions swapped. That matters: the slug,
 * series, price, access type and every entitlement hang off that row, so
 * deleting it and publishing the import in its place would break the paper's
 * URL and detach it from the year students bought.
 *
 * Four questions carry fewer than four options — 45, 47, 51 and 66. They are
 * printed that way in the source: the supplied text of question 45 lists three
 * options and question 47 lists two. They are imported as they stand rather
 * than padded, because inventing an option changes what the paper asks.
 *
 * Earlier attempts are detached, not deleted: a question with a recorded
 * attempt has to survive so a student's old result page still resolves.
 *
 *   npm run db:2024aug:promote -- --dry-run
 */
import { PrismaClient } from '@prisma/client';

import { MARKS_PER_QUESTION, NEGATIVE_MARKS_PER_QUESTION } from '../src/lib/marking';

const db = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

const TEST_SLUG = 'kas-pyq-2024-august-paper-1';
/** The admin imports, which carry no series and are titled by their upload. */
const IMPORT_MATCH = 'Website_Import';

async function main() {
  console.log(`\nPromoting the August 2024 Paper 1 import${DRY_RUN ? ' (dry run)' : ''}...\n`);

  const live = await db.test.findFirst({
    where: { slug: TEST_SLUG, deletedAt: null },
    select: { id: true, title: true, status: true, totalQuestions: true },
  });
  if (!live) throw new Error(`No test with slug ${TEST_SLUG}.`);

  const imports = await db.test.findMany({
    where: { title: { contains: IMPORT_MATCH }, deletedAt: null },
    select: {
      id: true,
      title: true,
      _count: { select: { questions: true } },
    },
  });

  if (imports.length === 0) throw new Error('No import found to promote.');

  // Where the same paper was uploaded twice, take the fullest; on a tie the
  // most recent, since a re-upload is a correction of the one before it.
  const source = imports.sort((a, b) => b._count.questions - a._count.questions)[0]!;

  console.log(`  live paper : ${live.totalQuestions} question(s), ${live.status}`);
  for (const row of imports) {
    console.log(
      `  import     : ${String(row._count.questions).padStart(3)} question(s)  ` +
        `${row.id === source.id ? '<- promoting' : '(will be retired)'}  ${row.title.slice(0, 40)}`,
    );
  }

  const rows = await db.testQuestion.findMany({
    where: { testId: source.id },
    orderBy: { sortOrder: 'asc' },
    select: {
      questionId: true,
      sortOrder: true,
      question: {
        select: { id: true, body: true, status: true, options: { select: { isCorrect: true } } },
      },
    },
  });

  const keyed = rows.filter((r) => r.question.options.some((o) => o.isCorrect)).length;
  const fourOptions = rows.filter((r) => r.question.options.length === 4).length;
  const shortLists = rows.filter((r) => r.question.options.length !== 4);

  console.log(`\n  of the ${rows.length} being promoted:`);
  console.log(`    ${keyed} have an answer key`);
  console.log(`    ${fourOptions} have four options`);
  if (shortLists.length > 0) {
    console.log(
      `    ${shortLists.length} carry fewer, as printed: ` +
        shortLists.map((r) => `Q${r.sortOrder} (${r.question.options.length})`).join(', '),
    );
  }

  const unkeyed = rows.length - keyed;
  if (unkeyed > 0) {
    throw new Error(`${unkeyed} question(s) have no answer key. Refusing to publish an unkeyed paper.`);
  }

  if (DRY_RUN) {
    console.log('\n  Nothing written.\n');
    return;
  }

  // Detach rather than delete: an old attempt still points at these.
  await db.testQuestion.deleteMany({ where: { testId: live.id } });

  await db.testQuestion.createMany({
    data: rows.map((row, i) => ({
      testId: live.id,
      questionId: row.questionId,
      sortOrder: i + 1,
      marks: MARKS_PER_QUESTION,
      negativeMarks: NEGATIVE_MARKS_PER_QUESTION,
    })),
  });

  // A draft question is skipped when a paper is served, so anything arriving
  // from an import has to be published along with it.
  await db.question.updateMany({
    where: { id: { in: rows.map((r) => r.questionId) }, status: { not: 'PUBLISHED' } },
    data: { status: 'PUBLISHED' },
  });

  await db.test.update({
    where: { id: live.id },
    data: {
      status: 'PUBLISHED',
      totalQuestions: rows.length,
      totalMarks: rows.length * MARKS_PER_QUESTION,
      passingMarks: Math.round(rows.length * MARKS_PER_QUESTION * 0.35),
    },
  });

  // The imports have served their purpose. Soft-deleted so they leave the
  // question bank without taking their questions — which the live paper now
  // uses — with them.
  const retired = await db.test.updateMany({
    where: { id: { in: imports.map((row) => row.id) } },
    data: { deletedAt: new Date(), status: 'ARCHIVED' },
  });

  console.log(`\n  ${rows.length} question(s) now on the live paper.`);
  console.log(`  ${retired.count} import(s) retired from the question bank.\n`);
}

main()
  .catch((error) => {
    console.error('\nFailed:\n', error?.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
