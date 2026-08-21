'use client';

import * as React from 'react';
import { BrainCircuit, Send, User } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { InlineError } from '@/components/ui/states';
import { ApiClientError, api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

/**
 * AI Coach chat.
 *
 * The allowance counter is shown before the student types, not after they hit a
 * wall — an AI request costs money, and discovering the limit mid-conversation
 * is a bad way to learn it exists.
 */
export interface CoachChatProps {
  suggestions: string[];
  allowance: { used: number; limit: number; remaining: number; unlimited: boolean };
}

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

export function CoachChat({ suggestions, allowance: initialAllowance }: CoachChatProps) {
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [question, setQuestion] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [allowance, setAllowance] = React.useState(initialAllowance);

  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns]);

  const exhausted = !allowance.unlimited && allowance.remaining <= 0;

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending || exhausted) return;

    setError(null);
    setSending(true);

    // Show the question immediately; the answer follows.
    const history = turns.slice(-6);
    setTurns((previous) => [...previous, { role: 'user', content: trimmed }]);
    setQuestion('');

    try {
      const result = await api.post<{
        answer: string;
        allowance: typeof allowance;
      }>('/api/ai-coach', { question: trimmed, history });

      setTurns((previous) => [...previous, { role: 'assistant', content: result.answer }]);
      setAllowance(result.allowance);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : 'We could not reach the coach. Please try again.',
      );
      // Drop the unanswered question so the thread does not show a dead end.
      setTurns((previous) => previous.slice(0, -1));
      setQuestion(trimmed);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Grounded in your own results — it can see your accuracy and weak topics.
        </p>
        <Badge variant={exhausted ? 'danger' : 'muted'}>
          {allowance.unlimited
            ? 'Unlimited this month'
            : `${allowance.remaining} of ${allowance.limit} left this month`}
        </Badge>
      </div>

      {/* Conversation ---------------------------------------------------- */}
      {turns.length > 0 && (
        <Card>
          <CardContent className="space-y-4 p-5 sm:p-6">
            {turns.map((turn, index) => (
              <div key={index} className="flex gap-3">
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-lg',
                    turn.role === 'user'
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-primary-muted text-primary',
                  )}
                  aria-hidden="true"
                >
                  {turn.role === 'user' ? (
                    <User className="size-4" />
                  ) : (
                    <BrainCircuit className="size-4" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {turn.role === 'user' ? 'You' : 'AVK AI Coach'}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{turn.content}</p>
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex gap-3" aria-live="polite">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary">
                  <BrainCircuit className="size-4 animate-pulse" aria-hidden="true" />
                </span>
                <p className="pt-1.5 text-sm text-muted-foreground">Thinking…</p>
              </div>
            )}

            <div ref={endRef} />
          </CardContent>
        </Card>
      )}

      {error && <InlineError message={error} />}

      {/* Suggestions ------------------------------------------------------ */}
      {turns.length === 0 && suggestions.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Try asking
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => ask(suggestion)}
                disabled={sending || exhausted}
                className={cn(
                  'rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors',
                  'hover:border-primary/40 hover:bg-muted/50',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Composer --------------------------------------------------------- */}
      <Card>
        <CardContent className="p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void ask(question);
            }}
          >
            <label htmlFor="coach-question" className="sr-only">
              Ask the coach
            </label>
            <Textarea
              id="coach-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={
                exhausted
                  ? 'You have used your requests for this month.'
                  : 'Ask about your preparation, a weak topic, or how to plan your week…'
              }
              rows={3}
              maxLength={1000}
              disabled={exhausted}
              onKeyDown={(event) => {
                // Enter sends, Shift+Enter adds a newline — the convention
                // every chat interface has trained people to expect.
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void ask(question);
                }
              }}
            />

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                Enter to send · Shift + Enter for a new line
              </span>
              <Button
                type="submit"
                loading={sending}
                disabled={!question.trim() || exhausted}
                size="sm"
              >
                <Send aria-hidden="true" />
                Ask
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">
        The coach can make mistakes and is not a substitute for your own judgement or your
        teachers. It only sees the performance figures shown on your analytics page.
      </p>
    </div>
  );
}
