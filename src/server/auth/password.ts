import 'server-only';

import { hash, verify } from '@node-rs/argon2';

/**
 * Password hashing.
 *
 * Argon2id with OWASP's recommended baseline (19 MiB memory, 2 iterations,
 * parallelism 1). Memory cost is the parameter that actually defeats GPU
 * cracking, so lower it only with a measured reason.
 *
 * The *policy* (length, composition, blocklist) lives in
 * `@/lib/password-policy`, which is isomorphic so the client form can show the
 * same rules. This module is server-only because `@node-rs/argon2` is a native
 * addon that cannot be bundled for the browser.
 */
const ARGON2_OPTIONS = {
  /** 19 MiB, expressed in KiB as the library expects. */
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export async function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, ARGON2_OPTIONS);
}

/**
 * Verifies a password against a stored hash.
 *
 * Returns `false` rather than throwing on a malformed hash: a corrupted record
 * must read as "wrong password", never as a 500 that reveals the account
 * exists.
 */
export async function verifyPassword(storedHash: string, plaintext: string): Promise<boolean> {
  try {
    return await verify(storedHash, plaintext, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

// Re-exported so server code has a single import for both hashing and policy.
export {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_STRENGTH_LABELS,
  checkPasswordStrength,
  type PasswordCheck,
} from '@/lib/password-policy';
