import type { Metadata } from 'next';
import Link from 'next/link';
import { HelpCircle, LifeBuoy } from 'lucide-react';

import { PageHeader } from '@/components/site/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { db } from '@/server/db';

export const metadata: Metadata = {
  title: 'Frequently asked questions',
  description:
    'Answers to common questions about AVK Envisions — tests, results, payments and your account.',
  alternates: { canonical: '/faq' },
};

export const revalidate = 3600;

const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: 'General',
  TESTS: 'Tests and results',
  PAYMENT: 'Payments and refunds',
  ACCOUNT: 'Your account',
  TECHNICAL: 'Technical',
  TEST_SERIES: 'Test series',
  OTHER: 'Anything else',
};

export default async function FaqPage() {
  const faqs = await db.faq.findMany({
    // Series-specific FAQs belong on that series' page, not the general list.
    where: { isPublished: true, testSeriesId: null },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    select: { id: true, question: true, answer: true, category: true },
  });

  const grouped = faqs.reduce<Record<string, typeof faqs>>((acc, faq) => {
    (acc[faq.category] ??= []).push(faq);
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        eyebrow="FAQ"
        title="Frequently asked questions"
        description="If your question is not answered here, open a support ticket and a human will reply — usually within one working day."
      />

      <section className="container py-14 sm:py-16">
        {faqs.length === 0 ? (
          <EmptyState
            icon={HelpCircle}
            title="No questions published yet"
            description="Answers appear here as the team writes them. In the meantime, support can help directly."
            action={{ label: 'Contact support', href: '/contact' }}
          />
        ) : (
          <div className="mx-auto max-w-3xl space-y-10">
            {Object.entries(grouped).map(([category, items]) => (
              <section key={category}>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {CATEGORY_LABELS[category] ?? category}
                </h2>

                <div className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
                  {items.map((faq) => (
                    <details key={faq.id} className="group px-5 py-4">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                        {faq.question}
                        <span
                          aria-hidden="true"
                          className="grid size-6 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-transform group-open:rotate-45"
                        >
                          +
                        </span>
                      </summary>
                      <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
                        {faq.answer}
                      </p>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="mx-auto mt-12 max-w-2xl rounded-xl border border-border bg-muted/30 p-6 text-center">
          <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary-muted text-primary">
            <LifeBuoy className="size-5" aria-hidden="true" />
          </span>
          <h2 className="mt-3 font-semibold tracking-tight">Still stuck?</h2>
          <p className="mx-auto mt-1.5 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
            Open a ticket and tell us what happened. We reply to every one.
          </p>
          <Button asChild className="mt-4">
            <Link href="/contact">Contact support</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
