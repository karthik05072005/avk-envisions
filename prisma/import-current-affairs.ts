/**
 * Replaces the Current Affairs drills for 2017, 2020, 2024 August and
 * 2024 December.
 *
 * Each of those four papers is emptied and refilled from its year's own
 * Current Affairs document. 2011 and 2015 are deliberately not touched.
 *
 * Two of the four source PDFs — 2020 and 2024 December — hold their questions
 * as images rather than text, so they were put through Tesseract first. The
 * questions are committed as JSON rather than read from the PDFs here: the
 * source documents live in .drive, which is not committed, and the server has
 * no OCR installed. prisma/data/current-affairs-pyqs.json is exactly what the
 * parsers produced, reviewed before it was written.
 *
 * Only questions whose answer the document actually keys are imported. Where
 * the key could not be read it is left out rather than guessed: an early draft
 * of the OCR parser keyed "Who directs the NSF?" to the wrong name because a
 * "(3)" had scanned as "(4)", and a wrongly keyed question marks a student
 * down for being right.
 *
 *   npx tsx prisma/import-current-affairs.ts --dry-run
 *
 * Safe to re-run: questions carry a deterministic code, so a second run
 * refreshes them rather than duplicating.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';

import { MARKS_PER_QUESTION, NEGATIVE_MARKS_PER_QUESTION } from '../src/lib/marking';

const db = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

interface ExportedPaper {
  slug: string;
  source: string;
  /** 'text' where the PDF was readable, 'ocr' where it had to be scanned. */
  method: 'text' | 'ocr';
  questions: {
    number: number;
    body: string;
    explanation: string | null;
    options: string[];
    correctIndex: number;
  }[];
}

async function load(): Promise<ExportedPaper[]> {
  const file = path.join(__dirname, 'data', 'current-affairs-pyqs.json');
  return JSON.parse(await readFile(file, 'utf8')) as ExportedPaper[];
}

async function main() {
  console.log(`\nImporting Current Affairs PYQs${DRY_RUN ? ' (dry run)' : ''}\n`);

  const admin = await db.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
  if (!admin) throw new Error('No admin account. Run the base seed first.');

  for (const paper of await load()) {
    const test = await db.test.findFirst({
      where: { slug: paper.slug, deletedAt: null },
      select: { id: true, examId: true, subjectId: true, totalQuestions: true },
    });

    if (!test) {
      console.log(`  --  ${paper.slug}  not found`);
      continue;
    }

    // A subject drill without a subject would file its questions nowhere, and
    // the drill is cut by subject — so this is a broken paper, not a question
    // to guess at.
    if (!test.subjectId) {
      console.log(`  --  ${paper.slug}  has no subject set; skipped`);
      continue;
    }
    const subjectId = test.subjectId;

    console.log(
      `  ${DRY_RUN ? 'would import' : 'imported   '} ${String(test.totalQuestions).padStart(3)} -> ${String(paper.questions.length).padStart(3)}  ` +
        `${paper.slug}  (${paper.method})`,
    );

    if (DRY_RUN) continue;

    const questionIds: string[] = [];

    for (const q of paper.questions) {
      const code = `${paper.slug}-q${q.number}`.toUpperCase();

      const data = {
        examId: test.examId,
        subjectId,
        type: 'SINGLE_CORRECT' as const,
        status: 'PUBLISHED' as const,
        difficulty: 'MEDIUM' as const,
        body: q.body,
        explanation: q.explanation,
        marks: MARKS_PER_QUESTION,
        negativeMarks: NEGATIVE_MARKS_PER_QUESTION,
        createdById: admin.id,
      };

      const existing = await db.question.findUnique({ where: { code }, select: { id: true } });

      let questionId: string;
      if (existing) {
        await db.question.update({ where: { id: existing.id }, data });
        // Replaced wholesale rather than edited: editing in place would leave
        // a stale option behind whenever a document is revised.
        await db.questionOption.deleteMany({ where: { questionId: existing.id } });
        questionId = existing.id;
      } else {
        const made = await db.question.create({ data: { ...data, code }, select: { id: true } });
        questionId = made.id;
      }

      await db.questionOption.createMany({
        data: q.options.map((body, index) => ({
          questionId,
          label: String.fromCharCode(65 + index),
          body,
          isCorrect: index === q.correctIndex,
          sortOrder: index,
        })),
      });

      questionIds.push(questionId);
    }

    // Detach what was there, then attach this year's questions. Detaching
    // leaves the old questions in the bank rather than destroying them.
    await db.testQuestion.deleteMany({ where: { testId: test.id } });
    await db.testQuestion.createMany({
      data: questionIds.map((questionId, index) => ({
        testId: test.id,
        questionId,
        sortOrder: index + 1,
        marks: MARKS_PER_QUESTION,
        negativeMarks: NEGATIVE_MARKS_PER_QUESTION,
      })),
    });

    await db.test.update({
      where: { id: test.id },
      data: {
        totalQuestions: questionIds.length,
        totalMarks: questionIds.length * MARKS_PER_QUESTION,
      },
    });
  }

  console.log('\n  2011 and 2015 were not touched.\n');
}

main()
  .catch((error) => {
    console.error('\nFailed:\n', error?.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
