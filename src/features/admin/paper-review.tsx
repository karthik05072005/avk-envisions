'use client';

import * as React from 'react';
import { AlertTriangle, Check, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { ApiClientError, api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { DeleteQuestion } from '@/features/admin/delete-question';

/**
 * A paper's questions, laid out the way the PDF import lays them out.
 *
 * The bank used to show a two-line preview per question, so checking a
 * hundred-question paper meant opening each one, editing, saving and coming
 * back — a hundred round trips. The import review already showed everything at
 * once and editable, and it is the same job: read the question, see which
 * option is keyed, fix what is wrong.
 *
 * Each question saves on its own. There is no "save all": a paper being
 * proof-read is edited a question at a time, and one bad field should not
 * block the other ninety-nine.
 */

export interface ReviewOption {
  id: string;
  label: string;
  body: string;
  isCorrect: boolean;
}

export interface ReviewQuestion {
  id: string;
  code: string | null;
  /** Position on the paper, which is what the admin counts by. */
  position: number;
  status: string;
  difficulty: string;
  subjectName: string | null;
  body: string;
  explanation: string | null;
  marks: number;
  negativeMarks: number;
  reviewNote: string | null;
  /** Papers this question is attached to, so a delete can warn accurately. */
  attachedTo: number;
  options: ReviewOption[];
  /** Everything the save endpoint needs but this screen does not edit. */
  examId: string;
  subjectId: string;
  type: string;
}

interface Props {
  paperTitle: string;
  questions: ReviewQuestion[];
}

/** One question's editable state. */
interface Draft {
  body: string;
  explanation: string;
  options: { id: string; body: string }[];
  correctIndex: number;
}

/**
 * Rows enough to show the whole value without an inner scrollbar.
 *
 * A fixed height is wrong in both directions on a real paper: a one-line
 * question wastes half a screen, and a ten-line explanation — the field most
 * worth proof-reading — gets cut off two lines in, hiding the very text the
 * reviewer opened the page to check.
 */
function rowsFor(text: string, min: number, max = 24): number {
  const wrapped = text.split('\n').reduce((n, line) => n + Math.ceil(line.length / 110 || 1), 0);
  return Math.min(max, Math.max(min, wrapped));
}

function draftOf(question: ReviewQuestion): Draft {
  return {
    body: question.body,
    explanation: question.explanation ?? '',
    options: question.options.map((o) => ({ id: o.id, body: o.body })),
    correctIndex: question.options.findIndex((o) => o.isCorrect),
  };
}

export function PaperReview({ paperTitle, questions }: Props) {
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, draftOf(q)])),
  );
  const [saving, setSaving] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState<Set<string>>(new Set());

  const original = React.useMemo(
    () => Object.fromEntries(questions.map((q) => [q.id, draftOf(q)])),
    [questions],
  );

  function edit(id: string, patch: Partial<Draft>) {
    setDrafts((previous) => ({ ...previous, [id]: { ...previous[id]!, ...patch } }));
    setSaved((previous) => {
      if (!previous.has(id)) return previous;
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
  }

  function editOption(id: string, index: number, body: string) {
    setDrafts((previous) => {
      const draft = previous[id]!;
      const options = draft.options.map((o, i) => (i === index ? { ...o, body } : o));
      return { ...previous, [id]: { ...draft, options } };
    });
    setSaved((previous) => {
      if (!previous.has(id)) return previous;
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
  }

  /** True when this question differs from what is stored. */
  function isDirty(question: ReviewQuestion): boolean {
    const draft = drafts[question.id]!;
    const was = original[question.id]!;
    return (
      draft.body !== was.body ||
      draft.explanation !== was.explanation ||
      draft.correctIndex !== was.correctIndex ||
      draft.options.some((o, i) => o.body !== was.options[i]?.body)
    );
  }

  async function save(question: ReviewQuestion) {
    const draft = drafts[question.id]!;

    if (draft.correctIndex < 0) {
      toast.error('Mark the correct option before saving.');
      return;
    }

    setSaving(question.id);
    try {
      await api.put(`/api/admin/questions/${question.id}`, {
        examId: question.examId,
        subjectId: question.subjectId,
        type: question.type,
        difficulty: question.difficulty,
        status: question.status,
        body: draft.body,
        explanation: draft.explanation || null,
        marks: question.marks,
        negativeMarks: question.negativeMarks,
        options: draft.options.map((option, index) => ({
          body: option.body,
          isCorrect: index === draft.correctIndex,
          sortOrder: index,
        })),
      });

      // Kept in the saved set rather than reloading: a reload would scroll the
      // page back to the top, which on a hundred-question paper loses the
      // reviewer's place after every single edit.
      original[question.id] = { ...draft, options: draft.options.map((o) => ({ ...o })) };
      setSaved((previous) => new Set(previous).add(question.id));
      toast.success(`Q${question.position} saved.`);
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : 'That question could not be saved.',
      );
    } finally {
      setSaving(null);
    }
  }

  if (questions.length === 0) return null;

  const unkeyed = questions.filter((q) => drafts[q.id]!.correctIndex < 0).length;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Review every question
        </h2>
        <p className="text-xs text-muted-foreground">
          {questions.length} question{questions.length === 1 ? '' : 's'} in {paperTitle}
          {unkeyed > 0 && (
            <span className="ml-2 font-medium text-destructive">
              · {unkeyed} with no correct answer set
            </span>
          )}
        </p>
      </div>

      <ul className="mt-3 space-y-3">
        {questions.map((question) => {
          const draft = drafts[question.id]!;
          const needsKey = draft.correctIndex < 0;
          const dirty = isDirty(question);

          return (
            <li
              key={question.id}
              className={cn(
                'rounded-xl border bg-card p-4',
                needsKey ? 'border-destructive/40' : 'border-border',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  Q{question.position}
                </span>

                {needsKey ? (
                  <Badge variant="danger" size="sm">
                    Set the correct answer
                  </Badge>
                ) : (
                  <Badge variant="success" size="sm">
                    Answer: {String.fromCharCode(65 + draft.correctIndex)}
                  </Badge>
                )}

                <StatusBadge status={question.status} />

                {question.code && (
                  <span className="font-mono text-xs text-muted-foreground">{question.code}</span>
                )}
                {question.subjectName && (
                  <span className="text-xs text-muted-foreground">{question.subjectName}</span>
                )}
                {question.reviewNote && (
                  <Badge variant="warning" size="sm">
                    <AlertTriangle aria-hidden="true" />
                    Flagged
                  </Badge>
                )}

                <div className="ml-auto flex items-center gap-1.5">
                  {saved.has(question.id) && !dirty && (
                    <span className="flex items-center gap-1 text-xs text-success">
                      <Check className="size-3.5" aria-hidden="true" />
                      Saved
                    </span>
                  )}

                  <Button
                    size="sm"
                    variant={dirty ? 'default' : 'outline'}
                    disabled={!dirty || saving === question.id}
                    onClick={() => save(question)}
                  >
                    {saving === question.id ? (
                      <Loader2 className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Save aria-hidden="true" />
                    )}
                    Save
                  </Button>

                  <DeleteQuestion
                    questionId={question.id}
                    code={question.code}
                    attachedTo={question.attachedTo}
                  />
                </div>
              </div>

              <Textarea
                value={draft.body}
                onChange={(event) => edit(question.id, { body: event.target.value })}
                rows={rowsFor(draft.body, 2)}
                // The shared textarea floors at 96px, which is three empty
                // lines under a one-line question — a screenful of nothing
                // repeated a hundred times down the paper.
                className="mt-3 min-h-0"
                aria-label={`Question ${question.position} text`}
              />

              <ul className="mt-2.5 space-y-2">
                {draft.options.map((option, index) => (
                  <li key={option.id} className="flex items-start gap-2.5">
                    <button
                      type="button"
                      onClick={() => edit(question.id, { correctIndex: index })}
                      aria-pressed={draft.correctIndex === index}
                      aria-label={`Mark option ${String.fromCharCode(65 + index)} correct`}
                      className={cn(
                        'mt-1 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        draft.correctIndex === index
                          ? 'border-success bg-success text-white'
                          : 'border-input text-muted-foreground hover:border-success/50',
                      )}
                    >
                      {draft.correctIndex === index ? (
                        <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                      ) : (
                        String.fromCharCode(65 + index)
                      )}
                    </button>

                    <Textarea
                      value={option.body}
                      onChange={(event) => editOption(question.id, index, event.target.value)}
                      rows={rowsFor(option.body, 1, 8)}
                      className="min-h-[40px] flex-1 text-sm"
                      aria-label={`Option ${String.fromCharCode(65 + index)}`}
                    />
                  </li>
                ))}
              </ul>

              <div className="mt-3">
                <label
                  htmlFor={`explanation-${question.id}`}
                  className="text-xs font-medium text-muted-foreground"
                >
                  Explanation{' '}
                  {question.explanation ? (
                    <span className="text-success">· read from the paper</span>
                  ) : (
                    <span>· none stored; optional</span>
                  )}
                </label>
                <Textarea
                  id={`explanation-${question.id}`}
                  value={draft.explanation}
                  onChange={(event) => edit(question.id, { explanation: event.target.value })}
                  rows={rowsFor(draft.explanation, 2)}
                  className="mt-1 text-sm"
                  placeholder="Why this answer is right — shown to a student after they finish."
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
