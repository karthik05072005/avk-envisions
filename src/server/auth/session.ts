import 'server-only';

import { cookies } from 'next/headers';

import { isProduction, serverEnv } from '@/lib/env';
import type { UserRole, UserStatus } from '@/lib/enums';
import { db } from '@/server/db';
import { logger } from '@/server/logger';

import { generateToken, hashToken } from './tokens';
import type { Permission, PermissionOverrides } from './permissions';
import { resolvePermissions } from './permissions';

/**
 * Database-backed sessions.
 *
 * A stateless JWT cannot satisfy this product's requirements: students must be
 * able to see their active devices and sign out of all of them, and admins must
 * be able to terminate a session immediately. Both need server-side revocation,
 * so the session lives in the database and the cookie carries only an opaque
 * random token.
 *
 * Two independent revocation mechanisms exist:
 *   1. `Session.revokedAt` — kills one specific device.
 *   2. `User.sessionEpoch` — incremented on password change or "sign out
 *      everywhere"; every session carrying a stale epoch is rejected without
 *      needing to update each row.
 */

export const SESSION_COOKIE_NAME = 'avk_session';

/** Refresh the sliding expiry at most this often, to avoid a write per request. */
const SLIDING_REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  avatarUrl: string | null;
  permissions: Permission[];
}

export interface AuthenticatedSession {
  sessionId: string;
  user: SessionUser;
  expiresAt: Date;
}

function sessionMaxAgeMs() {
  return serverEnv().SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

function cookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: isProduction(),
    /**
     * `lax` keeps the cookie on top-level navigations (needed for email
     * verification and Razorpay's return redirect) while still blocking it on
     * cross-site subrequests, which is what defeats CSRF for state-changing
     * POSTs.
     */
    sameSite: 'lax' as const,
    path: '/',
    expires: expiresAt,
  };
}

/** Best-effort device labelling for the session list. Never used for security. */
export function parseUserAgent(userAgent: string | null | undefined) {
  const ua = userAgent ?? '';

  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua) && !/Chrome/.test(ua)
          ? 'Safari'
          : /Firefox\//.test(ua)
            ? 'Firefox'
            : 'Unknown browser';

  const os = /Windows NT/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad|iPod/.test(ua)
        ? 'iOS'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Unknown OS';

  const device = /Mobile|Android|iPhone/.test(ua)
    ? 'Mobile'
    : /iPad|Tablet/.test(ua)
      ? 'Tablet'
      : 'Desktop';

  return { browser, os, device };
}

export interface CreateSessionInput {
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Issues a new session and writes the cookie. Returns the raw token only so
 * callers can log it out in tests; production code should ignore it.
 */
export async function createSession({ userId, ipAddress, userAgent }: CreateSessionInput) {
  const { token, tokenHash } = generateToken();
  const expiresAt = new Date(Date.now() + sessionMaxAgeMs());
  const { browser, os, device } = parseUserAgent(userAgent);

  // Bind the session to the user's current epoch so a later password change
  // invalidates it automatically.
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { sessionEpoch: true },
  });
  if (!user) throw new Error(`Cannot create a session for unknown user ${userId}`);

  const session = await db.session.create({
    data: {
      userId,
      tokenHash,
      epoch: user.sessionEpoch,
      expiresAt,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      browser,
      os,
      device,
    },
    select: { id: true },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, cookieOptions(expiresAt));

  return { sessionId: session.id, token, expiresAt };
}

/**
 * Resolves the current session from the request cookie.
 *
 * Returns `null` for every failure mode — missing, expired, revoked, stale
 * epoch, suspended or deleted account — so callers never have to distinguish
 * "no cookie" from "bad cookie".
 */
export async function getSession(): Promise<AuthenticatedSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const record = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      epoch: true,
      expiresAt: true,
      revokedAt: true,
      lastActiveAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          emailVerified: true,
          avatarUrl: true,
          sessionEpoch: true,
          deletedAt: true,
          extraPermissions: {
            select: { granted: true, permission: { select: { key: true } } },
          },
        },
      },
    },
  });

  if (!record) return null;
  if (record.revokedAt) return null;
  if (record.expiresAt.getTime() <= Date.now()) return null;

  const { user } = record;
  if (user.deletedAt) return null;
  if (user.status === 'SUSPENDED' || user.status === 'DELETED') return null;
  if (record.epoch !== user.sessionEpoch) return null;

  // Sliding expiry: extend the window, but only once a day so that a busy
  // student does not generate a database write on every page view.
  const staleness = Date.now() - record.lastActiveAt.getTime();
  if (staleness > SLIDING_REFRESH_THRESHOLD_MS) {
    const newExpiry = new Date(Date.now() + sessionMaxAgeMs());
    void db.session
      .update({
        where: { id: record.id },
        data: { lastActiveAt: new Date(), expiresAt: newExpiry },
      })
      .catch((error) => logger.warn({ error, sessionId: record.id }, 'Failed to refresh session expiry'));
  }

  const overrides: PermissionOverrides = {
    granted: user.extraPermissions.filter((p) => p.granted).map((p) => p.permission.key),
    revoked: user.extraPermissions.filter((p) => !p.granted).map((p) => p.permission.key),
  };

  return {
    sessionId: record.id,
    expiresAt: record.expiresAt,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
      status: user.status as UserStatus,
      emailVerified: Boolean(user.emailVerified),
      avatarUrl: user.avatarUrl,
      permissions: resolvePermissions(user.role as UserRole, overrides),
    },
  };
}

/**
 * The id of the session backing the current request, if any.
 * Used to label "this device" in the session list and to keep the current
 * device signed in across a global revocation.
 */
export async function currentSessionId(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return undefined;

  const record = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true },
  });
  return record?.id;
}

/** Signs the current device out and clears the cookie. */
export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await db.session
      .updateMany({
        where: { tokenHash: hashToken(token), revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch((error) => logger.warn({ error }, 'Failed to revoke session row on logout'));
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

/** Revokes one specific session. Used by the device list and by admins. */
export async function revokeSession(sessionId: string, userId?: string) {
  await db.session.updateMany({
    where: { id: sessionId, revokedAt: null, ...(userId ? { userId } : {}) },
    data: { revokedAt: new Date() },
  });
}

/**
 * Signs a user out of every device.
 *
 * Bumping `sessionEpoch` is what makes this instantaneous and total: any
 * session still holding the old epoch fails validation on its next request,
 * including ones issued a millisecond ago.
 */
export async function revokeAllSessions(userId: string, options: { exceptSessionId?: string } = {}) {
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { sessionEpoch: { increment: 1 } },
    }),
    db.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(options.exceptSessionId ? { id: { not: options.exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    }),
  ]);
}

/**
 * Re-issues the current device's session after a global revocation, so that
 * "sign out of all other devices" does not sign the user out of this one.
 */
export async function rotateCurrentSession(userId: string, ipAddress?: string | null, userAgent?: string | null) {
  await revokeAllSessions(userId);
  return createSession({ userId, ipAddress, userAgent });
}

/** Lists a user's live sessions for the security settings screen. */
export async function listActiveSessions(userId: string) {
  return db.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastActiveAt: 'desc' },
    select: {
      id: true,
      device: true,
      browser: true,
      os: true,
      ipAddress: true,
      lastActiveAt: true,
      createdAt: true,
      expiresAt: true,
    },
  });
}

/** Housekeeping: drops expired and long-revoked rows. Run from the job worker. */
export async function pruneExpiredSessions() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const result = await db.session.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: cutoff } }],
    },
  });
  return result.count;
}
