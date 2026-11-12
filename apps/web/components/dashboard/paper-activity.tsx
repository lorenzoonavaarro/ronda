import type { PaperAccount } from '@repo/api';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card';

import { formatUsd } from '../../lib/money';

export function PaperActivity({ account }: { account: PaperAccount }) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Recent paper trades</CardTitle>
          <CardDescription>The latest filled buys and sells.</CardDescription>
        </CardHeader>
        <CardContent>
          {account.orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No paper trades yet.</p>
          ) : (
            <ul>
              {account.orders.map((order) => (
                <li
                  key={order.id}
                  className="flex items-baseline justify-between gap-3 border-b py-2.5 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {order.side === 'buy' ? 'Bought' : 'Sold'} {order.quantity}{' '}
                      {order.symbol}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatWhen(order.createdAt)}
                    </p>
                  </div>
                  <p className="shrink-0 tabular-nums">
                    {formatUsd(order.notionalMinor)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Cash activity</CardTitle>
          <CardDescription>
            Simulated payouts, buys, and sells in paper cash.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {account.ledger.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cash activity yet.</p>
          ) : (
            <ul>
              {account.ledger.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-baseline justify-between gap-3 border-b py-2.5 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{entry.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatWhen(entry.createdAt)}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 tabular-nums ${
                      entry.amountMinor < 0
                        ? 'text-destructive'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {entry.amountMinor < 0 ? '-' : '+'}
                    {formatUsd(Math.abs(entry.amountMinor))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatWhen(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
