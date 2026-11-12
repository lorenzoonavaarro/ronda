export type ActiveCircleObligation = {
  monthlyAmountMinor: number;
  membersRequired: number;
  currentRound: number | null;
  currentRoundPaid: boolean;
};

export type PaperFreeze =
  | 'missed_contribution'
  | 'reserve_short'
  | 'payout_reversed'
  | null;

export function roundsStillOwed(circle: ActiveCircleObligation): number {
  if (!Number.isInteger(circle.membersRequired) || circle.membersRequired < 1) {
    return 0;
  }

  if (circle.currentRound === null) {
    return circle.membersRequired;
  }

  if (
    !Number.isInteger(circle.currentRound) ||
    circle.currentRound < 1 ||
    circle.currentRound > circle.membersRequired
  ) {
    return circle.membersRequired;
  }

  const unpaidCurrent = circle.currentRoundPaid ? 0 : 1;

  return unpaidCurrent + (circle.membersRequired - circle.currentRound);
}

export function paperGrantTarget(input: {
  payoutsReceivedMinor: number;
  circles: ActiveCircleObligation[];
}): {
  targetMinor: number;
  obligationsMinor: number;
  bufferMinor: number;
} {
  let obligationsMinor = 0;
  let bufferMinor = 0;

  for (const circle of input.circles) {
    const rounds = roundsStillOwed(circle);
    obligationsMinor += rounds * circle.monthlyAmountMinor;

    if (rounds > 0) {
      bufferMinor += circle.monthlyAmountMinor;
    }
  }

  return {
    targetMinor: Math.max(
      0,
      input.payoutsReceivedMinor - obligationsMinor - bufferMinor,
    ),
    obligationsMinor,
    bufferMinor,
  };
}

export function paperFreeze(input: {
  hasMissedContribution: boolean;
  hasReversedPayout: boolean;
  grantedMinor: number;
  targetMinor: number;
}): PaperFreeze {
  if (input.hasMissedContribution) {
    return 'missed_contribution';
  }

  if (input.grantedMinor > input.targetMinor) {
    if (input.hasReversedPayout) {
      return 'payout_reversed';
    }

    return 'reserve_short';
  }

  return null;
}
