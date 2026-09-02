'use client';

import * as React from 'react';
import { Bookmark, BookmarkCheck, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

import { ReportQuestion } from './report-question';

/**
 * A question shown with its answer key and solution revealed.
 *
 * Shared by practice review, bookmarks and the wrong-questions list so a
 * solution looks identical everywhere a student meets it — the layout itself
 * becomes something they stop having to re-read.
 */
export interface ReviewOption {
  id: string;
  label: string;
  body: string;
  isCorrect: boolean;
  isSelected?: boolean;
}

export interface QuestionReviewProps {
  questionId: string;
  index?: number;
  body: string;
  passage?: string | null;
  imageUrl?: string | null;
  type: string;
  difficulty: string;
  options: ReviewOption[];
  numericalAnswer?: number | null;
  numericalValue?: number | null;
  explanation?: string | null;
  detailedSolution?: string | null;
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
  /** null when the question was skipped. */
  isCorrect?: boolean | null;
  isBookmarked?: boolean;
  /** Hides the bookmark control where it would be redundant. */
  showBookmark?: boolean;
  /** Fires after a successful toggle, so a list can drop the row. */
  onBookmarkChange?: (bookmarked: boolean) => void;
  className?: string;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard',
};

export function QuestionReview({
  questionId,
  index,
  body,
  passage,
  imageUrl,
  type,
  difficulty,
  options,
  numericalAnswer,
  numericalValue,
  explanation,
  detailedSolution,
  subject,
  chapter,
  topic,
  isCorrect,
  isBookmarked = false,
  showBookmark = true,
  onBookmarkChange,
  className,
}: QuestionReviewProps) {
  // Optimistic so the star responds instantly; reverted if the write fails.
  const [bookmarked, setBookmarked] = React.useState(isBookmarked);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => setBookmarked(isBookmarked), [isBookmarked]);

  async function toggleBookmark() {
    const next = !bookmarked;
    setBookmarked(next);
    setSaving(true);

    try {
      if (next) await api.post('/api/bookmarks', { questionId });
      else await api.delete('/api/bookmarks', { questionId });

      onBookmarkChange?.(next);
      toast.success(next ? 'Bookmarked.' : 'Bookmark removed.');
    } catch {
      setBookmarked(!next);
      toast.error('We could not update that bookmark.');
    } finally {
      setSaving(false);
    }
  }

  const verdict = isCorrect === null || isCorrect === undefined ? null : isCorrect;

  return (
    <article
      className={cn('rounded-xl border border-border bg-card p-5', className)}
      aria-label={index !== undefined ? `Question ${index}` : undefined}
    >
      <div className="flex flex-wrap items-center gap-2">
        {index !== undefined && (
          <span className="text-xs font-semibold text-muted-foreground">Q{index}</span>
        )}

        {verdict !== null && (
          <Badge variant={verdict ? 'success' : 'danger'} size="sm">
            {verdict ? (
              <CheckCircle2 aria-hidden="true" />
            ) : (
              <XCircle aria-hidden="true" />
            )}
            {verdict ? 'Correct' : 'Incorrect'}
          </Badge>
        )}

        <Badge variant="muted" size="sm">
          {DIFFICULTY_LABELS[difficulty] ?? difficulty}
        </Badge>

        {subject && <span className="text-xs text-muted-foreground">{subject}</span>}
        {topic && <span className="text-xs text-muted-foreground">· {topic}</span>}

        {showBookmark && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto"
            onClick={toggleBookmark}
            disabled={saving}
            aria-pressed={bookmarked}
            aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this question'}
          >
            {bookmarked ? (
              <BookmarkCheck className="text-primary" aria-hidden="true" />
            ) : (
              <Bookmark aria-hidden="true" />
            )}
          </Button>
        )}
      </div>

      {passage && (
        <div className="mt-3 rounded-lg bg-muted/40 p-3">
          <p className="whitespace-pre-line text-sm leading-relaxed">{passage}</p>
        </div>
      )}

      <p className="mt-3 whitespace-pre-line text-question leading-relaxed">{body}</p>

      {imageUrl && (
        // Admin-controlled storage; plain <img> avoids remote-host config here.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="mt-3 max-w-full rounded-lg border border-border" />
      )}

      {type === 'NUMERICAL' ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <dt className="text-xs text-muted-foreground">Your answer</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">
              {numericalValue ?? 'Not answered'}
            </dd>
          </div>
          <div className="rounded-lg border border-success/30 bg-success/5 p-3">
            <dt className="text-xs text-muted-foreground">Correct answer</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-success">
              {numericalAnswer ?? '—'}
            </dd>
          </div>
        </dl>
      ) : (
        <ul className="mt-4 space-y-2">
          {options.map((option) => (
            <li
              key={option.id}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-3',
                option.isCorrect
                  ? 'border-success/40 bg-success/5'
                  : option.isSelected
                    ? 'border-destructive/40 bg-destructive/5'
                    : 'border-border',
              )}
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  option.isCorrect
                    ? 'bg-success text-white'
                    : option.isSelected
                      ? 'bg-destructive text-white'
                      : 'border border-border text-muted-foreground',
                )}
                aria-hidden="true"
              >
                {option.label}
              </span>
              <span className="flex-1 whitespace-pre-line text-sm leading-relaxed">
                {option.body}
              </span>
              {option.isCorrect && (
                <Badge variant="success" size="sm">
                  Correct
                </Badge>
              )}
              {option.isSelected && !option.isCorrect && (
                <Badge variant="danger" size="sm">
                  Your answer
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}

      {(detailedSolution || explanation) && (
        <div className="mt-4 rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Solution
          </p>
          {detailedSolution ? (
            <div
              className="prose-avk mt-2"
              // Authored by faculty through the admin CMS.
              dangerouslySetInnerHTML={{ __html: detailedSolution }}
            />
          ) : (
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {explanation}
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        {chapter ? (
          <p className="text-xs text-muted-foreground">
            {subject} › {chapter}
            {topic ? ` › ${topic}` : ''}
          </p>
        ) : (
          <span />
        )}

        {/* Beside the answer, where a student is looking when they realise the
            key is wrong. */}
        <ReportQuestion questionId={questionId} />
      </div>
    </article>
  );
}
