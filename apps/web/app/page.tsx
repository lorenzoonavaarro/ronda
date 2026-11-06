import Link from 'next/link';

import { LogoutButton } from '@/components/logout-button';
import { buttonVariants } from '@repo/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card';

import { getCurrentUser } from '../lib/api';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <p className="text-sm font-medium">Ronda</p>
          <CardTitle className="text-2xl">
            {user ? `Hello, ${user.displayName}` : 'Save with your group'}
          </CardTitle>
          <CardDescription>
            {user
              ? `You are signed in as ${user.username}. Group savings comes next.`
              : 'Sign in to create a circle, track contributions, and take your turn with the pot.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          {user ? (
            <LogoutButton />
          ) : (
            <>
              <Link className={buttonVariants()} href="/login">
                Sign in
              </Link>
              <Link
                className={buttonVariants({ variant: 'outline' })}
                href="/register"
              >
                Create an account
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
