/**
 * Cross-checks every analysis document against the year the site advertises.
 *
 * The Drive folder names and the cover headings inside the PDFs disagree for
 * some years. Whichever is wrong, a student would be practising a paper
 * labelled with a year that is not its own, so this prints both side by side
 * rather than picking one.
 *
 * Run with: node scripts/audit-synopsis-years.mjs
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';
import { extractText, getDocumentProxy } from 'unpdf';

const db = new PrismaClient();

function synopsisDir() {
  const url = process.env.DATABASE_URL ?? '';
  if (url.startsWith('file:')) return path.join(path.dirname(url.slice('file:'.length)), 'synopses');
  return path.resolve('storage/synopses');
}

const series = await db.testSeries.findMany({
  where: { track: 'PYQ', deletedAt: null },
  orderBy: { examYear: 'asc' },
  select: {
    examYear: true, sessionLabel: true,
    tests: {
      where: { synopsisFileName: { not: null }, deletedAt: null, paperNumber: { not: null } },
      orderBy: { paperNumber: 'asc' },
      select: { slug: true, synopsisFileName: true },
    },
  },
});

console.log('\nSite year   Paper   Document heading                                    Match');
console.log('-'.repeat(88));

let agree = 0, disagree = 0, missing = 0;

for (const s of series) {
  for (const t of s.tests) {
    const file = path.join(synopsisDir(), t.synopsisFileName);
    let heading = '(unreadable)', claimed = null;
    try {
      const pdf = await getDocumentProxy(new Uint8Array(await readFile(file)));
      const { text } = await extractText(pdf, { mergePages: true });
      const head = String(text).slice(0, 3000);
      heading = head.split(/\s{2,}|\n/).map((l) => l.trim())
        .find((l) => /KAS\s*PRELIMS/i.test(l)) ?? '(no heading)';
      const m = heading.match(/\b(20\d{2})\b/);
      claimed = m ? m[1] : null;
    } catch { missing += 1; }

    const label = `${s.examYear}${s.sessionLabel ? ' ' + s.sessionLabel : ''}`;
    const paper = t.slug.endsWith('-paper-1') ? 'I' : 'II';
    const ok = claimed === String(s.examYear);
    if (claimed) ok ? agree++ : disagree++;
    console.log(`${label.padEnd(12)}${paper.padEnd(8)}${heading.slice(0, 50).padEnd(52)}${ok ? 'yes' : 'NO'}`);
  }
}

console.log('-'.repeat(88));
console.log(`${agree} agree, ${disagree} disagree, ${missing} unreadable\n`);
await db.$disconnect();
