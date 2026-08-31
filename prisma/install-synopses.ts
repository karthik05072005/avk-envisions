/**
 * Installs the question-wise analysis PDFs and registers them against the tests
 * they analyse.
 *
 * The documents live in a shared Google Drive folder and total roughly 270 MB,
 * so they are downloaded here rather than committed. They are written into the
 * synopsis directory — which sits beside the database, outside the web root —
 * and only ever reach a student through the access-checked streaming route.
 *
 * Safe to re-run. A file already present with a sensible size is left alone, so
 * a second run costs nothing and a partial run can simply be repeated.
 *
 *   npm run db:synopses            install everything that is missing
 *   npm run db:synopses -- --force re-download even if present
 *
 * Run with: npm run db:synopses
 */
import { execFile } from 'node:child_process';
import { copyFile, mkdir, readFile, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { PrismaClient } from '@prisma/client';

import { PYQ_SYNOPSES } from './data/pyq-synopses';
import { synopsisDir } from '../src/server/services/synopsis-service';

const run = promisify(execFile);
const db = new PrismaClient();

const FORCE = process.argv.includes('--force');

/** Series-level documents, used when a test has none of its own. */
const SERIES_ASSETS: { seriesSlug: string; asset: string }[] = [
  // Empty: 2011's series-level document is set by `db:import:2011` from the
  // refreshed papers.
];

/** A Drive file is a real PDF only if it starts with the PDF magic bytes. */
async function isPdf(file: string): Promise<boolean> {
  try {
    const handle = await readFile(file);
    return handle.subarray(0, 5).toString('latin1') === '%PDF-';
  } catch {
    return false;
  }
}

/**
 * Downloads one Drive file.
 *
 * A folder that has been un-shared returns an HTML sign-in page with a 200, so
 * the result is checked for PDF magic bytes rather than trusted — otherwise the
 * database would end up pointing at a login page saved as a .pdf.
 */
async function downloadFromDrive(fileId: string, dest: string): Promise<boolean> {
  await run('curl', [
    '-sL',
    '--max-time',
    '180',
    `https://drive.google.com/uc?export=download&id=${fileId}`,
    '-o',
    dest,
  ]);

  if (await isPdf(dest)) return true;

  await unlink(dest).catch(() => {});
  return false;
}

async function main() {
  const dir = synopsisDir();
  await mkdir(dir, { recursive: true });
  console.log(`\nInstalling analysis documents into ${dir}\n`);

  let installed = 0;
  let skipped = 0;
  const failures: string[] = [];

  // --- Per-test documents --------------------------------------------------
  for (const entry of PYQ_SYNOPSES) {
    // 2011 is owned by `db:import:2011`, which installs the refreshed
    // documents. Re-installing the previous archive's copies here would show a
    // student an analysis of a paper that is no longer the one they sat.
    if (entry.testSlug.startsWith('kas-pyq-2011')) continue;

    const test = await db.test.findFirst({
      where: { slug: entry.testSlug, deletedAt: null },
      select: { id: true, title: true },
    });

    if (!test) {
      failures.push(`${entry.testSlug} — no such test (run the catalogue seed first)`);
      continue;
    }

    const fileName = `${entry.testSlug}.pdf`;
    const dest = path.join(dir, fileName);

    const existing = await stat(dest).catch(() => null);
    if (existing && existing.size > 1000 && !FORCE) {
      // Still re-point the row: the file may be in place from an earlier run
      // while the database has since been reset.
      await db.test.update({ where: { id: test.id }, data: { synopsisFileName: fileName } });
      skipped += 1;
      continue;
    }

    if (!(await downloadFromDrive(entry.driveFileId, dest))) {
      failures.push(`${entry.testSlug} — download failed or was not a PDF (${entry.source})`);
      continue;
    }

    const size = (await stat(dest)).size;
    await db.test.update({ where: { id: test.id }, data: { synopsisFileName: fileName } });
    console.log(`  ok  ${entry.testSlug.padEnd(44)} ${(size / 1024 / 1024).toFixed(1)} MB`);
    installed += 1;
  }

  // --- Series-level fallbacks ----------------------------------------------
  for (const entry of SERIES_ASSETS) {
    const series = await db.testSeries.findFirst({
      where: { slug: entry.seriesSlug, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!series) continue;

    const source = path.resolve('prisma/assets', entry.asset);
    if (!(await stat(source).catch(() => null))) continue;

    await copyFile(source, path.join(dir, entry.asset));
    await db.testSeries.update({
      where: { id: series.id },
      data: { synopsisFileName: entry.asset },
    });
    console.log(`  ok  ${series.name} (series-level fallback)`);
  }

  console.log(
    `\n${installed} downloaded, ${skipped} already present, ${failures.length} failed.`,
  );

  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  !!  ${f}`);
    console.log(
      '\nIf every download failed, the Drive folder is probably no longer shared publicly.',
    );
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error('\nInstall failed:\n', error?.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
