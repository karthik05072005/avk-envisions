'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Target } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/label';
import { ApiClientError, api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

/**
 * Post-registration onboarding.
 *
 * Every field is optional and the whole step is skippable. It exists to make
 * the first dashboard useful — knowing the target exam lets us recommend the
 * right tests — not to gate access to a product the student has already
 * signed up for.
 */
export interface OnboardingExam {
  id: string;
  name: string;
  shortName: string;
  colorHex: string | null;
}

const YEARS = [0, 1, 2].map((offset) => new Date().getFullYear() + offset);

export function OnboardingForm({ exams, name }: { exams: OnboardingExam[]; name: string }) {
  const router = useRouter();

  const [targetExamId, setTargetExamId] = React.useState<string | null>(null);
  const [targetYear, setTargetYear] = React.useState<number | null>(null);
  const [city, setCity] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const firstName = name.split(' ')[0] ?? name;

  async function finish(skip = false) {
    setSaving(true);
    try {
      await api.patch('/api/profile', {
        ...(skip
          ? {}
          : {
              targetExamId,
              targetYear,
              city: city.trim() || undefined,
            }),
        completeOnboarding: true,
      });

      router.replace('/dashboard');
      router.refresh();
    } catch (error) {
      setSaving(false);
      toast.error(
        error instanceof ApiClientError ? error.message : 'We could not save that. Try again.',
      );
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-muted text-primary">
          <Target className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Welcome, {firstName}</h1>
        <p className="mt-1.5 text-pretty text-sm leading-relaxed text-muted-foreground">
          Two quick questions so your dashboard shows the right things. You can skip this and
          change it later.
        </p>
      </div>

      <Card className="mt-6">
        <CardContent className="space-y-5 p-5 sm:p-6">
          <fieldset>
            <legend className="text-sm font-medium">Which exam are you preparing for?</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {exams.map((exam) => (
                <button
                  key={exam.id}
                  type="button"
                  onClick={() => setTargetExamId(exam.id === targetExamId ? null : exam.id)}
                  aria-pressed={targetExamId === exam.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    targetExamId === exam.id
                      ? 'border-primary bg-primary-muted'
                      : 'border-border hover:bg-muted/50',
                  )}
                >
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                    style={
                      exam.colorHex
                        ? { backgroundColor: `${exam.colorHex}1A`, color: exam.colorHex }
                        : undefined
                    }
                  >
                    {exam.shortName.slice(0, 4)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{exam.name}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium">When do you plan to sit it?</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {YEARS.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setTargetYear(year === targetYear ? null : year)}
                  aria-pressed={targetYear === year}
                  className={cn(
                    'rounded-lg border px-4 py-2 text-sm tabular-nums transition-colors',
                    targetYear === year
                      ? 'border-primary bg-primary-muted text-primary'
                      : 'border-border hover:bg-muted',
                  )}
                >
                  {year}
                </button>
              ))}
            </div>
          </fieldset>

          <FormField label="City" htmlFor="ob-city" hint="Optional">
            <Input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="e.g. Bengaluru"
              maxLength={80}
            />
          </FormField>

          <Button
            size="lg"
            fullWidth
            variant="brand"
            onClick={() => finish(false)}
            loading={saving}
            loadingText="Setting up…"
          >
            Continue to my dashboard
            <ArrowRight aria-hidden="true" />
          </Button>
        </CardContent>
      </Card>

      <button
        type="button"
        onClick={() => finish(true)}
        disabled={saving}
        className="mx-auto mt-4 block text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50"
      >
        Skip for now
      </button>
    </div>
  );
}
