import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PaypalAccount } from '@/components/dashboard/paypal-account';
import { PaypalConnectLink } from '@/components/dashboard/paypal-connect-link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card';
import { redirect } from 'next/navigation';

import { CreditSummary } from '@/components/dashboard/credit-summary';

import { getCredit, getCurrentUser, getPaypalLink } from '../../lib/api';

export const dynamic = 'force-dynamic';

const notices: Record<string, string> = {
  linked: 'PayPal account linked.',
  denied: 'PayPal did not share this account.',
  state: 'That link expired. Start it again from this page.',
  exchange:
    'PayPal signed you in, but did not confirm the account. Nothing was linked.',
  taken: 'That PayPal account is already linked to another member.',
  unavailable: 'PayPal is not configured on the server.',
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ paypal?: string | string[] }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const params = await searchParams;
  const noticeKey = typeof params.paypal === 'string' ? params.paypal : '';
  const notice = notices[noticeKey];
  const paypal = await getPaypalLink();
  const credit = await getCredit();
  const account = paypal.account;

  return (
    <DashboardShell title="Settings" user={user}>
      <div className="grid max-w-2xl gap-4 px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>
              You sign in with your email through Supabase. PayPal is only the
              account that will send and receive circle money.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium">{user.displayName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Username</dt>
                <dd className="font-medium">{user.username}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        {credit ? (
          <Card>
            <CardHeader>
              <CardTitle>Credit</CardTitle>
              <CardDescription>
                Confirmed on-time rounds add 10. A missed round subtracts 15 and
                sets that circle&apos;s streak back to zero. Finishing a circle
                with every round paid adds 20.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreditSummary credit={credit} />
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>PayPal</CardTitle>
            <CardDescription>
              Link the PayPal account Ronda should use for contributions and
              payouts. This does not replace your Supabase login.
              {paypal.environment
                ? ` This connection uses the ${paypal.environment} environment.`
                : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {notice ? <p className="text-sm font-medium">{notice}</p> : null}
            {account ? (
              <PaypalAccount account={account} />
            ) : paypal.configured ? (
              <div className="grid gap-3">
                <PaypalConnectLink />
                <div className="grid gap-2 text-sm text-muted-foreground">
                  <p>
                    PayPal’s page says this action is not allowed in your
                    country, and that the client id or return URL is not valid.
                    That appears when Log in with PayPal is off for this sandbox
                    app, or the return URL saved on the app is different.
                  </p>
                  <ol className="list-decimal space-y-1 pl-5">
                    <li>Open Apps & Credentials and stay on Sandbox.</li>
                    <li>
                      Open the app whose client id is in the API env file.
                    </li>
                    <li>
                      Under Other features, turn on Log in with PayPal and open
                      Advanced Settings.
                    </li>
                    <li>
                      Set Return URL to {paypal.returnUrl}. PayPal rejects the
                      hostname localhost in that field.
                    </li>
                    <li>
                      For sandbox testing, set the privacy policy URL and the
                      user agreement URL to https://example.com.
                    </li>
                    <li>
                      Include email, account verification status, and PayPal
                      account ID.
                    </li>
                    <li>Save. Sandbox does not need app review.</li>
                  </ol>
                  <p>
                    Sign in on that page with a sandbox personal account from
                    the Developer Dashboard.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                The server needs PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET
                before an account can be linked. The return URL is{' '}
                {paypal.returnUrl}.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
