'use client';

import * as React from 'react';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Mail, MailCheck } from 'lucide-react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/label';
import { InlineError } from '@/components/ui/states';
import { ApiClientError, api } from '@/lib/api-client';
import { emailSchema } from '@/validations/common';

const formSchema = z.object({ email: emailSchema });
type FormValues = z.infer<typeof formSchema>;

export function ForgotPasswordForm() {
  const [submittedTo, setSubmittedTo] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { email: '' } });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.post('/api/auth/forgot-password', values);
      // The API is non-enumerating, so the UI must be too: show the same
      // confirmation whether or not that address has an account.
      setSubmittedTo(values.email);
    } catch (error) {
      setError('root', {
        type: 'server',
        message:
          error instanceof ApiClientError
            ? error.message
            : 'We could not process that request. Please try again.',
      });
    }
  });

  if (submittedTo) {
    return (
      <div className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
          <MailCheck className="size-6" aria-hidden="true" />
        </div>

        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Check your inbox</h1>
        <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
          If an account exists for <span className="font-medium text-foreground">{submittedTo}</span>
          , we have sent a link to reset your password. It expires in one hour.
        </p>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Nothing arrived? Check your spam folder, or{' '}
          <button
            type="button"
            onClick={() => setSubmittedTo(null)}
            className="font-medium text-primary underline underline-offset-4"
          >
            try a different address
          </button>
          .
        </p>

        <Button asChild variant="ghost" className="mt-6">
          <Link href="/login">
            <ArrowLeft aria-hidden="true" />
            Back to sign in
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        Enter the email address on your account and we will send you a reset link.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        {errors.root && <InlineError message={errors.root.message ?? 'Request failed.'} />}

        <FormField label="Email address" htmlFor="email" error={errors.email?.message} required>
          <Input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            startIcon={<Mail />}
            invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </FormField>

        <Button type="submit" fullWidth size="lg" loading={isSubmitting} loadingText="Sending…">
          Send reset link
        </Button>
      </form>

      <Button asChild variant="ghost" fullWidth className="mt-4">
        <Link href="/login">
          <ArrowLeft aria-hidden="true" />
          Back to sign in
        </Link>
      </Button>
    </div>
  );
}
