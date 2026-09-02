'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Eraser,
  Flag,
  LayoutGrid,
  Loader2,
  Send,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ApiClientError, api } from '@/lib/api-client';
import { MULTI_SELECT_TYPES, type AnswerState } from '@/lib/enums';
import { cn } from '@/lib/utils';
import { ReportQuestion } from '@/features/practice/report-question';

import { ExamTimer } from './exam-timer';
import { QuestionPalette, type PaletteEntry } from './question-palette';

/**
 * The exam engine.
 *
 * Design constraints that shape everything below:
 *
 *  • **Never lose an answer.** Every change lands in a local dirty queue
 *    immediately and is flushed to the server on a short interval, on
 *    navigation, and on page hide. A failed flush keeps its patches queued and
 *    retries rather than discarding them.
 *
 *  • **Never block the student.** Saving is asynchronous and non-modal. A
 *    network blip shows a quiet indicator, not a dialog over the paper.
 *
 *  • **Minimal motion.** No page transitions, no card animations. The exam UI
 *    optimises for reading speed and stability; the marketing site is where the
 *    product is allowed to be expressive.
 */

export interface EngineQuestion {
  testQuestionId: string;
  questionId: string;
  sortOrder: number;
  sectionId: string | null;
  marks: number;
  negativeMarks: number;
  type: string;
  body: string;
  passage: string | null;
  imageUrl: string | null;
  options: { id: string; label: string; body: string; imageUrl: string | null }[];
}

export interface EngineAnswer {
  selectedOptionIds: string[];
  numericalValue: number | null;
  state: AnswerState;
  timeSpentSeconds: number;
}

export interface ExamEngineProps {
  attemptId: string;
  title: string;
  mode: string;
  navigationMode: string;
  totalMarks: number;
  sections: { id: string; name: string; sortOrder: number }[];
  questions: EngineQuestion[];
  initialAnswers: Record<string, EngineAnswer>;
  serverTime: string;
  expiresAt: string;
}

/** How often queued changes are pushed to the server. */
const FLUSH_INTERVAL_MS = 5_000;

interface PendingPatch {
  selectedOptionIds?: string[];
  numericalValue?: number | null;
  state?: AnswerState;
  timeDeltaSeconds?: number;
}

export function ExamEngine({
  attemptId,
  title,
  mode,
  navigationMode,
  totalMarks,
  questions,
  initialAnswers,
  serverTime,
  expiresAt,
}: ExamEngineProps) {
  const router = useRouter();

  const [answers, setAnswers] = React.useState<Record<string, EngineAnswer>>(() => {
    // Ensure every question has an entry, so lookups never need a null guard.
    const seeded: Record<string, EngineAnswer> = {};
    for (const question of questions) {
      seeded[question.testQuestionId] = initialAnswers[question.testQuestionId] ?? {
        selectedOptionIds: [],
        numericalValue: null,
        state: 'NOT_VISITED',
        timeSpentSeconds: 0,
      };
    }
    return seeded;
  });

  const [index, setIndex] = React.useState(0);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [saveState, setSaveState] = React.useState<'idle' | 'saving' | 'error'>('idle');

  const current = questions[index]!;
  const currentAnswer = answers[current.testQuestionId]!;

  // --- Dirty queue -------------------------------------------------------
  const pendingRef = React.useRef<Map<string, PendingPatch>>(new Map());
  const flushingRef = React.useRef(false);
  const submittedRef = React.useRef(false);

  const queue = React.useCallback((testQuestionId: string, patch: PendingPatch) => {
    const existing = pendingRef.current.get(testQuestionId) ?? {};
    pendingRef.current.set(testQuestionId, {
      ...existing,
      ...patch,
      // Time deltas accumulate rather than overwrite.
      timeDeltaSeconds: (existing.timeDeltaSeconds ?? 0) + (patch.timeDeltaSeconds ?? 0),
    });
  }, []);

  const flush = React.useCallback(async () => {
    if (flushingRef.current || pendingRef.current.size === 0 || submittedRef.current) return;

    flushingRef.current = true;

    // Take the queue, but keep the reference so failures can be merged back.
    const batch = new Map(pendingRef.current);
    pendingRef.current.clear();

    const patches = [...batch.entries()].map(([testQuestionId, patch]) => ({
      testQuestionId,
      ...patch,
    }));

    setSaveState('saving');

    try {
      await api.patch(`/api/attempts/${attemptId}/answers`, { patches });
      setSaveState('idle');
    } catch (error) {
      // Re-queue so nothing is lost; newer edits made meanwhile win.
      for (const [id, patch] of batch) {
        const newer = pendingRef.current.get(id);
        pendingRef.current.set(id, { ...patch, ...newer });
      }
      setSaveState('error');

      if (error instanceof ApiClientError && error.code === 'ALREADY_SUBMITTED') {
        router.replace(`/test/${attemptId}/result`);
      }
    } finally {
      flushingRef.current = false;
    }
  }, [attemptId, router]);

  // Periodic flush.
  React.useEffect(() => {
    const id = window.setInterval(() => void flush(), FLUSH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [flush]);

  // Flush when the page is hidden or closed. `visibilitychange` is the only
  // event reliably delivered on mobile; `beforeunload` is not.
  React.useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        void flush();
        void reportEvent('TAB_HIDDEN');
      } else {
        void reportEvent('TAB_VISIBLE');
      }
    };

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (submittedRef.current || pendingRef.current.size === 0) return;
      event.preventDefault();
      // Browsers show their own generic wording; the value is ignored.
      event.returnValue = '';
    };

    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
    // `reportEvent` is stable; flush is the only real dependency.
  }, [flush]);

  const reportEvent = React.useCallback(
    async (type: string) => {
      if (submittedRef.current) return;
      try {
        await api.post(`/api/attempts/${attemptId}/events`, { type });
      } catch {
        // Telemetry must never interrupt an exam in progress.
      }
    },
    [attemptId],
  );

  // --- Per-question time tracking ---------------------------------------
  const enteredAtRef = React.useRef<number>(Date.now());

  const bankTime = React.useCallback(
    (testQuestionId: string) => {
      const seconds = Math.round((Date.now() - enteredAtRef.current) / 1000);
      enteredAtRef.current = Date.now();
      if (seconds > 0) queue(testQuestionId, { timeDeltaSeconds: Math.min(seconds, 600) });
    },
    [queue],
  );

  // --- Answer mutation ---------------------------------------------------
  const nextState = (answered: boolean, marked: boolean): AnswerState => {
    if (marked) return answered ? 'ANSWERED_MARKED' : 'MARKED_FOR_REVIEW';
    return answered ? 'ANSWERED' : 'NOT_ANSWERED';
  };

  const updateAnswer = React.useCallback(
    (testQuestionId: string, mutate: (previous: EngineAnswer) => EngineAnswer) => {
      setAnswers((previous) => {
        const updated = mutate(previous[testQuestionId]!);
        queue(testQuestionId, {
          selectedOptionIds: updated.selectedOptionIds,
          numericalValue: updated.numericalValue,
          state: updated.state,
        });
        return { ...previous, [testQuestionId]: updated };
      });
    },
    [queue],
  );

  const selectOption = (optionId: string) => {
    const multi = MULTI_SELECT_TYPES.includes(current.type as never);

    updateAnswer(current.testQuestionId, (previous) => {
      const selected = multi
        ? previous.selectedOptionIds.includes(optionId)
          ? previous.selectedOptionIds.filter((id) => id !== optionId)
          : [...previous.selectedOptionIds, optionId]
        : [optionId];

      const marked =
        previous.state === 'MARKED_FOR_REVIEW' || previous.state === 'ANSWERED_MARKED';

      return { ...previous, selectedOptionIds: selected, state: nextState(selected.length > 0, marked) };
    });
  };

  const setNumeric = (raw: string) => {
    const trimmed = raw.trim();
    const value = trimmed === '' ? null : Number(trimmed);
    if (value !== null && !Number.isFinite(value)) return;

    updateAnswer(current.testQuestionId, (previous) => {
      const marked =
        previous.state === 'MARKED_FOR_REVIEW' || previous.state === 'ANSWERED_MARKED';
      return { ...previous, numericalValue: value, state: nextState(value !== null, marked) };
    });
  };

  const clearResponse = () => {
    updateAnswer(current.testQuestionId, (previous) => {
      const marked =
        previous.state === 'MARKED_FOR_REVIEW' || previous.state === 'ANSWERED_MARKED';
      return {
        ...previous,
        selectedOptionIds: [],
        numericalValue: null,
        state: nextState(false, marked),
      };
    });
  };

  const toggleMark = () => {
    updateAnswer(current.testQuestionId, (previous) => {
      const answered =
        previous.selectedOptionIds.length > 0 || previous.numericalValue !== null;
      const marked =
        previous.state === 'MARKED_FOR_REVIEW' || previous.state === 'ANSWERED_MARKED';
      return { ...previous, state: nextState(answered, !marked) };
    });
  };

  // --- Navigation --------------------------------------------------------
  const goTo = React.useCallback(
    (target: number) => {
      if (target < 0 || target >= questions.length) return;

      const leaving = questions[index]!;
      bankTime(leaving.testQuestionId);

      // A visited-but-unanswered question must stop reading as "not visited".
      setAnswers((previous) => {
        const entering = questions[target]!;
        const answer = previous[entering.testQuestionId]!;
        if (answer.state !== 'NOT_VISITED') return previous;

        queue(entering.testQuestionId, { state: 'NOT_ANSWERED' });
        return {
          ...previous,
          [entering.testQuestionId]: { ...answer, state: 'NOT_ANSWERED' },
        };
      });

      setIndex(target);
      setPaletteOpen(false);
      void flush();
    },
    [bankTime, flush, index, queue, questions],
  );

  // Mark the very first question as visited on mount.
  React.useEffect(() => {
    const first = questions[0];
    if (!first) return;
    setAnswers((previous) => {
      const answer = previous[first.testQuestionId]!;
      if (answer.state !== 'NOT_VISITED') return previous;
      queue(first.testQuestionId, { state: 'NOT_ANSWERED' });
      return { ...previous, [first.testQuestionId]: { ...answer, state: 'NOT_ANSWERED' } };
    });
  }, [questions, queue]);

  // Keyboard shortcuts — arrows to move, digits to select an option.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'ArrowRight') goTo(index + 1);
      else if (event.key === 'ArrowLeft') goTo(index - 1);
      else if (/^[1-9]$/.test(event.key)) {
        const option = current.options[Number(event.key) - 1];
        if (option) selectOption(option.id);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goTo, index, current]);

  // --- Submission --------------------------------------------------------
  const submit = React.useCallback(
    async (reason: 'MANUAL' | 'AUTO') => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);

      // Land every outstanding change before scoring.
      await flush();

      try {
        const result = await api.post<{ resultUrl: string }>(
          `/api/attempts/${attemptId}/submit`,
          { reason },
        );
        toast.success(reason === 'AUTO' ? 'Time is up — your test was submitted.' : 'Test submitted.');
        router.replace(result.resultUrl);
      } catch (error) {
        submittedRef.current = false;
        setSubmitting(false);
        setConfirmOpen(false);
        toast.error(
          error instanceof ApiClientError
            ? error.message
            : 'We could not submit your test. Please try again.',
        );
      }
    },
    [attemptId, flush, router],
  );

  const handleExpire = React.useCallback(() => void submit('AUTO'), [submit]);

  // --- Derived -----------------------------------------------------------
  const paletteEntries: PaletteEntry[] = React.useMemo(
    () =>
      questions.map((question) => ({
        testQuestionId: question.testQuestionId,
        sortOrder: question.sortOrder,
        state: answers[question.testQuestionId]!.state,
      })),
    [answers, questions],
  );

  const answeredCount = paletteEntries.filter(
    (entry) => entry.state === 'ANSWERED' || entry.state === 'ANSWERED_MARKED',
  ).length;

  const isMarked =
    currentAnswer.state === 'MARKED_FOR_REVIEW' || currentAnswer.state === 'ANSWERED_MARKED';
  const isMulti = MULTI_SELECT_TYPES.includes(current.type as never);
  const canGoBack = navigationMode !== 'SEQUENTIAL' && index > 0;

  return (
    <div className="exam-no-select flex min-h-dvh flex-col bg-background">
      {/* Header ---------------------------------------------------------- */}
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold sm:text-base">{title}</h1>
            <p className="text-xs text-muted-foreground">
              {answeredCount} of {questions.length} answered · {totalMarks} marks
            </p>
          </div>

          {/* Save indicator — quiet by design; only errors draw the eye. */}
          <div
            className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex"
            aria-live="polite"
          >
            {saveState === 'saving' && (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                Saving
              </>
            )}
            {saveState === 'error' && (
              <span className="flex items-center gap-1.5 text-warning">
                <CloudOff className="size-3.5" aria-hidden="true" />
                Reconnecting
              </span>
            )}
            {saveState === 'idle' && (
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-success" aria-hidden="true" />
                Saved
              </span>
            )}
          </div>

          <ExamTimer expiresAt={expiresAt} serverTime={serverTime} onExpire={handleExpire} />

          <Button
            variant="outline"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setPaletteOpen(true)}
            aria-label="Open question palette"
          >
            <LayoutGrid aria-hidden="true" />
          </Button>

          <Button
            size="sm"
            className="hidden sm:inline-flex"
            onClick={() => setConfirmOpen(true)}
            disabled={submitting}
          >
            <Send aria-hidden="true" />
            Submit
          </Button>
        </div>

        <div
          className="h-0.5 bg-primary transition-[width] duration-300"
          style={{ width: `${((index + 1) / questions.length) * 100}%` }}
          aria-hidden="true"
        />
      </header>

      <div className="flex flex-1">
        {/* Question ------------------------------------------------------ */}
        <main id="main-content" className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-md bg-primary-muted px-2 py-1 font-semibold text-primary">
                Question {current.sortOrder}
              </span>
              <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">
                +{current.marks}
                {current.negativeMarks > 0 && ` / −${current.negativeMarks}`}
              </span>
              {isMulti && (
                <span className="rounded-md bg-warning/10 px-2 py-1 font-medium text-warning">
                  Select all that apply
                </span>
              )}
            </div>

            {current.passage && (
              <div className="mt-5 rounded-lg border border-border bg-muted/30 p-4">
                <p className="whitespace-pre-line text-question leading-relaxed">{current.passage}</p>
              </div>
            )}

            <div className="mt-5 whitespace-pre-line text-question leading-relaxed">
              {current.body}
            </div>

            {current.imageUrl && (
              // Question images come from admin-controlled storage; plain <img>
              // avoids next/image's remote-host configuration for this path.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.imageUrl}
                alt=""
                className="mt-5 max-w-full rounded-lg border border-border"
              />
            )}

            {/* Reporting mid-test is the point: a student who spots a wrong key
                while answering should not have to remember it until the end. */}
            <ReportQuestion questionId={current.questionId} className="mt-4" />

            {/* Options / input */}
            <div className="mt-7">
              {current.type === 'NUMERICAL' ? (
                <div className="max-w-xs">
                  <label htmlFor="numeric-answer" className="text-sm font-medium">
                    Your answer
                  </label>
                  <Input
                    id="numeric-answer"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    className="mt-1.5"
                    placeholder="Enter a number"
                    value={currentAnswer.numericalValue ?? ''}
                    onChange={(event) => setNumeric(event.target.value)}
                  />
                </div>
              ) : (
                <fieldset>
                  <legend className="sr-only">
                    {isMulti ? 'Select all correct options' : 'Select one option'}
                  </legend>

                  <div className="space-y-3">
                    {current.options.map((option, optionIndex) => {
                      const selected = currentAnswer.selectedOptionIds.includes(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => selectOption(option.id)}
                          aria-pressed={selected}
                          className={cn(
                            'flex w-full items-start gap-3.5 rounded-xl border p-4 text-left transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                            selected
                              ? 'border-primary bg-primary-muted'
                              : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50',
                          )}
                        >
                          <span
                            className={cn(
                              'flex size-7 shrink-0 items-center justify-center border text-sm font-semibold',
                              isMulti ? 'rounded-md' : 'rounded-full',
                              selected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border text-muted-foreground',
                            )}
                            aria-hidden="true"
                          >
                            {option.label}
                          </span>
                          <span className="flex-1 whitespace-pre-line pt-0.5 text-[0.975rem] leading-relaxed">
                            {option.body}
                          </span>
                          <span className="sr-only">
                            Option {optionIndex + 1}
                            {selected ? ', selected' : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}
            </div>
          </div>
        </main>

        {/* Palette — desktop --------------------------------------------- */}
        <aside className="hidden w-72 shrink-0 border-l border-border bg-card lg:flex lg:flex-col">
          <QuestionPalette entries={paletteEntries} currentIndex={index} onJump={goTo} className="flex-1" />
          <div className="border-t border-border p-4">
            <Button fullWidth onClick={() => setConfirmOpen(true)} disabled={submitting}>
              <Send aria-hidden="true" />
              Submit test
            </Button>
          </div>
        </aside>
      </div>

      {/* Controls -------------------------------------------------------- */}
      <footer className="sticky bottom-0 border-t border-border bg-background px-3 py-3 sm:px-5">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goTo(index - 1)}
            disabled={!canGoBack}
            className="shrink-0"
          >
            <ChevronLeft aria-hidden="true" />
            <span className="hidden sm:inline">Previous</span>
          </Button>

          <Button variant="ghost" size="sm" onClick={clearResponse} className="shrink-0">
            <Eraser aria-hidden="true" />
            <span className="hidden sm:inline">Clear</span>
          </Button>

          <Button
            variant={isMarked ? 'secondary' : 'ghost'}
            size="sm"
            onClick={toggleMark}
            className="shrink-0"
            aria-pressed={isMarked}
          >
            <Flag aria-hidden="true" />
            <span className="hidden sm:inline">{isMarked ? 'Unmark' : 'Mark for review'}</span>
          </Button>

          <div className="flex-1" />

          {index === questions.length - 1 ? (
            <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={submitting}>
              <Send aria-hidden="true" />
              Submit
            </Button>
          ) : (
            <Button size="sm" onClick={() => goTo(index + 1)}>
              <span className="hidden sm:inline">Save &amp; next</span>
              <span className="sm:hidden">Next</span>
              <ChevronRight aria-hidden="true" />
            </Button>
          )}
        </div>
      </footer>

      {/* Palette — mobile bottom sheet ---------------------------------- */}
      {paletteOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setPaletteOpen(false)}
            aria-label="Close question palette"
            tabIndex={-1}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[75vh] rounded-t-2xl bg-card shadow-float">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="font-semibold">Questions</p>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setPaletteOpen(false)}
                aria-label="Close"
              >
                <X aria-hidden="true" />
              </Button>
            </div>
            <QuestionPalette
              entries={paletteEntries}
              currentIndex={index}
              onJump={goTo}
              className="max-h-[60vh]"
            />
          </div>
        </div>
      )}

      {/* Submit confirmation -------------------------------------------- */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Submit your test?</DialogTitle>
            <DialogDescription>
              You cannot change your answers after submitting.
            </DialogDescription>
          </DialogHeader>

          <dl className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-muted/50 p-3">
              <dt className="text-xs text-muted-foreground">Answered</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-success">
                {answeredCount}
              </dd>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <dt className="text-xs text-muted-foreground">Unanswered</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-destructive">
                {questions.length - answeredCount}
              </dd>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <dt className="text-xs text-muted-foreground">Marked</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-exam-review">
                {
                  paletteEntries.filter(
                    (e) => e.state === 'MARKED_FOR_REVIEW' || e.state === 'ANSWERED_MARKED',
                  ).length
                }
              </dd>
            </div>
          </dl>

          {answeredCount < questions.length && (
            <p className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/10 p-3 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              You have {questions.length - answeredCount} unanswered{' '}
              {questions.length - answeredCount === 1 ? 'question' : 'questions'}. Unanswered
              questions score zero, with no penalty.
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              Keep working
            </Button>
            <Button onClick={() => void submit('MANUAL')} loading={submitting} loadingText="Submitting…">
              Submit test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
