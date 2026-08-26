/**
 * Reads the English half of a KPSC KAS question paper.
 *
 * These are OCR'd scans of the real bilingual papers, so the text carries both
 * languages. The Kannada is set in a legacy font rather than Unicode, which
 * means it survives extraction as high Latin-1 mojibake — `±ÜÅÍæ°` and the
 * like — instead of Kannada codepoints. That makes the two easy to tell apart:
 * an English line is almost entirely ASCII, a Kannada line is almost entirely
 * not.
 *
 * The point of using these rather than the analysis documents is fidelity. The
 * question that reaches a student should be the question KPSC printed, down to
 * the spacing before a question mark and the line each statement sits on. So
 * the stem keeps its line breaks; nothing is reflowed into a paragraph.
 *
 * No answers here — question papers do not carry a key. The caller pairs these
 * with the analysis documents for that.
 */

export interface PaperOption {
  /** '1'–'4' as printed. */
  marker: string;
  /** Option text, joined across wrapped lines. */
  text: string;
}

export interface PaperQuestion {
  number: number;
  /** The stem, with its original line breaks kept. */
  stem: string;
  options: PaperOption[];
  warnings: string[];
}

export interface PaperParseResult {
  questions: PaperQuestion[];
  warnings: string[];
}

/**
 * A line counts as English when nearly all of it is ASCII.
 *
 * The threshold is high on purpose. A Kannada line rendered through the legacy
 * font is dense in accented Latin-1, so the two populations separate sharply;
 * anything in between is usually a heading with a stray glyph, and excluding it
 * costs nothing.
 */
function isEnglish(line: string): boolean {
  const text = line.trim();
  if (text === '') return false;

  const ascii = [...text].filter((ch) => ch.charCodeAt(0) < 128).length;
  if (ascii / text.length < 0.9) return false;

  // Must carry actual words, not just digits and punctuation.
  return /[A-Za-z]{2,}/.test(text);
}

/** Page furniture and the instruction block that precedes the questions. */
const FURNITURE = [
  /^Note\s*:/i,
  /^Space for rough work/i,
  /^\d{1,3}$/,
  /^[A-D]$/,
  /^SL\b/i,
  /^Question Booklet/i,
  /^Maximum\b/i,
  /^Time allowed/i,
  /^Serial No/i,
];

/** `1.` at the start of a line — a question number. */
const QUESTION = /^(\d{1,3})\.\s*(.*)$/;

/** `(1) text` — an answer option. */
const OPTION = /^\((\d)\)\s*(.*)$/;

export function parseQuestionPaper(raw: string): PaperParseResult {
  const warnings: string[] = [];

  const english = raw
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => isEnglish(l))
    .filter((l) => !FURNITURE.some((re) => re.test(l.trim())));

  if (english.length === 0) {
    warnings.push('No English text found. The scan may have no text layer.');
    return { questions: [], warnings };
  }

  // --- Split into questions -------------------------------------------------
  //
  // A number only opens a question when it is the next one expected and the
  // previous question already has its fourth option. Without that, the "4." in
  // a statement list, or a year inside a stem, would start a new block.
  const blocks: { number: number; lines: string[] }[] = [];
  let current: { number: number; lines: string[] } | null = null;
  let expected = 1;
  let optionsSeen = 0;

  for (const line of english) {
    const trimmed = line.trim();
    const question = QUESTION.exec(trimmed);

    // Next in sequence is enough. Requiring the previous question to have found
    // all four options first meant one mangled option list stalled the sequence
    // and swallowed every question after it. KPSC sets sub-statements as "A." to
    // "D." and options as "(1)" to "(4)", so a bare "12." at the start of a line
    // is reliably a question number.
    // The first question sets the starting number rather than being assumed to
    // be 1. If question 1's line is damaged in the scan, insisting on 1 loses
    // the entire paper; allowing a low start loses only the damaged question.
    const number = question ? Number(question[1]) : 0;
    const opens = question && (current === null ? number >= 1 && number <= 5 : number === expected);

    if (opens && question) {
      if (current) blocks.push(current);
      current = { number, lines: question[2] ? [question[2]] : [] };
      expected = number + 1;
      optionsSeen = 0;
      continue;
    }

    if (OPTION.test(trimmed)) optionsSeen += 1;
    if (current) current.lines.push(trimmed);
  }
  if (current) blocks.push(current);

  if (blocks.length === 0) {
    warnings.push('No numbered questions found.');
    return { questions: [], warnings };
  }

  // --- Read each question ---------------------------------------------------
  const questions = blocks.map((block) => {
    const local: string[] = [];
    const stemLines: string[] = [];
    const options: PaperOption[] = [];

    for (const line of block.lines) {
      const option = OPTION.exec(line);

      if (option) {
        const marker = option[1] ?? '';
        // Options must arrive in order. A "(2)" quoted inside a stem does not
        // open the list, and a repeat is a continuation rather than a new one.
        if (Number(marker) === options.length + 1) {
          options.push({ marker, text: (option[2] ?? '').trim() });
          continue;
        }
      }

      if (options.length > 0) {
        // A wrapped option line. Joined with a space: the break is where the
        // column ended, not something the paper intended.
        const last = options[options.length - 1];
        if (last) last.text = `${last.text} ${line}`.trim();
        continue;
      }

      stemLines.push(line);
    }

    // Line breaks inside the stem are kept. They carry the statement layout —
    // "A. …" and "B. …" on their own lines — which is part of the question.
    const stem = stemLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

    if (stem === '') local.push('The question text is empty.');
    if (options.length !== 4) local.push(`Found ${options.length} options, expected 4.`);
    if (options.some((o) => o.text === '')) local.push('An option has no text.');

    return { number: block.number, stem, options, warnings: local };
  });

  const clean = questions.filter((q) => q.warnings.length === 0).length;
  warnings.push(`${clean} of ${questions.length} questions read cleanly.`);

  return { questions, warnings };
}

/**
 * Compares two option sets loosely enough to survive OCR.
 *
 * Used to confirm that a question from the paper and the same-numbered question
 * from the analysis really are the same item before the analysis's answer is
 * applied to it. Punctuation, case and spacing are ignored; the words are not.
 */
export function optionsAgree(a: string[], b: string[]): boolean {
  if (a.length !== b.length || a.length === 0) return false;

  const normalise = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  return a.every((text, i) => {
    const left = normalise(text);
    const right = normalise(b[i] ?? '');
    if (left === right) return true;

    // OCR drops and mangles characters, so exact equality is too strict. One
    // containing the other, or a strong shared prefix, is enough to identify
    // the option — this is a check that we are looking at the same question,
    // not a proofreading pass.
    if (left.length > 6 && right.length > 6) {
      if (left.includes(right) || right.includes(left)) return true;
      const prefix = Math.min(left.length, right.length, 14);
      if (left.slice(0, prefix) === right.slice(0, prefix)) return true;
    }
    return false;
  });
}
