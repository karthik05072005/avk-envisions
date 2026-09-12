import { describe, expect, it } from 'vitest';

import { parsePyqAnalysis } from './pyq-analysis-parser';

/**
 * The two faults reported against the import: explanations arriving as one
 * paragraph, and the answer line ending up inside the last option.
 *
 * Both are written as fixtures rather than run against the real PDFs so they
 * fail fast and say exactly what broke. Three earlier attempts at this parser
 * collapsed whole papers to a single question; scripts/parser-baseline.mts
 * covers that scale, and these cover the shape.
 */

describe('explanations keep the shape the document printed', () => {
  it('keeps each point on its own line instead of running them together', () => {
    const { questions } = parsePyqAnalysis(
      [
        'Q1. Which of these is correct?',
        'OPTIONS',
        '(A) First',
        '(B) Second',
        '(C) Third',
        '(D) Fourth',
        'ANSWER',
        '(B) Second',
        'ABOUT THE QUESTION',
        '• Statement 1 is correct because of the first reason.',
        '• Statement 2 is incorrect because of the second reason.',
        '• Statement 3 is correct.',
      ].join('\n'),
    );

    const explanation = questions[0]?.explanation ?? '';
    expect(explanation.split('\n')).toHaveLength(3);
    expect(explanation).toContain('• Statement 1 is correct');
    // The old parser joined with spaces, producing one long line.
    expect(explanation).not.toMatch(/reason\. • Statement 2/);
  });

  it('rejoins a line the PDF wrapped mid-sentence', () => {
    const { questions } = parsePyqAnalysis(
      [
        'Q1. Which of these is correct?',
        'OPTIONS',
        '(A) First',
        '(B) Second',
        '(C) Third',
        '(D) Fourth',
        'ANSWER',
        '(A) First',
        'ABOUT THE QUESTION',
        'The Asian-Pacific Postal Union functions as a Restricted Union of the',
        'Universal Postal Union.',
      ].join('\n'),
    );

    // A wrap is the PDF's column width, not the author's intent.
    expect(questions[0]?.explanation).toBe(
      'The Asian-Pacific Postal Union functions as a Restricted Union of the Universal Postal Union.',
    );
  });
});

describe('the answer never lands inside an option', () => {
  it('ends the option list at an ANSWER line written as prose', () => {
    const { questions } = parsePyqAnalysis(
      [
        'Q1. Consider the following statements regarding GCCs:',
        'OPTIONS',
        '(A) 1 and 2 only',
        '(B) 1, 2 and 4 only',
        '(C) 2, 3 and 4 only',
        '(D) 1, 2, 3 and 4',
        // No marker after ANSWER — the form that used to glue onto option D.
        'ANSWER Statements 1, 2 and 4 are correct. Karnataka GCC strategy is',
        'intended to promote higher-value technology.',
      ].join('\n'),
    );

    const question = questions[0]!;
    expect(question.options).toHaveLength(4);
    expect(question.options[3]!.text).toBe('1, 2, 3 and 4');
    for (const option of question.options) {
      expect(option.text).not.toMatch(/ANSWER/i);
    }
    expect(question.explanation).toContain('Statements 1, 2 and 4 are correct');
  });

  it('reads the options, not the statements, in a statement-based question', () => {
    const { questions } = parsePyqAnalysis(
      [
        'Q1. Consider the following statements :',
        'A. The World Wetlands Day is observed every year on 2nd February.',
        'B. The theme for 2017 is Wetlands for our Future.',
        'C. World Wetlands Day 2017 was celebrated in Chilika Lake.',
        'Which of the above statements is/are correct ?',
        '(A) A only',
        '(B) A and B only',
        '(C) A and C only',
        '(D) A, B and C',
        'ANSWER',
        '(A) A only',
      ].join('\n'),
    );

    const question = questions[0]!;
    // The bracketed list is the options; the bare A./B./C. list is the stem.
    expect(question.options.map((o) => o.text)).toEqual([
      'A only',
      'A and B only',
      'A and C only',
      'A, B and C',
    ]);
    expect(question.correctIndex).toBe(0);
    expect(question.stem).toContain('World Wetlands Day is observed');
  });

  it('still reads a document that marks its options without brackets', () => {
    const { questions } = parsePyqAnalysis(
      [
        'Q1. Which one of the following is correct?',
        '1. First option',
        '2. Second option',
        '3. Third option',
        '4. Fourth option',
        'ANSWER',
        '3. Third option',
      ].join('\n'),
    );

    expect(questions[0]?.options).toHaveLength(4);
    expect(questions[0]?.correctIndex).toBe(2);
  });
});

describe('the KAS-50 day-paper layout', () => {
  it('reads an answer labelled "Key Answer:"', () => {
    const { questions } = parsePyqAnalysis(
      [
        '1. The Citizenship Rules, 2026, are significant because they concern:',
        'A. Abolition of citizenship by naturalisation',
        'B. Empowerment of designated District Collectors',
        'C. Introduction of State citizenship',
        'D. Automatic citizenship for all persons',
        'Key Answer: B. Empowerment of designated District Collectors',
        'Explanation:',
        '• The 2026 Rules concern administrative processing.',
        '2. Consider the following statements:',
        'A. First',
        'B. Second',
        'C. Third',
        'D. Fourth',
        'Key Answer: C. Third',
        'Explanation:',
        '• Something about the third.',
      ].join('\n'),
    );

    // Two questions, not one: the paper labels every answer this way, and
    // matching only a bare "ANSWER" collapsed all fifty into a single block.
    expect(questions).toHaveLength(2);
    expect(questions[0]?.correctIndex).toBe(1);
    expect(questions[1]?.correctIndex).toBe(2);
    expect(questions[0]?.options).toHaveLength(4);
  });

  it('carries on past a question whose number the PDF dropped', () => {
    const lines: string[] = [];
    for (const n of [1, 2, 4, 5]) {
      lines.push(
        `${n}. Question number ${n}?`,
        'A. First',
        'B. Second',
        'C. Third',
        'D. Fourth',
        'Key Answer: A. First',
        'Explanation:',
        '• Because of a reason.',
      );
    }

    // Question 3 lost its heading to a page break. Insisting on the exact next
    // number stopped the parser dead there, which is how a fifty-question
    // paper yielded seven.
    const { questions } = parsePyqAnalysis(lines.join('\n'));
    expect(questions.map((q) => q.number)).toEqual([1, 2, 4, 5]);
    expect(questions.every((q) => q.correctIndex === 0)).toBe(true);
  });

  it('does not mistake "Answer Options:" for the answer', () => {
    const { questions } = parsePyqAnalysis(
      [
        '1. Which of the following is not related to Article 164 (1A)?',
        'Answer Options:',
        '1. I only',
        '2. Both I and II',
        '3. II only',
        '4. None of the above',
        'ANSWER Option 3',
      ].join('\n'),
    );

    // The heading introduces the options; it does not give the key. Reading it
    // as an answer let "2." open a second block mid-list.
    expect(questions).toHaveLength(1);
    expect(questions[0]?.options).toHaveLength(4);
    expect(questions[0]?.correctIndex).toBe(2);
  });
});
