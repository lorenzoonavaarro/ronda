'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';

import { apiBase, readApiError } from '../lib/http';
import { AuthShell } from './auth-shell';

type AuthFormProps = {
  mode: 'login' | 'register';
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isRegister = mode === 'register';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    const body = {
      username: String(form.get('username') ?? ''),
      password: String(form.get('password') ?? ''),
      ...(isRegister
        ? {
            displayName: String(form.get('displayName') ?? ''),
            email: String(form.get('email') ?? ''),
          }
        : {}),
    };

    try {
      const response = await fetch(
        `${apiBase()}/auth/${isRegister ? 'register' : 'login'}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('The server did not respond. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title={isRegister ? 'Create your account' : 'Sign in'}
      footer={
        isRegister ? (
          <>
            Already have an account?{' '}
            <Link className="font-medium text-emerald-800" href="/login">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New to Ronda?{' '}
            <Link className="font-medium text-emerald-800" href="/register">
              Create an account
            </Link>
          </>
        )
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        {isRegister ? (
          <Label className="grid gap-2">
            Name
            <Input name="displayName" autoComplete="name" required />
          </Label>
        ) : null}
        <Label className="grid gap-2">
          Username
          <Input
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            minLength={3}
            maxLength={30}
            required
          />
        </Label>
        {isRegister ? (
          <Label className="grid gap-2">
            Email
            <Input name="email" type="email" autoComplete="email" required />
          </Label>
        ) : null}
        <Label className="grid gap-2">
          Password
          <Input
            name="password"
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            minLength={8}
            required
          />
        </Label>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button className="w-full" type="submit" disabled={submitting}>
          {submitting
            ? 'Please wait'
            : isRegister
              ? 'Create account'
              : 'Sign in'}
        </Button>
      </form>
    </AuthShell>
  );
}
