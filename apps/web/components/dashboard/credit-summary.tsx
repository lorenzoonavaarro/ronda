import type { CreditEvent, CreditRecord } from '@repo/api';

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
    <div className="grid gap-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Score</dt>
          <dd className="text-2xl font-semibold tabular-nums">
            {credit.points}
          </dd>
        </div>
        {membership ? (
          <div>
            <dt className="text-muted-foreground">Streak in this circle</dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {membership.streak}
            </dd>
          </div>
        ) : null}
      </dl>
      {!circleId && credit.memberships.length > 0 ? (
        <div className="grid gap-2 text-sm">
          {credit.memberships.map((item) => (
            <div
              key={item.circleId}
              className="flex items-center justify-between gap-3"
            >
              <p className="font-medium">{item.circleName}</p>
              <p className="text-muted-foreground">Streak {item.streak}</p>
            </div>
          ))}
        </div>
      ) : null}
      <div className="grid gap-2 text-sm">
        {events.length === 0 ? (
          <p className="text-muted-foreground">
            No contribution has changed this score yet.
          </p>
        ) : (
          events.map((event) => (
            <div
              key={`${event.circleId}:${event.eventType}:${event.roundNumber ?? 0}`}
              className="flex items-start justify-between gap-3"
            >
              <div>
                <p className="font-medium">{eventLabel(event)}</p>
                <p className="text-muted-foreground">
                  {circleId ? '' : `${event.circleName} · `}
                  {formatUtcDate(event.occurredOn)}
                </p>
              </div>
              <p className="font-medium tabular-nums">
                {formatPoints(event.points)}
              </p>
            </div>
          ))
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

function formatUtcDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}
