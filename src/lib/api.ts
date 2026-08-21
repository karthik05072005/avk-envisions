/**
 * The platform's API contract.
 *
 * Every route handler returns one of exactly two shapes:
 *
 *   success: { success: true,  data: T,  message?: string, meta?: PageMeta }
 *   failure: { success: false, error: { code, message, details? } }
 *
 * Clients can therefore branch on `success` alone, and error rendering is
 * uniform across the whole product.
 */

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PAYMENT_REQUIRED'
  | 'ENTITLEMENT_REQUIRED'
  | 'EMAIL_NOT_VERIFIED'
  | 'ACCOUNT_SUSPENDED'
  | 'ATTEMPT_EXPIRED'
  | 'ALREADY_SUBMITTED'
  | 'ATTEMPT_LIMIT_REACHED'
  | 'TEST_UNAVAILABLE'
  | 'AI_DISABLED'
  | 'AI_LIMIT_REACHED'
  | 'PROVIDER_ERROR'
  | 'INTERNAL_ERROR';

/** Field-level validation messages, keyed by dot-path. */
export type FieldErrors = Record<string, string[]>;

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
  meta?: PageMeta;
}

export interface ApiFailure {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: FieldErrors;
    /** Correlates a user-facing error with the server log entry. */
    requestId?: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/** Default HTTP status for each error code. */
export const ERROR_STATUS: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PAYMENT_REQUIRED: 402,
  ENTITLEMENT_REQUIRED: 403,
  EMAIL_NOT_VERIFIED: 403,
  ACCOUNT_SUSPENDED: 403,
  ATTEMPT_EXPIRED: 409,
  ALREADY_SUBMITTED: 409,
  ATTEMPT_LIMIT_REACHED: 409,
  TEST_UNAVAILABLE: 409,
  AI_DISABLED: 503,
  AI_LIMIT_REACHED: 429,
  PROVIDER_ERROR: 502,
  INTERNAL_ERROR: 500,
};

/**
 * Error type thrown anywhere in the server layer. The API wrapper converts it
 * into the failure envelope with the right status code, so business logic never
 * has to construct HTTP responses itself.
 */
export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: FieldErrors;
  /** When false, the message is replaced by a generic one before it is sent. */
  readonly exposeMessage: boolean;

  constructor(
    code: ApiErrorCode,
    message: string,
    options: { details?: FieldErrors; status?: number; exposeMessage?: boolean; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = options.status ?? ERROR_STATUS[code];
    this.details = options.details;
    // Internal failures must not leak implementation detail to students.
    this.exposeMessage = options.exposeMessage ?? code !== 'INTERNAL_ERROR';
  }
}

/** Convenience constructors for the errors thrown most often. */
export const errors = {
  badRequest: (message = 'The request could not be processed.', details?: FieldErrors) =>
    new AppError('BAD_REQUEST', message, { details }),
  validation: (details: FieldErrors, message = 'Please correct the highlighted fields.') =>
    new AppError('VALIDATION_ERROR', message, { details }),
  unauthorized: (message = 'Please sign in to continue.') => new AppError('UNAUTHORIZED', message),
  forbidden: (message = 'You do not have access to this resource.') =>
    new AppError('FORBIDDEN', message),
  notFound: (what = 'Resource') => new AppError('NOT_FOUND', `${what} was not found.`),
  conflict: (message: string) => new AppError('CONFLICT', message),
  rateLimited: (message = 'Too many requests. Please try again shortly.') =>
    new AppError('RATE_LIMITED', message),
  entitlementRequired: (message = 'This content requires an active subscription or purchase.') =>
    new AppError('ENTITLEMENT_REQUIRED', message),
  internal: (message = 'Something went wrong on our side.', cause?: unknown) =>
    new AppError('INTERNAL_ERROR', message, { cause, exposeMessage: false }),
};

export function ok<T>(data: T, message?: string, meta?: PageMeta): ApiSuccess<T> {
  return { success: true, data, ...(message ? { message } : {}), ...(meta ? { meta } : {}) };
}

export function fail(
  code: ApiErrorCode,
  message: string,
  details?: FieldErrors,
  requestId?: string,
): ApiFailure {
  return {
    success: false,
    error: { code, message, ...(details ? { details } : {}), ...(requestId ? { requestId } : {}) },
  };
}

/** Builds pagination metadata from a total count and the requested page. */
export function pageMeta(total: number, page: number, pageSize: number): PageMeta {
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
}

/** Narrowing helper for client-side consumers. */
export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiSuccess<T> {
  return response.success;
}
