/**
 * Measures the ADMIN IMPORT parser against every document we have.
 *
 * Note this is a different parser from the one scripts/parser-baseline.mts
 * covers: `question-parser.ts` serves /admin/import, while
 * `pyq-analysis-parser.ts` serves the PYQ scripts. A fix to one does nothing
 * for the other, which is exactly the trap that let a correctly formatted
 * client document import 4 questions out of 101.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { extractText, getDocumentProxy } from 'unpdf';
import { parseQuestionPaper } from '../src/server/services/question-parser';

async function main() {
  const dirs = ['synopses'];
  let found = 0, keyed = 0, explained = 0;

  for (const dir of dirs) {
    const files = (await readdir(dir)).filter((f) => f.endsWith('.pdf')).sort();
    for (const file of files) {
      let text: string;
      try {
        const bytes = new Uint8Array(await readFile(path.join(dir, file)));
        text = String((await extractText(await getDocumentProxy(bytes), { mergePages: true })).text);
      } catch {
        console.log(`${file.padEnd(46)} UNREADABLE`);
        continue;
      }
      const r = parseQuestionPaper(text);
      const k = r.questions.filter((q) => q.correctIndex !== null).length;
      const e = r.questions.filter((q) => (q.explanation ?? '').length > 0).length;
      found += r.questions.length; keyed += k; explained += e;
      console.log(
        `${file.padEnd(46)} found=${String(r.questions.length).padStart(3)} keyed=${String(k).padStart(3)} expl=${String(e).padStart(3)}`,
      );
    }
  }
  console.log(`\nTOTAL  found=${found} keyed=${keyed} explained=${explained}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
