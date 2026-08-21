import Image from 'next/image';
import Link from 'next/link';

import { cn } from '@/lib/utils';

/**
 * AVK Envisions mark.
 *
 * The supplied gold/graphite monogram, served as a transparent PNG so it sits
 * correctly on either theme's header. It is deliberately a raster rather than
 * inline SVG: the artwork has gradients and bevels that do not reduce to
 * `currentColor` without losing the brand.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/logo-avk.png"
      alt=""
      width={64}
      height={64}
      priority
      className={cn('size-9 shrink-0 object-contain', className)}
    />
  );
}

/**
 * Wordmark and home link.
 *
 * Always navigates to the home page — this is the site's home button, so it
 * carries an explicit label and tooltip rather than relying on the convention
 * that a logo is clickable.
 */
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
      title="Home"
      className={cn(
        'group inline-flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-90',
        className,
      )}
      aria-label="AVK Envisions — home"
    >
      <LogoMark />
      {showText && (
        <span className="text-[1.0625rem] font-bold leading-tight tracking-tight">
          AVK<span className="text-primary"> Envisions</span>
        </span>
      )}
    </Link>
  );
}
