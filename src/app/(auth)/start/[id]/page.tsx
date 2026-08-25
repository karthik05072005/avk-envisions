import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { GuestStartForm } from '@/features/auth/guest-start-form';
import { currentUser } from '@/server/auth/guards';
import { safeRedirectPath } from '@/validations/auth';
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
export default async function GuestStartPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { id } = await params;
  const { next } = await searchParams;

  // Normalised before use so a crafted `?next=//evil.com` cannot turn this
  // into an open redirect.
  const destination = safeRedirectPath(next, `/test/${id}`);

  // Already signed in? There is nothing to collect.
  if (await currentUser()) redirect(destination);

  const test = await db.test.findFirst({
    where: { id, deletedAt: null, status: 'PUBLISHED', accessType: 'FREE' },
    select: { id: true, title: true, totalQuestions: true },
  });

  // A paper with no questions can still have an analysis to read, so an empty
  // test is only a dead end when the visitor is heading for the test itself.
  const wantsAnalysis = destination.startsWith('/synopsis/');
  if (!test || (test.totalQuestions < 1 && !wantsAnalysis)) notFound();

  return (
    <GuestStartForm
      testId={test.id}
      testTitle={test.title}
      next={destination}
      purpose={wantsAnalysis ? 'ANALYSIS' : 'TEST'}
    />
  );
}
