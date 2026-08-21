'use client';

import * as React from 'react';

import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_STRENGTH_LABELS as LABELS,
  scorePassword as score,
} from '@/lib/password-policy';
import { cn } from '@/lib/utils';

/**
 * Password strength meter.
 *
 * Purely advisory. The requirement checklist that used to sit here was removed
 * along with the composition rules — showing a list of ticks for things that
 * are not actually required would tell the user something untrue about what the
 * form will accept.
 *
 * The only hard rule left is the length floor, and that is surfaced as a plain
 * message rather than a checklist item.
 */
export function PasswordStrength({ password, className }: { password: string; className?: string }) {
  if (!password) return null;

  const value = score(password);
  const tooShort = password.length < PASSWORD_MIN_LENGTH;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors duration-300',
                index < value
                  ? value <= 1
                    ? 'bg-destructive'
                    : value === 2
                      ? 'bg-warning'
                      : 'bg-success'
                  : 'bg-muted',
              )}
            />
          ))}
        </div>

        <span
          className={cn(
            'text-xs font-medium tabular-nums',
            value <= 1 ? 'text-destructive' : value === 2 ? 'text-warning' : 'text-success',
          )}
        >
          {LABELS[value]}
        </span>
      </div>

      {tooShort ? (
        <p className="text-xs text-destructive" aria-live="polite">
          Use at least {PASSWORD_MIN_LENGTH} characters.
        </p>
      ) : (
        value <= 1 && (
          // Advice, not a blocker — the form will accept this.
          <p className="text-xs text-muted-foreground">
            This password is weak, but you can still use it. A longer one is harder to guess.
          </p>
        )
      )}
    </div>
  );
}
