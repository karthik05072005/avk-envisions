import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

import { Logo } from '@/components/site/logo';
import { Button } from '@/components/ui/button';
import { db } from '@/server/db';

export const metadata: Metadata = {
  title: 'Account suspended',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Shown when a suspended account tries to use the app.
 *
 * Sits outside every layout group on purpose: the student and admin shells both
 * call guards that would redirect straight back here, and a redirect loop is a
 * worse experience than a plain page.
 *
 * The wording deliberately gives no reason. Suspension can follow a payment
 * dispute or a cheating investigation, and stating a cause here — without a
 * human having reviewed it — would be both premature and unfair.
 */
export default async function AccountSuspendedPage() {
  const setting = await db.siteSetting.findUnique({
    where: { key: 'site.supportEmail' },
    select: { value: true },
  });

  const supportEmail = setting?.value ?? 'support@avkvisions.com';

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-border">
        <div className="container flex h-16 items-center">
          <Logo />
        </div>
      </header>

      <main id="main-content" className="flex flex-1 items-center justify-center px-4 py-20">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-warning/10 text-warning">
            <ShieldAlert className="size-6" aria-hidden="true" />
          </div>

          <h1 className="mt-6 text-balance text-display-sm">Your account is suspended</h1>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
            You cannot sign in or attempt tests while an account is suspended. Your results,
            purchases and history are not deleted — they are preserved exactly as they were.
          </p>

          <p className="mt-4 text-pretty text-sm leading-relaxed text-muted-foreground">
            If you think this is a mistake, email{' '}
            <a
              href={`mailto:${supportEmail}`}
              className="font-medium text-primary underline underline-offset-4"
            >
              {supportEmail}
            </a>{' '}
            and a person will look at it.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild>
              <a href={`mailto:${supportEmail}`}>Email support</a>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
