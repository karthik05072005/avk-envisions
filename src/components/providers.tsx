'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@radix-ui/react-tooltip';

/**
 * Client-side providers mounted once at the root.
 *
 * Kept deliberately small: anything that can stay a server component should,
 * so this file is not a dumping ground for context.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      // Theme transitions look elegant on a settings screen and awful on a
      // full page repaint, so they are suppressed globally.
      disableTransitionOnChange
    >
      <TooltipProvider delayDuration={200} skipDelayDuration={300}>
        {children}
      </TooltipProvider>

      <Toaster
        position="top-right"
        richColors
        closeButton
        // Errors need long enough to read; successes should get out of the way.
        duration={4000}
        toastOptions={{
          classNames: {
            toast: 'rounded-xl border border-border shadow-elevated',
            title: 'text-sm font-semibold',
            description: 'text-sm text-muted-foreground',
          },
        }}
      />
    </NextThemesProvider>
  );
}
