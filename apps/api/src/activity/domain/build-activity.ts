import type {
  ActivityEntry,
  ActivityMonth,
  ActivityRecord,
  ActivityStatus,
  ActivityTurn,
  CreditEventType,
} from '@repo/api';

import { currentRound } from '../../charges/domain/charge-calendar';

export type ActivityContribution = {
  circleId: string;
  roundNumber: number;
  amountMinor: number;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
};

export type ActivityMembership = {
  circleId: string;
  circleName: string;
  status: 'forming' | 'active' | 'completed';
  monthlyAmountMinor: number;
  membersRequired: number;
  chargesBeginOn: string | null;
  payoutPosition: number | null;
};

export type ActivityEvent = {
  circleId: string;
  circleName: string;
  roundNumber: number;
  eventType: CreditEventType;
  points: number;
  occurredOn: string;
};

const entryStatus: Record<CreditEventType, ActivityStatus> = {
  contribution_paid: 'paid',
  contribution_missed: 'failed',
  circle_completed: 'completed',
  pot_defaulted: 'defaulted',
};

export function buildActivity(
  input: {
    events: ActivityEvent[];
    contributions: ActivityContribution[];
    memberships: ActivityMembership[];
  },
  now: Date,
): ActivityRecord {
  const contributions = new Map(
    input.contributions.map((row) => [
      `${row.circleId}:${row.roundNumber}`,
      row,
    ]),
  );
  const entries = input.events
    .map((event) => toEntry(event, contributions))
    .sort(newestFirst);
  const months = monthTotals(entries);
  const onTimeCount = entries.filter((entry) => entry.status === 'paid').length;
  const missedCount = entries.filter(
    (entry) => entry.status === 'failed',
  ).length;
  const decided = onTimeCount + missedCount;
  const turns = input.memberships
    .map((membership) => toTurn(membership, now))
    .sort(turnOrder);

  let committedMinor = 0;
  let paidThisRoundMinor = 0;

  for (const membership of input.memberships) {
    if (membership.status !== 'active' || !membership.chargesBeginOn) {
      continue;
    }

    const round = currentRound(
      membership.chargesBeginOn,
      now,
      membership.membersRequired,
    );

    if (round === null) {
      continue;
    }

    committedMinor += membership.monthlyAmountMinor;
    const contribution = contributions.get(`${membership.circleId}:${round}`);

    if (contribution?.status === 'paid') {
      paidThisRoundMinor += contribution.amountMinor;
    }
  }

  return {
    points: input.events.reduce((sum, event) => sum + event.points, 0),
    onTimeCount,
    missedCount,
    onTimeRate:
      decided === 0 ? null : Math.round((onTimeCount / decided) * 100),
    committedMinor,
    paidThisRoundMinor,
    months,
    turns,
    entries,
    score: scoreSeries(input.events),
  };
}

function toEntry(
  event: ActivityEvent,
  contributions: Map<string, ActivityContribution>,
): ActivityEntry {
  const counted =
    event.eventType === 'contribution_paid' ||
    event.eventType === 'contribution_missed';
  const contribution = counted
    ? contributions.get(`${event.circleId}:${event.roundNumber}`)
    : undefined;

  return {
    occurredOn: event.occurredOn,
    circleId: event.circleId,
    circleName: event.circleName,
    roundNumber: counted ? event.roundNumber : null,
    amountMinor: contribution?.amountMinor ?? null,
    status: entryStatus[event.eventType],
    points: event.points,
  };
}

function monthTotals(entries: ActivityEntry[]): ActivityMonth[] {
  const totals = new Map<string, ActivityMonth>();

  for (const entry of entries) {
    if (entry.amountMinor === null) {
      continue;
    }

    if (entry.status !== 'paid' && entry.status !== 'failed') {
      continue;
    }

    const month = entry.occurredOn.slice(0, 7);
    const current = totals.get(month) ?? {
      month,
      paidMinor: 0,
      missedMinor: 0,
    };

    if (entry.status === 'paid') {
      current.paidMinor += entry.amountMinor;
    } else {
      current.missedMinor += entry.amountMinor;
    }

    totals.set(month, current);
  }

  return [...totals.values()].sort((left, right) =>
    left.month.localeCompare(right.month),
  );
}

function scoreSeries(events: ActivityEvent[]): ActivityRecord['score'] {
  const ordered = [...events].sort((left, right) => {
    if (left.occurredOn !== right.occurredOn) {
      return left.occurredOn.localeCompare(right.occurredOn);
    }

    return left.roundNumber - right.roundNumber;
  });
  const series: ActivityRecord['score'] = [];
  let points = 0;

  for (const event of ordered) {
    points += event.points;
    const last = series.at(-1);

    if (last?.occurredOn === event.occurredOn) {
      last.points = points;
    } else {
      series.push({ occurredOn: event.occurredOn, points });
    }
  }

  return series;
}

function toTurn(membership: ActivityMembership, now: Date): ActivityTurn {
  const round = membership.chargesBeginOn
    ? currentRound(
        membership.chargesBeginOn,
        now,
        membership.membersRequired,
      )
    : null;
  // The member receives the pot on the round equal to their turn.
  const received =
    membership.payoutPosition !== null &&
    (membership.status === 'completed' ||
      (round !== null && round >= membership.payoutPosition));

  return {
    circleId: membership.circleId,
    circleName: membership.circleName,
    payoutPosition: membership.payoutPosition,
    currentRound: round,
    membersRequired: membership.membersRequired,
    state:
      membership.payoutPosition === null
        ? 'forming'
        : received
          ? 'received'
          : 'waiting',
  };
}

function newestFirst(left: ActivityEntry, right: ActivityEntry): number {
  if (left.occurredOn !== right.occurredOn) {
    return right.occurredOn.localeCompare(left.occurredOn);
  }

  return (right.roundNumber ?? -1) - (left.roundNumber ?? -1);
}

function turnOrder(left: ActivityTurn, right: ActivityTurn): number {
  const rank = { waiting: 0, forming: 1, received: 2 };

  return (
    rank[left.state] - rank[right.state] ||
    left.circleName.localeCompare(right.circleName)
  );
}
