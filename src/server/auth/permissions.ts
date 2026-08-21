import { ROLE_RANK, type UserRole } from '@/lib/enums';

/**
 * Role-based access control.
 *
 * A permission is a dot-namespaced capability string. Each role owns a fixed
 * base set defined here; individual users may additionally be granted or
 * revoked single permissions via the `UserPermission` table, which is layered
 * on top at resolution time.
 *
 * This module is pure and importable from the edge middleware — it must not
 * touch the database.
 */

export const PERMISSIONS = {
  // Users & accounts -------------------------------------------------------
  USER_READ: 'user.read',
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_SUSPEND: 'user.suspend',
  USER_DELETE: 'user.delete',
  /** Change someone's role — separated because it enables privilege escalation. */
  USER_ASSIGN_ROLE: 'user.assign_role',
  /** Manually grant a test series or plan without payment. */
  USER_GRANT_ACCESS: 'user.grant_access',
  /** Terminate another user's sessions. */
  SESSION_REVOKE_ANY: 'session.revoke_any',
  /** Create or modify other admin accounts. */
  ADMIN_MANAGE: 'admin.manage',

  // Exam taxonomy ----------------------------------------------------------
  EXAM_READ: 'exam.read',
  EXAM_MANAGE: 'exam.manage',
  TAXONOMY_MANAGE: 'taxonomy.manage',

  // Question bank ----------------------------------------------------------
  QUESTION_READ: 'question.read',
  QUESTION_CREATE: 'question.create',
  QUESTION_UPDATE: 'question.update',
  QUESTION_DELETE: 'question.delete',
  /** Move a question into or out of UNDER_REVIEW. */
  QUESTION_REVIEW: 'question.review',
  QUESTION_APPROVE: 'question.approve',
  QUESTION_PUBLISH: 'question.publish',
  QUESTION_IMPORT: 'question.import',
  QUESTION_EXPORT: 'question.export',

  // Tests ------------------------------------------------------------------
  TEST_READ: 'test.read',
  TEST_CREATE: 'test.create',
  TEST_UPDATE: 'test.update',
  TEST_DELETE: 'test.delete',
  TEST_PUBLISH: 'test.publish',

  TEST_SERIES_READ: 'test_series.read',
  TEST_SERIES_MANAGE: 'test_series.manage',
  TEST_SERIES_PUBLISH: 'test_series.publish',

  // Commerce ---------------------------------------------------------------
  ORDER_READ: 'order.read',
  ORDER_REFUND: 'order.refund',
  PAYMENT_READ: 'payment.read',
  COUPON_READ: 'coupon.read',
  COUPON_MANAGE: 'coupon.manage',
  PLAN_MANAGE: 'plan.manage',
  SUBSCRIPTION_READ: 'subscription.read',
  SUBSCRIPTION_MANAGE: 'subscription.manage',

  // Analytics --------------------------------------------------------------
  ANALYTICS_READ: 'analytics.read',
  /** Revenue, conversion and payout figures. */
  ANALYTICS_FINANCIAL: 'analytics.financial',
  /** Aggregate performance of students other than oneself. */
  STUDENT_PERFORMANCE_READ: 'student_performance.read',

  // Content ----------------------------------------------------------------
  CONTENT_MANAGE: 'content.manage',
  BLOG_MANAGE: 'blog.manage',
  ANNOUNCEMENT_MANAGE: 'announcement.manage',
  MATERIAL_MANAGE: 'material.manage',
  MEDIA_UPLOAD: 'media.upload',
  MEDIA_DELETE: 'media.delete',

  // Support ----------------------------------------------------------------
  TICKET_READ: 'ticket.read',
  TICKET_RESPOND: 'ticket.respond',
  TICKET_ASSIGN: 'ticket.assign',
  TICKET_CLOSE: 'ticket.close',
  QUESTION_REPORT_READ: 'question_report.read',
  QUESTION_REPORT_RESOLVE: 'question_report.resolve',

  // AI ---------------------------------------------------------------------
  AI_GENERATE: 'ai.generate',
  AI_SETTINGS: 'ai.settings',

  // Platform ---------------------------------------------------------------
  SETTINGS_READ: 'settings.read',
  SETTINGS_MANAGE: 'settings.manage',
  AUDIT_READ: 'audit.read',
  NOTIFICATION_BROADCAST: 'notification.broadcast',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

/** Human-readable grouping used to render the admin permission matrix. */
export const PERMISSION_CATEGORIES: Record<string, Permission[]> = {
  Users: [
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_SUSPEND,
    PERMISSIONS.USER_DELETE,
    PERMISSIONS.USER_ASSIGN_ROLE,
    PERMISSIONS.USER_GRANT_ACCESS,
    PERMISSIONS.SESSION_REVOKE_ANY,
    PERMISSIONS.ADMIN_MANAGE,
  ],
  Content: [
    PERMISSIONS.EXAM_READ,
    PERMISSIONS.EXAM_MANAGE,
    PERMISSIONS.TAXONOMY_MANAGE,
    PERMISSIONS.CONTENT_MANAGE,
    PERMISSIONS.BLOG_MANAGE,
    PERMISSIONS.ANNOUNCEMENT_MANAGE,
    PERMISSIONS.MATERIAL_MANAGE,
    PERMISSIONS.MEDIA_UPLOAD,
    PERMISSIONS.MEDIA_DELETE,
  ],
  Questions: [
    PERMISSIONS.QUESTION_READ,
    PERMISSIONS.QUESTION_CREATE,
    PERMISSIONS.QUESTION_UPDATE,
    PERMISSIONS.QUESTION_DELETE,
    PERMISSIONS.QUESTION_REVIEW,
    PERMISSIONS.QUESTION_APPROVE,
    PERMISSIONS.QUESTION_PUBLISH,
    PERMISSIONS.QUESTION_IMPORT,
    PERMISSIONS.QUESTION_EXPORT,
  ],
  Tests: [
    PERMISSIONS.TEST_READ,
    PERMISSIONS.TEST_CREATE,
    PERMISSIONS.TEST_UPDATE,
    PERMISSIONS.TEST_DELETE,
    PERMISSIONS.TEST_PUBLISH,
    PERMISSIONS.TEST_SERIES_READ,
    PERMISSIONS.TEST_SERIES_MANAGE,
    PERMISSIONS.TEST_SERIES_PUBLISH,
  ],
  Commerce: [
    PERMISSIONS.ORDER_READ,
    PERMISSIONS.ORDER_REFUND,
    PERMISSIONS.PAYMENT_READ,
    PERMISSIONS.COUPON_READ,
    PERMISSIONS.COUPON_MANAGE,
    PERMISSIONS.PLAN_MANAGE,
    PERMISSIONS.SUBSCRIPTION_READ,
    PERMISSIONS.SUBSCRIPTION_MANAGE,
  ],
  Support: [
    PERMISSIONS.TICKET_READ,
    PERMISSIONS.TICKET_RESPOND,
    PERMISSIONS.TICKET_ASSIGN,
    PERMISSIONS.TICKET_CLOSE,
    PERMISSIONS.QUESTION_REPORT_READ,
    PERMISSIONS.QUESTION_REPORT_RESOLVE,
  ],
  Insights: [
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.ANALYTICS_FINANCIAL,
    PERMISSIONS.STUDENT_PERFORMANCE_READ,
  ],
  Platform: [
    PERMISSIONS.AI_GENERATE,
    PERMISSIONS.AI_SETTINGS,
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.NOTIFICATION_BROADCAST,
  ],
};

/**
 * Base permission set per role.
 *
 * There are exactly two roles. An admin runs the platform and therefore holds
 * every permission; a student holds none of them — everything a student may do
 * (attempt tests, practise, buy access) is authorised by ownership of the
 * record, not by a permission flag.
 *
 * Per-user overrides still apply on top, which is how a specific admin can be
 * temporarily restricted without inventing a third role.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: ALL_PERMISSIONS,
  STUDENT: [],
};

/** Pre-built lookup sets so permission checks are O(1). */
const ROLE_PERMISSION_SETS: Record<UserRole, ReadonlySet<Permission>> = {
  ADMIN: new Set(ROLE_PERMISSIONS.ADMIN),
  STUDENT: new Set(ROLE_PERMISSIONS.STUDENT),
};

/** Extra grants/revocations applied on top of the role's base set. */
export interface PermissionOverrides {
  granted?: string[];
  revoked?: string[];
}

/**
 * Resolves whether a role (plus any per-user overrides) holds a permission.
 * An explicit revocation always wins, including for an admin, so a
 * compromised account can be defanged without changing its role.
 */
export function hasPermission(
  role: UserRole,
  permission: Permission,
  overrides: PermissionOverrides = {},
): boolean {
  if (overrides.revoked?.includes(permission)) return false;
  if (overrides.granted?.includes(permission)) return true;
  return ROLE_PERMISSION_SETS[role]?.has(permission) ?? false;
}

export function hasAnyPermission(
  role: UserRole,
  permissions: Permission[],
  overrides: PermissionOverrides = {},
): boolean {
  return permissions.some((p) => hasPermission(role, p, overrides));
}

export function hasAllPermissions(
  role: UserRole,
  permissions: Permission[],
  overrides: PermissionOverrides = {},
): boolean {
  return permissions.every((p) => hasPermission(role, p, overrides));
}

/** The effective permission list for a user, after overrides. */
export function resolvePermissions(role: UserRole, overrides: PermissionOverrides = {}): Permission[] {
  const set = new Set(ROLE_PERMISSIONS[role] ?? []);
  for (const p of overrides.granted ?? []) set.add(p as Permission);
  for (const p of overrides.revoked ?? []) set.delete(p as Permission);
  return [...set];
}

/** True when `role` sits at or above `minimum` in the hierarchy. */
export function atLeastRole(role: UserRole, minimum: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/** Roles permitted to open the /admin area. Only one qualifies. */
export const ADMIN_AREA_ROLES: readonly UserRole[] = ['ADMIN'];

/**
 * Any staff role — used to redirect staff away from the student dashboard.
 * Retained as a named concept so call sites read clearly, even though it is
 * now a single role.
 */
export const STAFF_ROLES: readonly UserRole[] = ['ADMIN'];

export function isStaff(role: UserRole): boolean {
  return STAFF_ROLES.includes(role);
}

/**
 * Landing route for a role immediately after sign-in.
 * Admins never land on the student dashboard, and vice versa.
 */
export function defaultRouteForRole(role: UserRole): string {
  return role === 'ADMIN' ? '/admin' : '/dashboard';
}
