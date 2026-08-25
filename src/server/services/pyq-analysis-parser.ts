/**
 * Extracts questions from the AVK Envisions PYQ analysis documents.
 *
 * Those PDFs are revision material — each question is followed by commentary —
 * but they contain the complete item: stem, four options and the keyed answer.
 * This recovers the item and discards the commentary.
 *
 * The twelve papers were not produced to one template. Three layouts appear:
 *
 *   A  `Q1. SUBJECT | TOPIC` / QUESTION / OPTIONS / `(A)…(D)` / ANSWER / `(B) …`
 *   B  `1. SUBJECT • TOPIC`  / stem   / OPTIONS / `(1)…(4)` / ANSWER / `(1) …`
 *   C  `1. stem…`                     /          `(1)…(4)` / `ANSWER Option 2 — …`
 *
 * Rather than detect a layout and commit to it, the parser accepts any of the
 * three markers at each position. That copes with papers that mix them, which
 * several do around page breaks.
 *
 * The one rule that is never relaxed: an item whose answer cannot be read is
 * returned with `correctIndex: null` and a warning. It is never guessed. A
 * wrongly keyed question is worse than a missing one — it teaches the student
 * something false and marks them down for knowing better.
 */

export interface ParsedOption {
  /** 'A'–'D' or '1'–'4' exactly as printed. */
  marker: string;
  text: string;
}

export interface ParsedPyqQuestion {
  /** Position in the paper, from the printed number. */
  number: number;
  /** Subject heading where the document gives one, e.g. "MEDIEVAL HISTORY". */
  subject: string | null;
  /** Topic after the separator, e.g. "DELHI SULTANATE". */
  topic: string | null;
  stem: string;
  options: ParsedOption[];
  /** Zero-based index of the keyed option, or null when it could not be read. */
  correctIndex: number | null;
  /** Explanation text, kept for the solution shown after an attempt. */
  explanation: string | null;
  warnings: string[];
}

export interface ParseResult {
  questions: ParsedPyqQuestion[];
  warnings: string[];
}

/** Running headers, footers and page numbers that repeat on every page. */
const FURNITURE = [
  /^AVK\s+ENVISIONS.*$/i,
  /^Page\s+\d+$/i,
  /^\d{1,3}$/,
  /^KAS\s+PRELIMS.*$/i,
  /^FOR ENHANCED LEARNING$/i,
  /^Learn\s*[•·]\s*Practice\s*[•·]\s*Excel.*$/i,
];

/** Section labels that end the stem or the option list. */
const COMMENTARY = /^(ABOUT THE QUESTION|HOW TO SOLVE|CORE|FUTURE ANGLE|READING METHOD|IMPORTANT|REVISION FORMAT)\b/i;

function stripFurniture(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => {
      const t = line.trim();
      if (t === '') return true;
      return !FURNITURE.some((re) => re.test(t));
    });
}

/**
 * Matches a question heading in any of the three layouts.
 *
 * Requires the number to be followed by a period and a space, which is what
 * separates "12. POLITY" from a stray "12" left by a page number, and from
 * "Article 12" inside a stem.
 */
const HEADING = /^(?:Q\s*)?(\d{1,3})\.\s+(.*)$/;

/** `(A) text`, `(1) text`, `A) text`, `A. text`. */
const OPTION = /^\(?([A-Da-d1-4])[).]\s*(.+)$/;

/** The keyed answer, in any of the forms the documents use. */
const ANSWER_INLINE =
  /^ANSWER\b[:\s·•—–-]*(?:Option\s*)?\(?([A-Da-d1-4])\)?[).]?\s*(?:[—–:-]\s*)?(.*)$/i;
const ANSWER_BARE = /^\(?([A-Da-d1-4])[).]?\s*(.*)$/;

function markerToIndex(marker: string): number | null {
  const m = marker.toUpperCase();
  if (m >= 'A' && m <= 'D') return m.charCodeAt(0) - 65;
  if (m >= '1' && m <= '4') return Number(m) - 1;
  return null;
}

/** Splits "MEDIEVAL HISTORY | DELHI SULTANATE" or "POLITY • UNION FINANCE". */
function splitHeading(rest: string): { subject: string | null; topic: string | null; inline: string } {
  const parts = rest.split(/\s*[|•·]\s*/);

  // A heading is subject/topic only when it is short and shouty — otherwise the
  // text after the number is the question stem itself (layout C).
  if (parts.length >= 2) {
    const subject = parts[0]?.trim() ?? '';
    const looksLikeHeading = subject.length <= 44 && subject === subject.toUpperCase();
    if (looksLikeHeading) {
      return {
        subject: subject || null,
        topic: parts.slice(1).join(' • ').trim() || null,
        inline: '',
      };
    }
  }

  const single = rest.trim();
  if (single.length <= 44 && single === single.toUpperCase() && /[A-Z]/.test(single)) {
    return { subject: single || null, topic: null, inline: '' };
  }

  return { subject: null, topic: null, inline: rest };
}

export function parsePyqAnalysis(raw: string): ParseResult {
  const lines = stripFurniture(raw);
  const warnings: string[] = [];

  // --- Split into blocks, one per question --------------------------------
  const blocks: { number: number; rest: string; body: string[] }[] = [];
  let current: { number: number; rest: string; body: string[] } | null = null;
  let lastNumber = 0;

  // Some papers number their options "1." to "4." rather than "(1)" to "(4)",
  // so a bare "2." is ambiguous: it is question 2 in one layout and option 2 in
  // another. Sequence alone cannot separate them — option 2 of question 1 is
  // exactly the number a new block expects.
  //
  // What does separate them is position. Every question runs stem, options,
  // answer, commentary; so a new question can only begin once the current block
  // has passed its answer. Until then a numbered line is an option.
  let answered = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^ANSWER/i.test(trimmed) || COMMENTARY.test(trimmed)) answered = true;

    const heading = HEADING.exec(trimmed);
    const opensBlock =
      heading &&
      Number(heading[1]) === lastNumber + 1 &&
      (current === null || answered);

    if (opensBlock && heading) {
      if (current) blocks.push(current);
      lastNumber = Number(heading[1]);
      current = { number: lastNumber, rest: heading[2] ?? '', body: [] };
      answered = false;
      continue;
    }

    if (current) current.body.push(line);
  }
  if (current) blocks.push(current);

  if (blocks.length === 0) {
    warnings.push('No questions found. The document may use a layout this parser does not know.');
    return { questions: [], warnings };
  }

  // --- Read each block ------------------------------------------------------
  const questions = blocks.map((block) => {
    const local: string[] = [];
    const { subject, topic, inline } = splitHeading(block.rest);

    // Match-list questions carry "A. …" / "B. …" items inside the stem, which
    // look exactly like options. When the block labels its option list, trust
    // the label and ignore anything that looks like an option before it.
    const hasOptionsLabel = block.body.some((l) => /^OPTIONS?\s*:?\s*$/i.test(l.trim()));

    const stemLines: string[] = inline ? [inline] : [];
    const options: ParsedOption[] = [];
    const explanation: string[] = [];

    type Mode = 'STEM' | 'OPTIONS' | 'ANSWER' | 'EXPLANATION';
    let mode: Mode = 'STEM';
    let correctIndex: number | null = null;

    for (const rawLine of block.body) {
      const line = rawLine.trim();
      if (line === '') continue;

      if (/^QUESTION\s*:?\s*$/i.test(line)) {
        mode = 'STEM';
        continue;
      }
      if (/^OPTIONS?\s*:?\s*$/i.test(line)) {
        mode = 'OPTIONS';
        continue;
      }

      // `ANSWER` alone means the key is on the following line. Without this
      // the label fell through and was appended to the last option's text.
      if (/^ANSWER\s*:?\s*$/i.test(line)) {
        mode = 'ANSWER';
        continue;
      }

      const inlineAnswer = ANSWER_INLINE.exec(line);
      if (inlineAnswer) {
        const idx = markerToIndex(inlineAnswer[1] ?? '');
        if (idx !== null) correctIndex = idx;
        // `ANSWER` on its own line means the key is on the next line.
        mode = idx === null ? 'ANSWER' : 'EXPLANATION';
        continue;
      }

      if (COMMENTARY.test(line)) {
        mode = 'EXPLANATION';
        continue;
      }

      if (mode === 'ANSWER') {
        const bare = ANSWER_BARE.exec(line);
        const idx = bare ? markerToIndex(bare[1] ?? '') : null;
        if (idx !== null) correctIndex = idx;
        mode = 'EXPLANATION';
        continue;
      }

      const option = OPTION.exec(line);
      const mayOpenOptions = hasOptionsLabel ? mode === 'OPTIONS' : mode === 'OPTIONS' || mode === 'STEM';
      if (option && mayOpenOptions) {
        const idx = markerToIndex(option[1] ?? '');
        // Options must arrive in order; a stray "(1)" mid-stem does not open
        // the list, and a repeated marker is a continuation, not a new option.
        if (idx !== null && idx === options.length) {
          mode = 'OPTIONS';
          options.push({ marker: (option[1] ?? '').toUpperCase(), text: option[2]?.trim() ?? '' });
          continue;
        }
      }

      if (mode === 'OPTIONS' && options.length > 0) {
        // Wrapped option text.
        const last = options[options.length - 1];
        if (last) last.text = `${last.text} ${line}`.trim();
        continue;
      }

      if (mode === 'EXPLANATION') {
        explanation.push(line);
        continue;
      }

      stemLines.push(line);
    }

    const stem = stemLines.join(' ').replace(/\s+/g, ' ').trim();

    if (stem === '') local.push('The question text is empty.');
    if (options.length !== 4) local.push(`Found ${options.length} options, expected 4.`);
    if (correctIndex === null) local.push('The answer could not be read; it must be keyed by hand.');
    else if (correctIndex >= options.length) {
      local.push(`The answer points at option ${correctIndex + 1}, but only ${options.length} were found.`);
      correctIndex = null;
    }

    return {
      number: block.number,
      subject,
      topic,
      stem,
      options,
      correctIndex,
      explanation: explanation.join(' ').replace(/\s+/g, ' ').trim() || null,
      warnings: local,
    };
  });

  const usable = questions.filter((q) => q.warnings.length === 0).length;
  warnings.push(`${usable} of ${questions.length} questions parsed cleanly.`);

  return { questions, warnings };
}
