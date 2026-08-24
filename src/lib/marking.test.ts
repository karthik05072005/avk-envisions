import { describe, expect, it } from 'vitest';

import {
  MARKING_SCHEME_SHORT,
  MARKS_PER_QUESTION,
  NEGATIVE_MARKS_PER_QUESTION,
  NEGATIVE_RATIO,
  totalMarksFor,
} from './marking';

/**
 * The scheme was wrong in production — 1 mark and 0.25 negative, so a
 * hundred-question paper scored out of 100 instead of 200. These lock the
 * published values down.
 */
describe('KAS marking scheme', () => {
  it('awards 2 marks a question', () => {
    expect(MARKS_PER_QUESTION).toBe(2);
  });

  it('deducts one quarter of the marks for a wrong answer', () => {
    expect(NEGATIVE_RATIO).toBe(0.25);
    expect(NEGATIVE_MARKS_PER_QUESTION).toBe(0.5);
    expect(NEGATIVE_MARKS_PER_QUESTION).toBe(MARKS_PER_QUESTION * NEGATIVE_RATIO);
  });

  it('puts a hundred-question paper out of 200', () => {
    expect(totalMarksFor(100)).toBe(200);
    expect(totalMarksFor(20)).toBe(40);
    expect(totalMarksFor(0)).toBe(0);
  });

  it('leaves a blind guess slightly positive, as one-quarter marking does', () => {
    // Four options, one correct. A quarter of the marks gained against three
    // quarters of the penalty comes to +marks/16 — small, but above zero.
    //
    // Worth stating precisely because the seeded blog post originally claimed
    // this was exactly zero. It never was: zero would require the penalty to
    // be a THIRD of the marks, not a quarter.
    const expected = 0.25 * MARKS_PER_QUESTION - 0.75 * NEGATIVE_MARKS_PER_QUESTION;
    expect(expected).toBeCloseTo(MARKS_PER_QUESTION / 16, 10);
    expect(expected).toBeGreaterThan(0);

    const breakEvenPenalty = (0.25 * MARKS_PER_QUESTION) / 0.75;
    expect(breakEvenPenalty).toBeCloseTo(MARKS_PER_QUESTION / 3, 10);
  });

  it('describes itself with the same numbers it enforces', () => {
    expect(MARKING_SCHEME_SHORT).toBe('2 marks, −0.5 negative');
  });
});
