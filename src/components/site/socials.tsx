import { cn } from '@/lib/utils';

/**
 * The channels where AVK Envisions publishes.
 *
 * One definition, used by the navigation panel and the footer, so a changed
 * handle cannot end up correct in one place and stale in the other.
 *
 * The share-sheet tracking parameters that come with copied links (`si`,
 * `utm_source=qr`, `r=nametag`) are stripped: they identify the QR code or app
 * a link was copied from, so leaving them in would tag every visitor arriving
 * from the site as having scanned a poster.
 */
export const SOCIALS = [
  { href: 'https://youtube.com/@avkenvisions', label: 'YouTube', tint: 'bg-red-600' },
  { href: 'https://t.me/KASEnvisions', label: 'Telegram', tint: 'bg-sky-500' },
  { href: 'https://www.instagram.com/avkenvision/', label: 'Instagram', tint: 'bg-fuchsia-600' },
  {
    href: 'https://whatsapp.com/channel/0029VbD35utIXnlrLmpWTD3L',
    label: 'WhatsApp',
    tint: 'bg-green-600',
  },
] as const;

/** Brand marks, inline so no icon package is needed at runtime. */
export function SocialGlyph({ name, className }: { name: string; className?: string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'currentColor',
    className: cn('size-4', className),
    'aria-hidden': true,
  } as const;

  if (name === 'YouTube') {
    return (
      <svg {...common}>
        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6Z" />
      </svg>
    );
  }

  if (name === 'Telegram') {
    return (
      <svg {...common}>
        <path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm5.6 8.2-1.9 8.8c-.1.6-.5.8-1 .5l-2.8-2.1-1.4 1.3c-.2.2-.3.3-.6.3l.2-3 5.4-4.9c.2-.2 0-.3-.4-.1l-6.6 4.2-2.9-.9c-.6-.2-.6-.6.1-.9l11.4-4.4c.5-.2 1 .1.8.9Z" />
      </svg>
    );
  }

  if (name === 'Instagram') {
    return (
      <svg {...common}>
        <path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2 0 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c0 1.2-.3 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2 0-1.8-.3-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c0-1.2.3-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4 1.3-.1 1.7-.1 4.8-.1Zm0 5.7a4.1 4.1 0 1 0 0 8.2 4.1 4.1 0 0 0 0-8.2Zm0 6.8a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4Zm5.2-6.9a1 1 0 1 1-1.9 0 1 1 0 0 1 1.9 0Z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M12 0a12 12 0 0 0-10 18.4L0 24l5.8-1.9A12 12 0 1 0 12 0Zm6.9 17c-.3.8-1.7 1.5-2.3 1.6-.6.1-1.3.1-2.1-.1-.5-.2-1.1-.4-1.9-.7-3.3-1.4-5.5-4.8-5.7-5-.2-.2-1.4-1.8-1.4-3.5 0-1.7.9-2.5 1.2-2.8.3-.3.7-.4.9-.4h.6c.2 0 .5-.1.7.5l1 2.4c.1.2.1.4 0 .6l-.4.6c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.2 1.4 2.5 1.5.3.2.5.1.6 0l1-1.2c.2-.2.4-.2.6-.1l2.2 1.1c.2.1.4.2.5.3 0 .2 0 .8-.3 1.5Z" />
    </svg>
  );
}

/** The four channels as a row of coloured buttons. */
export function SocialLinks({ className }: { className?: string }) {
  return (
    <ul className={cn('flex items-center gap-3', className)}>
      {SOCIALS.map((social) => (
        <li key={social.label}>
          <a
            href={social.href}
            target="_blank"
            // `noreferrer` alongside `noopener`: these open a third-party site,
            // which has no need to be told which page sent the visitor.
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
  );
}
