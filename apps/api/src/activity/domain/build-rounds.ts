import type { CircleRound, CircleRounds, ContributionStatus } from '@repo/api';

import { addUtcMonths } from '../../charges/domain/charge-calendar';

export type RoundMember = {
  userId: string;
  username: string;
  displayName: string;
  payoutPosition: number | null;
};

export type RoundContribution = {
  userId: string;
  roundNumber: number;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
};

export function buildCircleRounds(input: {
  chargesBeginOn: string | null;
  currentRound: number | null;
  members: RoundMember[];
  contributions: RoundContribution[];
}): CircleRounds {
  if (!input.chargesBeginOn || input.currentRound === null) {
    return { rounds: [] };
  }

  const members = [...input.members].sort(memberOrder);
  const statusByKey = new Map(
    input.contributions.map((row) => [
      `${row.userId}:${row.roundNumber}`,
      row.status,
    ]),
  );
  const rounds: CircleRound[] = [];

  for (let roundNumber = 1; roundNumber <= input.currentRound; roundNumber += 1) {
    const chargeOn = addUtcMonths(input.chargesBeginOn, roundNumber - 1);

    if (!chargeOn) {
      break;
    }

    rounds.push({
      roundNumber,
      chargeOn,
      payments: members.map((member) => ({
        username: member.username,
        displayName: member.displayName,
        payoutPosition: member.payoutPosition,
        status: paymentStatus(
          statusByKey.get(`${member.userId}:${roundNumber}`),
        ),
      })),
    });
  }

  return { rounds };
}

function paymentStatus(
  status: RoundContribution['status'] | undefined,
): ContributionStatus {
  if (status === 'paid' || status === 'failed' || status === 'refunded') {
    return status;
  }

  return 'due';
}

function memberOrder(left: RoundMember, right: RoundMember): number {
  if (left.payoutPosition === null || right.payoutPosition === null) {
    if (left.payoutPosition === right.payoutPosition) {
      return left.username.localeCompare(right.username);
    }

    return left.payoutPosition === null ? 1 : -1;
  }

  return (
    left.payoutPosition - right.payoutPosition ||
    left.username.localeCompare(right.username)
  );
}
