'use client';

import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { useState } from 'react';

import { formatUsd } from '@/lib/money';
import {
  interestMinor,
  projectCircleYield,
  todayUtc,
  type YieldMemberInput,
  type YieldRoundView,
} from '@/lib/yield-simulator';

export function YieldSimulator({
  chargesBeginOn,
  monthlyAmountMinor,
  membersRequired,
  members,
}: {
  chargesBeginOn: string | null;
  monthlyAmountMinor: number;
  membersRequired: number;
  members: YieldMemberInput[];
}) {
  const [asOf, setAsOf] = useState(todayUtc);

  if (!chargesBeginOn) {
    return (
      <p className="text-sm text-muted-foreground">
        The simulator starts once the first charge date is set.
      </p>
    );
  }

  const projection = projectCircleYield({
    chargesBeginOn,
    monthlyAmountMinor,
    membersRequired,
    asOf,
    members,
  });

  return (
    <div className="grid gap-3 border-t pt-4">
      <div className="grid gap-1">
        <p className="text-sm font-medium">Simulator</p>
        <p className="text-sm text-muted-foreground">
          Pick a UTC date. The rate is 4% a year. Each pot earns that rate only
          while it is held, which is 7 days, and the result stays beside the
          pot. Rounds are shown as paid on their charge dates. Nothing here is
          posted.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="yield-as-of">As of</Label>
        <Input
          id="yield-as-of"
          type="date"
          value={asOf}
          onChange={(event) => {
            const next = event.currentTarget.value;

            if (/^\d{4}-\d{2}-\d{2}$/.test(next)) {
              setAsOf(next);
            }
          }}
        />
      </div>
      {projection ? (
        <>
          <dl className="grid gap-3 text-sm">
            <Fact
              label="Still earning"
              value={formatUsd(projection.earningMinor)}
            />
            <Fact
              label="Available"
              value={formatUsd(projection.availableMinor)}
            />
          </dl>
          {projection.rounds[0] ? (
            <p className="text-sm text-muted-foreground">
              A full year on {formatUsd(projection.rounds[0].potMinor)} is{' '}
              {formatUsd(interestMinor(projection.rounds[0].potMinor, 365))}.
              The 7-day hold is the part of that year counted here.
            </p>
          ) : null}
          <div className="grid gap-3">
            {projection.rounds.map((round) => (
              <RoundRow key={round.number} round={round} />
            ))}
          </div>
          <SplitView
            splitOn={projection.splitOn}
            splitReady={projection.splitReady}
            shares={projection.shares}
          />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Enter a real calendar date.
        </p>
      )}
    </div>
  );
}

function RoundRow({ round }: { round: YieldRoundView }) {
  return (
    <div className="grid gap-1 text-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">Round {round.number}</p>
        <p>{stateLabel(round.state)}</p>
      </div>
      <p className="text-muted-foreground">
        {formatUtcDate(round.chargeOn)} to {formatUtcDate(round.payoutOn)}
      </p>
      <p className="text-muted-foreground">
        {formatUsd(round.potMinor)} · {round.days} of 7 days ·{' '}
        {formatUsd(round.interestMinor)}
      </p>
    </div>
  );
}

function SplitView({
  splitOn,
  splitReady,
  shares,
}: {
  splitOn: string | null;
  splitReady: boolean;
  shares: {
    displayName: string;
    username: string;
    payoutPosition: number | null;
    amountMinor: number;
  }[];
}) {
  if (!splitOn) {
    return null;
  }

  if (!splitReady) {
    return (
      <p className="text-sm text-muted-foreground">
        The split is on {formatUtcDate(splitOn)} UTC, after the last pot is
        sent.
      </p>
    );
  }

  if (shares.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No member is eligible for the split.
      </p>
    );
  }

  return (
    <div className="grid gap-2 text-sm">
      <p className="font-medium">Split on {formatUtcDate(splitOn)}</p>
      {shares.map((share) => (
        <div
          key={share.username}
          className="flex items-center justify-between gap-3"
        >
          <p>
            {share.displayName}
            <span className="text-muted-foreground">
              {' '}
              ·{' '}
              {share.payoutPosition === null
                ? 'Turn not set'
                : `Turn ${share.payoutPosition}`}
            </span>
          </p>
          <p className="font-medium">{formatUsd(share.amountMinor)}</p>
        </div>
      ))}
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

function stateLabel(state: YieldRoundView['state']): string {
  if (state === 'earning') {
    return 'Earning';
  }

  if (state === 'posted') {
    return 'Posted';
  }

  return 'Not started';
}

function formatUtcDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}
