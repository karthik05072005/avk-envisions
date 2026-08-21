/**
 * Shared, dependency-light helpers used across server and client code.
 * Anything here must be safe to import into a client bundle.
 */
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merges Tailwind classes, resolving conflicting utilities correctly. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// Money — always stored and computed in integer paise
// ---------------------------------------------------------------------------

/** Formats paise as Indian Rupees, e.g. 149900 -> "₹1,499". */
export function formatPaise(paise: number, options: { showDecimals?: boolean } = {}) {
  const { showDecimals = false } = options;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(paise / 100);
}

export const rupeesToPaise = (rupees: number) => Math.round(rupees * 100);
export const paiseToRupees = (paise: number) => paise / 100;

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** Safe division that returns 0 rather than NaN/Infinity for a zero divisor. */
export function safeDivide(numerator: number, denominator: number) {
  if (!denominator) return 0;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : 0;
}

/** Percentage of `value` out of `total`, clamped to [0, 100]. */
export function percentage(value: number, total: number, decimals = 1) {
  return round(clamp(safeDivide(value, total) * 100, 0, 100), decimals);
}

export function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Compact Indian-style counts: 1234 -> "1.2K", 1250000 -> "12.5L". */
export function formatCompactNumber(value: number) {
  if (value >= 10_000_000) return `${round(value / 10_000_000, 1)}Cr`;
  if (value >= 100_000) return `${round(value / 100_000, 1)}L`;
  if (value >= 1_000) return `${round(value / 1_000, 1)}K`;
  return String(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('en-IN').format(value);
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

/** Seconds -> "01:23:45" (hours omitted when zero). Used by the exam timer. */
export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/** Seconds -> human phrasing, e.g. "2h 15m", "45s". For summaries, not timers. */
export function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s < 60) return `${s}s`;
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

export function formatDate(date: Date | string | null | undefined, style: 'short' | 'long' | 'full' = 'short') {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';

  const options: Intl.DateTimeFormatOptions =
    style === 'full'
      ? { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' }
      : style === 'long'
        ? { day: 'numeric', month: 'long', year: 'numeric' }
        : { day: 'numeric', month: 'short', year: 'numeric' };

  return new Intl.DateTimeFormat('en-IN', options).format(d);
}

/** "3 days ago" / "in 2 hours". Falls back to an absolute date beyond a month. */
export function formatRelativeTime(date: Date | string | null | undefined) {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';

  const diffMs = d.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['second', 1000],
    ['minute', 60_000],
    ['hour', 3_600_000],
    ['day', 86_400_000],
    ['week', 604_800_000],
  ];

  if (absMs > 2_592_000_000) return formatDate(d, 'short');

  let chosen: [Intl.RelativeTimeFormatUnit, number] = units[0]!;
  for (const unit of units) {
    if (absMs >= unit[1]) chosen = unit;
  }
  return rtf.format(Math.round(diffMs / chosen[1]), chosen[0]);
}

/** Local calendar day key (YYYY-MM-DD) — timezone-stable for streak logic. */
export function toDateKey(date: Date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Strings
// ---------------------------------------------------------------------------

/** URL-safe slug. Non-Latin scripts collapse to empty, so callers must fall back. */
export function slugify(input: string) {
  return input
    .normalize('NFKD')
    // Strip combining marks left behind by NFKD decomposition (é -> e).
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function truncate(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

/** Strips HTML tags for excerpts, meta descriptions and plaintext emails. */
export function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function pluralize(count: number, singular: string, plural?: string) {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

/** Masks an email for display in logs and support screens. */
export function maskEmail(email: string) {
  const [local = '', domain = ''] = email.split('@');
  if (!domain) return '***';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export function groupBy<T, K extends string | number>(items: T[], key: (item: T) => K) {
  return items.reduce<Record<K, T[]>>(
    (acc, item) => {
      const k = key(item);
      (acc[k] ??= []).push(item);
      return acc;
    },
    {} as Record<K, T[]>,
  );
}

export function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function sum(values: number[]) {
  return values.reduce((a, b) => a + b, 0);
}

export function average(values: number[]) {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

/**
 * Deterministic shuffle. A seeded PRNG means an attempt's randomised question
 * order can be regenerated identically on the server if it is ever lost.
 */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  const arr = [...items];
  let state = 0;
  for (let i = 0; i < seed.length; i++) {
    state = (state * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const next = () => {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0xffffffff;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Ordinal suffix for ranks: 1 -> "1st", 22 -> "22nd". */
export function ordinal(n: number) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** Exhaustiveness guard for switch statements over union types. */
export function assertNever(value: never, message = 'Unexpected value'): never {
  throw new Error(`${message}: ${String(value)}`);
}
