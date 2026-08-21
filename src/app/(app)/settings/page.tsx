import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  NotificationPanel,
  PasswordPanel,
  SessionPanel,
} from '@/features/student/settings-panels';
import { enforceStudent } from '@/server/auth/guards';
import { currentSessionId, listActiveSessions } from '@/server/auth/session';
import { db } from '@/server/db';

export const metadata: Metadata = {
  title: 'Settings',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await enforceStudent('/settings');

  const [preferences, sessions, thisSessionId] = await Promise.all([
    db.notificationPreference.findUnique({
      where: { userId: user.id },
      select: {
        emailEnabled: true,
        newTestAlerts: true,
        testReminders: true,
        resultAlerts: true,
        studyReminders: true,
        achievementAlerts: true,
        subscriptionAlerts: true,
        marketingEmails: true,
      },
    }),
    listActiveSessions(user.id),
    currentSessionId(),
  ]);

  // Column defaults, used when the preference row does not exist yet.
  const defaults = {
    emailEnabled: true,
    newTestAlerts: true,
    testReminders: true,
    resultAlerts: true,
    studyReminders: true,
    achievementAlerts: true,
    subscriptionAlerts: true,
    marketingEmails: false,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Security, email preferences and the devices you are signed in on.
        </p>
      </header>

      <PasswordPanel />

      <NotificationPanel initial={preferences ?? defaults} />

      <SessionPanel
        sessions={sessions.map((session) => ({
          id: session.id,
          browser: session.browser,
          os: session.os,
          device: session.device,
          ipAddress: session.ipAddress,
          lastActiveAt: session.lastActiveAt.toISOString(),
          isCurrent: session.id === thisSessionId,
        }))}
      />

      {/* Data and account -------------------------------------------------- */}
      <Card>
        <CardContent className="p-5 sm:p-6">
          <h2 className="font-semibold tracking-tight">Your data</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Your attempts, bookmarks and analytics belong to you. To export or delete your account
            and everything in it, open a support ticket and we will action it — we do not put an
            irreversible delete button behind a single click.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/support">Request an export or deletion</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/privacy">Privacy policy</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
