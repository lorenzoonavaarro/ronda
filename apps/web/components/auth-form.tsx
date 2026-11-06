import Link from 'next/link';

import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';

import { AuthShell } from './auth-shell';

type AuthFormProps = {
  mode: 'login' | 'register';
  nextPath?: string | null;
  error?: string | null;
};

export function AuthForm({ mode, nextPath, error }: AuthFormProps) {
  const isRegister = mode === 'register';
  const action = `/api/auth/${isRegister ? 'register' : 'login'}`;

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
      <form className="space-y-4" method="post" action={action}>
        {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
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
        <Button className="w-full" type="submit">
          {isRegister ? 'Create account' : 'Sign in'}
        </Button>
      </form>
    </AuthShell>
  );
}
