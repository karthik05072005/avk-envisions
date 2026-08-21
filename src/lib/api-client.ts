import type { ApiResponse, FieldErrors } from './api';

/**
 * Browser-side API client.
 *
 * Understands the platform's success/failure envelope, so callers get a typed
 * value on success and a structured `ApiClientError` on failure — never a raw
 * `Response` to unpack by hand.
 */

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  /** Field-level messages, ready to feed straight into a form. */
  readonly fieldErrors?: FieldErrors;
  readonly requestId?: string;

  constructor(options: {
    code: string;
    message: string;
    status: number;
    fieldErrors?: FieldErrors;
    requestId?: string;
  }) {
    super(options.message);
    this.name = 'ApiClientError';
    this.code = options.code;
    this.status = options.status;
    this.fieldErrors = options.fieldErrors;
    this.requestId = options.requestId;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  let response: Response;
  try {
    response = await fetch(path, {
      ...rest,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      // Cookies carry the session, so they must be sent on same-origin calls.
      credentials: 'same-origin',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    // Network-level failure: no response at all.
    throw new ApiClientError({
      code: 'NETWORK_ERROR',
      message: 'We could not reach the server. Check your connection and try again.',
      status: 0,
    });
  }

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    // A non-JSON body means something upstream failed (proxy, gateway).
    throw new ApiClientError({
      code: 'INVALID_RESPONSE',
      message:
        response.status >= 500
          ? 'Something went wrong on our side. Please try again shortly.'
          : 'We received an unexpected response. Please try again.',
      status: response.status,
    });
  }

  if (!payload || payload.success !== true) {
    const error = payload && !payload.success ? payload.error : undefined;
    throw new ApiClientError({
      code: error?.code ?? 'UNKNOWN_ERROR',
      message: error?.message ?? 'Something went wrong. Please try again.',
      status: response.status,
      fieldErrors: error?.details,
      requestId: error?.requestId,
    });
  }

  return payload.data;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE', body }),
};

/**
 * Applies server-returned field errors to a react-hook-form instance.
 * Errors for unknown fields fall back to the form-level `root` error so nothing
 * is silently dropped.
 */
export function applyFieldErrors(
  error: unknown,
  setError: (name: string, error: { type: string; message: string }) => void,
  knownFields: readonly string[],
): boolean {
  if (!(error instanceof ApiClientError) || !error.fieldErrors) return false;

  let applied = false;
  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    const message = messages[0];
    if (!message) continue;

    setError(knownFields.includes(field) ? field : 'root', { type: 'server', message });
    applied = true;
  }
  return applied;
}
