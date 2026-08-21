'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Clock, FileQuestion, Target, Trophy } from 'lucide-react';
import { toast } from 'sonner';

import { Logo } from '@/components/site/logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ApiClientError, api } from '@/lib/api-client';
import { formatDuration } from '@/lib/utils';

/**
 * Pre-test briefing.
 *
 * The last screen before a timed attempt begins, so it states the marking
 * scheme and the recovery behaviour plainly. A student should never discover
 * mid-paper that wrong answers carry a penalty, or worry that a dropped
 * connection has cost them their work.
 */
export interface StartScreenProps {
  test: {
    id: string;
    title: string;
    description: string | null;
    instructions: string | null;
    durationMinutes: number;
    totalQuestions: number;
    totalMarks: number;
    negativeMarkingEnabled: boolean;
    maxAttempts: number;
    examName: string;
  };
  /** Attempts already used, for the allowance notice. */
  attemptsUsed: number;
}

export function StartScreen({ test, attemptsUsed }: StartScreenProps) {
  const router = useRouter();
  const [starting, setStarting] = React.useState(false);

  const attemptsLeft = test.maxAttempts === 0 ? null : test.maxAttempts - attemptsUsed;
  const exhausted = attemptsLeft !== null && attemptsLeft <= 0;

  async function start() {
    setStarting(true);
    try {
      const result = await api.post<{ attemptId: string; resumed: boolean }>('/api/attempts', {
        testId: test.id,
      });
      if (result.resumed) toast.info('Resuming your attempt in progress.');
      router.replace(`/test/${result.attemptId}`);
    } catch (error) {
      setStarting(false);
      toast.error(
        error instanceof ApiClientError ? error.message : 'We could not start this test.',
      );
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <Button asChild variant="ghost" size="sm">
            <Link href="/my-tests">
              <ArrowLeft aria-hidden="true" />
              My tests
            </Link>
          </Button>
        </div>
      </header>

      <main id="main-content" className="container flex-1 py-10">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            {test.examName}
          </p>
          <h1 className="mt-2 text-balance text-display-sm">{test.title}</h1>
          {test.description && (
            <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
              {test.description}
            </p>
          )}

          <dl className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Duration', value: formatDuration(test.durationMinutes * 60), icon: Clock },
              { label: 'Questions', value: test.totalQuestions, icon: FileQuestion },
              { label: 'Total marks', value: test.totalMarks, icon: Trophy },
              {
                label: 'Attempts left',
                value: attemptsLeft === null ? 'Unlimited' : attemptsLeft,
                icon: Target,
              },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl border border-border bg-card p-4">
                <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                  <Icon className="size-3.5" aria-hidden="true" />
                  {label}
                </dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          <Card className="mt-7">
            <CardContent className="p-6">
              <h2 className="font-semibold tracking-tight">Before you begin</h2>

              {test.instructions ? (
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {test.instructions}
                </p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                  <li>Each question carries the marks shown alongside it.</li>
                  {test.negativeMarkingEnabled && (
                    <li>Incorrect answers carry a penalty. Unanswered questions score zero.</li>
                  )}
                  <li>You may move between questions freely and mark any for review.</li>
                </ul>
              )}

              <div className="mt-5 space-y-2.5 border-t border-border pt-5 text-sm">
                <p className="flex items-start gap-2 text-muted-foreground">
                  <Clock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    The timer runs on our servers. Closing the tab does not pause it, and the test
                    submits automatically when time expires.
                  </span>
                </p>
                <p className="flex items-start gap-2 text-muted-foreground">
                  <Target className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                  <span>
                    Your answers save continuously. If your connection drops, reopen the test and
                    you will resume exactly where you left off.
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          {exhausted ? (
            <div className="mt-7 flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning/10 p-4 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                You have used all {test.maxAttempts} attempts for this test. Your previous results
                remain available in My tests.
              </span>
            </div>
          ) : (
            <Button
              size="xl"
              variant="brand"
              fullWidth
              className="mt-7"
              onClick={start}
              loading={starting}
              loadingText="Preparing your paper…"
            >
              Start test
            </Button>
          )}

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Once you begin, the timer cannot be paused.
          </p>
        </div>
      </main>
    </div>
  );
}
