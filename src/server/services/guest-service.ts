import { randomBytes } from 'node:crypto';

import { AppError, errors } from '@/lib/api';
import { hashPassword } from '@/server/auth/password';
import { db } from '@/server/db';
import { normalisePhone } from '@/validations/guest';

/**
 * Free-test guest access.
 *
 * A visitor who wants the free test gives a name and a phone number rather
 * than registering. Rather than inventing an anonymous attempt path, that
 * creates a real STUDENT account — so attempts, scoring, results, analytics,
 * leaderboards and the admin panel all work unchanged, and the lead is a
 * first-class record rather than a side table nobody looks at.
 *
 * The account has no usable password. It is marked `GUEST_FREE_TEST` so the
 * admin panel can tell leads from students who signed up properly, and so a
 * guest can later be invited to set a password without losing their history.
 */

/** Addresses use the reserved `.invalid` TLD (RFC 2606): provably undeliverable. */
const GUEST_EMAIL_DOMAIN = 'guest.invalid';

function guestEmailFor(phoneDigits: string): string {
  return `guest.${phoneDigits}@${GUEST_EMAIL_DOMAIN}`;
}

/** True when the address was minted by this flow rather than typed by a person. */
export function isGuestEmail(email: string): boolean {
  return email.endsWith(`@${GUEST_EMAIL_DOMAIN}`);
}

/**
 * Confirms a test may be taken without paying.
 *
 * Checked server-side on every call. The client decides which button to show;
 * it never decides what is free.
 */
export async function assertTestIsFree(
  testId: string,
  options: { requireQuestions?: boolean } = {},
) {
  const { requireQuestions = true } = options;
  const test = await db.test.findFirst({
    where: { id: testId, deletedAt: null },
    select: { id: true, title: true, accessType: true, status: true, totalQuestions: true },
  });

  if (!test) throw errors.notFound('Test');

  if (test.status !== 'PUBLISHED') {
    throw new AppError('TEST_UNAVAILABLE', 'This test is not currently available.');
  }

  if (test.accessType !== 'FREE') {
    throw new AppError(
      'ENTITLEMENT_REQUIRED',
      'This test is not free. Please sign in or purchase access to continue.',
    );
  }

  if (requireQuestions && test.totalQuestions < 1) {
    throw new AppError('TEST_UNAVAILABLE', 'This test does not have any questions yet.');
  }

  return test;
}

/**
 * Finds or creates the guest account behind a phone number.
 *
 * Returning the same account for a repeat number is deliberate: a student who
 * comes back to finish a paper should find their attempt, not a fresh identity
 * and a second lead record. The number is normalised first, so "+91 98765
 * 43210" and "9876543210" resolve to one person.
 */
export async function findOrCreateGuest(input: {
  name: string;
  phone: string;
  context?: { ipAddress?: string | null; userAgent?: string | null };
}) {
  const phoneDigits = normalisePhone(input.phone);

  if (phoneDigits.length !== 10) {
    throw new AppError('VALIDATION_ERROR', 'Enter a valid 10-digit mobile number.');
  }

  const email = guestEmailFor(phoneDigits);

  const existing = await db.user.findUnique({
    where: { emailNormal: email },
    select: { id: true, name: true, status: true, deletedAt: true },
  });

  if (existing) {
    if (existing.deletedAt || existing.status === 'SUSPENDED') {
      throw new AppError(
        'ACCOUNT_SUSPENDED',
        'This number cannot be used right now. Please contact support.',
      );
    }

    // Refresh the display name: people correct their own spelling, and the
    // most recent entry is the one they just looked at.
    if (existing.name !== input.name) {
      await db.user.update({ where: { id: existing.id }, data: { name: input.name } });
    }

    return { userId: existing.id, isNew: false };
  }

  // No usable password. A random one is hashed rather than storing a sentinel,
  // so the column holds a well-formed hash that cannot be guessed and that no
  // sign-in attempt can ever match.
  const unusablePassword = randomBytes(32).toString('hex');

  const user = await db.user.create({
    data: {
      name: input.name,
      email,
      emailNormal: email,
      passwordHash: await hashPassword(unusablePassword),
      phone: phoneDigits,
      role: 'STUDENT',
      // Active immediately: there is no address to verify, and requiring
      // verification would make the free test unreachable, which is the whole
      // point of this flow.
      status: 'ACTIVE',
      signupSource: 'GUEST_FREE_TEST',
    },
    select: { id: true },
  });

  return { userId: user.id, isNew: true };
}
