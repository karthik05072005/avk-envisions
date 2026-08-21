import type { Metadata } from 'next';
import { KeyRound, Settings } from 'lucide-react';

import { EmptyState } from '@/components/ui/states';
import { SettingsForm } from '@/features/admin/settings-form';
import { serverEnv } from '@/lib/env';
import { enforceAdminArea } from '@/server/auth/guards';
import { db } from '@/server/db';

export const metadata: Metadata = {
  title: 'Platform settings',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  await enforceAdminArea('/admin/settings');

  const settings = await db.siteSetting.findMany({
    orderBy: [{ group: 'asc' }, { key: 'asc' }],
    select: { key: true, value: true, valueType: true, group: true, label: true },
  });

  const env = serverEnv();

  /** Integration status, read from the environment rather than the database. */
  const integrations = [
    {
      name: 'Payments (Razorpay)',
      enabled: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
      vars: 'RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET',
    },
    {
      name: 'Email delivery',
      enabled: env.EMAIL_PROVIDER !== 'console',
      vars: 'EMAIL_PROVIDER, EMAIL_API_KEY',
    },
    {
      name: 'AI Coach',
      enabled: env.AI_PROVIDER !== 'disabled' && Boolean(env.AI_API_KEY),
      vars: 'AI_PROVIDER, AI_API_KEY',
    },
    {
      name: 'Redis rate limiting',
      enabled: Boolean(env.REDIS_URL),
      vars: 'REDIS_URL',
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Platform settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Values stored in the database. Secrets and integrations live in the environment.
        </p>
      </header>

      {/* Integrations ---------------------------------------------------- */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-semibold tracking-tight">
          <KeyRound className="size-4 text-muted-foreground" aria-hidden="true" />
          Integrations
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configured through environment variables, not here — a secret in the database would end
          up in backups and audit logs.
        </p>

        <ul className="mt-4 space-y-2">
          {integrations.map((integration) => (
            <li
              key={integration.name}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{integration.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{integration.vars}</p>
              </div>
              <span
                className={
                  integration.enabled
                    ? 'shrink-0 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success'
                    : 'shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground'
                }
              >
                {integration.enabled ? 'Configured' : 'Not configured'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {settings.length === 0 ? (
        <EmptyState
          icon={Settings}
          title="No settings defined"
          description="Settings are created by the seed. Run `npm run db:seed` to populate them."
        />
      ) : (
        <SettingsForm settings={settings} />
      )}
    </div>
  );
}
