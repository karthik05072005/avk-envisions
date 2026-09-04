/**
 * Puts the line breaks back into question text.
 *
 * The parser joined every line of a question into one paragraph, so a
 * statement-and-codes question arrived as an unbroken wall:
 *
 *   Read the following statements : STATEMENTS a. Most Asokan inscriptions
 *   were in Prakrit b. Most Prakrit inscriptions were in Brahmi c. However...
 *
 * The exam screen already renders newlines (`whitespace-pre-line`); there were
 * simply none in the stored text. Reading that on a phone, under time pressure,
 * is materially harder than reading the printed paper — and it was being fixed
 * by hand, one question at a time, across a catalogue of more than a thousand.
 *
 * Only whitespace changes. No word is added, removed or reordered: the break is
 * inserted at labels the paper itself printed on their own lines. Anything that
 * would alter the wording is left alone for a human.
 *
 *   npm run db:reformat -- --dry-run
 *
 * Run with: npm run db:reformat
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Section labels the papers print on their own line.
 *
 * Matched only when followed by more text, so a body ending in the word
 * "STATEMENTS" is untouched.
 */
/**
 * Uppercase only, deliberately.
 *
 * A case-insensitive match also hits the word in an ordinary sentence — "Read
 * the following statements :" — which both swallowed the word and emitted the
 * heading twice. The papers print these labels in capitals precisely because
 * they are headings, so requiring capitals is what distinguishes the two.
 */
const SECTION = /\s+(STATEMENTS?|CONCLUSIONS?|ASSERTIONS?|CODES?|REASON|LIST\s+I{1,3}|LIST\s+IV)\s*[:.]?\s+/g;

/**
 * An item label: "a." / "(b)" / "1." mid-sentence.
 *
 * Requires whitespace before and after, and a capital or digit following, so
 * "e.g." and decimals like "3.5" are not split. Single letters only — matching
 * longer runs would break ordinary abbreviations.
 */
const ITEM = /\s+(\(?[a-dA-D1-9]\)?[.)])\s+(?=[A-Z0-9“"'(])/g;

function reformat(body: string): string {
  let out = body.replace(SECTION, (_m, label: string) => `\n${label.toUpperCase()}\n`);
  out = out.replace(ITEM, (_m, label: string) => `\n${label} `);

  return out
    .split('\n')
    .map((line) => line.trim())
    .filter((line, index, all) => line !== '' || (index > 0 && all[index - 1] !== ''))
    .join('\n')
    .trim();
}

async function main() {
  console.log(`\nReformatting question text${DRY_RUN ? ' (dry run)' : ''}...\n`);

  const questions = await db.question.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true, body: true },
  });

  let changed = 0;
  const samples: string[] = [];

  for (const question of questions) {
    const next = reformat(question.body);
    if (next === question.body) continue;

    // A reformat that changes anything but whitespace is a bug in the rules
    // above, not a formatting improvement. Skip it rather than rewrite a
    // student's question.
    const before = question.body.replace(/\s+/g, '');
    const after = next.replace(/\s+/g, '');
    if (before !== after) {
      console.log(`  !!  ${question.code}: skipped, text would change`);
      continue;
    }

    changed += 1;
    if (samples.length < 3) samples.push(`${question.code}\n${next}\n`);
    if (!DRY_RUN) {
      await db.question.update({ where: { id: question.id }, data: { body: next } });
    }
  }

  for (const sample of samples) console.log(`  ---\n${sample}`);
  console.log(`  ${changed} of ${questions.length} question(s) ${DRY_RUN ? 'would be ' : ''}reformatted.\n`);
}

main()
  .catch((error) => {
    console.error('\nFailed:\n', error?.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
