import type { PaperAccount } from '@repo/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card';

import { formatUsd } from '../../lib/money';

export function PaperHoldings({ account }: { account: PaperAccount }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Paper cash</CardTitle>
        <CardDescription>
          Simulated balance. A succeeded payout adds what is left after the
          contributions you still owe and one extra month.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
          <p className="text-3xl font-semibold tabular-nums">
            {formatUsd(account.cashMinor)}
          </p>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <Fact
              label="Payouts received"
              value={formatUsd(account.payoutsReceivedMinor)}
            />
            <Fact
              label="Still owed"
              value={formatUsd(account.obligationsMinor)}
            />
            <Fact
              label="Extra month"
              value={formatUsd(account.bufferMinor)}
            />
          </dl>
          {account.freezeReason === 'missed_contribution' ? (
            <p className="text-sm text-destructive">
              New purchases are paused until your missed contribution is paid.
              Selling still returns paper cash.
            </p>
          ) : null}
          {account.freezeReason === 'reserve_short' ? (
            <p className="text-sm text-destructive">
              New purchases are paused because your circles now need a larger
              reserve. Selling still returns paper cash.
            </p>
          ) : null}
          {account.freezeReason === 'payout_reversed' ? (
            <p className="text-sm text-destructive">
              New purchases are paused because a simulated PayPal payout was
              reversed. Selling still returns paper cash.
            </p>
          ) : null}
          {account.quotesConfigured ? null : (
            <p className="text-sm text-muted-foreground">
              Stock prices are not configured. Add Alpaca market-data keys to
              the API environment as ALPACA_API_KEY_ID and
              ALPACA_API_SECRET_KEY.
            </p>
          )}
      </CardContent>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

