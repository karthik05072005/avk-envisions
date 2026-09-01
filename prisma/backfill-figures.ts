/**
 * Attaches the figures already-published questions are missing.
 *
 * Questions were imported by reading text only, so every map, diagram and chart
 * was dropped. That fails silently: "identify the currents indicated on the
 * given world map" reaches the student with no map, four plausible options and
 * no way to tell why none of them fit.
 *
 * Reads each source document again, matches figures to questions by the number
 * printed beside them, and fills in `imageUrl`. Existing images are left alone,
 * so a figure corrected by hand in the admin panel is not overwritten.
 *
 *   npm run db:figures -- --dry-run
 *
 * Run with: npm run db:figures
 */
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';

import { KAS_2011_SOURCES } from './data/kas-2011-sources';
import { KAS_QUESTION_PAPERS } from './data/kas-question-papers';
import { storeFigure } from '../src/server/services/figure-storage';
import { extractFigures } from '../src/server/services/pdf-figures';
import { synopsisDir } from '../src/server/services/synopsis-service';

const db = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

/** Drive folder → series slug, matching the question-paper importer. */
const FOLDER_TO_SERIES: Record<string, string> = {
  '2012': 'kas-pyq-2011',
  '2015': 'kas-pyq-2015',
  '2017': 'kas-pyq-2017',
  '2020': 'kas-pyq-2020',
  '2024 AUGUST': 'kas-pyq-2024-august',
  '2024 DECEMBER': 'kas-pyq-2024-december',
};

interface Source {
  file: string;
  testSlug: string;
}

/** Every cached document, paired with the test its figures belong to. */
async function sources(): Promise<Source[]> {
  const found: Source[] = [];
  const base = path.dirname(synopsisDir());

  // The refreshed 2011 papers.
  for (const entry of KAS_2011_SOURCES) {
    if (entry.subject !== null) continue; // subject splits duplicate the complete paper
    const file = path.join(base, 'kas-2011', entry.name);
    if (await stat(file).catch(() => null)) {
      found.push({ file, testSlug: `kas-pyq-2011-paper-${entry.paperNumber}` });
    }
  }

  // The OCR'd question papers.
  for (const entry of KAS_QUESTION_PAPERS) {
    const series = FOLDER_TO_SERIES[entry.folder];
    if (!series || series === 'kas-pyq-2011') continue; // 2011 handled above
    const paperNo = /paper[-\s]*2/i.test(entry.name) ? 2 : 1;
    const file = path.join(base, 'question-papers', entry.name);
    if (await stat(file).catch(() => null)) {
      found.push({ file, testSlug: `${series}-paper-${paperNo}` });
    }
  }

  return found;
}

async function main() {
  console.log(`\nAttaching missing figures${DRY_RUN ? ' (dry run)' : ''}...\n`);

  const list = await sources();
  if (list.length === 0) {
    console.log('  No source documents are cached. Run the import scripts first.\n');
    return;
  }

  let attached = 0;
  let alreadyHad = 0;
  let unmatched = 0;

  for (const source of list) {
    const test = await db.test.findFirst({
      where: { slug: source.testSlug, deletedAt: null },
      select: { id: true },
    });
    if (!test) continue;

    const { figures, warnings } = await extractFigures(await readFile(source.file));
    const placed = figures.filter((f) => f.questionNumber !== null);

    if (placed.length === 0) {
      console.log(`  --  ${source.testSlug.padEnd(30)} no placeable figures`);
      for (const w of warnings.slice(0, 2)) console.log(`        ${w}`);
      continue;
    }

    let here = 0;
    for (const figure of placed) {
      const code = `${source.testSlug}-Q${figure.questionNumber}`.toUpperCase();
      const question = await db.question.findUnique({
        where: { code },
        select: { id: true, imageUrl: true },
      });

      if (!question) {
        unmatched += 1;
        continue;
      }
      if (question.imageUrl) {
        alreadyHad += 1;
        continue;
      }
      if (DRY_RUN) {
        here += 1;
        continue;
      }

      const url = await storeFigure(figure.data);
      await db.question.update({ where: { id: question.id }, data: { imageUrl: url } });
      here += 1;
    }

    attached += here;
    console.log(
      `  ok  ${source.testSlug.padEnd(30)} ${here} figure(s)${DRY_RUN ? ' would be' : ''} attached` +
        ` (${placed.length} placed, ${figures.length - placed.length} unplaced)`,
    );
  }

  console.log(
    `\n  ${attached} figure(s) ${DRY_RUN ? 'would be ' : ''}attached.` +
      `\n  ${alreadyHad} question(s) already had one.` +
      `\n  ${unmatched} figure(s) had no matching question.\n`,
  );
}

main()
  .catch((error) => {
    console.error('\nFailed:\n', error?.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
