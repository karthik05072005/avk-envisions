import { describe, expect, it } from 'vitest';

import { importCommitSchema } from './import';

/**
 * The import commit contract.
 *
 * These guard the part that decides where a student's questions end up. A
 * destination silently dropped, or a legacy payload no longer understood,
 * means an admin imports a paper and cannot find it.
 */

const QUESTION = {
  number: 1,
  body: 'Which of the following is correct about the Constitution?',
  options: [{ body: 'Alpha' }, { body: 'Beta' }, { body: 'Gamma' }, { body: 'Delta' }],
  correctIndex: 1,
};

const BASE = {
  examId: 'cmsyvchoi0051ui0gqtbn71pd',
  subjectId: 'cmsyvchog004zui0gtr4uuu2d',
  questions: [QUESTION],
};

describe('importCommitSchema', () => {
  it('accepts several destinations at once', () => {
    const parsed = importCommitSchema.parse({
      ...BASE,
      destinations: [
        { kind: 'NEW_TEST', title: 'August 2024 Paper 1' },
        { kind: 'EXISTING_TEST', testId: 'cmsyvchm8003lui0g92cde1qr' },
        { kind: 'EXISTING_TEST', testId: 'cmt7jt52o003luil0pi0vv94h' },
      ],
    });

    expect(parsed.destinations).toHaveLength(3);
    expect(parsed.destinations[0]!.kind).toBe('NEW_TEST');
  });

  it('treats no destination as the question bank', () => {
    const parsed = importCommitSchema.parse({ ...BASE, destinations: [] });
    expect(parsed.destinations).toEqual([]);
  });

  it('refuses a new test with no title', () => {
    expect(() =>
      importCommitSchema.parse({ ...BASE, destinations: [{ kind: 'NEW_TEST' }] }),
    ).toThrow(/title/i);
  });

  it('refuses an existing destination with no test', () => {
    expect(() =>
      importCommitSchema.parse({ ...BASE, destinations: [{ kind: 'EXISTING_TEST' }] }),
    ).toThrow(/test/i);
  });

  it('folds the old single-target payload into a destination', () => {
    // A console left open across the release still sends the old shape; it has
    // to keep working rather than failing validation on the next import.
    const parsed = importCommitSchema.parse({
      ...BASE,
      target: 'NEW_TEST',
      title: 'Legacy paper',
      accessType: 'PAID',
    });

    expect(parsed.destinations).toHaveLength(1);
    expect(parsed.destinations[0]).toMatchObject({ kind: 'NEW_TEST', title: 'Legacy paper' });
  });

  it('folds the old EXISTING_TEST payload, carrying the test id', () => {
    const parsed = importCommitSchema.parse({
      ...BASE,
      target: 'EXISTING_TEST',
      testId: 'cmsyvchm8003lui0g92cde1qr',
    });

    expect(parsed.destinations).toEqual([
      expect.objectContaining({ kind: 'EXISTING_TEST', testId: 'cmsyvchm8003lui0g92cde1qr' }),
    ]);
  });

  it('reads the old BANK_ONLY as no destination', () => {
    const parsed = importCommitSchema.parse({ ...BASE, target: 'BANK_ONLY' });
    expect(parsed.destinations).toEqual([]);
  });

  it('refuses a key that points past the last option', () => {
    expect(() =>
      importCommitSchema.parse({
        ...BASE,
        questions: [{ ...QUESTION, correctIndex: 9 }],
        destinations: [],
      }),
    ).toThrow(/correct answer points past/i);
  });

  it('refuses two options with the same text', () => {
    expect(() =>
      importCommitSchema.parse({
        ...BASE,
        questions: [{ ...QUESTION, options: [{ body: 'Same' }, { body: 'same' }] }],
        destinations: [],
      }),
    ).toThrow(/identical text/i);
  });

  it('refuses an import with nothing in it', () => {
    expect(() => importCommitSchema.parse({ ...BASE, questions: [], destinations: [] })).toThrow();
  });
});
