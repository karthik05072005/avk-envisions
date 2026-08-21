import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

import { Providers } from '@/components/providers';
import { publicEnv } from '@/lib/env';

import './globals.css';

/**
 * Inter is loaded through `next/font`, which self-hosts the files at build
 * time — no runtime request to Google, and no layout shift from a swap.
 */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.appUrl),
  title: {
    default: `${publicEnv.appName} — Online Test Series & Exam Preparation`,
    template: `%s · ${publicEnv.appName}`,
  },
  description:
    'Prepare smarter with full-length mock tests, sectional practice, a deep question bank and analytics that show you exactly what to fix next.',
  applicationName: publicEnv.appName,
  keywords: [
    'online test series',
    'mock tests',
    'exam preparation',
    'question bank',
    'practice tests',
    'previous year questions',
  ],
  authors: [{ name: publicEnv.appName }],
  openGraph: {
    type: 'website',
    siteName: publicEnv.appName,
    locale: 'en_IN',
    url: publicEnv.appUrl,
    title: `${publicEnv.appName} — Online Test Series & Exam Preparation`,
    description:
      'Full-length mocks, sectional tests and performance analytics that tell you what to study next.',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${publicEnv.appName} — Online Test Series`,
    description: 'Prepare smarter. Perform better. Achieve more.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  manifest: '/manifest.webmanifest',
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Zoom is left enabled deliberately: capping it fails WCAG 1.4.4 and hurts
  // students reading dense question text on small screens.
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0f1d' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="min-h-dvh bg-background font-sans antialiased">
        {/* First tab stop on every page — required for keyboard-only users. */}
        <a
          href="#main-content"
          className="sr-only z-[100] focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
        >
          Skip to main content
        </a>

        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
