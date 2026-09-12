/**
 * Reads Current Affairs questions out of OCR'd analysis documents.
 *
 * The 2020 and 2024 December Current Affairs PDFs hold their questions as
 * images — 2 characters of extractable text across 40 pages in the 2020 case —
 * so the ordinary PDF parser has nothing to work on. Rendered at 200dpi and
 * put through Tesseract they read cleanly, but OCR output has its own shape:
 *
 *     2. CURRENT AFFAIRS * AMBEDKAR          <- number, subject, topic
 *     Which State/UT has released a ... ?    <- the question
 *     OPTIONS
 *     (1) Maharashtra
 *     (2) Odisha
 *     (3) Goa
 *     (4) Delhi
 *     (4) Delhi                              <- the key, repeated verbatim
 *     ABOUT THE QUESTION
 *     ...                                    <- explanation, to FUTURE ANGLE
 *
 * The key is sometimes a bare "ANSWER" line with nothing after it. Those are
 * rejected rather than guessed: a wrongly keyed question marks a student down
 * for being right, which is worse than a question that is missing.
 *
 * Used by import-ocr-current-affairs.ts; exported separately so it can be
 * tested against the text files without touching the database.
 */

export interface OcrQuestion {
  number: number;
  /** The subject/topic heading as printed, e.g. "CURRENT AFFAIRS * AMBEDKAR". */
  heading: string;
  body: string;
  options: string[];
  /** Index into `options`, or null when the document did not key it. */
  correctIndex: number | null;
  explanation: string | null;
  /** Why this question cannot be trusted, if so. */
  warnings: string[];
}

/** Lines that end the question body or an option run. */
const SECTION = /^(OPTIONS|ANSWER|ABOUT THE QUESTION|HOW TO SOLVE|CORE|FUTURE ANGLE)/i;

/**
 * A new question starts here. The two documents number them differently:
 *   2020:     "2. CURRENT AFFAIRS * AMBEDKAR"   number + subject heading
 *   Dec 2024: "Q1."                             bare, heading-less
 */
const HEADING = /^(\d{1,3})\.\s+([A-Z][A-Z0-9 &''.,\/()+*·—–-]{4,})$/;
const HEADING_Q = /^Q\s?(\d{1,3})\s*[.:]?\s*$/i;

/** "(1) Maharashtra", "1) Maharashtra" or "1. Maharashtra". */
const OPTION = /^\(?([1-4])[).]\s*(.+)$/;

/** Page furniture Tesseract picks up on every page. */
const NOISE = [
  /^AVK ENVISIONS/i,
  /^FOR ENHANCED LEARNING/i,
  /^KAS PRELIMS/i,
  /^Previous Year Questions/i,
  /^Page \d+/i,
  /^ERE$/,
  /^[|*+~\s.·—–-]{0,6}$/,
];

function isNoise(line: string): boolean {
  return NOISE.some((re) => re.test(line.trim()));
}

/** OCR leaves mojibake where the document used typographic punctuation. */
function clean(text: string): string {
  return text
    .replace(/�/g, "'")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseOcrCurrentAffairs(raw: string): OcrQuestion[] {
  const lines = raw.split('\n').map((l) => l.replace(/\r$/, ''));
  const questions: OcrQuestion[] = [];

  let current: OcrQuestion | null = null;
  let mode: 'body' | 'options' | 'answer' | 'explanation' = 'body';
  const bodyLines: string[] = [];
  const explLines: string[] = [];
  /** Option lines seen after the key marker — the repeated correct answer. */
  const afterOptions: string[] = [];

  function finish() {
    if (!current) return;

    current.body = clean(bodyLines.join(' '));
    current.explanation = explLines.length ? clean(explLines.join(' ')) : null;

    // The key is the option repeated after the option block. Matched on its
    // text rather than its number, because OCR misreads "(1)" as "(4)" far
    // more often than it misreads a whole word.
    // Matched on the option's TEXT, never on its number alone. OCR misreads a
    // digit far more readily than a whole word, and a question keyed off a
    // misread digit is worse than a missing one: an early draft keyed "Who
    // directs the NSF?" to Pramod Mistri because the repeated line's "(3)"
    // scanned as "(4)", while the words beside it said Panchanathan.
    if (afterOptions.length > 0) {
      const keyed = clean(afterOptions[afterOptions.length - 1]!)
        .replace(/^\(?[1-4][).]?\s*/, '')
        .toLowerCase();

      if (keyed) {
        const exact = current.options.findIndex((o) => clean(o).toLowerCase() === keyed);
        // OCR truncates ("Both A.and" for "Both A and B"), so a prefix match
        // is allowed — but only where exactly one option can be meant.
        const prefix = current.options
          .map((o, i) => [clean(o).toLowerCase(), i] as const)
          .filter(([o]) => o.length > 3 && (o.startsWith(keyed) || keyed.startsWith(o)));

        if (exact !== -1) current.correctIndex = exact;
        else if (prefix.length === 1) current.correctIndex = prefix[0]![1];
      }
    }

    // Where the ANSWER line came out blank, the explanation often states the
    // key in prose — "keys the answer as 5th", "the keyed answer is Delhi".
    // Only accepted when exactly one option appears there, so an explanation
    // that discusses several is left unkeyed rather than guessed at.
    if (current.correctIndex === null && current.explanation && current.options.length > 0) {
      const prose = current.explanation.toLowerCase();
      const hits = current.options
        .map((o, i) => [clean(o).toLowerCase(), i] as const)
        .filter(([o]) => o.length >= 3 && prose.includes(o));
      if (hits.length === 1) current.correctIndex = hits[0]![1];
    }

    if (current.options.length !== 4) {
      current.warnings.push(`Found ${current.options.length} options, expected 4.`);
    }
    if (current.correctIndex === null) {
      current.warnings.push('The answer could not be read; it must be keyed by hand.');
    } else if (current.correctIndex < 0 || current.correctIndex >= current.options.length) {
      current.warnings.push('The answer points at an option that is not there.');
      current.correctIndex = null;
    }
    if (!current.body) current.warnings.push('The question text could not be read.');

    questions.push(current);
    current = null;
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || isNoise(trimmed)) continue;

    const heading = trimmed.match(HEADING) ?? trimmed.match(HEADING_Q);
    if (heading) {
      finish();
      current = {
        number: Number(heading[1]),
        heading: (heading[2] ?? 'CURRENT AFFAIRS').trim(),
        body: '',
        options: [],
        correctIndex: null,
        explanation: null,
        warnings: [],
      };
      mode = 'body';
      bodyLines.length = 0;
      explLines.length = 0;
      afterOptions.length = 0;
      continue;
    }

    if (!current) continue;

    if (/^OPTIONS/i.test(trimmed)) {
      mode = 'options';
      continue;
    }
    if (/^ANSWER/i.test(trimmed)) {
      // "ANSWER" alone, or "ANSWER (3) Goa" on one line.
      const inline = trimmed.replace(/^ANSWER[:\s]*/i, '').trim();
      if (inline) afterOptions.push(inline);
      mode = 'answer';
      continue;
    }
    if (/^(ABOUT THE QUESTION|HOW TO SOLVE|CORE)/i.test(trimmed)) {
      mode = 'explanation';
      continue;
    }
    if (/^FUTURE ANGLE/i.test(trimmed)) {
      // Related-question prompts, not part of this question's explanation.
      mode = 'body';
      continue;
    }

    if (mode === 'body' && !SECTION.test(trimmed)) {
      // The December document prints no OPTIONS marker — a numbered run simply
      // begins. Treat "1." as the start of the options once a body exists, so
      // a statement list inside the question ("A. …", "B. …") is not mistaken
      // for one.
      const asOption = trimmed.match(OPTION);
      if (asOption && bodyLines.length > 0 && Number(asOption[1]) === current.options.length + 1) {
        current.options.push(asOption[2]!.trim());
        mode = 'options';
        continue;
      }
      // Only before the options: after FUTURE ANGLE this swallows the tail of
      // the page, so anything arriving once options exist is ignored.
      if (current.options.length === 0) bodyLines.push(trimmed);
      continue;
    }

    if (mode === 'options') {
      const opt = trimmed.match(OPTION);
      if (opt) {
        if (current.options.length < 4) current.options.push(opt[2]!.trim());
        else afterOptions.push(trimmed); // the key, repeated
      }
      continue;
    }

    if (mode === 'answer') {
      afterOptions.push(trimmed);
      mode = 'explanation';
      continue;
    }

    if (mode === 'explanation') {
      explLines.push(trimmed);
    }
  }

  finish();
  return questions;
}
