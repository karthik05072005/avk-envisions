/**
 * Question paper parser.
 *
 * Deliberately pure — text in, structured questions out. No PDF handling, no
 * database, no I/O. Extracting text from a PDF and understanding what that text
 * *means* are separate problems, and only the second one is subtle enough to
 * need exhaustive tests.
 *
 * The parser is honest about failure. It never guesses an answer key: a
 * question whose answer line could not be found comes back with
 * `correctIndex: null` and a warning, so the import UI can force a human to
 * resolve it. Silently defaulting to option A would put wrong keys in front of
 * real students, which is the single worst thing this codebase can do.
 */

export interface ParsedOption {
  /** The marker as printed — "1", "A", "a" — before normalisation. */
  marker: string;
  body: string;
}

export interface ParsedQuestion {
  /** Question number as printed in the paper. */
  number: number;
  body: string;
  options: ParsedOption[];
  /** Zero-based index into `options`, or null when no answer was found. */
  correctIndex: number | null;
  /** Answer text as printed, kept so a human can check the parse. */
  rawAnswer: string | null;
  /** Anything a human should look at before this is imported. */
  warnings: string[];
  /** The block this came from, for the review UI. */
  raw: string;
}

export interface ParseResult {
  questions: ParsedQuestion[];
  stats: {
    found: number;
    withAnswer: number;
    withoutAnswer: number;
    withWarnings: number;
  };
  /** Problems with the document as a whole. */
  documentWarnings: string[];
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/**
 * Cleans text extracted from a PDF.
 *
 * PDF extraction routinely produces soft hyphens, non-breaking spaces, smart
 * quotes and ligatures. Left alone these break every regex below and, worse,
 * end up stored as question text that looks subtly wrong to a student.
 */
export function normaliseText(input: string): string {
  return (
    input
      .replace(/\r\n?/g, '\n')
      // Ligatures that pdf extraction emits as single glyphs.
      .replace(/ﬁ/g, 'fi')
      .replace(/ﬂ/g, 'fl')
      // Non-breaking and zero-width spaces.
      .replace(/[   ]/g, ' ')
      .replace(/[​-‍﻿]/g, '')
      // Soft hyphen used for line-break hyphenation.
      .replace(/­/g, '')
      // Normalise dashes and quotes so stored text is consistent.
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[ \t]+/g, ' ')
      // Collapse runs of blank lines but keep paragraph breaks.
      .replace(/\n{3,}/g, '\n\n')
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      .trim()
  );
}

/**
 * Strips repeated page furniture.
 *
 * A header or footer printed on every page appears dozens of times in the
 * extracted text and would otherwise be swallowed into question bodies.
 */
export function stripRepeatedLines(text: string, minRepeats = 3): string {
  const lines = text.split('\n');
  const counts = new Map<string, number>();

  for (const line of lines) {
    const key = line.trim();
    // Only short lines are plausible furniture; a repeated long line is more
    // likely to be real content than a running header.
    if (key.length === 0 || key.length > 80) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const furniture = new Set(
    [...counts.entries()]
      .filter(([line, count]) => {
        if (count < minRepeats) return false;
        // Never strip anything structural. On a 100-question paper the
        // "Options:" heading and the answer lines repeat constantly, and
        // removing them would destroy the very markers the parser relies on.
        if (/^(Q\s*)?\d+[.):]/.test(line)) return false;
        if (/^\(?[a-hA-H]\)?[.):]/.test(line)) return false;
        if (/^(?:options?|choices?)\s*[:.]?\s*$/i.test(line)) return false;
        if (/^(?:correct\s*answer|answer|ans|key)\b/i.test(line)) return false;
        return true;
      })
      .map(([line]) => line),
  );

  // Page numbers on their own line.
  return lines
    .filter((line) => !furniture.has(line.trim()) && !/^Page \d+( of \d+)?$/i.test(line.trim()))
    .join('\n');
}

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

/** Start of a question: "Q1.", "Q.1", "1.", "1)", "Question 1". */
const QUESTION_START = /^(?:Q(?:uestion)?\s*\.?\s*)?(\d{1,3})\s*[.):\]]\s*(.*)$/i;

/** An option line: "1. text", "(a) text", "A) text", "A. text". */
const OPTION_LINE = /^\(?([1-9]|[a-hA-H])\)?\s*[.):\]]?\s+(.+)$/;

/** Explicit "Options:" heading, a strong signal when the paper uses one. */
const OPTIONS_HEADING = /^(?:options?|choices?)\s*[:.]?\s*$/i;

/** Answer line, in the several shapes real papers use. */
const ANSWER_LINE =
  /^(?:correct\s*answer|answer|ans|key)\s*(?:key)?\s*[:.\-–]\s*\(?([1-9]|[a-hA-H])\)?\s*[.)]?\s*(.*)$/i;

/** Marker → zero-based index. Handles both numeric and alphabetic papers. */
function markerToIndex(marker: string): number | null {
  const trimmed = marker.trim();
  if (/^[1-9]$/.test(trimmed)) return Number(trimmed) - 1;
  if (/^[a-hA-H]$/.test(trimmed)) return trimmed.toLowerCase().charCodeAt(0) - 97;
  return null;
}

/** True when markers run 1,2,3… or a,b,c… without gaps. */
function isSequential(markers: string[]): boolean {
  if (markers.length < 2) return false;
  const indices = markers.map(markerToIndex);
  if (indices.some((i) => i === null)) return false;
  return (indices as number[]).every((value, i) => value === (indices[0] as number) + i);
}

// ---------------------------------------------------------------------------
// Block parsing
// ---------------------------------------------------------------------------

/**
 * Splits a question block into body / options / answer.
 *
 * The hard case is a paper where the *question itself* contains a lettered list
 * (statements a, b, c) followed by numbered options. Two things disambiguate
 * it: an explicit "Options:" heading when present, and otherwise the fact that
 * the real options are the last sequential run of markers in the block.
 */
function parseBlock(number: number, raw: string): ParsedQuestion {
  const warnings: string[] = [];
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);

  // --- Answer -------------------------------------------------------------
  let correctIndex: number | null = null;
  let rawAnswer: string | null = null;
  let answerLineIndex = -1;

  for (let i = lines.length - 1; i >= 0; i--) {
    const match = ANSWER_LINE.exec(lines[i]!);
    if (match) {
      correctIndex = markerToIndex(match[1]!);
      rawAnswer = lines[i]!;
      answerLineIndex = i;
      break;
    }
  }

  const beforeAnswer = answerLineIndex === -1 ? lines : lines.slice(0, answerLineIndex);

  // --- Options ------------------------------------------------------------
  const headingIndex = beforeAnswer.findIndex((line) => OPTIONS_HEADING.test(line));

  let optionLines: { marker: string; body: string; index: number }[] = [];

  const collectFrom = (startAt: number) => {
    const collected: { marker: string; body: string; index: number }[] = [];
    for (let i = startAt; i < beforeAnswer.length; i++) {
      const match = OPTION_LINE.exec(beforeAnswer[i]!);
      if (!match) {
        // A non-matching line after options have started is a wrapped
        // continuation of the previous option, not a new one.
        if (collected.length > 0 && beforeAnswer[i]!.length > 0) {
          collected[collected.length - 1]!.body += ` ${beforeAnswer[i]}`;
          continue;
        }
        continue;
      }
      collected.push({ marker: match[1]!, body: match[2]!.trim(), index: i });
    }
    return collected;
  };

  if (headingIndex !== -1) {
    optionLines = collectFrom(headingIndex + 1);
  } else {
    // No heading: take the last sequential run of option-like lines.
    const candidates: { marker: string; body: string; index: number }[] = [];
    for (let i = 0; i < beforeAnswer.length; i++) {
      const match = OPTION_LINE.exec(beforeAnswer[i]!);
      if (match) candidates.push({ marker: match[1]!, body: match[2]!.trim(), index: i });
    }

    // Walk backwards to find the trailing run whose markers are sequential.
    for (let start = 0; start < candidates.length; start++) {
      const run = candidates.slice(start);
      if (isSequential(run.map((r) => r.marker))) {
        optionLines = run;
        break;
      }
    }
    if (optionLines.length === 0) optionLines = candidates;
  }

  // --- Body ---------------------------------------------------------------
  const bodyEnd =
    headingIndex !== -1
      ? headingIndex
      : optionLines.length > 0
        ? optionLines[0]!.index
        : beforeAnswer.length;

  const body = beforeAnswer.slice(0, bodyEnd).join('\n').trim();

  // --- Warnings -----------------------------------------------------------
  if (!body) warnings.push('No question text found');
  if (optionLines.length === 0) warnings.push('No options found');
  else if (optionLines.length < 2) warnings.push('Only one option found');

  if (correctIndex === null) {
    warnings.push(
      answerLineIndex === -1
        ? 'No answer line found — set the correct option manually'
        : 'Answer line found but its marker could not be read',
    );
  } else if (correctIndex >= optionLines.length) {
    warnings.push(
      `Answer points at option ${correctIndex + 1} but only ${optionLines.length} option(s) were found`,
    );
    correctIndex = null;
  }

  if (!isSequential(optionLines.map((o) => o.marker)) && optionLines.length >= 2) {
    warnings.push('Option markers are not sequential — check nothing was missed');
  }

  const bodies = optionLines.map((o) => o.body.toLowerCase());
  if (new Set(bodies).size !== bodies.length) warnings.push('Two options have identical text');

  return {
    number,
    body,
    options: optionLines.map((o) => ({ marker: o.marker, body: o.body })),
    correctIndex,
    rawAnswer,
    warnings,
    raw,
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Parses a whole question paper.
 *
 * Blocks are split on question-number markers. A line only starts a new
 * question if its number is greater than the previous one — otherwise the "1."
 * of an option list would be mistaken for question 1 all over again.
 */
export function parseQuestionPaper(rawText: string): ParseResult {
  const documentWarnings: string[] = [];

  const text = stripRepeatedLines(normaliseText(rawText));

  if (!text) {
    return {
      questions: [],
      stats: { found: 0, withAnswer: 0, withoutAnswer: 0, withWarnings: 0 },
      documentWarnings: [
        'No readable text was found. If this is a scanned PDF it holds images, not text, and needs OCR before it can be imported.',
      ],
    };
  }

  const lines = text.split('\n');

  /**
   * Splitting is a state machine, not a regex sweep.
   *
   * The naive rule — "a line starting with a number greater than the last
   * question number begins a new question" — is wrong, because option markers
   * 2, 3 and 4 all satisfy it. Tracking whether we are inside an option run is
   * what tells "2. Svetlana Kuznetsova" (an option) apart from "2. Next
   * question?" (a question).
   */
  const explicitQ = /^Q(?:uestion)?\s*\.?\s*\d/i;
  // A paper that prefixes questions with "Q" is unambiguous, so trust it.
  const usesQPrefix = lines.filter((line) => explicitQ.test(line)).length >= 2;

  type Mode = 'SEEKING' | 'BODY' | 'OPTIONS';

  const blocks: { number: number; lines: string[] }[] = [];
  let lastNumber = 0;
  let mode: Mode = 'SEEKING';
  let expectedOption = 0;

  const startBlock = (number: number, rest: string) => {
    blocks.push({ number, lines: rest ? [rest] : [] });
    lastNumber = number;
  };

  const append = (line: string) => {
    if (blocks.length > 0) blocks[blocks.length - 1]!.lines.push(line);
  };

  for (const line of lines) {
    // Snapshot the mode: assigning to `mode` inside the loop narrows its type
    // for the rest of the iteration, which makes later comparisons look
    // unreachable to the compiler even though they are not.
    const currentMode: Mode = mode;

    const qMatch = QUESTION_START.exec(line);
    const optMatch = OPTION_LINE.exec(line);
    const optIndex = optMatch ? markerToIndex(optMatch[1]!) : null;
    const isExplicit = explicitQ.test(line);

    // An answer line always closes the block.
    if (ANSWER_LINE.test(line)) {
      append(line);
      mode = 'SEEKING';
      expectedOption = 0;
      continue;
    }

    if (OPTIONS_HEADING.test(line)) {
      append(line);
      mode = 'OPTIONS';
      expectedOption = 0;
      continue;
    }

    // --- Does this line start a new question? ---------------------------
    let startsQuestion = false;
    if (qMatch) {
      const candidate = Number(qMatch[1]);
      if (isExplicit) {
        // "Q12." is never an option marker.
        startsQuestion = candidate > lastNumber;
      } else if (usesQPrefix) {
        // The paper marks questions with Q, so a bare number is an option.
        startsQuestion = false;
      } else if (currentMode === 'OPTIONS') {
        // Inside an option run, only a number that both breaks the run and
        // continues the question sequence can be a new question.
        startsQuestion = optIndex !== expectedOption && candidate === lastNumber + 1;
      } else {
        startsQuestion = candidate === lastNumber + 1;
      }
    }

    if (startsQuestion) {
      startBlock(Number(qMatch![1]), (qMatch![2] ?? '').trim());
      mode = 'BODY';
      expectedOption = 0;
      continue;
    }

    // --- Option run tracking ---------------------------------------------
    if (optMatch && optIndex !== null) {
      if (currentMode === 'OPTIONS' && optIndex === expectedOption) {
        expectedOption += 1;
      } else if (currentMode === 'BODY' && optIndex === 0) {
        // First option of the run.
        mode = 'OPTIONS';
        expectedOption = 1;
      }
    }

    append(line);
  }

  if (blocks.length === 0) {
    documentWarnings.push(
      'No numbered questions were recognised. Expected lines like "Q1." or "1." at the start of each question.',
    );
  }

  const questions = blocks.map((block) => parseBlock(block.number, block.lines.join('\n')));

  // Gaps in numbering usually mean a question was missed by the split.
  const numbers = questions.map((q) => q.number);
  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i]! !== numbers[i - 1]! + 1) {
      documentWarnings.push(
        `Question numbering jumps from ${numbers[i - 1]} to ${numbers[i]} — a question may have been missed.`,
      );
    }
  }

  return {
    questions,
    stats: {
      found: questions.length,
      withAnswer: questions.filter((q) => q.correctIndex !== null).length,
      withoutAnswer: questions.filter((q) => q.correctIndex === null).length,
      withWarnings: questions.filter((q) => q.warnings.length > 0).length,
    },
    documentWarnings,
  };
}
