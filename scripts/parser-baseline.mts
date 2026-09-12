/**
 * Measures the PYQ parser against every document we have.
 *
 * Run it before and after a parser change and diff the two outputs. Three
 * separate attempts at improving this parser have silently collapsed papers to
 * one question each, and each time the damage was only noticed later — a
 * before/after count per paper makes that impossible to miss.
 *
 *   npx tsx scripts/parser-baseline.mts > baseline.txt
 *   ...change the parser...
 *   npx tsx scripts/parser-baseline.mts > after.txt
 *   diff baseline.txt after.txt
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { extractText, getDocumentProxy } from 'unpdf';

import { parsePyqAnalysis } from '../src/server/services/pyq-analysis-parser';

const SYNOPSES = 'synopses';

async function textOf(file: string): Promise<string> {
  const buf = new Uint8Array(await readFile(path.join(SYNOPSES, file)));
  const { text } = await extractText(await getDocumentProxy(buf), { mergePages: true });
  return String(text);
}

async function main() {
  const files = (await readdir(SYNOPSES)).filter((f) => f.endsWith('.pdf')).sort();

  let totalFound = 0;
  let totalUsable = 0;
  let totalKeyed = 0;
  let totalExplained = 0;
  let optionsWithAnswerGlued = 0;

  for (const file of files) {
    let text: string;
    try {
      text = await textOf(file);
    } catch (error) {
      console.log(`${file.padEnd(42)} UNREADABLE`);
      continue;
    }

    const { questions } = parsePyqAnalysis(text);
    const usable = questions.filter((q) => q.warnings.length === 0 && q.correctIndex !== null);
    const keyed = questions.filter((q) => q.correctIndex !== null);
    const explained = questions.filter((q) => (q.explanation ?? '').length > 0);

    // The specific fault: an option whose text has swallowed the answer line
    // or the commentary that follows it.
    const glued = questions.filter((q) =>
      q.options.some((o) => /\bANSWER\b|ABOUT THE QUESTION|HOW TO SOLVE/i.test(o.text)),
    ).length;

    totalFound += questions.length;
    totalUsable += usable.length;
    totalKeyed += keyed.length;
    totalExplained += explained.length;
    optionsWithAnswerGlued += glued;

    console.log(
      `${file.padEnd(42)} found=${String(questions.length).padStart(3)}` +
        ` usable=${String(usable.length).padStart(3)}` +
        ` keyed=${String(keyed.length).padStart(3)}` +
        ` expl=${String(explained.length).padStart(3)}` +
        ` glued=${String(glued).padStart(3)}`,
    );
  }

  console.log(
    `\nTOTAL  found=${totalFound} usable=${totalUsable} keyed=${totalKeyed}` +
      ` explained=${totalExplained} glued=${optionsWithAnswerGlued}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
