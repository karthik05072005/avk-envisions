'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Phone, User } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/label';
import { InlineError } from '@/components/ui/states';
import { ApiClientError, api, applyFieldErrors } from '@/lib/api-client';
import { nameSchema } from '@/validations/common';
import { guestPhoneSchema } from '@/validations/guest';

const formSchema = z.object({
  name: nameSchema,
  phone: guestPhoneSchema,
});

type FormValues = z.infer<typeof formSchema>;

interface GuestStartResponse {
  redirectTo: string;
  isNew: boolean;
}

/**
 * Collects a name and phone number so a visitor can take the free test without
 * creating an account.
 *
 * Nothing is sent to the number — it is a contact detail, not a credential, so
 * there is no OTP step and no waiting for a message.
 */
export function GuestStartForm({ testId, testTitle }: { testId: string; testTitle: string }) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', phone: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const data = await api.post<GuestStartResponse>('/api/guest/start', { ...values, testId });

      toast.success(data.isNew ? 'You are all set. Good luck!' : 'Welcome back.');

      router.replace(data.redirectTo);
      router.refresh();
    } catch (error) {
      if (applyFieldErrors(error, setError as never, ['name', 'phone'])) return;

      setError('root', {
        type: 'server',
        message:
          error instanceof ApiClientError
            ? error.message
            : 'We could not start your test. Please try again.',
      });
    }
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Start your free test</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Just two details and you can begin <span className="font-medium">{testTitle}</span>. No
        account, no password.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        {errors.root && <InlineError message={errors.root.message ?? 'Could not start the test.'} />}

        <FormField label="Your name" htmlFor="name" error={errors.name?.message} required>
          <Input
            type="text"
            autoComplete="name"
            placeholder="Full name"
            startIcon={<User />}
            invalid={Boolean(errors.name)}
            {...register('name')}
          />
        </FormField>

        <FormField label="Mobile number" htmlFor="phone" error={errors.phone?.message} required>
          <Input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="10-digit mobile number"
            startIcon={<Phone />}
            invalid={Boolean(errors.phone)}
            {...register('phone')}
          />
        </FormField>

        <p className="text-xs leading-relaxed text-muted-foreground">
          We use your number to save your result so you can come back to it. We will not send you a
          verification code.
        </p>

        <Button type="submit" fullWidth size="lg" loading={isSubmitting} loadingText="Starting…">
          Start free test
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          href={`/login?next=/test/${testId}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
