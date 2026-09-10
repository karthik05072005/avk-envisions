/**
 * Trims Free Test 2 back to the 25 questions the series advertises.
 *
 * The paper picked up a 26th question during hand-editing, so the schedule
 * said "26 questions" against a series header promising 25. Rather than guess
 * which one is surplus, this removes the LAST by sort order — a question
 * appended past the intended 25 — and only ever detaches it from the paper.
 * The question itself stays in the bank, so nothing is lost if the wrong one
 * goes and it can simply be re-attached.
 *
 *   npx tsx prisma/trim-free-test-2.ts --dry-run
 *
 * Safe to re-run: a paper already at 25 or fewer is left alone.
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');
const TARGET = 25;

async function main() {
  const test = await db.test.findFirst({
    where: { deletedAt: null, slug: 'kas-free-2' },
    select: { id: true, slug: true, title: true, totalQuestions: true },
  });

  if (!test) {
    console.log('  kas-free-2 not found; nothing to do.');
    return;
  }

  // Only questions a student would actually be served: an unpublished or
  // soft-deleted question is skipped when the paper is rendered, so counting
  // rows blindly would trim a paper that is already short in practice.
  const rows = await db.testQuestion.findMany({
    where: { testId: test.id, question: { deletedAt: null, status: 'PUBLISHED' } },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, sortOrder: true, question: { select: { code: true, body: true } } },
  });

  console.log(`\n  ${test.title}  [${test.slug}]`);
  console.log(`  stored total: ${test.totalQuestions}   live attached: ${rows.length}\n`);

  for (const [i, r] of rows.entries()) {
    console.log(
      `    ${String(i + 1).padStart(2)}  ${(r.question.code ?? '-').padEnd(16)} ${r.question.body.replace(/\s+/g, ' ').slice(0, 58)}`,
    );
  }

  if (rows.length <= TARGET) {
    console.log(`\n  Already ${rows.length} (target ${TARGET}); leaving it alone.`);
    // The displayed count comes from totalQuestions, which can drift from the
    // rows after hand-editing. Correct it even when no trimming is needed.
    if (test.totalQuestions !== rows.length && !DRY_RUN) {
      await db.test.update({ where: { id: test.id }, data: { totalQuestions: rows.length } });
      console.log(`  Corrected totalQuestions ${test.totalQuestions} -> ${rows.length}.`);
    }
    return;
  }

  const surplus = rows.slice(TARGET);
  console.log(`\n  ${surplus.length} past the target of ${TARGET}:`);
  for (const r of surplus) {
    console.log(`    ${DRY_RUN ? 'would detach' : 'detached'}  ${r.question.code ?? '-'}  ${r.question.body.replace(/\s+/g, ' ').slice(0, 50)}`);
  }

  if (!DRY_RUN) {
    // Detach only. The question stays in the bank.
    await db.testQuestion.deleteMany({ where: { id: { in: surplus.map((r) => r.id) } } });
    await db.test.update({ where: { id: test.id }, data: { totalQuestions: TARGET } });
    console.log(`\n  ${test.slug} is now ${TARGET} questions.`);
  }
}

main()
  .catch((error) => {
    console.error('\nFailed:\n', error?.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
