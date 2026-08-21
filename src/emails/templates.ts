import { publicEnv } from '@/lib/env';
import { formatDate, formatPaise, percentage } from '@/lib/utils';

import { escapeHtml, renderEmail, renderPlainText, type EmailLayoutOptions } from './layout';

/**
 * Transactional email templates.
 *
 * Each template returns a `{ subject, html, text }` triple. Values that come
 * from user input (names, test titles, ticket subjects) are escaped by the
 * layout's `escapeHtml`; only the small amount of `<strong>` markup composed
 * here is intentionally raw.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function build(subject: string, options: EmailLayoutOptions): RenderedEmail {
  return { subject, html: renderEmail(options), text: renderPlainText(options) };
}

const url = (path: string) => `${publicEnv.appUrl}${path}`;
const strong = (value: string) => `<strong>${escapeHtml(value)}</strong>`;

// ---------------------------------------------------------------------------
// Account lifecycle
// ---------------------------------------------------------------------------

export function verifyEmailTemplate(input: { name: string; token: string }): RenderedEmail {
  return build(`Verify your email — ${publicEnv.appName}`, {
    preheader: 'Confirm your email address to activate your account.',
    heading: `Welcome, ${escapeHtml(input.name.split(' ')[0] ?? input.name)}`,
    body: [
      `Thanks for creating an account with ${strong(publicEnv.appName)}. Confirm your email address to unlock test series, practice sessions and your performance dashboard.`,
    ],
    button: { label: 'Verify email address', url: url(`/verify-email?token=${input.token}`) },
    footnote:
      'This link expires in 24 hours. If you did not create this account, you can safely ignore this email.',
  });
}

export function welcomeTemplate(input: { name: string }): RenderedEmail {
  return build(`Your ${publicEnv.appName} account is ready`, {
    preheader: 'Here is how to get the most out of your preparation.',
    heading: `You're all set, ${escapeHtml(input.name.split(' ')[0] ?? input.name)}`,
    body: [
      'Your email is verified and your account is active. Here is a good first move: attempt a free mock test so the platform can establish your baseline.',
      'Once you have one test behind you, your dashboard starts showing accuracy trends, weak topics and a recommended study order.',
    ],
    button: { label: 'Go to your dashboard', url: url('/dashboard') },
  });
}

export function passwordResetTemplate(input: { name: string; token: string }): RenderedEmail {
  return build(`Reset your ${publicEnv.appName} password`, {
    preheader: 'A password reset was requested for your account.',
    heading: 'Reset your password',
    body: [
      `Hi ${escapeHtml(input.name.split(' ')[0] ?? input.name)}, we received a request to reset the password for your account.`,
      'Choose a new password using the link below. Your current password stays active until you complete the reset.',
    ],
    button: { label: 'Choose a new password', url: url(`/reset-password/${input.token}`) },
    footnote:
      'This link expires in 1 hour and can be used only once. If you did not request a reset, no action is needed — your account remains secure.',
  });
}

export function passwordChangedTemplate(input: { name: string; when: Date; ip?: string | null }): RenderedEmail {
  return build(`Your ${publicEnv.appName} password was changed`, {
    preheader: 'Confirming a recent change to your account security.',
    heading: 'Your password was changed',
    body: [
      `Hi ${escapeHtml(input.name.split(' ')[0] ?? input.name)}, the password for your account was changed successfully.`,
      'If this was you, no further action is needed. If it was not, reset your password immediately and contact our support team.',
    ],
    details: [
      { label: 'Changed on', value: formatDate(input.when, 'full') },
      ...(input.ip ? [{ label: 'IP address', value: input.ip }] : []),
    ],
    button: { label: 'Review account security', url: url('/settings/security') },
  });
}

// ---------------------------------------------------------------------------
// Commerce
// ---------------------------------------------------------------------------

export function paymentSuccessTemplate(input: {
  name: string;
  orderNumber: string;
  productName: string;
  amountInPaise: number;
  paymentId: string;
  paidAt: Date;
}): RenderedEmail {
  return build(`Payment received — ${input.orderNumber}`, {
    preheader: `Your purchase of ${input.productName} is confirmed.`,
    heading: 'Payment successful',
    body: [
      `Hi ${escapeHtml(input.name.split(' ')[0] ?? input.name)}, we have received your payment and your access is now active.`,
    ],
    details: [
      { label: 'Order number', value: input.orderNumber },
      { label: 'Product', value: input.productName },
      { label: 'Amount paid', value: formatPaise(input.amountInPaise, { showDecimals: true }) },
      { label: 'Payment ID', value: input.paymentId },
      { label: 'Date', value: formatDate(input.paidAt, 'full') },
    ],
    button: { label: 'Start preparing', url: url('/my-tests') },
    footnote: 'Your invoice is available to download from your orders page at any time.',
  });
}

export function subscriptionActivatedTemplate(input: {
  name: string;
  planName: string;
  expiresAt: Date;
}): RenderedEmail {
  return build(`${input.planName} is now active`, {
    preheader: 'Your subscription has been activated.',
    heading: `${escapeHtml(input.planName)} is active`,
    body: [
      `Hi ${escapeHtml(input.name.split(' ')[0] ?? input.name)}, your subscription is live and every included test series is now unlocked.`,
    ],
    details: [
      { label: 'Plan', value: input.planName },
      { label: 'Valid until', value: formatDate(input.expiresAt, 'long') },
    ],
    button: { label: 'Explore your test series', url: url('/test-series') },
  });
}

export function subscriptionExpiringTemplate(input: {
  name: string;
  planName: string;
  expiresAt: Date;
  daysRemaining: number;
}): RenderedEmail {
  const dayWord = input.daysRemaining === 1 ? 'day' : 'days';
  return build(`Your ${input.planName} expires in ${input.daysRemaining} ${dayWord}`, {
    preheader: 'Renew to keep your test series and analytics.',
    heading: `Your subscription ends in ${input.daysRemaining} ${dayWord}`,
    body: [
      `Hi ${escapeHtml(input.name.split(' ')[0] ?? input.name)}, your ${strong(input.planName)} subscription is approaching its expiry date.`,
      'Renewing keeps your test series, performance history and analytics available without interruption. Your past results are never deleted.',
    ],
    details: [
      { label: 'Plan', value: input.planName },
      { label: 'Expires on', value: formatDate(input.expiresAt, 'long') },
    ],
    button: { label: 'Renew subscription', url: url('/pricing') },
  });
}

// ---------------------------------------------------------------------------
// Learning
// ---------------------------------------------------------------------------

export function testResultTemplate(input: {
  name: string;
  testTitle: string;
  score: number;
  maxScore: number;
  accuracy: number;
  rank?: number | null;
  percentile?: number | null;
  attemptId: string;
}): RenderedEmail {
  const scoreLine = `${input.score} / ${input.maxScore}`;

  return build(`Your result for ${input.testTitle}`, {
    preheader: `You scored ${scoreLine}. See the full breakdown.`,
    heading: 'Your result is ready',
    body: [
      `Hi ${escapeHtml(input.name.split(' ')[0] ?? input.name)}, your result for ${strong(input.testTitle)} has been published.`,
      'The full report breaks your performance down by subject, chapter, topic and difficulty, and shows exactly which questions to revisit first.',
    ],
    details: [
      { label: 'Score', value: scoreLine },
      { label: 'Percentage', value: `${percentage(input.score, input.maxScore)}%` },
      { label: 'Accuracy', value: `${Math.round(input.accuracy)}%` },
      ...(input.rank ? [{ label: 'Rank', value: `#${input.rank}` }] : []),
      ...(input.percentile != null
        ? [{ label: 'Percentile', value: `${Math.round(input.percentile * 10) / 10}` }]
        : []),
    ],
    button: { label: 'View detailed analysis', url: url(`/test/${input.attemptId}/result`) },
  });
}

export function testReminderTemplate(input: {
  name: string;
  testTitle: string;
  startsAt: Date;
  testId: string;
}): RenderedEmail {
  return build(`Reminder: ${input.testTitle}`, {
    preheader: 'A scheduled test is coming up.',
    heading: 'Your test is coming up',
    body: [
      `Hi ${escapeHtml(input.name.split(' ')[0] ?? input.name)}, this is a reminder that ${strong(input.testTitle)} is scheduled soon.`,
      'Find a quiet spot, check your internet connection, and give it a clean run — your analytics are only as useful as the attempts behind them.',
    ],
    details: [{ label: 'Starts', value: formatDate(input.startsAt, 'full') }],
    button: { label: 'Open the test', url: url(`/test/${input.testId}`) },
  });
}

export function newTestTemplate(input: {
  name: string;
  testTitle: string;
  seriesName: string;
  testId: string;
}): RenderedEmail {
  return build(`New test available: ${input.testTitle}`, {
    preheader: `${input.testTitle} has been added to ${input.seriesName}.`,
    heading: 'A new test is available',
    body: [
      `${strong(input.testTitle)} has just been published in ${strong(input.seriesName)}, and it is already unlocked for you.`,
    ],
    button: { label: 'Attempt the test', url: url(`/test/${input.testId}`) },
  });
}

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------

export function supportTicketUpdateTemplate(input: {
  name: string;
  ticketNumber: string;
  subject: string;
  status: string;
  message?: string;
}): RenderedEmail {
  return build(`[${input.ticketNumber}] ${input.subject}`, {
    preheader: `Your support ticket has been updated: ${input.status}.`,
    heading: 'Update on your support ticket',
    body: [
      `Hi ${escapeHtml(input.name.split(' ')[0] ?? input.name)}, there is an update on your ticket ${strong(input.ticketNumber)}.`,
      ...(input.message ? [escapeHtml(input.message)] : []),
    ],
    details: [
      { label: 'Ticket', value: input.ticketNumber },
      { label: 'Subject', value: input.subject },
      { label: 'Status', value: input.status.replace(/_/g, ' ').toLowerCase() },
    ],
    button: { label: 'View the ticket', url: url('/support') },
  });
}

/** Sent when an admin manually grants access without a payment. */
export function accessGrantedTemplate(input: {
  name: string;
  productName: string;
  expiresAt?: Date | null;
}): RenderedEmail {
  return build(`You now have access to ${input.productName}`, {
    preheader: 'Access has been added to your account.',
    heading: 'Access granted',
    body: [
      `Hi ${escapeHtml(input.name.split(' ')[0] ?? input.name)}, ${strong(input.productName)} has been added to your account and is ready to use.`,
    ],
    details: [
      { label: 'Product', value: input.productName },
      {
        label: 'Access until',
        value: input.expiresAt ? formatDate(input.expiresAt, 'long') : 'No expiry',
      },
    ],
    button: { label: 'Start now', url: url('/my-tests') },
  });
}
