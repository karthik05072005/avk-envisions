'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronRight, LayoutDashboard, LogOut, User, X } from 'lucide-react';

import { Logo } from '@/components/site/logo';
import { cn } from '@/lib/utils';

/**
 * The slide-out navigation.
 *
 * A vertical list rather than a row of tabs: the site has nine sections and a
 * horizontal bar could only show them by shrinking the labels until they read
 * as abbreviations. A list gives every section the same weight at any width,
 * which is how the catalogue is actually organised.
 */

export interface NavItem {
  href: string;
  label: string;
  /** Rendered as the row's icon; passed from the server component. */
  icon: React.ReactNode;
}

interface Props {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  session: { name: string; dashboardHref: string } | null;
  onSignOut: () => void;
  signingOut: boolean;
  pathname: string;
}

/** Where the study material and updates are published. */
const SOCIALS = [
  { href: 'https://youtube.com/@avkenvisions', label: 'YouTube', tint: 'bg-red-600' },
  { href: 'https://t.me/avkenvisions', label: 'Telegram', tint: 'bg-sky-500' },
  { href: 'https://instagram.com/avkenvisions', label: 'Instagram', tint: 'bg-fuchsia-600' },
  { href: 'https://wa.me/919999999999', label: 'WhatsApp', tint: 'bg-green-600' },
];

export function NavPanel({
  open,
  onClose,
  items,
  session,
  onSignOut,
  signingOut,
  pathname,
}: Props) {
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Escape closes it, as with any dialog. Without this the only way out on a
  // keyboard is to tab all the way to the close button.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Focus moves into the panel so a screen reader announces it rather than
  // leaving the reading position behind on the page underneath.
  React.useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/25 backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-full max-w-xs flex-col overflow-y-auto bg-background shadow-2xl outline-none animate-slide-in-right sm:max-w-sm"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <Logo />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-3" aria-label="Main">
          <ul className="space-y-0.5">
            {items.map((item) => {
              // Home matches only itself: every path starts with "/", so the
              // prefix rule below would light Home on every page of the site.
              const active =
                item.href === '/'
                  ? pathname === '/'
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary-muted text-primary'
                        : 'text-foreground hover:bg-muted/70',
                    )}
                  >
                    <span
                      className={cn('shrink-0', active ? 'text-primary' : 'text-muted-foreground')}
                      aria-hidden="true"
                    >
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="space-y-4 border-t border-border px-5 py-4">
          <Link
            href={session ? session.dashboardHref : '/register'}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <LayoutDashboard className="size-4" aria-hidden="true" />
            Dashboard
          </Link>

          <ul className="flex items-center justify-center gap-3">
            {SOCIALS.map((social) => (
              <li key={social.label}>
                <a
                  href={social.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={social.label}
                  className={cn(
                    'flex size-9 items-center justify-center rounded-lg text-white transition-opacity hover:opacity-85',
                    social.tint,
                  )}
                >
                  <SocialGlyph name={social.label} />
                </a>
              </li>
            ))}
          </ul>

          {session ? (
            <button
              type="button"
              onClick={onSignOut}
              disabled={signingOut}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted/60 disabled:opacity-60"
            >
              <LogOut className="size-4" aria-hidden="true" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          ) : (
            <p className="flex items-center justify-center gap-3 text-sm">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 font-medium transition-colors hover:text-primary"
              >
                <User className="size-4" aria-hidden="true" />
                Login
              </Link>
              <span className="text-border" aria-hidden="true">
                |
              </span>
              <Link href="/register" className="font-semibold text-primary hover:underline">
                Register
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Brand marks, inline so the panel needs no icon package at runtime. */
function SocialGlyph({ name }: { name: string }) {
  const common = { className: 'size-4', fill: 'currentColor', 'aria-hidden': true } as const;

  if (name === 'YouTube') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6Z" />
      </svg>
    );
  }
  if (name === 'Telegram') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm5.6 8.2-1.9 8.8c-.1.6-.5.8-1 .5l-2.8-2.1-1.4 1.3c-.2.2-.3.3-.6.3l.2-3 5.4-4.9c.2-.2 0-.3-.4-.1l-6.6 4.2-2.9-.9c-.6-.2-.6-.6.1-.9l11.4-4.4c.5-.2 1 .1.8.9Z" />
      </svg>
    );
  }
  if (name === 'Instagram') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2 0 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c0 1.2-.3 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2 0-1.8-.3-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c0-1.2.3-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4 1.3-.1 1.7-.1 4.8-.1Zm0 5.7a4.1 4.1 0 1 0 0 8.2 4.1 4.1 0 0 0 0-8.2Zm0 6.8a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4Zm5.2-6.9a1 1 0 1 1-1.9 0 1 1 0 0 1 1.9 0Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <path d="M12 0a12 12 0 0 0-10 18.4L0 24l5.8-1.9A12 12 0 1 0 12 0Zm6.9 17c-.3.8-1.7 1.5-2.3 1.6-.6.1-1.3.1-2.1-.1-.5-.2-1.1-.4-1.9-.7-3.3-1.4-5.5-4.8-5.7-5-.2-.2-1.4-1.8-1.4-3.5 0-1.7.9-2.5 1.2-2.8.3-.3.7-.4.9-.4h.6c.2 0 .5-.1.7.5l1 2.4c.1.2.1.4 0 .6l-.4.6c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.2 1.4 2.5 1.5.3.2.5.1.6 0l1-1.2c.2-.2.4-.2.6-.1l2.2 1.1c.2.1.4.2.5.3 0 .2 0 .8-.3 1.5Z" />
    </svg>
  );
}
