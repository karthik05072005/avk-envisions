import type { Metadata } from 'next';
import { FileText } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { SynopsisManager } from '@/features/admin/synopsis-manager';
import { enforceAdminArea } from '@/server/auth/guards';
import { db } from '@/server/db';
import { synopsisStatus } from '@/server/services/synopsis-service';

export const metadata: Metadata = {
  title: 'Analysis PDFs',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Analysis documents, per paper and per series.
 *
 * These could previously only be installed by running a script on the server
 * with a Drive file id committed to the repo, so correcting one — or adding a
 * new year — needed a deploy and someone who could SSH. The people who write
 * the analysis can now replace it themselves.
 *
 * A series-level document is the fallback shown when a paper has none of its
 * own, which is why both are listed together.
 */
export default async function AdminSynopsisPage() {
  await enforceAdminArea('/admin/synopsis');

  const series = await db.testSeries.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      synopsisFileName: true,
      tests: {
        where: { deletedAt: null },
        select: { id: true, title: true, slug: true, synopsisFileName: true },
        orderBy: { slug: 'asc' },
      },
    },
    orderBy: { slug: 'desc' },
  });

  // Sizes come off disk, so a row pointing at a file that is not there shows as
  // missing rather than silently implying the document exists.
  const withStatus = await Promise.all(
    series.map(async (item) => ({
      ...item,
      status: await synopsisStatus(item.synopsisFileName),
      tests: await Promise.all(
        item.tests.map(async (test) => ({
          ...test,
          status: await synopsisStatus(test.synopsisFileName),
        })),
      ),
    })),
  );

  const total = withStatus.reduce(
    (sum, item) => sum + item.tests.filter((t) => t.status.present).length,
    0,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Analysis PDFs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The question-wise analysis a student sees after finishing a paper. {total} installed.
          A series document is used for any paper that has none of its own.
        </p>
      </header>

      {withStatus.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No test series yet"
          description="Create a series first, then attach its analysis documents here."
        />
      ) : (
        withStatus.map((item) => (
          <Card key={item.id}>
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight">{item.name}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Series-level document — the fallback for papers without one
                  </p>
                </div>
                <SynopsisManager
                  kind="series"
                  id={item.id}
                  fileName={item.synopsisFileName}
                  sizeBytes={item.status.sizeBytes}
                  present={item.status.present}
                />
              </div>

              {item.tests.length === 0 ? (
                <p className="pt-3 text-xs text-muted-foreground">No papers in this series yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {item.tests.map((test) => (
                    <li
                      key={test.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{test.title}</p>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {test.slug}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {!test.synopsisFileName && item.synopsisFileName && (
                          <Badge variant="info" size="sm">
                            using the series PDF
                          </Badge>
                        )}
                        <SynopsisManager
                          kind="test"
                          id={test.id}
                          fileName={test.synopsisFileName}
                          sizeBytes={test.status.sizeBytes}
                          present={test.status.present}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
