/**
 * Application-level enums.
 *
 * SQLite has no native ENUM type, so every "enum" column in `schema.prisma` is
 * a `String`. This module is the single source of truth for the values those
 * columns may hold: each enum is declared once as a readonly tuple, exposed as
 * a const object for ergonomic access, a TypeScript union for compile-time
 * safety, and a Zod schema for runtime validation at every API boundary.
 *
 * Adding a value means adding it here — never inline a bare string literal in
 * feature code.
 */
import { z } from 'zod';

/** Builds the const-object / union / zod trio from a tuple of values. */
function buildEnum<const T extends readonly [string, ...string[]]>(values: T) {
  const obj = Object.freeze(
    Object.fromEntries(values.map((v) => [v, v])) as { [K in T[number]]: K },
  );
  return {
    values,
    ...obj,
    schema: z.enum(values),
    options: values as unknown as T[number][],
    is: (value: unknown): value is T[number] =>
      typeof value === 'string' && (values as readonly string[]).includes(value),
  };
}

// ---------------------------------------------------------------------------
// Identity & access
// ---------------------------------------------------------------------------

export const UserRole = buildEnum(['ADMIN', 'STUDENT'] as const);
export type UserRole = (typeof UserRole.values)[number];

export const UserStatus = buildEnum([
  'ACTIVE',
  'SUSPENDED',
  'PENDING_VERIFICATION',
  'DELETED',
] as const);
export type UserStatus = (typeof UserStatus.values)[number];

/**
 * Role hierarchy used for "at least this role" checks. Higher wins.
 *
 * With two roles the ordering is trivial, but the ranking is kept so
 * `atLeastRole()` call sites stay meaningful if the model ever grows again.
 */
export const ROLE_RANK: Record<UserRole, number> = {
  STUDENT: 0,
  ADMIN: 100,
};

export const Language = buildEnum(['en', 'kn', 'hi', 'te', 'ta', 'ml'] as const);
export type Language = (typeof Language.values)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  kn: 'ಕನ್ನಡ',
  hi: 'हिन्दी',
  te: 'తెలుగు',
  ta: 'தமிழ்',
  ml: 'മലയാളം',
};

// ---------------------------------------------------------------------------
// Exam taxonomy
// ---------------------------------------------------------------------------

export const ExamCategory = buildEnum([
  'ENGINEERING',
  'MEDICAL',
  'CIVIL_SERVICES',
  'BANKING',
  'SSC',
  'STATE',
  'OTHER',
] as const);
export type ExamCategory = (typeof ExamCategory.values)[number];

export const EXAM_CATEGORY_LABELS: Record<ExamCategory, string> = {
  ENGINEERING: 'Engineering',
  MEDICAL: 'Medical',
  CIVIL_SERVICES: 'Civil Services',
  BANKING: 'Banking',
  SSC: 'SSC',
  STATE: 'State Exams',
  OTHER: 'Other',
};

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

export const QuestionType = buildEnum([
  'SINGLE_CORRECT',
  'MULTIPLE_CORRECT',
  'NUMERICAL',
  'TRUE_FALSE',
  'ASSERTION_REASON',
  'MATCH_THE_FOLLOWING',
  'PASSAGE',
  'CASE_STUDY',
  'IMAGE_BASED',
] as const);
export type QuestionType = (typeof QuestionType.values)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE_CORRECT: 'Single correct',
  MULTIPLE_CORRECT: 'Multiple correct',
  NUMERICAL: 'Numerical answer',
  TRUE_FALSE: 'True / False',
  ASSERTION_REASON: 'Assertion & Reason',
  MATCH_THE_FOLLOWING: 'Match the following',
  PASSAGE: 'Passage based',
  CASE_STUDY: 'Case study',
  IMAGE_BASED: 'Image based',
};

/** Types whose answer is expressed by selecting one or more options. */
export const OPTION_BASED_TYPES: readonly QuestionType[] = [
  'SINGLE_CORRECT',
  'MULTIPLE_CORRECT',
  'TRUE_FALSE',
  'ASSERTION_REASON',
  'PASSAGE',
  'CASE_STUDY',
  'IMAGE_BASED',
  'MATCH_THE_FOLLOWING',
];

/** Types that accept more than one correct option. */
export const MULTI_SELECT_TYPES: readonly QuestionType[] = ['MULTIPLE_CORRECT'];

export const Difficulty = buildEnum(['EASY', 'MEDIUM', 'HARD'] as const);
export type Difficulty = (typeof Difficulty.values)[number];

export const QuestionStatus = buildEnum([
  'DRAFT',
  'UNDER_REVIEW',
  'APPROVED',
  'PUBLISHED',
  'ARCHIVED',
] as const);
export type QuestionStatus = (typeof QuestionStatus.values)[number];

/**
 * Legal question status transitions. Enforced server-side so a question can
 * never jump straight from DRAFT to PUBLISHED, which is what keeps unreviewed
 * AI output out of live tests.
 */
export const QUESTION_STATUS_TRANSITIONS: Record<QuestionStatus, readonly QuestionStatus[]> = {
  DRAFT: ['UNDER_REVIEW', 'ARCHIVED'],
  UNDER_REVIEW: ['APPROVED', 'DRAFT', 'ARCHIVED'],
  APPROVED: ['PUBLISHED', 'UNDER_REVIEW', 'ARCHIVED'],
  PUBLISHED: ['ARCHIVED', 'UNDER_REVIEW'],
  ARCHIVED: ['DRAFT'],
};

export const QuestionReportReason = buildEnum([
  'WRONG_ANSWER',
  'TYPO',
  'AMBIGUOUS',
  'INCORRECT_QUESTION',
  'IMAGE_ISSUE',
  'OTHER',
] as const);
export type QuestionReportReason = (typeof QuestionReportReason.values)[number];

export const QUESTION_REPORT_REASON_LABELS: Record<QuestionReportReason, string> = {
  WRONG_ANSWER: 'The marked answer is wrong',
  TYPO: 'Spelling or formatting mistake',
  AMBIGUOUS: 'Question is ambiguous',
  INCORRECT_QUESTION: 'Question itself is incorrect',
  IMAGE_ISSUE: 'Image is missing or unclear',
  OTHER: 'Something else',
};

export const ReportStatus = buildEnum(['REPORTED', 'REVIEWING', 'RESOLVED', 'REJECTED'] as const);
export type ReportStatus = (typeof ReportStatus.values)[number];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

export const TestCategory = buildEnum([
  'FULL_MOCK',
  'SECTIONAL',
  'CHAPTER',
  'TOPIC',
  'PRACTICE',
  'PREVIOUS_YEAR',
  'CUSTOM',
] as const);
export type TestCategory = (typeof TestCategory.values)[number];

export const TEST_CATEGORY_LABELS: Record<TestCategory, string> = {
  FULL_MOCK: 'Full mock test',
  SECTIONAL: 'Sectional test',
  CHAPTER: 'Chapter test',
  TOPIC: 'Topic test',
  PRACTICE: 'Practice test',
  PREVIOUS_YEAR: 'Previous year paper',
  CUSTOM: 'Custom test',
};

/**
 * EXAM     — answers and solutions stay hidden until submission.
 * PRACTICE — the student may reveal the answer per question while attempting.
 * ADAPTIVE — questions are chosen in-flight from the student's mastery profile.
 */
export const TestMode = buildEnum(['EXAM', 'PRACTICE', 'ADAPTIVE'] as const);
export type TestMode = (typeof TestMode.values)[number];

export const ContentStatus = buildEnum(['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const);
export type ContentStatus = (typeof ContentStatus.values)[number];

export const AccessType = buildEnum(['FREE', 'PAID', 'SUBSCRIBER_ONLY'] as const);
export type AccessType = (typeof AccessType.values)[number];

export const NavigationMode = buildEnum(['FREE_NAVIGATION', 'SEQUENTIAL'] as const);
export type NavigationMode = (typeof NavigationMode.values)[number];

export const SeriesDifficulty = buildEnum([
  'BEGINNER',
  'INTERMEDIATE',
  'ADVANCED',
  'MIXED',
] as const);
export type SeriesDifficulty = (typeof SeriesDifficulty.values)[number];

// ---------------------------------------------------------------------------
// Attempts
// ---------------------------------------------------------------------------

export const AttemptStatus = buildEnum([
  'IN_PROGRESS',
  'SUBMITTED',
  'AUTO_SUBMITTED',
  'EXPIRED',
  'ABANDONED',
] as const);
export type AttemptStatus = (typeof AttemptStatus.values)[number];

/** Attempt states that count as finished and therefore scoreable. */
export const TERMINAL_ATTEMPT_STATUSES: readonly AttemptStatus[] = [
  'SUBMITTED',
  'AUTO_SUBMITTED',
  'EXPIRED',
];

/**
 * Per-question state shown in the question palette. Mirrors the vocabulary
 * students already know from real online exams.
 */
export const AnswerState = buildEnum([
  'NOT_VISITED',
  'NOT_ANSWERED',
  'ANSWERED',
  'MARKED_FOR_REVIEW',
  'ANSWERED_MARKED',
] as const);
export type AnswerState = (typeof AnswerState.values)[number];

export const ANSWER_STATE_LABELS: Record<AnswerState, string> = {
  NOT_VISITED: 'Not visited',
  NOT_ANSWERED: 'Not answered',
  ANSWERED: 'Answered',
  MARKED_FOR_REVIEW: 'Marked for review',
  ANSWERED_MARKED: 'Answered & marked',
};

export const AttemptEventType = buildEnum([
  'TAB_HIDDEN',
  'TAB_VISIBLE',
  'FULLSCREEN_EXIT',
  'FULLSCREEN_ENTER',
  'COPY_BLOCKED',
  'PASTE_BLOCKED',
  'RECONNECT',
  'AUTOSAVE_FAILED',
  'SUBMIT',
] as const);
export type AttemptEventType = (typeof AttemptEventType.values)[number];

// ---------------------------------------------------------------------------
// Practice & performance
// ---------------------------------------------------------------------------

export const PracticeSource = buildEnum([
  'NEW',
  'INCORRECT',
  'BOOKMARKED',
  'WEAK_TOPIC',
  'RANDOM',
  'ADAPTIVE',
] as const);
export type PracticeSource = (typeof PracticeSource.values)[number];

export const PRACTICE_SOURCE_LABELS: Record<PracticeSource, string> = {
  NEW: 'Questions you have not seen',
  INCORRECT: 'Questions you got wrong',
  BOOKMARKED: 'Your bookmarked questions',
  WEAK_TOPIC: 'Your weak topics',
  RANDOM: 'Random mix',
  ADAPTIVE: 'Adaptive difficulty',
};

export const SessionStatus = buildEnum(['IN_PROGRESS', 'COMPLETED', 'ABANDONED'] as const);
export type SessionStatus = (typeof SessionStatus.values)[number];

export const MasteryClass = buildEnum([
  'WEAK',
  'MODERATE',
  'STRONG',
  'INSUFFICIENT_DATA',
] as const);
export type MasteryClass = (typeof MasteryClass.values)[number];

export const PerformanceTrend = buildEnum([
  'IMPROVING',
  'DECLINING',
  'STABLE',
  'INSUFFICIENT_DATA',
] as const);
export type PerformanceTrend = (typeof PerformanceTrend.values)[number];

export const SnapshotPeriod = buildEnum(['ATTEMPT', 'DAILY', 'WEEKLY', 'MONTHLY'] as const);
export type SnapshotPeriod = (typeof SnapshotPeriod.values)[number];

// ---------------------------------------------------------------------------
// Study planner & gamification
// ---------------------------------------------------------------------------

export const StudyTaskType = buildEnum(['STUDY', 'PRACTICE', 'TEST', 'REVISION'] as const);
export type StudyTaskType = (typeof StudyTaskType.values)[number];

export const StudyTaskStatus = buildEnum([
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'SKIPPED',
] as const);
export type StudyTaskStatus = (typeof StudyTaskStatus.values)[number];

export const PlanStatus = buildEnum(['ACTIVE', 'COMPLETED', 'ARCHIVED'] as const);
export type PlanStatus = (typeof PlanStatus.values)[number];

export const StudyActivity = buildEnum(['TEST', 'PRACTICE', 'MATERIAL', 'MANUAL'] as const);
export type StudyActivity = (typeof StudyActivity.values)[number];

export const AchievementCategory = buildEnum([
  'TESTS',
  'QUESTIONS',
  'ACCURACY',
  'STREAK',
  'RANK',
  'MILESTONE',
] as const);
export type AchievementCategory = (typeof AchievementCategory.values)[number];

export const AchievementTier = buildEnum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] as const);
export type AchievementTier = (typeof AchievementTier.values)[number];

// ---------------------------------------------------------------------------
// Commerce
// ---------------------------------------------------------------------------

export const OrderStatus = buildEnum([
  'CREATED',
  'PENDING',
  'PAID',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
] as const);
export type OrderStatus = (typeof OrderStatus.values)[number];

export const PaymentStatus = buildEnum([
  'CREATED',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
] as const);
export type PaymentStatus = (typeof PaymentStatus.values)[number];

export const SubscriptionStatus = buildEnum([
  'ACTIVE',
  'EXPIRED',
  'CANCELLED',
  'PENDING',
] as const);
export type SubscriptionStatus = (typeof SubscriptionStatus.values)[number];

export const ProductType = buildEnum(['TEST_SERIES', 'SUBSCRIPTION_PLAN'] as const);
export type ProductType = (typeof ProductType.values)[number];

export const DiscountType = buildEnum(['PERCENTAGE', 'FIXED'] as const);
export type DiscountType = (typeof DiscountType.values)[number];

export const EntitlementSource = buildEnum([
  'PURCHASE',
  'SUBSCRIPTION',
  'ADMIN_GRANT',
  'FREE',
] as const);
export type EntitlementSource = (typeof EntitlementSource.values)[number];

// ---------------------------------------------------------------------------
// Notifications & support
// ---------------------------------------------------------------------------

export const NotificationType = buildEnum([
  'NEW_TEST',
  'TEST_REMINDER',
  'RESULT_READY',
  'SUBSCRIPTION_EXPIRY',
  'PAYMENT',
  'ANNOUNCEMENT',
  'ACHIEVEMENT',
  'STUDY_REMINDER',
  'SUPPORT',
  'SYSTEM',
] as const);
export type NotificationType = (typeof NotificationType.values)[number];

export const NotificationChannel = buildEnum(['IN_APP', 'EMAIL', 'WHATSAPP', 'PUSH'] as const);
export type NotificationChannel = (typeof NotificationChannel.values)[number];

export const TicketCategory = buildEnum([
  'PAYMENT',
  'TECHNICAL',
  'TEST',
  'QUESTION',
  'ACCOUNT',
  'OTHER',
] as const);
export type TicketCategory = (typeof TicketCategory.values)[number];

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  PAYMENT: 'Payment or billing',
  TECHNICAL: 'Technical problem',
  TEST: 'Issue during a test',
  QUESTION: 'Question content',
  ACCOUNT: 'Account access',
  OTHER: 'Something else',
};

export const TicketStatus = buildEnum([
  'OPEN',
  'IN_PROGRESS',
  'WAITING',
  'RESOLVED',
  'CLOSED',
] as const);
export type TicketStatus = (typeof TicketStatus.values)[number];

export const Priority = buildEnum(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const);
export type Priority = (typeof Priority.values)[number];

// ---------------------------------------------------------------------------
// Content & media
// ---------------------------------------------------------------------------

export const MediaKind = buildEnum(['IMAGE', 'PDF', 'DOCUMENT', 'OTHER'] as const);
export type MediaKind = (typeof MediaKind.values)[number];

export const StudyMaterialType = buildEnum(['PDF', 'NOTES', 'DOCUMENT', 'IMAGE'] as const);
export type StudyMaterialType = (typeof StudyMaterialType.values)[number];

export const TestimonialKind = buildEnum(['TESTIMONIAL', 'SUCCESS_STORY'] as const);
export type TestimonialKind = (typeof TestimonialKind.values)[number];

export const FaqCategory = buildEnum([
  'GENERAL',
  'PAYMENT',
  'TESTS',
  'ACCOUNT',
  'TEST_SERIES',
] as const);
export type FaqCategory = (typeof FaqCategory.values)[number];

export const AnnouncementLevel = buildEnum(['INFO', 'SUCCESS', 'WARNING', 'CRITICAL'] as const);
export type AnnouncementLevel = (typeof AnnouncementLevel.values)[number];

export const AnnouncementAudience = buildEnum([
  'ALL',
  'STUDENTS',
  'SUBSCRIBERS',
] as const);
export type AnnouncementAudience = (typeof AnnouncementAudience.values)[number];

export const ContentBlockType = buildEnum([
  'HERO',
  'STATS',
  'FEATURES',
  'SHOWCASE',
  'CTA',
  'STEPS',
  'LOGOS',
] as const);
export type ContentBlockType = (typeof ContentBlockType.values)[number];

// ---------------------------------------------------------------------------
// AI & operations
// ---------------------------------------------------------------------------

export const AIFeature = buildEnum([
  'COACH',
  'QUESTION_GENERATION',
  'EXPLANATION',
  'STUDY_PLAN',
  'RECOMMENDATION',
] as const);
export type AIFeature = (typeof AIFeature.values)[number];

export const AIRequestStatus = buildEnum([
  'SUCCESS',
  'ERROR',
  'RATE_LIMITED',
  'BLOCKED',
] as const);
export type AIRequestStatus = (typeof AIRequestStatus.values)[number];

export const BatchStatus = buildEnum([
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'PARTIAL',
] as const);
export type BatchStatus = (typeof BatchStatus.values)[number];

export const JobType = buildEnum([
  'SEND_EMAIL',
  'RECOMPUTE_RANKS',
  'AGGREGATE_ANALYTICS',
  'GENERATE_INVOICE',
  'AI_GENERATE_QUESTIONS',
  'SEND_NOTIFICATION',
  'SUBSCRIPTION_REMINDERS',
  'RECOMPUTE_QUESTION_STATS',
] as const);
export type JobType = (typeof JobType.values)[number];

export const JobStatus = buildEnum([
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'DEAD',
] as const);
export type JobStatus = (typeof JobStatus.values)[number];

/** Series slug for the "50 Questions · 50 Days" challenge. */
export const DAILY_CHALLENGE_SLUG = 'kas-50-questions-50-days';

/** Slug prefix for its per-day papers. */
export const DAILY_CHALLENGE_TEST_PREFIX = 'kas-50-days-';
