import type { PaperAccount } from '@repo/api';
import { Badge } from '@repo/ui/components/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card';

import { formatUsd } from '../../lib/money';

export function PaperHoldings({ account }: { account: PaperAccount }) {
  const priced = account.positions.every(
    (position) => position.marketValueMinor !== null,
  );
  const marketValueMinor = account.positions.reduce(
    (sum, position) => sum + (position.marketValueMinor ?? 0),
    0,
  );

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Paper cash</CardTitle>
          <CardDescription>
            This balance is simulated. A circle payout still goes to your
            PayPal. After it succeeds, paper cash increases by the payout minus
            the contributions you still owe and one extra month.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-3xl font-semibold">
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
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle>Positions</CardTitle>
            {priced && account.positions.length > 0 ? (
              <Badge variant="outline">{formatUsd(marketValueMinor)}</Badge>
            ) : null}
          </div>
          <CardDescription>
            {account.positions.length === 0
              ? 'No paper positions yet.'
              : 'Value uses the latest trade when a price is available.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {account.positions.map((position) => (
            <div
              key={position.symbol}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <div>
                <p className="font-medium">{position.symbol}</p>
                <p className="text-muted-foreground">
                  {position.quantity} shares at{' '}
                  {formatUsd(position.averageCostMinor)}
                </p>
              </div>
              <div className="text-right">
                <p>
                  {position.marketValueMinor === null
                    ? 'Price unavailable'
                    : formatUsd(position.marketValueMinor)}
                </p>
                {position.gainMinor === null ? null : (
                  <p className="text-muted-foreground">
                    {formatUsd(position.gainMinor)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      {account.orders.length === 0 ? null : (
        <Card>
          <CardHeader>
            <CardTitle>Recent paper trades</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {account.orders.map((order) => (
              <div
                key={order.id}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {order.side === 'buy' ? 'Bought' : 'Sold'} {order.quantity}{' '}
                    {order.symbol}
                  </p>
                  <p className="text-muted-foreground">
                    {formatWhen(order.createdAt)}
                  </p>
                </div>
                <p>{formatUsd(order.notionalMinor)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {account.ledger.length === 0 ? null : (
        <Card>
          <CardHeader>
            <CardTitle>Cash activity</CardTitle>
            <CardDescription>
              Simulated PayPal funding, reversals, and paper-trade cash
              movements.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {account.ledger.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <div>
                  <p className="font-medium">{entry.description}</p>
                  <p className="text-muted-foreground">
                    {formatWhen(entry.createdAt)}
                  </p>
                </div>
                <p className={entry.amountMinor < 0 ? 'text-destructive' : ''}>
                  {entry.amountMinor < 0 ? '-' : '+'}
                  {formatUsd(Math.abs(entry.amountMinor))}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function formatWhen(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
