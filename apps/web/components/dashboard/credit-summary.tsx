import type { CreditEvent, CreditRecord } from '@repo/api';

const rules = [
  { label: 'On time', value: '+10' },
  { label: 'Missed', value: '−15' },
  { label: 'Circle finished', value: '+20' },
];

export function CreditSummary({
  credit,
  circleId,
}: {
  credit: CreditRecord;
  circleId?: string;
}) {
  const membership = circleId
    ? credit.memberships.find((item) => item.circleId === circleId)
    : null;
  const events = circleId
    ? credit.events.filter((event) => event.circleId === circleId)
    : credit.events;

  return (
    <div className="grid gap-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Score</p>
          <p className="text-4xl font-semibold tabular-nums tracking-tight">
            {credit.points}
          </p>
        </div>
        {membership ? (
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Streak</p>
            <p className="text-3xl font-semibold tabular-nums">
              {membership.streak}
            </p>
          </div>
        ) : null}
      </div>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        {rules.map((rule) => (
          <div key={rule.label} className="rounded-lg bg-muted/60 px-3 py-2">
            <dt className="text-muted-foreground">{rule.label}</dt>
            <dd className="font-medium tabular-nums">{rule.value}</dd>
          </div>
        ))}
      </dl>
      {!circleId && credit.memberships.length > 0 ? (
        <div className="grid gap-2">
          <p className="text-sm font-medium">Streaks</p>
          <ul className="grid gap-2">
            {credit.memberships.map((item) => (
              <li
                key={item.circleId}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="truncate font-medium">{item.circleName}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {item.streak}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="grid gap-2">
        <p className="text-sm font-medium">Recent changes</p>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No contribution has changed this score yet.
          </p>
        ) : (
          <ul className="grid gap-2">
            {events.map((event) => (
              <li
                key={`${event.circleId}:${event.eventType}:${event.roundNumber ?? 0}`}
                className="flex items-start justify-between gap-3 border-t border-border/70 pt-2 text-sm first:border-t-0 first:pt-0"
              >
                <div className="min-w-0">
                  <p className="font-medium">{eventLabel(event)}</p>
                  <p className="truncate text-muted-foreground">
                    {circleId ? '' : `${event.circleName} · `}
                    {formatUtcDate(event.occurredOn)}
                  </p>
                </div>
                <p
                  className={`shrink-0 font-medium tabular-nums ${pointsClass(event.points)}`}
                >
                  {formatPoints(event.points)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        A loan opens when you receive the pot while later rounds are still
        unpaid. Receiving the pot does not change this score.
      </p>
    </div>
  );
}

function eventLabel(event: CreditEvent): string {
  if (event.eventType === 'contribution_paid') {
    return `Round ${event.roundNumber} paid on time`;
  }

  if (event.eventType === 'contribution_missed') {
    return `Round ${event.roundNumber} missed`;
  }

  if (event.eventType === 'circle_completed') {
    return 'Every round paid';
  }

  return 'Pot taken with rounds unpaid';
}

function formatPoints(points: number): string {
  return points > 0 ? `+${points}` : String(points);
}

function pointsClass(points: number): string {
  if (points < 0) {
    return 'text-destructive';
  }

  return 'text-foreground';
}

function formatUtcDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}
