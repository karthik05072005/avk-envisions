import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { GuestStartForm } from '@/features/auth/guest-start-form';
import { currentUser } from '@/server/auth/guards';
import { db } from '@/server/db';

export const metadata: Metadata = {
  title: 'Start your free test',
  robots: { index: false, follow: false },
};

/** The test's free-ness is read live, so revoking it takes effect immediately. */
export const dynamic = 'force-dynamic';

/**
 * `/start/[id]` — the guest entry point to a free test.
 *
 * Reached when a signed-out visitor opens a free test. Collects a name and
 * phone number, which is enough to create a student record and let them begin.
 */
export default async function GuestStartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Already signed in? There is nothing to collect — go straight to the test.
  if (await currentUser()) redirect(`/test/${id}`);

  const test = await db.test.findFirst({
    where: { id, deletedAt: null, status: 'PUBLISHED', accessType: 'FREE' },
    select: { id: true, title: true, totalQuestions: true },
  });

  // Not free, unpublished or gone: this page has nothing to offer, and saying
  // so is better than collecting a phone number for a test they cannot take.
  if (!test || test.totalQuestions < 1) notFound();

  return <GuestStartForm testId={test.id} testTitle={test.title} />;
}
