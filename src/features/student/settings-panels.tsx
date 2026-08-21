'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Laptop, LogOut, Save, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/label';
import { InlineError } from '@/components/ui/states';
import { PasswordStrength } from '@/features/auth/password-strength';
import { ApiClientError, api } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';

/**
 * Change password.
 *
 * "Sign out other devices" defaults on. A password change is usually a
 * response to a suspected compromise, and leaving an attacker's session alive
 * would defeat the point.
 */
export function PasswordPanel() {
  const router = useRouter();
  const [current, setCurrent] = React.useState('');
  const [next, setNext] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [signOutOthers, setSignOutOthers] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit = current && next && next === confirm && !saving;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await api.post('/api/auth/change-password', {
        currentPassword: current,
        newPassword: next,
        confirmPassword: confirm,
        signOutOtherDevices: signOutOthers,
      });

      setCurrent('');
      setNext('');
      setConfirm('');
      toast.success('Password updated.');
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? (Object.values(caught.fieldErrors ?? {})[0]?.[0] ?? caught.message)
          : 'We could not change your password.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-semibold tracking-tight">
          <KeyRound className="size-4 text-muted-foreground" aria-hidden="true" />
          Password
        </h2>

        <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
          {error && <InlineError message={error} />}

          <FormField label="Current password" htmlFor="s-current" required>
            <Input
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
            />
          </FormField>

          <div className="space-y-1.5">
            <label htmlFor="s-new" className="text-sm font-medium leading-none">
              New password
              <span aria-hidden="true" className="ml-0.5 text-destructive">
                *
              </span>
            </label>
            <Input
              id="s-new"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
            />
            <PasswordStrength password={next} className="pt-1" />
          </div>

          <FormField
            label="Confirm new password"
            htmlFor="s-confirm"
            required
            error={mismatch ? 'Passwords do not match' : undefined}
          >
            <Input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              invalid={mismatch}
            />
          </FormField>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={signOutOthers}
              onChange={(event) => setSignOutOthers(event.target.checked)}
              className="mt-1 size-4 rounded border-input"
            />
            <span>
              <span className="block text-sm font-medium">Sign out on all other devices</span>
              <span className="block text-xs text-muted-foreground">
                Recommended. You stay signed in here.
              </span>
            </span>
          </label>

          <Button type="submit" loading={saving} disabled={!canSubmit}>
            <Save aria-hidden="true" />
            Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------

export interface NotificationValues {
  emailEnabled: boolean;
  newTestAlerts: boolean;
  testReminders: boolean;
  resultAlerts: boolean;
  studyReminders: boolean;
  achievementAlerts: boolean;
  subscriptionAlerts: boolean;
  marketingEmails: boolean;
}

const NOTIFICATION_ROWS: { key: keyof NotificationValues; label: string; hint: string }[] = [
  { key: 'resultAlerts', label: 'Test results', hint: 'When your result and rank are ready' },
  { key: 'newTestAlerts', label: 'New tests', hint: 'When a test is added to a series you own' },
  { key: 'testReminders', label: 'Test reminders', hint: 'Before a scheduled test opens' },
  { key: 'studyReminders', label: 'Study reminders', hint: 'Daily nudge to keep your streak' },
  { key: 'achievementAlerts', label: 'Achievements', hint: 'When you unlock a badge' },
  {
    key: 'subscriptionAlerts',
    label: 'Subscription',
    hint: 'Renewals and expiry — these matter for access',
  },
  { key: 'marketingEmails', label: 'Product news', hint: 'Occasional updates and offers' },
];

export function NotificationPanel({ initial }: { initial: NotificationValues }) {
  const router = useRouter();
  const [values, setValues] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);

  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  async function save() {
    setSaving(true);
    try {
      await api.patch('/api/profile', { notifications: values });
      toast.success('Preferences saved.');
      router.refresh();
    } catch {
      toast.error('We could not save your preferences.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <h2 className="font-semibold tracking-tight">Email notifications</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Account and security emails are always sent — those are not marketing.
        </p>

        <label className="mt-4 flex items-start gap-3 rounded-lg border border-border p-3">
          <input
            type="checkbox"
            checked={values.emailEnabled}
            onChange={(event) =>
              setValues((previous) => ({ ...previous, emailEnabled: event.target.checked }))
            }
            className="mt-1 size-4 rounded border-input"
          />
          <span>
            <span className="block text-sm font-medium">Email me at all</span>
            <span className="block text-xs text-muted-foreground">
              Turn this off to silence everything below in one go.
            </span>
          </span>
        </label>

        <div className="mt-3 space-y-2.5">
          {NOTIFICATION_ROWS.map((row) => (
            <label
              key={row.key}
              className="flex items-start gap-3"
              // Individual toggles are meaningless while email is off entirely.
              aria-disabled={!values.emailEnabled}
            >
              <input
                type="checkbox"
                checked={values[row.key]}
                disabled={!values.emailEnabled}
                onChange={(event) =>
                  setValues((previous) => ({ ...previous, [row.key]: event.target.checked }))
                }
                className="mt-1 size-4 rounded border-input disabled:opacity-40"
              />
              <span className={values.emailEnabled ? '' : 'opacity-50'}>
                <span className="block text-sm font-medium">{row.label}</span>
                <span className="block text-xs text-muted-foreground">{row.hint}</span>
              </span>
            </label>
          ))}
        </div>

        <Button onClick={save} loading={saving} disabled={!dirty} className="mt-5">
          <Save aria-hidden="true" />
          Save preferences
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------

export interface SessionRow {
  id: string;
  browser: string | null;
  os: string | null;
  device: string | null;
  ipAddress: string | null;
  lastActiveAt: string;
  isCurrent: boolean;
}

/** Active devices, with a way to end any of them. */
export function SessionPanel({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function revoke(sessionId: string) {
    setBusy(sessionId);
    try {
      await api.delete('/api/auth/sessions', { sessionId });
      toast.success('That device has been signed out.');
      router.refresh();
    } catch {
      toast.error('We could not sign that device out.');
    } finally {
      setBusy(null);
    }
  }

  async function revokeAll() {
    if (!window.confirm('Sign out on all other devices?')) return;

    setBusy('all');
    try {
      await api.delete('/api/auth/sessions');
      toast.success('Signed out everywhere else.');
      router.refresh();
    } catch {
      toast.error('We could not sign the other devices out.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold tracking-tight">Signed-in devices</h2>
          {sessions.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={revokeAll}
              loading={busy === 'all'}
            >
              <LogOut aria-hidden="true" />
              Sign out others
            </Button>
          )}
        </div>

        <ul className="mt-4 divide-y divide-border">
          {sessions.map((session) => {
            const Icon = session.device === 'mobile' ? Smartphone : Laptop;

            return (
              <li key={session.id} className="flex items-center gap-3 py-3">
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">
                      {[session.browser, session.os].filter(Boolean).join(' on ') ||
                        'Unknown device'}
                    </span>
                    {session.isCurrent && (
                      <Badge variant="success" size="sm">
                        This device
                      </Badge>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {session.ipAddress ?? 'IP unknown'} · last active{' '}
                    {formatDate(session.lastActiveAt, 'short')}
                  </p>
                </div>

                {!session.isCurrent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revoke(session.id)}
                    loading={busy === session.id}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    Sign out
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
