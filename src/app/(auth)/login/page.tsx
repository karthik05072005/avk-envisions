import type { Metadata } from 'next';

import { LoginForm } from '@/features/auth/login-form';
import { redirectIfAuthenticated } from '@/server/auth/guards';
import { safeRedirectPath } from '@/validations/auth';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your AVK Envisions account to continue your exam preparation.',
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Normalised before use so a crafted `?next=//evil.com` cannot turn the login
  // page into an open redirect.
  const safeNext = next ? safeRedirectPath(next, '/dashboard') : undefined;

  await redirectIfAuthenticated(safeNext);

  return <LoginForm next={safeNext} />;
}
