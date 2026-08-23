import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, FileText, Lock, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { SynopsisViewer } from '@/features/student/synopsis-viewer';
import { formatPaise } from '@/lib/utils';
import { enforceStudent } from '@/server/auth/guards';
import { checkTestSynopsisAccess } from '@/server/services/synopsis-service';

export const metadata: Metadata = {
  title: 'Paper analysis',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * `/synopsis/test/[testId]` — the question-wise analysis for one test.
 *
 * Every outcome other than "you may read this" is rendered as an explanation of
 * what is missing, rather than a 404 that leaves the student guessing.
 */
export default async function TestSynopsisPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;
  const user = await enforceStudent(`/synopsis/test/${testId}`);
  const access = await checkTestSynopsisAccess(testId, user);

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-3">
      <Link href={`/test/${testId}`}>
        <ArrowLeft aria-hidden="true" />
        Back to the test
      </Link>
    </Button>
  );

  if (access.state === 'NOT_PUBLISHED') {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        {back}
        <EmptyState
          icon={FileText}
          title="No analysis yet"
          description="The question-wise analysis for this paper has not been published. It will appear here once it is ready."
        />
      </div>
    );
  }

  if (access.state === 'PURCHASE_REQUIRED') {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        {back}
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Lock className="size-6" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                The analysis is part of {access.seriesName}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Unlock the paper to read the full question-wise analysis — every question with its
                answer, the reasoning, the core concept and the likely future angle.
              </p>
            </div>
            <Button asChild size="lg" variant="brand">
              <Link href={`/test/${testId}`}>Unlock for {formatPaise(access.priceInPaise)}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (access.state === 'ATTEMPT_REQUIRED') {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        {back}
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <ShieldAlert className="size-6" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Attempt the paper first</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                The analysis contains every answer. Sit {access.seriesName} first — it is worth far
                more once you know which questions you actually got wrong.
              </p>
            </div>
            <Button asChild size="lg" variant="brand">
              <Link href={`/test/${testId}`}>Go to the paper</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {back}

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{access.seriesName} — Analysis</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Question-wise analysis: answer, reasoning, core concept and future angle for all 100
          questions. Reading only — this document is not available for download.
        </p>
      </header>

      <SynopsisViewer src={`/api/synopsis/test/${testId}`} title={`${access.seriesName} analysis`} />
    </div>
  );
}
