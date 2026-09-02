import { describe, expect, it } from 'vitest';

import { parsePyqAnalysis } from './pyq-analysis-parser';

/**
 * The twelve analysis documents use four different layouts. Each of these is a
 * cut-down but faithful sample of one, taken from the real papers.
 */

const LAYOUT_LETTERED = [
  'Q1. MEDIEVAL HISTORY | DELHI SULTANATE',
  'QUESTION',
  'The biggest network of canals was created by which Sultan?',
  'OPTIONS',
  '(A) Ghiyasuddin Tughlaq',
  '(B) Firuz Shah Tughlaq',
  '(C) Mohammad-bin-Tughlaq',
  '(D) Allauddin Khilji',
  'ANSWER',
  '(B) Firuz Shah Tughlaq',
  'ABOUT THE QUESTION',
  'Firuz Shah Tughlaq is associated with canal building.',
].join('\n');

const LAYOUT_NUMBERED_HEADING = [
  '1. POLITY • UNION–STATE FINANCE',
  'Match List-I with List-II:',
  'A. Stamp duties',
  'B. Duties on succession',
  'OPTIONS',
  '(1) I – II – III – IV',
  '(2) I – III – IV – II',
  '(3) II – I – III – IV',
  '(4) I – IV – III – II',
  'ANSWER',
  '(1) I – II – III – IV',
  'ABOUT THE QUESTION',
  'A constitutional-tax classification question.',
].join('\n');

const LAYOUT_INLINE_ANSWER = [
  '1. Who among the following is related to the following statements?',
  '(1) Ranganatha Diwakara',
  '(2) Tagadooru Ramachandra Rao',
  '(3) Mohare Hanumantharaya',
  '(4) Nittru Srinivasa Rao',
  'ANSWER Option 2 — Tagadooru Ramachandra Rao',
  'ABOUT THE QUESTION',
  'A Karnataka-personality association question.',
].join('\n');

const LAYOUT_NUMBERED_OPTIONS = [
  '1. Who won the Australian Open 2012?',
  'Options:',
  '1. Victoria Azarenka',
  '2. Svetlana Kuznetsova',
  '3. Maria Sharapova',
  '4. Caroline Wozniacki',
  'Answer: 1. Victoria Azarenka',
  'About the question:',
  'Azarenka won her first Grand Slam there.',
].join('\n');

describe('parsePyqAnalysis', () => {
  it('reads the lettered layout', () => {
    const { questions } = parsePyqAnalysis(LAYOUT_LETTERED);
    expect(questions).toHaveLength(1);
    const q = questions[0]!;
    expect(q.subject).toBe('MEDIEVAL HISTORY');
    expect(q.topic).toBe('DELHI SULTANATE');
    expect(q.stem).toContain('biggest network of canals');
    expect(q.options).toHaveLength(4);
    expect(q.correctIndex).toBe(1);
    expect(q.warnings).toEqual([]);
  });

  it('reads the numbered-heading layout', () => {
    const q = parsePyqAnalysis(LAYOUT_NUMBERED_HEADING).questions[0]!;
    expect(q.subject).toBe('POLITY');
    expect(q.correctIndex).toBe(0);
    expect(q.warnings).toEqual([]);
  });

  it('keeps match-list items in the stem rather than treating them as options', () => {
    // "A. Stamp duties" looks exactly like a lettered option. When the block
    // labels its real option list, that label wins.
    const q = parsePyqAnalysis(LAYOUT_NUMBERED_HEADING).questions[0]!;
    expect(q.options).toHaveLength(4);
    expect(q.options[0]!.text).toContain('I – II – III – IV');
    expect(q.stem).toContain('Stamp duties');
  });

  it('reads an answer given on the same line', () => {
    const q = parsePyqAnalysis(LAYOUT_INLINE_ANSWER).questions[0]!;
    expect(q.correctIndex).toBe(1);
    expect(q.options).toHaveLength(4);
    expect(q.warnings).toEqual([]);
  });

  it('does not mistake numbered options for the next question', () => {
    // The hardest case: options run "1." to "4.", so option 2 of question 1 is
    // the exact token a naive splitter expects question 2 to start with.
    const { questions } = parsePyqAnalysis(LAYOUT_NUMBERED_OPTIONS);
    expect(questions).toHaveLength(1);
    expect(questions[0]!.options).toHaveLength(4);
    expect(questions[0]!.correctIndex).toBe(0);
  });

  it('strips the section labels out of the stem', () => {
    const q = parsePyqAnalysis(LAYOUT_NUMBERED_OPTIONS).questions[0]!;
    expect(q.stem).toBe('Who won the Australian Open 2012?');
    expect(q.stem).not.toContain('Options');
  });

  it('keeps the commentary as the explanation', () => {
    const q = parsePyqAnalysis(LAYOUT_LETTERED).questions[0]!;
    expect(q.explanation).toContain('canal building');
    expect(q.explanation).not.toContain('ABOUT THE QUESTION');
  });

  it('separates consecutive questions', () => {
    const doc = `${LAYOUT_NUMBERED_OPTIONS}\n2. Second question?\nOptions:\n1. Alpha\n2. Beta\n3. Gamma\n4. Delta\nAnswer: 3. Gamma`;
    const { questions } = parsePyqAnalysis(doc);
    expect(questions).toHaveLength(2);
    expect(questions[1]!.correctIndex).toBe(2);
  });

  it('refuses to guess an answer it cannot read', () => {
    // The rule that must never be relaxed. A wrongly keyed question marks a
    // student down for being right.
    const doc = [
      '1. A question with no key given?',
      'OPTIONS',
      '(A) One',
      '(B) Two',
      '(C) Three',
      '(D) Four',
      'ABOUT THE QUESTION',
      'No answer was printed.',
    ].join('\n');
    const q = parsePyqAnalysis(doc).questions[0]!;
    expect(q.correctIndex).toBeNull();
    expect(q.warnings.join(' ')).toMatch(/answer could not be read/i);
  });

  it('flags a short option list rather than padding it', () => {
    const doc = ['1. Two options only?', 'OPTIONS', '(A) One', '(B) Two', 'ANSWER', '(A) One'].join('\n');
    const q = parsePyqAnalysis(doc).questions[0]!;
    expect(q.options).toHaveLength(2);
    expect(q.warnings.join(' ')).toMatch(/expected 4/);
  });

  it('rejects a key that points past the options found', () => {
    const doc = ['1. Mismatched?', 'OPTIONS', '(A) One', '(B) Two', 'ANSWER', '(D) Four'].join('\n');
    const q = parsePyqAnalysis(doc).questions[0]!;
    expect(q.correctIndex).toBeNull();
    expect(q.warnings.join(' ')).toMatch(/only 2 were found/);
  });

  it('reports plainly when it recognises nothing', () => {
    const { questions, warnings } = parsePyqAnalysis('Just prose with no questions in it.');
    expect(questions).toEqual([]);
    expect(warnings.join(' ')).toMatch(/No questions found/i);
  });

  it('drops repeated page furniture', () => {
    const doc = [
      'AVK ENVISIONS KAS PRELIMS 2020 • PAPER-I',
      'Page 3',
      '1. A question?',
      'OPTIONS',
      '(A) One',
      '(B) Two',
      '(C) Three',
      '(D) Four',
      'ANSWER',
      '(C) Three',
    ].join('\n');
    const q = parsePyqAnalysis(doc).questions[0]!;
    expect(q.stem).toBe('A question?');
    expect(q.correctIndex).toBe(2);
  });

  it('keeps a key printed as a bare digit under ANSWER', () => {
    // Standalone numbers are page furniture in these documents, and stripping
    // them took the answer with it. Twelve questions in the 2011 Paper I parsed
    // perfectly, then had no key and were discarded.
    const { questions } = parsePyqAnalysis(
      [
        'Q1. Smart-e-Pants are:',
        'OPTIONS',
        '(1) Underwear monitoring vital signs',
        '(2) Diapers notifying parents',
        '(3) Pants connected to a video game',
        '(4) Electronic shorts for spinal-cord injuries',
        'ANSWER',
        '1',
        'ABOUT THE QUESTION',
        'Wearable health technology.',
      ].join('\n'),
    );

    expect(questions).toHaveLength(1);
    expect(questions[0]!.correctIndex).toBe(0);
  });

  it('still drops a bare number that is only a page number', () => {
    const { questions } = parsePyqAnalysis(
      [
        'Q1. Which is the capital?',
        '14',
        'OPTIONS',
        '(1) Bengaluru',
        '(2) Mysuru',
        'ANSWER',
        '(1) Bengaluru',
      ].join('\n'),
    );

    expect(questions[0]!.stem).not.toContain('14');
  });

  it('does not let one unanswered question swallow the rest of the paper', () => {
    // A question printed with no ANSWER used to stall block-splitting, so every
    // later question was absorbed into it. Two such questions in the 2011
    // Paper II cost twenty of the hundred.
    const { questions } = parsePyqAnalysis(
      [
        'Q1. First question?',
        '(1) A',
        '(2) B',
        'ANSWER',
        '(1) A',
        'Q2. Second question, printed without a key?',
        '(1) C',
        '(2) D',
        'SECTION 11 - QUANTITATIVE APTITUDE',
        'Q3. Third question?',
        '(1) E',
        '(2) F',
        'ANSWER',
        '(2) F',
      ].join('\n'),
    );

    expect(questions.map((q) => q.number)).toEqual([1, 2, 3]);
    expect(questions[2]!.correctIndex).toBe(1);
  });
});
