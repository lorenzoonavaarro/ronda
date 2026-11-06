import Link from 'next/link';

import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { Overview } from '@/components/dashboard/overview';
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
  const user = await getCurrentUser();

  if (!user) {
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
            <Link className={buttonVariants()} href="/login">
              Sign in
            </Link>
            <Link
              className={buttonVariants({ variant: 'outline' })}
              href="/register"
            >
              Create an account
            </Link>
          </CardContent>
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
