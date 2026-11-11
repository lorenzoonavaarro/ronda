import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { CreditSummary } from '@/components/dashboard/credit-summary';
import { PaypalAccount } from '@/components/dashboard/paypal-account';
import { PaypalConnectLink } from '@/components/dashboard/paypal-connect-link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card';

import { getCredit, getPaypalLink, requireUser } from '../../lib/api';

export const dynamic = 'force-dynamic';

const notices: Record<string, { tone: 'ok' | 'problem'; text: string }> = {
  linked: { tone: 'ok', text: 'PayPal account linked.' },
  denied: { tone: 'problem', text: 'PayPal did not share this account.' },
  state: {
    tone: 'problem',
    text: 'That link expired. Start it again from this page.',
  },
  exchange: {
    tone: 'problem',
    text: 'PayPal signed you in, but did not confirm the account. Nothing was linked.',
  },
  taken: {
    tone: 'problem',
    text: 'That PayPal account is already linked to another member.',
  },
  unavailable: {
    tone: 'problem',
    text: 'PayPal is not configured on the server.',
  },
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ paypal?: string | string[] }>;
}) {
  await requireUser();
  const params = await searchParams;
  const noticeKey = typeof params.paypal === 'string' ? params.paypal : '';
  const notice = notices[noticeKey];
  const paypal = await getPaypalLink();
  const credit = await getCredit();
  const account = paypal.account;

  return (
    <DashboardShell title="Credit & PayPal">
      <div className="grid items-start gap-4 px-4 lg:px-6 @3xl/main:grid-cols-2">
        <Card className="bg-linear-to-t from-primary/5 to-card shadow-xs">
          <CardHeader>
            <CardDescription>Credit score</CardDescription>
            <CardTitle>One score across your circles</CardTitle>
          </CardHeader>
          <CardContent>
            {credit ? (
              <CreditSummary credit={credit} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Your score appears after the first recorded round.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>PayPal</CardDescription>
            <CardTitle>
              {account ? 'Linked for contributions' : 'Link an account'}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {notice ? <Notice tone={notice.tone} text={notice.text} /> : null}
            {account ? (
              <PaypalAccount account={account} />
            ) : paypal.configured ? (
              <div className="grid gap-3">
                <p className="text-sm text-muted-foreground">
                  Contributions and payouts use this PayPal account. Signing in
                  stays with your Ronda account.
                </p>
                <PaypalConnectLink />
              </div>
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

function Notice({ tone, text }: { tone: 'ok' | 'problem'; text: string }) {
  return (
    <p
      className={
        tone === 'ok'
          ? 'rounded-lg bg-muted px-3 py-2 text-sm font-medium'
          : 'rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive'
      }
    >
      {text}
    </p>
  );
}
