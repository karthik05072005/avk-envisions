import type { Metadata } from 'next';
import Link from 'next/link';
import { BrainCircuit, KeyRound, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CoachChat } from '@/features/ai/coach-chat';
import { serverEnv } from '@/lib/env';
import { enforceStudent } from '@/server/auth/guards';
import { isAiEnabled } from '@/server/ai/provider';
import { getAiAllowance, getCoachSuggestions } from '@/server/services/ai-coach-service';
import { getAnalyticsOverview } from '@/server/services/analytics-service';

export const metadata: Metadata = {
  title: 'AVK AI Coach',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AiCoachPage() {
  const user = await enforceStudent('/ai-coach');
  const enabled = isAiEnabled();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight sm:text-3xl">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary-muted text-primary">
            <BrainCircuit className="size-5" aria-hidden="true" />
          </span>
          AVK AI Coach
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          A study advisor that can see your actual results, not a generic chatbot.
        </p>
      </header>

      {!enabled ? (
        <>
          {/*
            No AI key is configured. Rather than a mock conversation — which
            would be indistinguishable from a real one and could send a student
            off on invented advice — the page says plainly that it is off.
          */}
          <Card>
            <CardContent className="p-6 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-warning/10 text-warning">
                <KeyRound className="size-5" aria-hidden="true" />
              </span>

              <h2 className="mt-4 text-lg font-semibold tracking-tight">
                The AI Coach is not switched on
              </h2>
              <p className="mx-auto mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
                This deployment has no AI provider configured, so the coach cannot answer anything
                yet. We would rather tell you that than have it invent study advice that looks real.
              </p>

              <div className="mx-auto mt-5 max-w-md rounded-lg border border-border bg-muted/40 p-4 text-left">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  To enable it
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  An administrator sets{' '}
                  <code className="rounded bg-background px-1 py-0.5 font-mono text-xs">
                    AI_PROVIDER
                  </code>{' '}
                  to{' '}
                  <code className="rounded bg-background px-1 py-0.5 font-mono text-xs">
                    anthropic
                  </code>{' '}
                  or{' '}
                  <code className="rounded bg-background px-1 py-0.5 font-mono text-xs">
                    openai
                  </code>
                  , along with{' '}
                  <code className="rounded bg-background px-1 py-0.5 font-mono text-xs">
                    AI_API_KEY
                  </code>
                  . Current setting:{' '}
                  <code className="rounded bg-background px-1 py-0.5 font-mono text-xs">
                    {serverEnv().AI_PROVIDER}
                  </code>
                  .
                </p>
              </div>

              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button asChild variant="outline">
                  <Link href="/analytics">See your analytics instead</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/study-planner">Plan your week</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 sm:p-6">
              <h2 className="flex items-center gap-2 font-semibold tracking-tight">
                <Sparkles className="size-4 text-primary" aria-hidden="true" />
                What it will do once enabled
              </h2>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                <li>
                  Answer questions about your preparation using your real accuracy, weak topics and
                  attempt history.
                </li>
                <li>Suggest what to study next, with the figures that justify the suggestion.</li>
                <li>Explain why a topic keeps costing you marks.</li>
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                It will be explicitly instructed never to invent statistics about you — if the data
                is thin, it will say so rather than guess.
              </p>
            </CardContent>
          </Card>
        </>
      ) : (
        <EnabledCoach userId={user.id} />
      )}
    </div>
  );
}

/** Split out so the disabled path costs no analytics queries at all. */
async function EnabledCoach({ userId }: { userId: string }) {
  const [suggestions, allowance, overview] = await Promise.all([
    getCoachSuggestions(userId),
    getAiAllowance(userId),
    getAnalyticsOverview(userId),
  ]);

  return (
    <>
      {overview.questionsAnswered === 0 && (
        <Card variant="accent">
          <CardContent className="p-5">
            <p className="text-sm leading-relaxed">
              You have not answered any questions yet, so the coach has nothing about you to work
              from. It can still answer general preparation questions — but attempt a test or a
              practice session and its advice becomes specific to you.
            </p>
            <Button asChild size="sm" className="mt-3">
              <Link href="/practice">Start practising</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <CoachChat suggestions={suggestions} allowance={allowance} />
    </>
  );
}
