import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck, Mail, Settings } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UserAvatar } from '@/components/ui/avatar';
import { StatCard } from '@/components/ui/stat-card';
import { ProfileForm } from '@/features/student/profile-form';
import { TERMINAL_ATTEMPT_STATUSES } from '@/lib/enums';
import { formatDate } from '@/lib/utils';
import { enforceStudent } from '@/server/auth/guards';
import { db } from '@/server/db';

export const metadata: Metadata = {
  title: 'Profile',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await enforceStudent('/profile');

  const [account, profile, exams, attempts, achievements] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { name: true, email: true, emailVerified: true, createdAt: true, avatarUrl: true },
    }),
    db.studentProfile.findUnique({
      where: { userId: user.id },
      select: {
        displayName: true,
        city: true,
        state: true,
        targetExamId: true,
        targetYear: true,
        leaderboardVisible: true,
      },
    }),
    db.exam.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    }),
    db.testAttempt.count({
      where: { userId: user.id, status: { in: [...TERMINAL_ATTEMPT_STATUSES] } },
    }),
    db.userAchievement.count({ where: { userId: user.id } }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your details and how you appear to other students.
        </p>
      </header>

      {/* Identity ------------------------------------------------------- */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
          <UserAvatar name={account.name} src={account.avatarUrl} className="size-16 shrink-0" />

          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2">
              <span className="truncate text-lg font-semibold">{account.name}</span>
              {account.emailVerified ? (
                <Badge variant="success" size="sm">
                  <BadgeCheck aria-hidden="true" />
                  Verified
                </Badge>
              ) : (
                <Badge variant="warning" size="sm">
                  Email not verified
                </Badge>
              )}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
              <Mail className="size-3.5 shrink-0" aria-hidden="true" />
              {account.email}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Member since {formatDate(account.createdAt, 'long')}
            </p>
          </div>

          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href="/settings">
              <Settings aria-hidden="true" />
              Settings
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Tests completed" value={attempts} />
        <StatCard label="Achievements unlocked" value={achievements} />
      </div>

      <ProfileForm
        exams={exams}
        initial={{
          name: account.name,
          displayName: profile?.displayName ?? '',
          city: profile?.city ?? '',
          state: profile?.state ?? '',
          targetExamId: profile?.targetExamId ?? null,
          targetYear: profile?.targetYear ?? null,
          // Defaults to visible, matching the column default.
          leaderboardVisible: profile?.leaderboardVisible ?? true,
        }}
      />
    </div>
  );
}
