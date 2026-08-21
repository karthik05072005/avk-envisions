import 'server-only';

import { NextResponse } from 'next/server';
import { ZodError, type ZodType, type ZodTypeDef } from 'zod';

import {
  AppError,
  ERROR_STATUS,
  type ApiErrorCode,
  type ApiResponse,
  type FieldErrors,
  type PageMeta,
  errors,
  fail,
  ok,
} from '@/lib/api';
import { isProduction } from '@/lib/env';
import { clientIp } from '@/server/audit';
import { newRequestId, requestLogger } from '@/server/logger';
import { rateLimit, rateLimitHeaders, type RateLimitPolicy } from '@/server/rate-limit';

/**
 * The single entry point every API route uses.
 *
 * It guarantees four things no individual handler has to re-implement:
 *   1. Uniform success/failure envelopes and HTTP status codes.
 *   2. A request id on every response and every log line, so a user-reported
 *      error can be traced to an exact server log entry.
 *   3. Stack traces and internal messages never reach the client in production.
 *   4. Optional rate limiting applied before the handler body runs.
 */

export interface HandlerContext {
  request: Request;
  requestId: string;
  logger: ReturnType<typeof requestLogger>;
  ip: string;
  /** Route params, already awaited (Next.js 15 delivers these as a Promise). */
  params: Record<string, string>;
}

export interface HandlerResult<T> {
  data: T;
  message?: string;
  meta?: PageMeta;
  status?: number;
  headers?: Record<string, string>;
}

export interface RouteOptions {
  /** Applies a named rate-limit policy keyed by IP before running the handler. */
  rateLimit?: RateLimitPolicy;
  /** Overrides the rate-limit key; defaults to the client IP. */
  rateLimitKey?: (context: HandlerContext) => string | Promise<string>;
}

type RouteHandler<T> = (context: HandlerContext) => Promise<HandlerResult<T> | T>;

/**
 * Next.js 15 passes route params as a promise in the second argument.
 *
 * This must be a required property: Next generates a type check against every
 * exported handler, and an optional `params` fails to satisfy its
 * `RouteContext` constraint. Static routes still receive the object, with the
 * promise resolving to `{}`.
 */
type NextRouteArgs = { params: Promise<Record<string, string>> };

function toFieldErrors(error: ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
    (fields[path] ??= []).push(issue.message);
  }
  return fields;
}

function jsonResponse<T>(body: ApiResponse<T>, status: number, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers });
}

/**
 * Wraps a route handler.
 *
 * @example
 *   export const POST = route(async ({ request }) => {
 *     const input = await parseBody(request, createTestSchema);
 *     return { data: await createTest(input), message: 'Test created.' };
 *   }, { rateLimit: 'publicWrite' });
 */
export function route<T>(handler: RouteHandler<T>, options: RouteOptions = {}) {
  return async (request: Request, args: NextRouteArgs): Promise<NextResponse> => {
    const requestId = request.headers.get('x-request-id') ?? newRequestId();
    const ip = clientIp(request);
    const log = requestLogger(requestId, {
      method: request.method,
      path: new URL(request.url).pathname,
    });

    const context: HandlerContext = {
      request,
      requestId,
      logger: log,
      ip,
      // Defensive `?.` — the runtime always supplies this, but tests and
      // direct invocations may not.
      params: args?.params ? await args.params : {},
    };

    const baseHeaders: Record<string, string> = { 'x-request-id': requestId };

    try {
      if (options.rateLimit) {
        const key = options.rateLimitKey ? await options.rateLimitKey(context) : ip;
        const result = await rateLimit(options.rateLimit, key);
        Object.assign(baseHeaders, rateLimitHeaders(result));

        if (!result.allowed) {
          log.warn({ policy: options.rateLimit, key }, 'Rate limit exceeded');
          return jsonResponse(
            fail('RATE_LIMITED', 'Too many requests. Please wait a moment and try again.', undefined, requestId),
            429,
            baseHeaders,
          );
        }
      }

      const result = await handler(context);
      const normalized: HandlerResult<T> =
        result !== null && typeof result === 'object' && 'data' in (result as object)
          ? (result as HandlerResult<T>)
          : { data: result as T };

      return jsonResponse(
        ok(normalized.data, normalized.message, normalized.meta),
        normalized.status ?? 200,
        { ...baseHeaders, ...normalized.headers },
      );
    } catch (error) {
      return handleError(error, requestId, log, baseHeaders);
    }
  };
}

function handleError(
  error: unknown,
  requestId: string,
  log: ReturnType<typeof requestLogger>,
  headers: Record<string, string>,
): NextResponse {
  if (error instanceof ZodError) {
    log.info({ issues: error.issues.length }, 'Request failed validation');
    return jsonResponse(
      fail('VALIDATION_ERROR', 'Please correct the highlighted fields.', toFieldErrors(error), requestId),
      ERROR_STATUS.VALIDATION_ERROR,
      headers,
    );
  }

  if (error instanceof AppError) {
    // Expected, business-level failures are info; unexpected ones are errors.
    const level = error.status >= 500 ? 'error' : 'info';
    log[level]({ err: error, code: error.code }, error.message);

    const message = error.exposeMessage ? error.message : 'Something went wrong. Please try again.';
    return jsonResponse(fail(error.code, message, error.details, requestId), error.status, headers);
  }

  // Prisma's unique-constraint violation is common enough to translate.
  if (isPrismaKnownError(error) && error.code === 'P2002') {
    log.info({ err: error }, 'Unique constraint violation');
    return jsonResponse(
      fail('CONFLICT', 'A record with these details already exists.', undefined, requestId),
      409,
      headers,
    );
  }
  if (isPrismaKnownError(error) && error.code === 'P2025') {
    return jsonResponse(fail('NOT_FOUND', 'The requested record no longer exists.', undefined, requestId), 404, headers);
  }

  log.error({ err: error }, 'Unhandled error in API route');

  return jsonResponse(
    fail(
      'INTERNAL_ERROR',
      isProduction()
        ? 'Something went wrong on our side. Our team has been notified.'
        : `Unhandled error: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      requestId,
    ),
    500,
    headers,
  );
}

function isPrismaKnownError(error: unknown): error is { code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    (error as { code: string }).code.startsWith('P')
  );
}

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

/**
 * A schema whose parsed *output* is `T`, with an unconstrained input type.
 *
 * Zod's own `ZodSchema<T>` alias defaults its Input parameter to `T` as well,
 * which makes TypeScript unify `T` against the schema's input type. For any
 * schema using `.default()` or `.transform()` — where input and output differ —
 * that infers the wrong type at the call site (e.g. `boolean | undefined`
 * instead of `boolean`). Pinning Input to `unknown` keeps inference on output.
 */
type InputSchema<T> = ZodType<T, ZodTypeDef, unknown>;

/** Parses and validates a JSON body, throwing a ZodError the wrapper renders. */
export async function parseBody<T>(request: Request, schema: InputSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw errors.badRequest('Request body must be valid JSON.');
  }
  return schema.parse(raw);
}

/** Parses and validates the query string. */
export function parseQuery<T>(request: Request, schema: InputSchema<T>): T {
  const url = new URL(request.url);
  const raw: Record<string, string | string[]> = {};

  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    raw[key] = values.length > 1 ? values : values[0]!;
  }

  return schema.parse(raw);
}

/** Parses multipart form data into a plain object before validation. */
export async function parseFormData<T>(request: Request, schema: InputSchema<T>): Promise<T> {
  const form = await request.formData();
  const raw: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    raw[key] = value;
  }
  return schema.parse(raw);
}

/** Builds a failure response outside the `route` wrapper (e.g. in middleware). */
export function errorResponse(code: ApiErrorCode, message: string, status?: number) {
  return NextResponse.json(fail(code, message), { status: status ?? ERROR_STATUS[code] });
}
