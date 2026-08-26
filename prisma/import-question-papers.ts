/**
 * Replaces imported question text with the wording from the real papers.
 *
 * Questions were first recovered from the analysis documents, which paraphrase
 * and reflow. These OCR'd scans are the papers KPSC actually printed, so the
 * stem and options are taken verbatim — spacing, punctuation and line breaks
 * intact.
 *
 * Question papers carry no answer key, so the keyed answer stays as it was,
 * matched by question number. Before applying it, the option lists from the two
 * sources are compared: if they do not describe the same four choices, the
 * question is left alone and reported. Copying a key from one question onto a
 * different question would silently mark students wrong.
 *
 *   npm run db:import:papers -- --dry-run   report without writing
 *
 * Run with: npm run db:import:papers
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';
import { extractText, getDocumentProxy } from 'unpdf';

import {
  optionsAgree,
  parseQuestionPaper,
} from '../src/server/services/kas-question-paper-parser';

const db = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Drive folder → the series slug on the site.
 *
 * The folder names and the years on the site do not line up — the folder called
 * "2015" holds a paper printed as 2014 — but AVK confirmed the site labels are
 * the ones to keep, so the mapping is by folder, not by filename.
 */
const FOLDER_TO_SERIES: Record<string, string> = {
  '2012': 'kas-pyq-2011',
  '2015': 'kas-pyq-2015',
  '2017': 'kas-pyq-2017',
  '2020': 'kas-pyq-2020',
  '2024 AUGUST': 'kas-pyq-2024-august',
  '2024 DECEMBER': 'kas-pyq-2024-december',
};

/** 2011 was transcribed and verified by hand; it is not touched. */
const LEAVE_ALONE = new Set(['kas-pyq-2011']);

interface QpEntry {
  year: string;
  paper: string;
  name: string;
  path: string;
  ok: boolean;
}

async function textOf(file: string): Promise<string> {
  const { text } = await extractText(
    await getDocumentProxy(new Uint8Array(await readFile(file))),
    { mergePages: true },
  );
  return String(text);
}

async function main() {
  console.log(`\nApplying question-paper wording${DRY_RUN ? ' (dry run)' : ''}...\n`);

  const manifest: QpEntry[] = JSON.parse(await readFile('.drive/qp.json', 'utf8'));

  let updated = 0;
  let unmatched = 0;
  let unreadable = 0;

  for (const entry of manifest) {
    if (!entry.ok) continue;

    const seriesSlug = FOLDER_TO_SERIES[entry.year];
    if (!seriesSlug) {
      console.log(`  --  unknown folder "${entry.year}", skipped`);
      continue;
    }
    if (LEAVE_ALONE.has(seriesSlug)) {
      console.log(`  --  ${seriesSlug} left alone by instruction`);
      continue;
    }

    const paperNo = /paper[-\s]*2/i.test(entry.name) ? 2 : 1;
    const testSlug = `${seriesSlug}-paper-${paperNo}`;

    const test = await db.test.findFirst({
      where: { slug: testSlug, deletedAt: null },
      select: { id: true, slug: true },
    });
    if (!test) {
      console.log(`  --  ${testSlug.padEnd(30)} no such test`);
      continue;
    }

    const { questions } = parseQuestionPaper(await textOf(entry.path));
    const usable = questions.filter((q) => q.warnings.length === 0);

    if (usable.length === 0) {
      unreadable += 1;
      console.log(
        `  !!  ${testSlug.padEnd(30)} scan unreadable (${questions.length} found, 0 clean) — left as it was`,
      );
      continue;
    }

    // The questions already on this test, keyed by their number in the paper.
    const existing = await db.testQuestion.findMany({
      where: { testId: test.id },
      orderBy: { sortOrder: 'asc' },
      select: {
        question: {
          select: {
            id: true,
            code: true,
            body: true,
            options: {
              orderBy: { sortOrder: 'asc' },
              select: { id: true, body: true, isCorrect: true, sortOrder: true },
            },
          },
        },
      },
    });

    const byNumber = new Map<number, (typeof existing)[number]['question']>();
    for (const row of existing) {
      const match = /-Q(\d+)$/i.exec(row.question.code ?? '');
      if (match) byNumber.set(Number(match[1]), row.question);
    }

    let applied = 0;
    let mismatched = 0;

    for (const paperQuestion of usable) {
      const current = byNumber.get(paperQuestion.number);
      if (!current) {
        mismatched += 1;
        continue;
      }

      // Do the two sources describe the same four choices? If not, this is not
      // the same question and its answer must not be carried across.
      const agree = optionsAgree(
        paperQuestion.options.map((o) => o.text),
        current.options.map((o) => o.body),
      );

      if (!agree) {
        mismatched += 1;
        continue;
      }

      if (DRY_RUN) {
        applied += 1;
        continue;
      }

      await db.question.update({
        where: { id: current.id },
        data: { body: paperQuestion.stem },
      });

      // Options are rewritten in place, so the recorded answer stays on the
      // choice it was keyed to — the order is confirmed identical above.
      for (const [index, option] of current.options.entries()) {
        const replacement = paperQuestion.options[index];
        if (!replacement) continue;
        await db.questionOption.update({
          where: { id: option.id },
          data: { body: replacement.text },
        });
      }

      applied += 1;
    }

    updated += applied;
    unmatched += mismatched;

    console.log(
      `  ok  ${testSlug.padEnd(30)} ${applied} rewritten from the paper` +
        (mismatched > 0 ? `, ${mismatched} left alone (no confident match)` : ''),
    );
  }

  console.log(
    `\n  ${updated} questions now carry the paper's exact wording.` +
      `\n  ${unmatched} left on their previous text — the two sources did not agree.` +
      `\n  ${unreadable} scans had no usable text layer.\n`,
  );
}

main()
  .catch((error) => {
    console.error('\nFailed:\n', error?.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
