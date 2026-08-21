'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/label';
import { ApiClientError, api } from '@/lib/api-client';

/**
 * Profile editor.
 *
 * `displayName` is what appears on the leaderboard, kept separate from the
 * legal name on the account — a student can compete without publishing the
 * name they registered with.
 */
export interface ProfileValues {
  name: string;
  displayName: string;
  city: string;
  state: string;
  targetExamId: string | null;
  targetYear: number | null;
  leaderboardVisible: boolean;
}

export function ProfileForm({
  initial,
  exams,
}: {
  initial: ProfileValues;
  exams: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [values, setValues] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);

  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const years = [0, 1, 2, 3].map((offset) => new Date().getFullYear() + offset);

  function set<K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      await api.patch('/api/profile', {
        name: values.name,
        displayName: values.displayName,
        city: values.city,
        state: values.state,
        targetExamId: values.targetExamId,
        targetYear: values.targetYear,
        leaderboardVisible: values.leaderboardVisible,
      });
      toast.success('Profile saved.');
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? (Object.values(error.fieldErrors ?? {})[0]?.[0] ?? error.message)
          : 'We could not save your profile.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5 sm:p-6">
        <h2 className="font-semibold tracking-tight">Your details</h2>

        <FormField label="Full name" htmlFor="p-name" required>
          <Input value={values.name} onChange={(event) => set('name', event.target.value)} />
        </FormField>

        <FormField
          label="Display name"
          htmlFor="p-display"
          hint="Shown on the leaderboard. Leave blank to use your full name."
        >
          <Input
            value={values.displayName}
            onChange={(event) => set('displayName', event.target.value)}
            maxLength={40}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="City" htmlFor="p-city">
            <Input value={values.city} onChange={(event) => set('city', event.target.value)} />
          </FormField>
          <FormField label="State" htmlFor="p-state">
            <Input value={values.state} onChange={(event) => set('state', event.target.value)} />
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Target exam" htmlFor="p-exam">
            <select
              id="p-exam"
              value={values.targetExamId ?? ''}
              onChange={(event) => set('targetExamId', event.target.value || null)}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="">Not decided</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Target year" htmlFor="p-year">
            <select
              id="p-year"
              value={values.targetYear ?? ''}
              onChange={(event) =>
                set('targetYear', event.target.value ? Number(event.target.value) : null)
              }
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="">Not decided</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <label className="flex items-start gap-3 border-t border-border pt-4">
          <input
            type="checkbox"
            checked={values.leaderboardVisible}
            onChange={(event) => set('leaderboardVisible', event.target.checked)}
            className="mt-1 size-4 rounded border-input"
          />
          <span>
            <span className="block text-sm font-medium">Show me on the leaderboard</span>
            <span className="block text-xs text-muted-foreground">
              Turn this off and you disappear from public rankings. Your own results and analytics
              are unaffected.
            </span>
          </span>
        </label>

        <Button onClick={save} loading={saving} disabled={!dirty || !values.name.trim()}>
          <Save aria-hidden="true" />
          Save changes
        </Button>
      </CardContent>
    </Card>
  );
}
