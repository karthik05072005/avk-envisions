import type { Metadata } from 'next';

import { RegisterForm } from '@/features/auth/register-form';
import { redirectIfAuthenticated } from '@/server/auth/guards';

export const metadata: Metadata = {
  title: 'Create your account',
  description:
    'Create a free AVK Envisions account to access mock tests, practice questions and performance analytics.',
};

export default async function RegisterPage() {
  await redirectIfAuthenticated();

  return <RegisterForm />;
}
