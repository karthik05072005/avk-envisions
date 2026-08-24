/**
 * The KPSC KAS Prelims marking scheme.
 *
 * Two marks for a correct answer, one quarter of that deducted for a wrong one,
 * nothing for a blank. A hundred-question paper is therefore out of 200.
 *
 * These live in one place because they were previously written out at each
 * call site — the seeds, the admin validators, the importer and the instruction
 * text all carried their own copy of "1 mark, 0.25 negative". When the real
 * scheme turned out to be 2 and 0.5, every one of those was wrong
 * independently, and a paper scored out of 100 instead of 200.
 *
 * Scoring reads absolute values, not the ratio: `NEGATIVE_MARKS_PER_QUESTION`
 * is what is actually subtracted. The ratio is kept for display and for tests
 * that assert the two stay consistent.
 */

/** Awarded for a correct answer. */
export const MARKS_PER_QUESTION = 2;

/** Fraction of the question's marks lost for a wrong answer. */
export const NEGATIVE_RATIO = 0.25;

/** Deducted for a wrong answer — the ratio applied to the marks. */
export const NEGATIVE_MARKS_PER_QUESTION = MARKS_PER_QUESTION * NEGATIVE_RATIO;

/** Total for a paper of `count` questions. */
export function totalMarksFor(count: number): number {
  return count * MARKS_PER_QUESTION;
}

/** One-line description of the scheme, for instructions and FAQs. */
export const MARKING_SCHEME_TEXT =
  `Each question carries ${MARKS_PER_QUESTION} marks. ` +
  `${NEGATIVE_MARKS_PER_QUESTION} marks are deducted for an incorrect answer. ` +
  'Unanswered questions carry no penalty.';

/** Short form, e.g. for a stat chip: "2 marks, −0.5 negative". */
export const MARKING_SCHEME_SHORT = `${MARKS_PER_QUESTION} marks, −${NEGATIVE_MARKS_PER_QUESTION} negative`;
