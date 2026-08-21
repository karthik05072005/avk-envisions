import { z } from 'zod';

/**
 * Validation primitives shared by every feature module.
 *
 * These schemas are the boundary between untrusted input and the rest of the
 * server. Feature schemas compose them rather than re-declaring rules, so a fix
 * to (say) the id format applies everywhere at once.
 */

/** Prisma `cuid()` ids. Loose enough to accept cuid and cuid2. */
export const cuidSchema = z
  .string()
  .min(20, 'Invalid identifier')
  .max(40, 'Invalid identifier')
  .regex(/^[a-z0-9]+$/i, 'Invalid identifier');

export const slugSchema = z
  .string()
  .min(2, 'Slug is too short')
  .max(120, 'Slug is too long')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only');

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email address is required')
  .max(254, 'Email address is too long')
  .email('Enter a valid email address')
  .transform((v) => v.toLowerCase());

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Enter your full name')
  .max(80, 'Name is too long')
  // Letters (any script), spaces, apostrophes, hyphens and dots only.
  .regex(/^[\p{L}\p{M}][\p{L}\p{M}\s'.-]*$/u, 'Name contains unsupported characters');

/** Optional Indian mobile number. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^(?:\+91[-\s]?)?[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number')
  .optional()
  .or(z.literal(''));

export const urlSchema = z.string().trim().url('Enter a valid URL').max(2048);

/** Free-text field that must not be blank once trimmed. */
export const requiredText = (label: string, max = 500) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);

export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? undefined : v));

// ---------------------------------------------------------------------------
// Coercion helpers for query strings, where everything arrives as a string
// ---------------------------------------------------------------------------

export const numericString = (fallback?: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === '') return fallback;
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? n : fallback;
    });

export const booleanString = (fallback = false) =>
  z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === '') return fallback;
      if (typeof v === 'boolean') return v;
      return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
    });

/** Accepts `a,b,c` or repeated params, yielding a string array. */
export const csvArray = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => {
    if (v === undefined) return [] as string[];
    const list = Array.isArray(v) ? v : v.split(',');
    return list.map((s) => s.trim()).filter(Boolean);
  });

// ---------------------------------------------------------------------------
// Pagination & sorting
// ---------------------------------------------------------------------------

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Standard list-query envelope. `pageSize` is hard-capped so a client cannot
 * request an unbounded result set and exhaust memory.
 */
export const paginationSchema = z.object({
  page: numericString(1).pipe(z.number().int().min(1).max(10_000)),
  pageSize: numericString(DEFAULT_PAGE_SIZE).pipe(z.number().int().min(1).max(MAX_PAGE_SIZE)),
});

export type Pagination = z.infer<typeof paginationSchema>;

export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc');

/** Builds a sort schema restricted to an explicit allowlist of columns. */
export function sortSchema<const T extends readonly [string, ...string[]]>(fields: T, defaultField: T[number]) {
  return z.object({
    sortBy: z.enum(fields).default(defaultField as never),
    sortOrder: sortOrderSchema,
  });
}

/** Trimmed free-text search, capped to avoid pathological LIKE queries. */
export const searchSchema = z.object({
  q: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? v : undefined)),
});

/** Converts validated pagination into Prisma's `skip`/`take`. */
export function toPrismaPagination({ page, pageSize }: Pagination) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

export const dateSchema = z
  .union([z.string(), z.date()])
  .transform((v, ctx) => {
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid date' });
      return z.NEVER;
    }
    return d;
  });

export const optionalDateSchema = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (v === undefined || v === null || v === '') return undefined;
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid date' });
      return z.NEVER;
    }
    return d;
  });

/** Inclusive date range where `to` must not precede `from`. */
export const dateRangeSchema = z
  .object({ from: optionalDateSchema, to: optionalDateSchema })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: 'End date must be on or after the start date',
    path: ['to'],
  });

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/** Prices are always integer paise, never floats. */
export const paiseSchema = z
  .number()
  .int('Amount must be a whole number of paise')
  .min(0, 'Amount cannot be negative')
  .max(100_000_000, 'Amount exceeds the maximum allowed');

/** Accepts rupees from a form and converts to paise. */
export const rupeesToPaiseSchema = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    const n = typeof v === 'number' ? v : Number.parseFloat(v);
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid amount' });
      return z.NEVER;
    }
    return Math.round(n * 100);
  });

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'] as const;
export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;
export const ALLOWED_IMPORT_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

/**
 * Validates an uploaded file's declared type and size.
 *
 * The MIME type here is client-supplied and therefore only a first filter; the
 * storage layer re-checks the real content signature before persisting.
 */
export function fileSchema(options: { types: readonly string[]; maxBytes: number; label?: string }) {
  const { types, maxBytes, label = 'File' } = options;
  return z
    .instanceof(File, { message: `${label} is required` })
    .refine((f) => f.size > 0, `${label} is empty`)
    .refine((f) => f.size <= maxBytes, `${label} must be under ${Math.round(maxBytes / 1_048_576)} MB`)
    .refine((f) => types.includes(f.type), `${label} type is not supported`);
}

/** Rejects path traversal and control characters in user-supplied filenames. */
export const safeFileNameSchema = z
  .string()
  .min(1)
  .max(255)
  .refine((n) => !n.includes('/') && !n.includes('\\') && !n.includes('..'), 'Invalid file name')
  // Control characters are checked by code point to avoid an escape-heavy regex.
  .refine((n) => ![...n].some((ch) => ch.charCodeAt(0) < 32), 'File name contains control characters')
  .refine((n) => !/[<>:"|?*]/.test(n), 'File name contains invalid characters');
