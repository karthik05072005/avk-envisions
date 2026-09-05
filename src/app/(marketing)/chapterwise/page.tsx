import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowLeft,
  Gift,
  Info,
  Landmark,
  Leaf,
  List,
  Lock,
  Mountain,
  TrendingUp,
  Castle,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { getChapterwiseSubjects } from '@/server/services/catalogue-service';

export const metadata: Metadata = {
  title: 'Solve Chapterwise',
  description:
    'Practise chapterwise questions mapped to the standard reference books — Laxmikanth, Spectrum, NCERT, Shankar IAS and the Economic Survey.',
  alternates: { canonical: '/chapterwise' },
};

export const dynamic = 'force-dynamic';

/**
 * Per-subject colour and icon.
 *
 * Keyed by slug so a subject added later simply falls back rather than
 * breaking the grid. Everything else — name, description, price, whether it is
 * ready — comes from the catalogue.
 */
interface Skin {
  icon: LucideIcon;
  wash: string;
  chip: string;
  button: string;
}

const SKINS: Record<string, Skin> = {
  'chapterwise-polity': {
    icon: Landmark,
    wash: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300',
    chip: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    button: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  'chapterwise-history': {
    icon: Castle,
    wash: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300',
    chip: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
    button: 'bg-red-600 hover:bg-red-700 text-white',
  },
  'chapterwise-geography': {
    icon: Mountain,
    wash: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
    chip: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    button: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  'chapterwise-environment': {
    icon: Leaf,
    wash: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300',
    chip: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
    button: 'bg-violet-600 hover:bg-violet-700 text-white',
  },
  'chapterwise-economy': {
    icon: TrendingUp,
    wash: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300',
    chip: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    button: 'bg-orange-500 hover:bg-orange-600 text-white',
  },
};

const FALLBACK: Skin = {
  icon: Landmark,
  wash: 'bg-muted text-muted-foreground',
  chip: 'bg-muted text-muted-foreground',
  button: 'bg-primary hover:bg-primary/90 text-primary-foreground',
};

/**
 * The sentence naming the book, without the shared boilerplate that follows.
 *
 * Splitting on the first full stop was wrong: "Indian Polity by M. Laxmikanth"
 * cut at the initial and left the card reading "…by M." Cutting at the known
 * trailing sentence instead keeps the author's name intact.
 */
const BOILERPLATE = /\s*Work through the book chapter by chapter.*$/s;

function shortDescription(text: string | null): string {
  if (!text) return '';
  return text.replace(BOILERPLATE, '').trim();
}

export default async function ChapterwisePage() {
  const subjects = await getChapterwiseSubjects();

  return (
    <div className="container max-w-6xl py-8 sm:py-10">
      <header className="relative flex items-center justify-between gap-4">
        <Link
          href="/test-series"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
        </Link>

        <div className="absolute left-1/2 hidden -translate-x-1/2 text-center sm:block">
          <h1 className="text-2xl font-bold tracking-tight">Solve Chapterwise (Paid)</h1>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/60"
        >
          <Gift className="size-4" aria-hidden="true" />
          My Progress
        </Link>
      </header>

      <div className="mt-4 text-center sm:mt-2">
        <h1 className="text-2xl font-bold tracking-tight sm:hidden">Solve Chapterwise (Paid)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Practice chapterwise questions by subject and strengthen your concepts
        </p>
      </div>

      {/* Unlock-everything banner */}
      <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-amber-200/70 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20 sm:p-5">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          aria-hidden="true"
        >
          <Lock className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">
            These tests are part of the Paid Chapterwise Series.
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Unlock full access to practice all chapters and track your performance.
          </p>
        </div>

        <Link
          href="/pricing"
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Lock className="size-4" aria-hidden="true" />
          Unlock All Subjects
        </Link>
      </div>

      {/* Subjects */}
      <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {subjects.map((subject, index) => {
          const skin = SKINS[subject.slug] ?? FALLBACK;
          const Icon = skin.icon;

          return (
            <li key={subject.id}>
              <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start gap-4">
                  <span
                    className={cn(
                      'flex size-16 shrink-0 items-center justify-center rounded-full',
                      skin.wash,
                    )}
                    aria-hidden="true"
                  >
                    <Icon className="size-8" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-base font-bold leading-snug tracking-tight">
                        {index + 1}. {subject.name}
                      </h2>
                      <Lock
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        aria-label="Locked"
                      />
                    </div>

                    <span
                      className={cn(
                        'mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        skin.chip,
                      )}
                    >
                      <Lock className="size-3" aria-hidden="true" />
                      Paid
                    </span>
                  </div>
                </div>

                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {shortDescription(subject.description)}
                </p>

                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/test-series/${subject.slug}`}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <List className="size-4" aria-hidden="true" />
                    View Chapters
                  </Link>

                  <Link
                    href="/pricing"
                    className={cn(
                      'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      skin.button,
                    )}
                  >
                    <Lock className="size-4" aria-hidden="true" />
                    Unlock Now
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground sm:p-5">
        <Info className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          Unlock any subject or all subjects to access chapterwise tests, performance analytics
          and detailed solutions.
        </span>
        <Link
          href="/pricing"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 font-medium text-foreground transition-colors hover:bg-muted/60"
        >
          <Gift className="size-4" aria-hidden="true" />
          View Plans &amp; Pricing
        </Link>
      </p>
    </div>
  );
}
