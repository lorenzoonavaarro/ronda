import { Show, SignInButton, SignUpButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { Suspense } from 'react';

import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { Overview } from '@/components/dashboard/overview';
import { SignedInOverviewRefresh } from '@/components/signed-in-overview-refresh';
import { buttonVariants } from '@repo/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card';

import { getCircles, getCurrentUser } from '../lib/api';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await auth();
  const user = session.isAuthenticated ? await getCurrentUser() : null;

  if (!session.isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <p className="text-sm font-medium">Ronda</p>
            <CardTitle className="text-2xl">Save with your group</CardTitle>
            <CardDescription>
              Sign in to create a circle, track contributions, and take your
              turn with the pot.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <SignedInOverviewRefresh />
            <Suspense>
              <Show when="signed-out">
                <SignInButton mode="redirect">
                  <button className={buttonVariants()} type="button">
                    Sign in
                  </button>
                </SignInButton>
                <SignUpButton mode="redirect">
                  <button
                    className={buttonVariants({ variant: 'outline' })}
                    type="button"
                  >
                    Create an account
                  </button>
                </SignUpButton>
              </Show>
            </Suspense>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-2xl">Could not open your overview</CardTitle>
            <CardDescription>
              You are signed in, but Ronda could not load your account. Refresh
              the page.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const circles = await getCircles();

  return (
    <DashboardShell title="Overview" user={user}>
      <Overview circles={circles} />
    </DashboardShell>
  );
}
