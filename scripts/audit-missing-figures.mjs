/**
 * Lists questions whose wording depends on a figure that is not attached.
 *
 * A question saying "the following figure shows" with no image is unanswerable,
 * and it fails silently — the student sees a complete-looking question and
 * cannot work out why none of the options fit. This finds them so they can be
 * fixed at source rather than discovered by whoever sits the paper.
 *
 * Run with: node scripts/audit-missing-figures.mjs
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

/** Wording that only makes sense with something to look at. */
const NEEDS_FIGURE =
  /\b(following figure|figure (?:above|below|shown)|pie (?:chart|diagram)|the diagram|following diagram|given map|following map|bar (?:chart|graph)|the graph)\b/i;

const rows = await db.question.findMany({
  where: { deletedAt: null },
  select: {
    code: true,
    body: true,
    imageUrl: true,
    testQuestions: { select: { test: { select: { slug: true } } }, take: 1 },
  },
});

const affected = rows.filter((q) => NEEDS_FIGURE.test(q.body) && !q.imageUrl);

console.log(`\n${affected.length} question(s) refer to a figure but have no image attached\n`);
for (const q of affected) {
  const test = q.testQuestions[0]?.test.slug ?? 'unattached';
  console.log(`  ${(q.code ?? '?').padEnd(30)} ${test.padEnd(26)} ${q.body.replace(/\s+/g, ' ').slice(0, 60)}`);
}

if (affected.length > 0) {
  console.log(
    '\nThese cannot be answered as printed. Supply the figure through the admin' +
      '\nimporter, or withdraw the question.\n',
  );
}

await db.$disconnect();
