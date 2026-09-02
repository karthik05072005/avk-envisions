import type { Metadata } from 'next';
import Link from 'next/link';
import { Flag } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { ReportActions } from '@/features/admin/report-actions';
import { QUESTION_REPORT_REASON_LABELS } from '@/lib/enums';
import { formatDate } from '@/lib/utils';
import { enforceAdminArea } from '@/server/auth/guards';
import { listQuestionReports } from '@/server/services/question-report-service';

export const metadata: Metadata = {
  title: 'Reported questions',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const TABS = [
  ['REPORTED', 'New'],
  ['REVIEWING', 'Looking into it'],
  ['RESOLVED', 'Fixed'],
  ['REJECTED', 'No change needed'],
  ['ALL', 'Everything'],
] as const;

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await enforceAdminArea('/admin/reports');
  const params = await searchParams;

  // Default to what needs work, not the whole history.
  const status = params.status ?? 'REPORTED';
  const reports = await listQuestionReports(status === 'ALL' ? undefined : status);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reported questions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Students telling us a question is wrong. A wrong answer key costs marks silently, so
          these are worth clearing first.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map(([value, label]) => (
          <Link
            key={value}
            href={`/admin/reports?status=${value}`}
            className={
              status === value
                ? 'rounded-lg border border-primary bg-primary-muted px-3 py-1.5 text-sm font-medium'
                : 'rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/50'
            }
          >
            {label}
          </Link>
        ))}
      </div>

      {reports.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="Nothing reported"
          description="When a student flags a question, it appears here."
        />
      ) : (
        <ul className="space-y-3">
          {reports.map((report) => (
            <li key={report.id}>
              <Card>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="warning" size="sm">
                      {QUESTION_REPORT_REASON_LABELS[
                        report.reason as keyof typeof QUESTION_REPORT_REASON_LABELS
                      ] ?? report.reason}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {report.question.code}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(report.createdAt)}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {report.reporter ? report.reporter.name : 'A guest'}
                    </span>
                  </div>

                  <p className="mt-2.5 line-clamp-2 text-sm">{report.question.body}</p>

                  {report.description && (
                    <p className="mt-2 rounded-lg border border-border bg-muted/40 p-2.5 text-sm">
                      {report.description}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/questions/${report.question.id}`}
                      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Open the question
                    </Link>
                    <ReportActions id={report.id} status={report.status} />
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
