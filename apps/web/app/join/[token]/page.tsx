import Link from 'next/link';

import { AuthShell } from '@/components/auth-shell';
import { JoinCircle } from '@/components/dashboard/join-circle';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { buttonVariants } from '@repo/ui/components/button';

import { getCurrentUser } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!/^[A-Za-z0-9_-]{20,128}$/.test(token)) {
    return (
      <AuthShell
        title="Invite link"
        footer="Ask the circle creator for a new link."
      >
        This invite link is not valid.
      </AuthShell>
    );
  }

  const user = await getCurrentUser();
  const next = `/join/${token}`;

  if (!user) {
    return (
      <AuthShell
        title="Join a circle"
        footer={
          <>
            Already have an account?{' '}
            <Link
              className="font-medium text-foreground"
              href={`/login?next=${encodeURIComponent(next)}`}
            >
              Sign in
            </Link>
          </>
        }
      >
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Sign in with your Ronda username to join. PayPal is not used to sign
            in.
          </p>
          <Link
            className={buttonVariants()}
            href={`/login?next=${encodeURIComponent(next)}`}
          >
            Sign in
          </Link>
          <Link
            className={buttonVariants({ variant: 'outline' })}
            href={`/register?next=${encodeURIComponent(next)}`}
          >
            Create an account
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <DashboardShell title="Join circle" user={user}>
      <div className="px-4 lg:px-6">
        <div className="grid max-w-lg gap-4">
          <p className="text-sm text-muted-foreground">
            You are joining as {user.displayName}. The circle stays forming
            until it starts, and nothing is due yet.
          </p>
          <JoinCircle token={token} />
          <Link className="text-sm underline-offset-4 hover:underline" href="/">
            Back to overview
          </Link>
        </div>
      </div>
    </DashboardShell>
  );
}
