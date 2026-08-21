import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, HelpCircle } from 'lucide-react';

import { PageHeader } from '@/components/site/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { formatPaise } from '@/lib/utils';
import { getFaqs, getPublishedPlans } from '@/server/services/marketing-service';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Simple plans for AVK Envisions. Start free, upgrade when the platform has proven itself to you.',
  alternates: { canonical: '/pricing' },
};

export default async function PricingPage() {
  const [plans, faqs] = await Promise.all([getPublishedPlans(), getFaqs('PAYMENT', 8)]);

  return (
    <>
      <PageHeader
        eyebrow="Pricing"
        title="Straightforward plans"
        description="Start free, with real mock tests and a real performance report. Upgrade only when it has earned it."
      />

      <section className="container py-14 sm:py-16">
        {plans.length === 0 ? (
          <EmptyState
            title="Plans are being finalised"
            description="Pricing will appear here shortly. You can still create a free account and start practising."
            action={{ label: 'Create a free account', href: '/register' }}
          />
        ) : (
          <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                variant={plan.isFeatured ? 'elevated' : 'default'}
                className={plan.isFeatured ? 'relative border-primary/40' : 'relative'}
              >
                {plan.isFeatured && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most popular</Badge>
                )}

                <CardContent className="flex h-full flex-col p-6">
                  <h2 className="text-lg font-semibold tracking-tight">{plan.name}</h2>
                  {plan.tagline && (
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {plan.tagline}
                    </p>
                  )}

                  <div className="mt-5 flex items-baseline gap-2">
                    <span className="text-3xl font-semibold tracking-tight">
                      {plan.priceInPaise === 0 ? 'Free' : formatPaise(plan.priceInPaise)}
                    </span>
                    {plan.priceInPaise > 0 && (
                      <span className="text-sm text-muted-foreground">
                        / {plan.durationDays >= 365 ? 'year' : `${plan.durationDays} days`}
                      </span>
                    )}
                  </div>

                  {plan.comparePriceInPaise > plan.priceInPaise && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      <span className="line-through">{formatPaise(plan.comparePriceInPaise)}</span>{' '}
                      <span className="font-medium text-success">
                        Save{' '}
                        {Math.round(
                          ((plan.comparePriceInPaise - plan.priceInPaise) /
                            plan.comparePriceInPaise) *
                            100,
                        )}
                        %
                      </span>
                    </p>
                  )}

                  <ul className="mt-6 flex-1 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2
                          className="mt-0.5 size-4 shrink-0 text-success"
                          aria-hidden="true"
                        />
                        <span className="leading-relaxed text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    asChild
                    fullWidth
                    size="lg"
                    variant={plan.isFeatured ? 'brand' : 'outline'}
                    className="mt-7"
                  >
                    <Link href="/register">
                      {plan.priceInPaise === 0 ? 'Start free' : `Choose ${plan.name}`}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <p className="mt-8 text-center text-sm text-muted-foreground">
          All prices in Indian Rupees and inclusive of applicable taxes. Cancel anytime — your past
          results are never deleted.
        </p>
      </section>

      {faqs.length > 0 && (
        <section className="border-t border-border bg-muted/20 py-14 sm:py-16">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary-muted text-primary">
                <HelpCircle className="size-5" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-display-sm">Billing questions</h2>
            </div>

            <div className="mx-auto mt-10 max-w-3xl divide-y divide-border rounded-xl border border-border bg-card">
              {faqs.map((faq) => (
                <details key={faq.id} className="group px-6 py-5">
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
          </div>
        </section>
      )}
    </>
  );
}
