import { describe, expect, it } from 'vitest';

import { normaliseText, parseQuestionPaper, stripRepeatedLines } from './question-parser';

/**
 * Parser tests.
 *
 * The parser decides which option is the correct answer for questions that will
 * be put in front of real students. A silent mis-parse here is indistinguishable
 * from a correct one until someone is marked wrong, so every supported format
 * and every failure mode is pinned down explicitly.
 */

describe('normaliseText', () => {
  it('collapses PDF artefacts', () => {
    const messy = 'The ﬁrst  line​\nSecond­line';
    const clean = normaliseText(messy);

    expect(clean).toContain('first');
    expect(clean).not.toContain(' ');
    expect(clean).not.toContain('​');
    expect(clean).toContain('Secondline');
  });

  it('normalises smart quotes so stored text is consistent', () => {
    expect(normaliseText('“Quoted” and ‘single’')).toBe('"Quoted" and \'single\'');
  });
});

describe('stripRepeatedLines', () => {
  it('removes running headers but keeps content', () => {
    const text = [
      'ACME PAPER',
      'Q1. First question',
      'ACME PAPER',
      'Q2. Second question',
      'ACME PAPER',
      'Q3. Third question',
    ].join('\n');

    const stripped = stripRepeatedLines(text);
    expect(stripped).not.toContain('ACME PAPER');
    expect(stripped).toContain('Q1. First question');
    expect(stripped).toContain('Q3. Third question');
  });

  it('never strips a repeated line that looks like a question', () => {
    const text = ['1. Same', '1. Same', '1. Same'].join('\n');
    expect(stripRepeatedLines(text)).toContain('1. Same');
  });

  it('removes standalone page numbers', () => {
    expect(stripRepeatedLines('Q1. Something\nPage 3 of 12')).not.toContain('Page 3');
  });
});

describe('parseQuestionPaper — the KAS format', () => {
  const paper = `
Q1. Who won the Australian Open 2012?
Options:
1. Victoria Azarenka
2. Svetlana Kuznetsova
3. Maria Sharapova
4. Caroline Wozniacki
CORRECT ANSWER: 1. Victoria Azarenka

Q2. Aurora Borealis occurs in:
Options:
1. Stratosphere
2. Troposphere
3. Ozonosphere
4. Ionosphere
CORRECT ANSWER: 4. Ionosphere
`;

  it('finds every question', () => {
    const result = parseQuestionPaper(paper);
    expect(result.stats.found).toBe(2);
    expect(result.stats.withAnswer).toBe(2);
  });

  it('extracts the body without the options', () => {
    const [first] = parseQuestionPaper(paper).questions;
    expect(first!.body).toBe('Who won the Australian Open 2012?');
    expect(first!.body).not.toContain('Victoria');
  });

  it('extracts all four options in order', () => {
    const [first] = parseQuestionPaper(paper).questions;
    expect(first!.options.map((o) => o.body)).toEqual([
      'Victoria Azarenka',
      'Svetlana Kuznetsova',
      'Maria Sharapova',
      'Caroline Wozniacki',
    ]);
  });

  it('resolves the answer to a zero-based index', () => {
    const [first, second] = parseQuestionPaper(paper).questions;
    expect(first!.correctIndex).toBe(0);
    expect(second!.correctIndex).toBe(3);
  });

  it('reports no warnings for a clean paper', () => {
    expect(parseQuestionPaper(paper).stats.withWarnings).toBe(0);
  });
});

describe('parseQuestionPaper — statement lists', () => {
  // The hard case: the question body contains a lettered list, and the real
  // options are the numbered run after it.
  const paper = `
Q43. Ashokan inscriptions
Statements:
a. Most inscriptions were in Prakrit.
b. Most Prakrit inscriptions used Brahmi.
c. Some northwest inscriptions used Kharosthi.
Options:
1. a and b
2. Only a
3. b and c
4. a, b and c
CORRECT ANSWER: 4. a, b and c
`;

  it('does not mistake statements for options', () => {
    const [q] = parseQuestionPaper(paper).questions;
    expect(q!.options).toHaveLength(4);
    expect(q!.options[0]!.body).toBe('a and b');
  });

  it('keeps the statements in the question body', () => {
    const [q] = parseQuestionPaper(paper).questions;
    expect(q!.body).toContain('Most inscriptions were in Prakrit');
    expect(q!.body).toContain('Ashokan inscriptions');
  });

  it('still resolves the answer', () => {
    expect(parseQuestionPaper(paper).questions[0]!.correctIndex).toBe(3);
  });

  it('handles a statement list with no explicit Options heading', () => {
    const noHeading = `
Q5. Consider the following:
a. First statement
b. Second statement
1. Only a
2. Only b
3. Both
4. Neither
Answer: 3
`;
    const [q] = parseQuestionPaper(noHeading).questions;
    // The trailing sequential run is the options.
    expect(q!.options.map((o) => o.body)).toEqual(['Only a', 'Only b', 'Both', 'Neither']);
    expect(q!.correctIndex).toBe(2);
  });
});

describe('parseQuestionPaper — alternative formats', () => {
  it('handles lettered options with an "Ans:" line', () => {
    const paper = `
1. What is the capital of France?
(a) Berlin
(b) Madrid
(c) Paris
(d) Rome
Ans: (c)
`;
    const [q] = parseQuestionPaper(paper).questions;
    expect(q!.options).toHaveLength(4);
    expect(q!.correctIndex).toBe(2);
    expect(q!.options[2]!.body).toBe('Paris');
  });

  it('handles "A)" style markers and an "Answer -" line', () => {
    const paper = `
Question 7. Which gas do plants absorb?
A) Oxygen
B) Carbon dioxide
C) Nitrogen
D) Hydrogen
Answer - B
`;
    const [q] = parseQuestionPaper(paper).questions;
    expect(q!.number).toBe(7);
    expect(q!.correctIndex).toBe(1);
  });

  it('joins an option that wrapped onto the next line', () => {
    const paper = `
Q1. A long question
Options:
1. This option is quite long and
continues onto a second line
2. Short one
Answer: 1
`;
    const [q] = parseQuestionPaper(paper).questions;
    expect(q!.options).toHaveLength(2);
    expect(q!.options[0]!.body).toContain('continues onto a second line');
  });
});

describe('parseQuestionPaper — failure is reported, never guessed', () => {
  it('returns null rather than assuming an answer when none is present', () => {
    const paper = `
Q1. A question with no answer key
1. Alpha
2. Beta
3. Gamma
4. Delta
`;
    const [q] = parseQuestionPaper(paper).questions;
    expect(q!.correctIndex).toBeNull();
    expect(q!.warnings.join(' ')).toMatch(/no answer line/i);
  });

  it('rejects an answer pointing past the last option', () => {
    const paper = `
Q1. Two options only
1. Alpha
2. Beta
CORRECT ANSWER: 4
`;
    const [q] = parseQuestionPaper(paper).questions;
    expect(q!.correctIndex).toBeNull();
    expect(q!.warnings.join(' ')).toMatch(/only 2 option/i);
  });

  it('flags a question with no options', () => {
    const [q] = parseQuestionPaper('Q1. Just a bare question with nothing else').questions;
    expect(q!.warnings).toContain('No options found');
  });

  it('flags duplicate option text', () => {
    const paper = `
Q1. Duplicated
1. Same
2. Same
Answer: 1
`;
    expect(parseQuestionPaper(paper).questions[0]!.warnings.join(' ')).toMatch(/identical/i);
  });

  it('warns when a scanned PDF yields no text', () => {
    const result = parseQuestionPaper('   \n  \n ');
    expect(result.questions).toHaveLength(0);
    expect(result.documentWarnings.join(' ')).toMatch(/OCR/i);
  });

  it('warns when nothing looks like a question', () => {
    const result = parseQuestionPaper('This document has prose but no numbered questions at all.');
    expect(result.questions).toHaveLength(0);
    expect(result.documentWarnings.join(' ')).toMatch(/no numbered questions/i);
  });

  it('warns about a gap in question numbering', () => {
    const paper = `
Q1. First
1. a
2. b
Answer: 1

Q5. Fifth
1. a
2. b
Answer: 2
`;
    expect(parseQuestionPaper(paper).documentWarnings.join(' ')).toMatch(/jumps from 1 to 5/);
  });
});

describe('parseQuestionPaper — question splitting', () => {
  it('does not treat option markers as new questions', () => {
    const paper = `
Q1. First question
1. Alpha
2. Beta
3. Gamma
4. Delta
CORRECT ANSWER: 2

Q2. Second question
1. One
2. Two
CORRECT ANSWER: 1
`;
    const result = parseQuestionPaper(paper);
    // Without the "must advance" rule this would find far more than two.
    expect(result.stats.found).toBe(2);
    expect(result.questions.map((q) => q.number)).toEqual([1, 2]);
  });

  it('drops preamble before the first question', () => {
    const paper = `
SOME EXAM BOARD
Instructions: answer all questions.

Q1. The real first question
1. Alpha
2. Beta
Answer: 1
`;
    const [q] = parseQuestionPaper(paper).questions;
    expect(q!.body).toBe('The real first question');
    expect(q!.body).not.toContain('Instructions');
  });

  it('parses a 100-question paper without losing any', () => {
    const paper = Array.from({ length: 100 }, (_, i) => {
      const n = i + 1;
      return `Q${n}. Question number ${n}?\nOptions:\n1. A${n}\n2. B${n}\n3. C${n}\n4. D${n}\nCORRECT ANSWER: ${(i % 4) + 1}`;
    }).join('\n\n');

    const result = parseQuestionPaper(paper);
    expect(result.stats.found).toBe(100);
    expect(result.stats.withAnswer).toBe(100);
    expect(result.stats.withWarnings).toBe(0);
    expect(result.questions[41]!.correctIndex).toBe(41 % 4);
  });
});
