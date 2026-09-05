/**
 * Finds questions that are in the bank but on no test.
 *
 * Creating a question from inside a paper used to put it in the bank and
 * nowhere else — the paper's count never moved, so the question looked as
 * though it had been discarded. It had not been; it was simply unattached.
 * This lists those, newest first, so they can be put where they belong.
 *
 * Attaching is deliberately a separate, explicit step: only a person knows
 * which paper a loose question was meant for, and guessing would put someone's
 * question on the wrong paper.
 *
 *   npm run db:orphans                       list them
 *   npm run db:orphans -- --attach <testId>  attach every listed question
 *   npm run db:orphans -- --since 2026-09-01 only ones created on or after
 *
 * Run with: npm run db:orphans
 */
import { PrismaClient } from '@prisma/client';

import { MARKS_PER_QUESTION, NEGATIVE_MARKS_PER_QUESTION } from '../src/lib/marking';

const db = new PrismaClient();

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const since = flag('--since');
  const attachTo = flag('--attach');

  const createdAt = since ? { gte: new Date(`${since}T00:00:00`) } : undefined;

  const orphans = await db.question.findMany({
    where: { deletedAt: null, testQuestions: { none: {} }, ...(createdAt ? { createdAt } : {}) },
    select: {
      id: true,
      code: true,
      body: true,
      status: true,
      createdAt: true,
      subject: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`\n${orphans.length} question(s) are on no test${since ? ` since ${since}` : ''}.\n`);

  for (const q of orphans.slice(0, 40)) {
    console.log(
      `  ${q.code.padEnd(26)} ${q.createdAt.toISOString().slice(0, 16)}  ${q.status.padEnd(9)} ` +
        `${(q.subject?.name ?? '—').padEnd(18)} ${q.body.replace(/\s+/g, ' ').slice(0, 52)}`,
    );
  }
  if (orphans.length > 40) console.log(`  … and ${orphans.length - 40} more`);

  if (!attachTo) {
    console.log(
      '\n  To attach these to a paper:' +
        '\n    npm run db:orphans -- --attach <testId>' +
        '\n  The testId is in the admin URL: /admin/questions?testId=…\n',
    );
    return;
  }

  const test = await db.test.findFirst({
    where: { id: attachTo, deletedAt: null },
    select: { id: true, title: true },
  });
  if (!test) throw new Error(`No test with id ${attachTo}.`);

  const last = await db.testQuestion.aggregate({
    where: { testId: test.id },
    _max: { sortOrder: true },
  });
  let sortOrder = (last._max.sortOrder ?? 0) + 1;

  for (const q of orphans) {
    await db.testQuestion.create({
      data: {
        testId: test.id,
        questionId: q.id,
        sortOrder: sortOrder++,
        marks: MARKS_PER_QUESTION,
        negativeMarks: NEGATIVE_MARKS_PER_QUESTION,
      },
    });
  }

  // Recomputed rather than incremented, so a count that has already drifted is
  // corrected instead of carried forward.
  const totals = await db.testQuestion.aggregate({
    where: { testId: test.id },
    _count: true,
    _sum: { marks: true },
  });
  await db.test.update({
    where: { id: test.id },
    data: { totalQuestions: totals._count, totalMarks: totals._sum.marks ?? 0 },
  });

  console.log(
    `\n  ${orphans.length} attached to "${test.title}", now ${totals._count} questions.\n`,
  );
}

main()
  .catch((error) => {
    console.error('\nFailed:\n', error?.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
