import Link from 'next/link';
import { ArrowLeft, Compass } from 'lucide-react';

import { Logo } from '@/components/site/logo';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

/**
 * Global 404.
 *
 * Routes that exist but are not yet built land here too, so this page offers a
 * way back rather than a dead end.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border">
        <div className="container flex h-16 items-center">
          <Logo />
        </div>
      </header>

      <main id="main-content" className="flex flex-1 items-center justify-center px-4 py-20">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary-muted text-primary">
            <Compass className="size-6" aria-hidden="true" />
          </div>

          <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-primary">
            Error 404
          </p>
          <h1 className="mt-2 text-balance text-display-sm">This page isn’t here</h1>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
            The link may be broken, or the page may have moved. Let’s get you back to something
            useful.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/">
                <ArrowLeft aria-hidden="true" />
                Back to home
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
