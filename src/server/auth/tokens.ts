import 'server-only';

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Opaque token generation and storage.
 *
 * Session cookies, email-verification links and password-reset links all follow
 * the same rule: the raw token is given to the user exactly once and is never
 * persisted. The database stores only a SHA-256 digest, so a leaked database
 * cannot be replayed to log in or take over an account.
 *
 * SHA-256 (not Argon2) is correct here: these tokens are 256 bits of true
 * randomness, so there is nothing to brute-force and a slow KDF would only add
 * latency to every authenticated request.
 */

const TOKEN_BYTES = 32;

export interface GeneratedToken {
  /** Sent to the user. Never written to the database or a log. */
  token: string;
  /** Stored in the database. */
  tokenHash: string;
}

export function generateToken(): GeneratedToken {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Constant-time comparison of two token digests. Prevents an attacker from
 * learning a valid prefix by measuring response time.
 */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// ---------------------------------------------------------------------------
// Token lifetimes
// ---------------------------------------------------------------------------

export const TOKEN_TTL = {
  /** Email verification links stay valid for a day. */
  emailVerification: 24 * 60 * 60 * 1000,
  /** Password resets are deliberately short-lived. */
  passwordReset: 60 * 60 * 1000,
} as const;

export function expiryFromNow(ms: number): Date {
  return new Date(Date.now() + ms);
}

export function isExpired(date: Date | null | undefined): boolean {
  return !date || date.getTime() <= Date.now();
}

// ---------------------------------------------------------------------------
// Short human-readable identifiers
// ---------------------------------------------------------------------------

/** Ambiguity-free alphabet (no O/0, I/1) for codes people read aloud. */
const READABLE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Generates a short reference such as a ticket or question code. */
export function readableCode(length = 8): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += READABLE_ALPHABET[bytes[i]! % READABLE_ALPHABET.length];
  }
  return out;
}

/**
 * Sequential-looking document number, e.g. `AVK-2026-000148`.
 * The caller supplies the sequence value from a transactional counter — this
 * only formats it.
 */
export function formatDocumentNumber(prefix: string, sequence: number, year = new Date().getFullYear()): string {
  return `${prefix}-${year}-${String(sequence).padStart(6, '0')}`;
}
