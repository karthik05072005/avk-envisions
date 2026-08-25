import { z } from 'zod';

import { nameSchema } from './common';

/**
 * Lead capture for the free test.
 *
 * A visitor gives a name and phone number instead of registering. This is a
 * contact detail, not a credential: nothing is sent to the number and it never
 * signs anybody in, so there is no OTP or SMS anywhere in this flow.
 */

/** Required variant of the shared phone rule — the lead is the point here. */
export const guestPhoneSchema = z
  .string()
  .trim()
  .min(1, 'Mobile number is required')
  .regex(/^(?:\+91[-\s]?)?[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');

export const guestStartSchema = z.object({
  name: nameSchema,
  phone: guestPhoneSchema,
  /** The test they are trying to take. Validated server-side as free. */
  testId: z.string().trim().min(1, 'Test is required'),
  /** Where to send them afterwards. Normalised server-side before use. */
  next: z.string().trim().optional(),
});

export type GuestStartInput = z.infer<typeof guestStartSchema>;

/**
 * Reduces a number to its ten national digits, dropping any +91 prefix and
 * separators, so "+91 98765 43210" and "9876543210" are one person rather
 * than two leads.
 */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}
