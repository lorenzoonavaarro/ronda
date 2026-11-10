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
import { CreditSummary } from '@/components/dashboard/credit-summary';
import { ProfileForm } from '@/components/dashboard/profile-form';

import { getCredit, getPaypalLink, requireUser } from '../../lib/api';

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
  const user = await requireUser();
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
              Update the name and username shown to your circle members.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm user={user} />
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
              Link the PayPal account used for contributions and payouts.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {notice ? <p className="text-sm font-medium">{notice}</p> : null}
            {account ? (
              <PaypalAccount account={account} />
            ) : paypal.configured ? (
              <PaypalConnectLink />
            ) : (
              <p className="text-sm text-muted-foreground">
                PayPal linking is not configured yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
