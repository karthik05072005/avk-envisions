/**
 * Installs the question-wise analysis PDFs and registers them against their
 * papers.
 *
 * Copies each document from `prisma/assets` into the synopsis directory — which
 * lives beside the database, outside the web root — and records the file name
 * on the series. Safe to re-run: it overwrites the copy and re-points the row.
 *
 * Run with: npm run db:synopses
 */
import { copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';

import { synopsisDir } from '../src/server/services/synopsis-service';

const db = new PrismaClient();

/** Series slug → the PDF in `prisma/assets` that analyses it. */
const SYNOPSES: { seriesSlug: string; asset: string }[] = [
  { seriesSlug: 'kas-pyq-2011', asset: 'kas-2011-paper1-analysis.pdf' },
];

async function main() {
  const dir = synopsisDir();
  await mkdir(dir, { recursive: true });
  console.log(`\nInstalling analysis documents into ${dir}\n`);

  let installed = 0;

  for (const entry of SYNOPSES) {
    const source = path.resolve('prisma/assets', entry.asset);

    try {
      await stat(source);
    } catch {
      console.log(`  !!  ${entry.asset} is missing from prisma/assets — skipped`);
      continue;
    }

    const series = await db.testSeries.findFirst({
      where: { slug: entry.seriesSlug, deletedAt: null },
      select: { id: true, name: true },
    });

    if (!series) {
      console.log(`  !!  series "${entry.seriesSlug}" does not exist — run the catalogue seed first`);
      continue;
    }

    await copyFile(source, path.join(dir, entry.asset));
    await db.testSeries.update({
      where: { id: series.id },
      data: { synopsisFileName: entry.asset },
    });

    const size = (await stat(source)).size;
    console.log(`  ok  ${series.name} → ${entry.asset} (${(size / 1024 / 1024).toFixed(1)} MB)`);
    installed += 1;
  }

  console.log(`\nDone. ${installed} document(s) installed.\n`);
}

main()
  .catch((error) => {
    console.error('\nInstall failed:\n', error?.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
