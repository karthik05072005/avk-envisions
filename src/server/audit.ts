import 'server-only';

import { db, type DbClient } from '@/server/db';
import { logger } from '@/server/logger';

/**
 * Audit logging.
 *
 * Records who did what to which entity. Writes are best-effort by default: a
 * logging failure must never roll back the business operation that succeeded.
 * Pass a transaction client when the audit entry genuinely must be atomic with
 * the change (financial and permission events).
 */

/** Canonical action verbs. Keeping them enumerated makes the log filterable. */
export const AUDIT_ACTIONS = {
  // Authentication
  LOGIN_SUCCESS: 'auth.login',
  LOGIN_FAILED: 'auth.login_failed',
  LOGOUT: 'auth.logout',
  PASSWORD_CHANGED: 'auth.password_changed',
  PASSWORD_RESET_REQUESTED: 'auth.password_reset_requested',
  PASSWORD_RESET_COMPLETED: 'auth.password_reset_completed',
  EMAIL_VERIFIED: 'auth.email_verified',
  SESSIONS_REVOKED: 'auth.sessions_revoked',

  // Accounts
  USER_REGISTERED: 'user.registered',
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_SUSPENDED: 'user.suspended',
  PROFILE_UPDATED: 'user.profile_updated',
  USER_ACTIVATED: 'user.activated',
  USER_DELETED: 'user.deleted',
  USER_ROLE_CHANGED: 'user.role_changed',
  USER_ACCESS_GRANTED: 'user.access_granted',

  // Content
  EXAM_CREATED: 'exam.created',
  EXAM_UPDATED: 'exam.updated',
  EXAM_DELETED: 'exam.deleted',
  QUESTION_CREATED: 'question.created',
  QUESTION_UPDATED: 'question.updated',
  QUESTION_DELETED: 'question.deleted',
  QUESTION_STATUS_CHANGED: 'question.status_changed',
  QUESTION_IMPORTED: 'question.imported',
  TEST_CREATED: 'test.created',
  TEST_UPDATED: 'test.updated',
  TEST_PUBLISHED: 'test.published',
  TEST_UNPUBLISHED: 'test.unpublished',
  TEST_DELETED: 'test.deleted',
  TEST_SERIES_CREATED: 'test_series.created',
  TEST_SERIES_UPDATED: 'test_series.updated',
  TEST_SERIES_PRICE_CHANGED: 'test_series.price_changed',

  // Commerce
  ORDER_CREATED: 'order.created',
  ORDER_PAID: 'order.paid',
  ORDER_FAILED: 'order.failed',
  ORDER_REFUNDED: 'order.refunded',
  PAYMENT_VERIFIED: 'payment.verified',
  PAYMENT_WEBHOOK: 'payment.webhook',
  COUPON_CREATED: 'coupon.created',
  COUPON_UPDATED: 'coupon.updated',
  COUPON_REDEEMED: 'coupon.redeemed',
  SUBSCRIPTION_ACTIVATED: 'subscription.activated',
  SUBSCRIPTION_CANCELLED: 'subscription.cancelled',
  SUBSCRIPTION_EXPIRED: 'subscription.expired',
  PLAN_UPDATED: 'plan.updated',

  // Platform
  SETTINGS_UPDATED: 'settings.updated',
  ANNOUNCEMENT_SENT: 'announcement.sent',
  AI_GENERATION_STARTED: 'ai.generation_started',
  TICKET_CREATED: 'ticket.created',
  TICKET_REPLIED: 'ticket.replied',
  TICKET_STATUS_CHANGED: 'ticket.status_changed',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS] | (string & {});

export interface AuditActor {
  id?: string | null;
  email?: string | null;
  role?: string | null;
}

export interface AuditEntry {
  actor?: AuditActor | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  /** Contextual detail. Must never contain passwords, tokens or card data. */
  meta?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

/**
 * Keys that must never be persisted even if a caller passes them by accident.
 * Defence in depth alongside the logger's redaction list.
 */
const FORBIDDEN_META_KEYS = new Set([
  'password',
  'passwordhash',
  'newpassword',
  'currentpassword',
  'token',
  'tokenhash',
  'secret',
  'signature',
  'apikey',
  'razorpaysignature',
  'cardnumber',
  'cvv',
]);

function sanitizeMeta(meta: Record<string, unknown> | undefined): string {
  if (!meta) return '{}';

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (FORBIDDEN_META_KEYS.has(key.toLowerCase())) {
      clean[key] = '[redacted]';
      continue;
    }
    // Keep entries small; audit rows are read in bulk in the admin table.
    clean[key] = typeof value === 'string' && value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }

  try {
    return JSON.stringify(clean);
  } catch {
    return '{"error":"meta-not-serialisable"}';
  }
}

/**
 * Writes an audit entry.
 *
 * @param client Pass a transaction client to make the entry atomic with the
 *               operation it describes; omit for best-effort logging.
 */
export async function audit(entry: AuditEntry, client: DbClient = db): Promise<void> {
  const data = {
    actorId: entry.actor?.id ?? null,
    actorEmail: entry.actor?.email ?? null,
    actorRole: entry.actor?.role ?? null,
    action: entry.action,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
    metaJson: sanitizeMeta(entry.meta),
    ipAddress: entry.ipAddress ?? null,
    userAgent: entry.userAgent ?? null,
    requestId: entry.requestId ?? null,
  };

  if (client !== db) {
    // Inside a transaction the caller wants atomicity, so let errors propagate.
    await client.auditLog.create({ data });
    return;
  }

  try {
    await db.auditLog.create({ data });
  } catch (error) {
    logger.error({ error, action: entry.action }, 'Failed to write audit log');
  }
}

/** Extracts request metadata for an audit entry from a Fetch API Request. */
export function auditContextFromRequest(request: Request) {
  return {
    ipAddress: clientIp(request),
    userAgent: request.headers.get('user-agent'),
  };
}

/**
 * Best-effort client IP.
 *
 * `x-forwarded-for` is client-controllable unless a trusted proxy overwrites
 * it, so this value is fine for rate limiting and audit context but must never
 * be used as an authorization signal.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip') ?? request.headers.get('cf-connecting-ip') ?? 'unknown';
}
