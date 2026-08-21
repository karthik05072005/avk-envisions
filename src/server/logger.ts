import 'server-only';

import pino from 'pino';

import { isProduction, serverEnv } from '@/lib/env';

/**
 * Structured application logger.
 *
 * Redaction is deliberately aggressive: this platform handles passwords,
 * session tokens, payment signatures and AI keys, none of which may ever reach
 * a log sink. Add any new sensitive field to `REDACT_PATHS` rather than
 * remembering to strip it at each call site.
 */
const REDACT_PATHS = [
  'password',
  'passwordHash',
  'confirmPassword',
  'currentPassword',
  'newPassword',
  'token',
  'tokenHash',
  'sessionToken',
  'razorpaySignature',
  'signature',
  'apiKey',
  'secret',
  'authorization',
  'cookie',
  'req.headers.authorization',
  'req.headers.cookie',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.secret',
];

function createLogger() {
  const level = (() => {
    try {
      return serverEnv().LOG_LEVEL;
    } catch {
      // Logging must work even when env validation is what failed.
      return 'info';
    }
  })();

  return pino({
    level,
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    base: { service: 'avk-visions' },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    // Pretty output is a dev-only convenience; production emits raw NDJSON for
    // ingestion by the log platform.
    ...(isProduction()
      ? {}
      : {
          transport: {
            target: 'pino/file',
            options: { destination: 1 },
          },
        }),
  });
}

const globalForLogger = globalThis as unknown as { logger?: pino.Logger };

export const logger = globalForLogger.logger ?? createLogger();

if (!isProduction()) globalForLogger.logger = logger;

/**
 * Returns a child logger bound to a request id, so every line emitted while
 * handling one request can be correlated.
 */
export function requestLogger(requestId: string, extra: Record<string, unknown> = {}) {
  return logger.child({ requestId, ...extra });
}

/** Generates a request id when the platform has not supplied one. */
export function newRequestId() {
  return crypto.randomUUID();
}
