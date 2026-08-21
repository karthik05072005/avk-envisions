import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3, Gauge, Target, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/states';
import { formatDuration, formatNumber } from '@/lib/utils';
import { enforceAdminArea } from '@/server/auth/guards';
import { getPlatformAnalytics } from '@/server/services/admin-service';

export const metadata: Metadata = {
  title: 'Platform analytics',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminAnalyticsPage() {
  await enforceAdminArea('/admin/analytics');
  const analytics = await getPlatformAnalytics();

  if (analytics.totalAttempts === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Platform analytics</h1>
        </header>
        <EmptyState
          icon={BarChart3}
          title="No attempts to analyse yet"
          description="Once students start submitting tests, this page shows how the platform is performing as a whole."
          action={{ label: 'Manage tests', href: '/admin/tests' }}
        />
      </div>
    );
  }

  const maxSubjectCount = Math.max(...analytics.questionsBySubject.map((s) => s.count), 1);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Platform analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aggregated across every submitted attempt.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total attempts"
          value={formatNumber(analytics.totalAttempts)}
          icon={Target}
        />
        <StatCard label="Average accuracy" value={`${analytics.avgAccuracy}%`} icon={Gauge} />
        <StatCard label="Average score" value={`${analytics.avgScorePercent}%`} icon={BarChart3} />
        <StatCard
          label="Time on tests"
          value={formatDuration(analytics.totalTimeSeconds)}
          icon={Users}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5 sm:p-6">
            <h2 className="font-semibold tracking-tight">Most attempted tests</h2>

            {analytics.popularTests.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No test has been attempted yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {analytics.popularTests.map((test) => (
                  <li key={test.id}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <Link
                        href={`/admin/tests/${test.id}`}
                        className="min-w-0 truncate font-medium hover:text-primary"
                      >
                        {test.title}
                      </Link>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {test.attemptCount} attempts
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Average {Math.round(test.avgScore)} of {test.totalMarks}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 sm:p-6">
            <h2 className="font-semibold tracking-tight">Question bank by subject</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Published questions only.
            </p>

            <ul className="mt-4 space-y-3">
              {analytics.questionsBySubject.map((subject) => (
                <li key={subject.name}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-medium">{subject.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {subject.count}
                    </span>
                  </div>
                  <Progress
                    value={(subject.count / maxSubjectCount) * 100}
                    className="mt-1.5"
                    size="sm"
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Button asChild variant="outline">
        <Link href="/admin/tests">Manage tests</Link>
      </Button>
    </div>
  );
}
