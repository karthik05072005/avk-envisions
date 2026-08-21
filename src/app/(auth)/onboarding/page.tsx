import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { OnboardingForm } from '@/features/auth/onboarding-form';
import { enforceStudent } from '@/server/auth/guards';
import { db } from '@/server/db';

export const metadata: Metadata = {
  title: 'Set up your account',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const user = await enforceStudent('/onboarding');

  const [profile, exams] = await Promise.all([
    db.studentProfile.findUnique({
      where: { userId: user.id },
      select: { onboardedAt: true },
    }),
    db.exam.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }],
      take: 6,
      select: { id: true, name: true, shortName: true, colorHex: true },
    }),
  ]);

  // Already done — sending someone back through onboarding is a dead end that
  // looks like the app has forgotten them.
  if (profile?.onboardedAt) redirect('/dashboard');

  // Nothing to choose from, so nothing to ask.
  if (exams.length === 0) redirect('/dashboard');

  return <OnboardingForm exams={exams} name={user.name} />;
}
