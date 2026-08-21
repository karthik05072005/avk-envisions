import Link from 'next/link';

import { cn } from '@/lib/utils';

/**
 * AVK Visions wordmark.
 *
 * Drawn as inline SVG rather than an image file so it inherits `currentColor`
 * and stays crisp in both themes without shipping two assets.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn('size-8', className)}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      {/* Stylised "A" formed from an upward chevron — growth and ascent. */}
      <path
        d="M9 22.5L16 9L23 22.5"
        className="stroke-primary-foreground"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.4 18.2H19.6"
        className="stroke-primary-foreground"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}

export function Logo({
  className,
  href = '/',
  showText = true,
}: {
  className?: string;
  href?: string;
  showText?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group inline-flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-90',
        className,
      )}
      aria-label="AVK Visions home"
    >
      <LogoMark />
      {showText && (
        <span className="text-[1.0625rem] font-bold tracking-tight">
          AVK<span className="text-primary"> Visions</span>
        </span>
      )}
    </Link>
  );
}
