import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, Layers } from 'lucide-react';

import { PageHeader } from '@/components/site/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { formatPaise } from '@/lib/utils';
import { getAllTestSeries } from '@/server/services/marketing-service';

export const metadata: Metadata = {
  title: 'Test series',
  description:
    'Structured test series with full-length mocks, sectional tests and detailed performance analysis after every attempt.',
  alternates: { canonical: '/test-series' },
};

export default async function TestSeriesPage() {
  const series = await getAllTestSeries();

  return (
    <>
      <PageHeader
        eyebrow="Test series"
        title="Structured series, not a pile of tests"
        description="Each series follows a deliberate progression — chapter drills, then sectional tests, then full-length mocks under real exam conditions."
      />

      <section className="container py-14 sm:py-16">
        {series.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No test series published yet"
            description="Series appear here once the content team publishes them. In the meantime, free practice is already available."
            action={{ label: 'Start practising', href: '/register' }}
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {series.map((item) => (
              <Card
                key={item.id}
                interactive
                className={item.isFeatured ? 'relative border-primary/40' : 'relative'}
              >
                <CardContent className="flex h-full flex-col p-6">
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant="brand"
                      size="sm"
                      style={
                        item.exam.colorHex
                          ? { backgroundColor: `${item.exam.colorHex}1A`, color: item.exam.colorHex }
                          : undefined
                      }
                    >
                      {item.exam.shortName}
                    </Badge>
                    {item.discountPercent > 0 && (
                      <Badge variant="success" size="sm">
                        {item.discountPercent}% off
                      </Badge>
                    )}
                  </div>

                  <h2 className="mt-4 text-lg font-semibold leading-tight tracking-tight">
                    {item.name}
                  </h2>
                  {item.tagline && (
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {item.tagline}
                    </p>
                  )}

                  <ul className="mt-5 flex-1 space-y-2.5">
                    {item.features.slice(0, 4).map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <CheckCircle2
                          className="mt-0.5 size-4 shrink-0 text-success"
                          aria-hidden="true"
                        />
                        <span className="leading-relaxed text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 border-t border-border pt-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-semibold tracking-tight">
                        {item.priceInPaise === 0 ? 'Free' : formatPaise(item.priceInPaise)}
                      </span>
                      {item.comparePriceInPaise > item.priceInPaise && (
                        <span className="text-sm text-muted-foreground line-through">
                          {formatPaise(item.comparePriceInPaise)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.testCount} tests · {item.difficulty.toLowerCase()} difficulty
                    </p>

                    <Button asChild fullWidth className="mt-4">
                      <Link href={`/test-series/${item.slug}`}>View series</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
