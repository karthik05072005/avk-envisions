/**
 * Password policy — isomorphic.
 *
 * Lives in `lib/` rather than `server/` because both the client form (for live
 * feedback) and the server (for enforcement) need the same rules. Contains no
 * hashing: that is `server/auth/password.ts`, which is server-only because it
 * pulls in a native Argon2 addon.
 *
 * DELIBERATELY PERMISSIVE. Composition requirements — an uppercase letter, a
 * digit, a symbol — were removed by product decision: they were rejecting
 * passwords students considered perfectly reasonable and pushing them towards
 * reuse. The only hard constraints left are a short floor and an upper bound.
 *
 * The strength meter remains, but it is *advice*. Nothing it reports can block
 * a sign-up. If password rules are ever reintroduced, this is the one file to
 * change — every call site defers to `checkPasswordStrength`.
 */

/** Absolute floor. Below this a password offers essentially no protection. */
export const PASSWORD_MIN_LENGTH = 6;

/**
 * Upper bound. Not a usability rule — Argon2 hashes the whole input, so an
 * unbounded password is a denial-of-service vector against our own CPU.
 */
export const PASSWORD_MAX_LENGTH = 128;

export interface PasswordCheck {
  valid: boolean;
  /** 0-4, suitable for driving a strength meter. Advisory only. */
  score: number;
  errors: string[];
}

/**
 * Validates a password.
 *
 * Only length is enforced. `context` is accepted so call sites do not have to
 * change if identity-based checks are ever restored, but it is unused today.
 */
export function checkPasswordStrength(
  password: string,
  _context: { email?: string; name?: string } = {},
): PasswordCheck {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push(`Use no more than ${PASSWORD_MAX_LENGTH} characters.`);
  }

  return { valid: errors.length === 0, score: scorePassword(password), errors };
}

/**
 * Rough 0-4 strength score, used only for the UI meter.
 *
 * Never gates acceptance — a password scoring 0 is still valid as long as it
 * clears the length floor.
 */
export function scorePassword(password: string): number {
  if (!password) return 0;

  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score++;
  if (password.length >= 10) score++;
  if (password.length >= 14) score++;

  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) =>
    re.test(password),
  ).length;
  if (classes >= 3) score++;

  return Math.min(4, score);
}

export const PASSWORD_STRENGTH_LABELS = [
  'Very weak',
  'Weak',
  'Fair',
  'Strong',
  'Very strong',
] as const;
