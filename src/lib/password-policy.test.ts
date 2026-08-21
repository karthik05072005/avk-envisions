import { describe, expect, it } from 'vitest';

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  checkPasswordStrength,
  scorePassword,
} from './password-policy';

/**
 * Password policy tests.
 *
 * The policy is deliberately permissive: composition requirements were removed
 * by product decision. These tests pin that down, so a future change that
 * quietly reintroduces a rule fails here rather than surprising users at the
 * registration form.
 */

describe('checkPasswordStrength — what is accepted', () => {
  // Every one of these was rejected under the previous policy.
  const accepted = [
    ['Test@123456', 'sequential characters'],
    ['password', 'a common password'],
    ['password123', 'common password with digits'],
    ['abcdef', 'lowercase only'],
    ['123456', 'digits only'],
    ['aaaaaa', 'the same character repeated'],
    ['qwerty', 'a keyboard run'],
    ['ABCDEF', 'uppercase only'],
    ['!!!!!!', 'symbols only'],
    ['abcd1234', 'no uppercase, no symbol'],
  ] as const;

  for (const [password, why] of accepted) {
    it(`accepts "${password}" (${why})`, () => {
      const result = checkPasswordStrength(password);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  }

  it('accepts a password containing the user’s own name', () => {
    const result = checkPasswordStrength('anandkumar', {
      name: 'Anand Kumar',
      email: 'anand@example.com',
    });
    expect(result.valid).toBe(true);
  });

  it('accepts a password containing the user’s email local-part', () => {
    const result = checkPasswordStrength('anand123', { email: 'anand@example.com' });
    expect(result.valid).toBe(true);
  });
});

describe('checkPasswordStrength — the only remaining rules', () => {
  it('rejects anything below the length floor', () => {
    const result = checkPasswordStrength('a'.repeat(PASSWORD_MIN_LENGTH - 1));
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/at least 6 characters/i);
  });

  it('accepts exactly the length floor', () => {
    expect(checkPasswordStrength('a'.repeat(PASSWORD_MIN_LENGTH)).valid).toBe(true);
  });

  it('rejects anything above the upper bound', () => {
    // The cap is not usability — an unbounded input is a CPU denial-of-service
    // against our own Argon2 hashing.
    const result = checkPasswordStrength('a'.repeat(PASSWORD_MAX_LENGTH + 1));
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/no more than/i);
  });

  it('accepts exactly the upper bound', () => {
    expect(checkPasswordStrength('a'.repeat(PASSWORD_MAX_LENGTH)).valid).toBe(true);
  });

  it('rejects an empty password', () => {
    expect(checkPasswordStrength('').valid).toBe(false);
  });
});

describe('scorePassword — advisory only', () => {
  it('never blocks: a zero-scoring password is still valid', () => {
    const weak = 'aaaaaa';
    expect(scorePassword(weak)).toBeLessThanOrEqual(2);
    expect(checkPasswordStrength(weak).valid).toBe(true);
  });

  it('scores an empty password at zero', () => {
    expect(scorePassword('')).toBe(0);
  });

  it('rewards length', () => {
    expect(scorePassword('abcdefghijklmn')).toBeGreaterThan(scorePassword('abcdef'));
  });

  it('rewards character variety', () => {
    expect(scorePassword('Abcd1234!x')).toBeGreaterThan(scorePassword('abcdefghij'));
  });

  it('never exceeds the label range', () => {
    for (const password of ['a', 'abcdef', 'Abcd1234!', 'A'.repeat(60) + 'b1!']) {
      const value = scorePassword(password);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(4);
    }
  });
});
