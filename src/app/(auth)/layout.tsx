import Link from 'next/link';
import { BarChart3, ShieldCheck, Target } from 'lucide-react';

import { Logo } from '@/components/site/logo';
import { ThemeToggle } from '@/components/theme-toggle';

/**
 * Split-screen shell for every authentication screen.
 *
 * The right panel is decorative and hidden below `lg`, so on mobile the form
 * gets the entire viewport rather than being pushed below marketing copy.
 */
const HIGHLIGHTS = [
  {
    icon: Target,
    title: 'Know your weak topics',
    body: 'Ranked by how much they are actually costing you, not by how many you got wrong.',
  },
  {
    icon: BarChart3,
    title: 'Track real progress',
    body: 'Accuracy, speed and percentile trends across every attempt you make.',
  },
  {
    icon: ShieldCheck,
    title: 'Never lose an answer',
    body: 'Continuous autosave and a server-side timer, so a dropped connection costs you nothing.',
  },
] as const;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:grid lg:grid-cols-2">
      {/* Form side */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between px-6 py-5 sm:px-10">
          <Logo />
          <ThemeToggle />
        </header>

        <main id="main-content" className="flex flex-1 items-center justify-center px-6 py-8 sm:px-10">
          <div className="w-full max-w-sm">{children}</div>
        </main>

        <footer className="px-6 py-6 sm:px-10">
          <p className="text-center text-xs text-muted-foreground lg:text-left">
            By continuing you agree to our{' '}
            <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>
        </footer>
      </div>

      {/* Decorative side */}
      <aside className="relative hidden overflow-hidden bg-brand-gradient lg:flex lg:flex-col lg:justify-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_0%,rgba(255,255,255,0.18),transparent)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:64px_64px]"
        />

        <div className="relative mx-auto max-w-md px-12">
          <h2 className="text-balance text-display-sm text-primary-foreground">
            Preparation that tells you what to do next.
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-primary-foreground/80">
            Most platforms hand you a score. AVK Envisions hands you a plan.
          </p>

          <ul className="mt-10 space-y-7">
            {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-primary-foreground backdrop-blur-sm">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-primary-foreground">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-primary-foreground/75">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
