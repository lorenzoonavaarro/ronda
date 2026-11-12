import type {
  CircleRoundPayment,
  CircleRounds as CircleRoundHistory,
} from '@repo/api';
import { Badge } from '@repo/ui/components/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card';

export function CircleRounds({ rounds }: { rounds: CircleRoundHistory }) {
  const history = [...rounds.rounds].reverse();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment history</CardTitle>
        <CardDescription>
          Every member for each round that has started. The member whose turn
          matches the round receives that pot.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No round has been charged yet.
          </p>
        ) : (
          history.map((round) => (
            <section key={round.roundNumber} className="grid gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-medium">Round {round.roundNumber}</h3>
                <p className="text-sm text-muted-foreground">
                  {formatUtcDate(round.chargeOn)}
                </p>
              </div>
              <ul className="grid gap-2">
                {round.payments.map((payment) => (
                  <li
                    key={payment.username}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{payment.displayName}</p>
                      <p className="truncate text-muted-foreground">
                        {payment.username}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {payment.payoutPosition === round.roundNumber ? (
                        <Badge variant="secondary">Receives the pot</Badge>
                      ) : null}
                      <span className={statusClass(payment.status)}>
                        {statusLabel(payment.status)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function statusLabel(status: CircleRoundPayment['status']): string {
  if (status === 'paid') {
    return 'Paid';
  }

  if (status === 'failed') {
    return 'Failed';
  }

  if (status === 'refunded') {
    return 'Refunded';
  }

  if (status === 'due') {
    return 'Due';
  }

  return 'Not due';
}

function statusClass(status: CircleRoundPayment['status']): string {
  if (status === 'failed') {
    return 'text-destructive';
  }

  return 'text-muted-foreground';
}

function formatUtcDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}
