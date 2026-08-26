import { describe, expect, it } from 'vitest';

import { optionsAgree, parseQuestionPaper } from './kas-question-paper-parser';

/** A faithful sample of the real bilingual layout, Kannada included. */
const PAPER = [
  '±ÜÅÍæ° ±ÜâÔ¤Pæ ÍæÅà~',
  '2. Which State/UT has released a booklet for',
  'students on Ambedkar’s teachings ?',
  '±ÜÅÍæ°±Ü£ÅPæ¿áÈÉ ÊÜáá©ÅñÜÊÝWÜ¨Ü',
  '(1) Maharashtra',
  '(2) Odisha',
  '(3) Goa',
  '(4) Delhi',
].join('\n');

const STATEMENTS = [
  '1. Which of the following statement/s is true',
  'with reference to Nayanars ?',
  'A. They were Sangam poets.',
  'B. They were Shaiva saints.',
  'C. They composed devotional poetry.',
  'Choose the correct answer from the',
  'options given below :',
  '(1) A only',
  '(2) A and C only',
  '(3) B, C and D',
  '(4) B and C only',
].join('\n');

describe('parseQuestionPaper', () => {
  it('drops the Kannada and keeps the English', () => {
    // The Kannada is set in a legacy font, so it arrives as accented Latin-1.
    const q = parseQuestionPaper(PAPER).questions.find((x) => x.number === 2)!;
    expect(q.stem).not.toMatch(/[À-ÿ]{3,}/);
    expect(q.stem).toContain('Which State/UT');
  });

  it('keeps the wording exactly as printed', () => {
    // The space before "?" and the curly apostrophe are KPSC's, not typos.
    const q = parseQuestionPaper(PAPER).questions.find((x) => x.number === 2)!;
    expect(q.stem).toBe('Which State/UT has released a booklet for\nstudents on Ambedkar’s teachings ?');
  });

  it('keeps the line breaks rather than reflowing the stem', () => {
    const q = parseQuestionPaper(PAPER).questions.find((x) => x.number === 2)!;
    expect(q.stem.split('\n')).toHaveLength(2);
  });

  it('reads the four options in order', () => {
    const q = parseQuestionPaper(PAPER).questions.find((x) => x.number === 2)!;
    expect(q.options.map((o) => o.text)).toEqual(['Maharashtra', 'Odisha', 'Goa', 'Delhi']);
    expect(q.warnings).toEqual([]);
  });

  it('keeps sub-statements on their own lines inside the stem', () => {
    const q = parseQuestionPaper(STATEMENTS).questions[0]!;
    expect(q.stem).toContain('A. They were Sangam poets.\nB. They were Shaiva saints.');
    expect(q.stem).toContain('Choose the correct answer from the\noptions given below :');
    expect(q.options).toHaveLength(4);
  });

  it('does not mistake a lettered statement for an option', () => {
    const q = parseQuestionPaper(STATEMENTS).questions[0]!;
    expect(q.options[0]!.text).toBe('A only');
    expect(q.stem).toContain('A. They were Sangam poets.');
  });

  it('joins an option that wrapped across two lines', () => {
    const doc = [
      '1. A question ?',
      '(1) A rather long option that ran past',
      'the end of the column',
      '(2) Short',
      '(3) Another',
      '(4) Last',
    ].join('\n');
    const q = parseQuestionPaper(doc).questions[0]!;
    expect(q.options[0]!.text).toBe('A rather long option that ran past the end of the column');
  });

  it('flags a short option list rather than inventing one', () => {
    const doc = ['1. A question ?', '(1) One', '(2) Two'].join('\n');
    const q = parseQuestionPaper(doc).questions[0]!;
    expect(q.warnings.join(' ')).toMatch(/expected 4/);
  });

  it('says so plainly when a scan has no text layer', () => {
    const { questions, warnings } = parseQuestionPaper('±ÜÅÍæ° ±ÜâÔ¤Pæ\n±Ü£ÅPæ I');
    expect(questions).toEqual([]);
    expect(warnings.join(' ')).toMatch(/No English text/i);
  });
});

describe('optionsAgree', () => {
  const paper = ['Maharashtra', 'Odisha', 'Goa', 'Delhi'];

  it('accepts the same four choices', () => {
    expect(optionsAgree(paper, ['Maharashtra', 'Odisha', 'Goa', 'Delhi'])).toBe(true);
  });

  it('ignores punctuation, case and spacing', () => {
    expect(optionsAgree(paper, ['maharashtra.', 'ODISHA', ' Goa ', 'Delhi,'])).toBe(true);
  });

  it('tolerates the character damage OCR leaves behind', () => {
    expect(
      optionsAgree(
        ['Sethuraman Panchanathan', 'Pankaj Agnihotri'],
        ['Sethuraman Panchanathan extra', 'Pankaj Agnihotri'],
      ),
    ).toBe(true);
  });

  it('rejects a different set of choices', () => {
    // This is the check that stops one question's answer being applied to
    // another. It has to fail closed.
    expect(optionsAgree(paper, ['Kerala', 'Punjab', 'Bihar', 'Assam'])).toBe(false);
  });

  it('rejects options that arrived in a different order', () => {
    expect(optionsAgree(paper, ['Delhi', 'Goa', 'Odisha', 'Maharashtra'])).toBe(false);
  });

  it('rejects lists of different lengths, and empty ones', () => {
    expect(optionsAgree(paper, ['Maharashtra', 'Odisha'])).toBe(false);
    expect(optionsAgree([], [])).toBe(false);
  });
});
