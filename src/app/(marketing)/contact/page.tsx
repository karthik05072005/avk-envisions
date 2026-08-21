import type { Metadata } from 'next';
import Link from 'next/link';
import { HelpCircle, LifeBuoy, Mail } from 'lucide-react';

import { PageHeader } from '@/components/site/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { currentUser } from '@/server/auth/guards';
import { db } from '@/server/db';

export const metadata: Metadata = {
  title: 'Contact us',
  description: 'Get in touch with the AVK Visions team.',
  alternates: { canonical: '/contact' },
};

export const dynamic = 'force-dynamic';

export default async function ContactPage() {
  const [user, settings] = await Promise.all([
    currentUser(),
    db.siteSetting.findMany({
      where: { key: { in: ['site.supportEmail', 'site.contactEmail'] } },
      select: { key: true, value: true },
    }),
  ]);

  const byKey = new Map(settings.map((s) => [s.key, s.value]));
  const supportEmail = byKey.get('site.supportEmail') ?? 'support@avkvisions.com';
  const contactEmail = byKey.get('site.contactEmail') ?? supportEmail;

  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="Get in touch"
        description="A support ticket reaches us fastest and keeps the whole conversation in one place. Email works too."
      />

      <section className="container py-14 sm:py-16">
        <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-2">
          {/* Ticket — the preferred route ------------------------------- */}
          <Card variant="elevated">
            <CardContent className="flex h-full flex-col p-6">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary-muted text-primary">
                <LifeBuoy className="size-5" aria-hidden="true" />
              </span>

              <h2 className="mt-4 font-semibold tracking-tight">Open a support ticket</h2>
              <p className="mt-2 flex-1 text-pretty text-sm leading-relaxed text-muted-foreground">
                Best for anything about your account, a payment, or a mistake in a question. We can
                see your attempt history, so we can usually answer straight away.
              </p>

              <Button asChild className="mt-5">
                {/* Ticketing lives in the student area, so signed-out visitors
                    are sent through sign-in with a return path. */}
                <Link href={user ? '/support' : '/login?next=%2Fsupport'}>
                  {user ? 'Open a ticket' : 'Sign in to open a ticket'}
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Email ------------------------------------------------------ */}
          <Card>
            <CardContent className="flex h-full flex-col p-6">
              <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Mail className="size-5" aria-hidden="true" />
              </span>

              <h2 className="mt-4 font-semibold tracking-tight">Email us</h2>
              <p className="mt-2 flex-1 text-pretty text-sm leading-relaxed text-muted-foreground">
                If you cannot sign in, or would rather write directly.
              </p>

              <dl className="mt-5 space-y-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Support</dt>
                  <dd>
                    <a
                      href={`mailto:${supportEmail}`}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {supportEmail}
                    </a>
                  </dd>
                </div>
                {contactEmail !== supportEmail && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      Everything else
                    </dt>
                    <dd>
                      <a
                        href={`mailto:${contactEmail}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {contactEmail}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        </div>

        <div className="mx-auto mt-8 max-w-4xl rounded-xl border border-border bg-muted/30 p-5">
          <p className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
            <HelpCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Many questions are already answered on the{' '}
              <Link href="/faq" className="font-medium text-primary underline underline-offset-4">
                FAQ page
              </Link>
              . Worth a look first — it is usually faster than waiting for a reply.
            </span>
          </p>
        </div>
      </section>
    </>
  );
}
