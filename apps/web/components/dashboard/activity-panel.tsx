import type { ActivityRecord, ScorePoint } from '@repo/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/table';

import { barFraction, scoreLine } from '../../lib/activity-charts';
import { formatUsd } from '../../lib/money';

const chartBox = { left: 8, right: 312, top: 16, bottom: 104 };

export function ActivityPanel({ activity }: { activity: ActivityRecord }) {
  const paidMinor = activity.months.reduce(
    (sum, month) => sum + month.paidMinor,
    0,
  );
  const missedMinor = activity.months.reduce(
    (sum, month) => sum + month.missedMinor,
    0,
  );

  return (
    <>
      <section className="grid grid-cols-1 gap-4 px-4 lg:px-6 @4xl/main:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Score</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {activity.points}
            </CardTitle>
            <CardDescription>
              Points after each paid round, miss, finished circle, or pot
              default.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScoreChart series={activity.score} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Paid and missed</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {formatUsd(paidMinor)}
            </CardTitle>
            <CardDescription>
              {formatUsd(missedMinor)} missed across recorded contributions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MonthBars months={activity.months} />
          </CardContent>
        </Card>
      </section>
      <section className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
            <CardDescription>
              Each row is one score change. The amount is the contribution for
              that round.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activity.entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No contribution has changed this score yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Circle</TableHead>
                    <TableHead>Round</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activity.entries.map((entry) => (
                    <TableRow
                      key={`${entry.circleId}:${entry.status}:${entry.roundNumber ?? 0}:${entry.occurredOn}`}
                    >
                      <TableCell>{formatUtcDate(entry.occurredOn)}</TableCell>
                      <TableCell>{entry.circleName}</TableCell>
                      <TableCell>
                        {entry.roundNumber === null ? '—' : entry.roundNumber}
                      </TableCell>
                      <TableCell>
                        {entry.amountMinor === null
                          ? '—'
                          : formatUsd(entry.amountMinor)}
                      </TableCell>
                      <TableCell>{resultLabel(entry.status)}</TableCell>
                      <TableCell
                        className={`text-right font-medium tabular-nums ${entry.points < 0 ? 'text-destructive' : ''}`}
                      >
                        {formatPoints(entry.points)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}

function ScoreChart({ series }: { series: ScorePoint[] }) {
  if (series.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No contribution has changed this score yet.
      </p>
    );
  }

  const line = scoreLine(series, chartBox);
  const start = series[0];
  const end = series.at(-1);

  return (
    <svg
      viewBox="0 0 320 132"
      role="img"
      aria-label={`Score from ${start?.points ?? 0} on ${start?.occurredOn ?? ''} to ${end?.points ?? 0} on ${end?.occurredOn ?? ''}.`}
      className="h-40 w-full"
    >
      {line.zeroY !== null ? (
        <line
          x1={chartBox.left}
          x2={chartBox.right}
          y1={line.zeroY}
          y2={line.zeroY}
          className="stroke-border"
          strokeDasharray="3 3"
        />
      ) : null}
      <polyline
        points={line.points.map((point) => `${point.x},${point.y}`).join(' ')}
        fill="none"
        className="stroke-primary"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {line.points.map((point, index) => (
        <circle
          key={series[index]?.occurredOn ?? index}
          cx={point.x}
          cy={point.y}
          r="3"
          className="fill-primary"
        />
      ))}
      <text
        x={chartBox.left}
        y="126"
        className="fill-muted-foreground text-[11px]"
      >
        {formatUtcDate(start?.occurredOn ?? '')}
      </text>
      {series.length > 1 ? (
        <text
          x={chartBox.right}
          y="126"
          textAnchor="end"
          className="fill-muted-foreground text-[11px]"
        >
          {formatUtcDate(end?.occurredOn ?? '')}
        </text>
      ) : null}
    </svg>
  );
}

function MonthBars({
  months,
}: {
  months: ActivityRecord['months'];
}) {
  if (months.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No paid or missed contribution yet.
      </p>
    );
  }

  const max = Math.max(
    ...months.flatMap((month) => [month.paidMinor, month.missedMinor]),
  );
  const plot = { left: 8, right: 312, top: 8, bottom: 96 };
  const group = (plot.right - plot.left) / months.length;
  const barWidth = Math.min(16, group / 2 - 4);

  return (
    <div className="grid gap-3">
      <svg
        viewBox="0 0 320 128"
        role="img"
        aria-label={`Paid ${formatUsd(months.reduce((sum, month) => sum + month.paidMinor, 0))} and missed ${formatUsd(months.reduce((sum, month) => sum + month.missedMinor, 0))}.`}
        className="h-40 w-full"
      >
        {months.map((month, index) => {
          const center = plot.left + group * index + group / 2;
          const paidHeight =
            barFraction(month.paidMinor, max) * (plot.bottom - plot.top);
          const missedHeight =
            barFraction(month.missedMinor, max) * (plot.bottom - plot.top);

          return (
            <g key={month.month}>
              <rect
                x={center - barWidth - 2}
                y={plot.bottom - paidHeight}
                width={barWidth}
                height={paidHeight}
                rx="2"
                className="fill-primary"
              />
              <rect
                x={center + 2}
                y={plot.bottom - missedHeight}
                width={barWidth}
                height={missedHeight}
                rx="2"
                className="fill-destructive"
              />
              <text
                x={center}
                y="116"
                textAnchor="middle"
                className="fill-muted-foreground text-[11px]"
              >
                {monthLabel(month.month)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="flex gap-4 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-primary" />
          Paid
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-destructive" />
          Missed
        </span>
      </p>
    </div>
  );
}

function resultLabel(status: ActivityRecord['entries'][number]['status']): string {
  if (status === 'paid') {
    return 'Paid';
  }

  if (status === 'failed') {
    return 'Failed';
  }

  if (status === 'refunded') {
    return 'Refunded';
  }

  if (status === 'completed') {
    return 'Circle finished';
  }

  return 'Pot default';
}

function formatPoints(points: number): string {
  return points > 0 ? `+${points}` : String(points);
}

function formatUtcDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-');

  if (!year || !monthNumber) {
    return month;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(Number(year), Number(monthNumber) - 1, 1)));
}
