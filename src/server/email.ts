import 'server-only';

import type { RenderedEmail } from '@/emails/templates';
import { serverEnv } from '@/lib/env';
import { maskEmail } from '@/lib/utils';
import { db } from '@/server/db';
import { logger } from '@/server/logger';

/**
 * Transactional email delivery.
 *
 * A provider abstraction sits in front of the concrete integration so that
 * swapping Resend for SES or Postmark touches one file. In development the
 * `console` provider prints the message instead of sending it, which keeps a
 * fresh checkout fully functional with no API keys.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<{ id: string | null }>;
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

/** Development provider: logs the email rather than delivering it. */
class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console';

  async send(message: EmailMessage) {
    logger.info(
      {
        to: maskEmail(message.to),
        subject: message.subject,
        preview: message.text.slice(0, 400),
      },
      'Email (console provider — not delivered)',
    );
    return { id: null };
  }
}

class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage) {
    const { Resend } = await import('resend');
    const client = new Resend(this.apiKey);

    const { data, error } = await client.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
    });

    if (error) {
      throw new Error(`Resend rejected the message: ${error.message}`);
    }
    return { id: data?.id ?? null };
  }
}

let providerInstance: EmailProvider | null = null;

function getProvider(): EmailProvider {
  if (providerInstance) return providerInstance;

  const env = serverEnv();
  providerInstance =
    env.EMAIL_PROVIDER === 'resend' && env.EMAIL_API_KEY
      ? new ResendEmailProvider(env.EMAIL_API_KEY, env.EMAIL_FROM)
      : new ConsoleEmailProvider();

  return providerInstance;
}

// ---------------------------------------------------------------------------
// Preference-aware sending
// ---------------------------------------------------------------------------

/**
 * Email categories.
 *
 * `transactional` messages are sent regardless of preferences — they are
 * security or purchase records the user is entitled to receive, and suppressing
 * them would be both hostile and, for receipts, legally questionable.
 * Everything else is suppressible.
 */
export type EmailCategory =
  | 'transactional'
  | 'result'
  | 'test-reminder'
  | 'study-reminder'
  | 'subscription'
  | 'achievement'
  | 'marketing';

/** Maps a category to the `NotificationPreference` column that gates it. */
const PREFERENCE_FIELD: Record<Exclude<EmailCategory, 'transactional'>, string> = {
  result: 'resultAlerts',
  'test-reminder': 'testReminders',
  'study-reminder': 'studyReminders',
  subscription: 'subscriptionAlerts',
  achievement: 'achievementAlerts',
  marketing: 'marketingEmails',
};

export interface SendEmailOptions {
  to: string;
  email: RenderedEmail;
  category?: EmailCategory;
  /** When given, the user's notification preferences are respected. */
  userId?: string;
}

export interface SendEmailResult {
  sent: boolean;
  id?: string | null;
  /** Set when the send was intentionally skipped rather than failed. */
  skippedReason?: 'preference-opted-out' | 'email-disabled';
}

/**
 * Sends one email, honouring the recipient's notification preferences for
 * non-transactional categories.
 *
 * Never throws: a delivery failure is logged and reported in the return value.
 * Callers are user-facing flows (registration, checkout) that must not fail
 * because an email provider had a bad minute — the account is created and the
 * payment is recorded either way.
 */
export async function sendEmail({
  to,
  email,
  category = 'transactional',
  userId,
}: SendEmailOptions): Promise<SendEmailResult> {
  try {
    if (category !== 'transactional' && userId) {
      const allowed = await isEmailAllowed(userId, category);
      if (!allowed) {
        logger.debug({ userId, category }, 'Email suppressed by user preference');
        return { sent: false, skippedReason: 'preference-opted-out' };
      }
    }

    const env = serverEnv();
    const provider = getProvider();

    const result = await provider.send({
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(env.EMAIL_REPLY_TO ? { replyTo: env.EMAIL_REPLY_TO } : {}),
    });

    logger.info(
      { to: maskEmail(to), subject: email.subject, provider: provider.name, category },
      'Email sent',
    );
    return { sent: true, id: result.id };
  } catch (error) {
    logger.error({ error, to: maskEmail(to), subject: email.subject }, 'Failed to send email');
    return { sent: false };
  }
}

/** Checks the recipient's preferences for a suppressible category. */
async function isEmailAllowed(userId: string, category: Exclude<EmailCategory, 'transactional'>) {
  const preference = await db.notificationPreference.findUnique({
    where: { userId },
    select: {
      emailEnabled: true,
      resultAlerts: true,
      testReminders: true,
      studyReminders: true,
      subscriptionAlerts: true,
      achievementAlerts: true,
      marketingEmails: true,
    },
  });

  // No preference row yet means defaults apply, and defaults permit sending
  // everything except marketing.
  if (!preference) return category !== 'marketing';
  if (!preference.emailEnabled) return false;

  const field = PREFERENCE_FIELD[category] as keyof typeof preference;
  return preference[field] !== false;
}

/**
 * Queues an email through the background job table instead of sending inline.
 * Prefer this anywhere the send is not needed to complete the user's request.
 */
export async function queueEmail(options: {
  to: string;
  template: string;
  payload: Record<string, unknown>;
  category?: EmailCategory;
  userId?: string;
  idempotencyKey?: string;
}) {
  await db.job.create({
    data: {
      type: 'SEND_EMAIL',
      payloadJson: JSON.stringify(options),
      ...(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
    },
  });
}

/** Test seam: forces a specific provider instance. */
export function __setEmailProvider(provider: EmailProvider | null) {
  providerInstance = provider;
}
