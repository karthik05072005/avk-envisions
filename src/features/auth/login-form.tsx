'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/label';
import { InlineError } from '@/components/ui/states';
import { ApiClientError, api, applyFieldErrors } from '@/lib/api-client';
import { emailSchema } from '@/validations/common';

/**
 * Client-side login schema.
 *
 * Password composition rules are deliberately absent: an existing password that
 * predates a policy change must still be accepted, and restating the policy on
 * a login form leaks it to an attacker for no benefit.
 */
const formSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
});

type FormValues = z.infer<typeof formSchema>;

interface LoginResponse {
  user: { id: string; name: string; role: string; emailVerified: boolean };
  redirectTo: string;
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const data = await api.post<LoginResponse>('/api/auth/login', { ...values, next });

      toast.success(`Welcome back, ${data.user.name.split(' ')[0] ?? data.user.name}.`);

      // `refresh()` re-runs server components so the layout picks up the new
      // session before the navigation completes.
      router.replace(data.redirectTo);
      router.refresh();
    } catch (error) {
      if (applyFieldErrors(error, setError as never, ['email', 'password'])) return;

      setError('root', {
        type: 'server',
        message:
          error instanceof ApiClientError
            ? error.message
            : 'We could not sign you in. Please try again.',
      });
    }
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Sign in to continue your preparation.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        {errors.root && <InlineError message={errors.root.message ?? 'Sign in failed.'} />}

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

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium leading-none">
              Password
              <span aria-hidden="true" className="ml-0.5 text-destructive">
                *
              </span>
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Enter your password"
            startIcon={<Lock />}
            invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : undefined}
            endIcon={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="rounded p-0.5 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            }
            {...register('password')}
          />

          {errors.password && (
            <p id="password-error" className="text-xs font-medium text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>

        <Button type="submit" fullWidth size="lg" loading={isSubmitting} loadingText="Signing in…">
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to AVK Visions?{' '}
        <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
