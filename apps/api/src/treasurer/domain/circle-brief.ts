import type { CircleDetail, CircleMember, ContributionStatus } from '@repo/api';

export type PaypalDestination = {
  fullName: string | null;
  email: string | null;
  payerId: string;
};

export type CircleBrief = {
  id: string;
  name: string;
  status: CircleDetail['status'];
  monthlyAmountMinor: number;
  monthlyAmountUsd: string;
  currency: 'USD';
  memberCount: number;
  membersRequired: number;
  viewerIsCreator: boolean;
  chargeDay: number;
  chargesBeginOn: string | null;
  currentRound: number | null;
  potCollectedMinor: number;
  potCollectedUsd: string;
  currentRecipient: {
    displayName: string;
    username: string;
    payoutPosition: number;
  } | null;
  waitingForPaymentApproval: { displayName: string; username: string }[];
  contributions: {
    displayName: string;
    username: string;
    payoutPosition: number | null;
    chargeApproved: boolean;
    contributionStatus: ContributionStatus;
  }[];
};

export type PayoutDecision = {
  ready: boolean;
  sent: false;
  confirmationRequired: boolean;
  reason: string;
  circleId: string;
  circleName: string;
  round: number | null;
  amountMinor: number | null;
  amountUsd: string | null;
  recipient: {
    displayName: string;
    username: string;
    paypal: PaypalDestination | null;
  } | null;
  unpaid: {
    displayName: string;
    username: string;
    contributionStatus: ContributionStatus;
  }[];
};

export function circleBrief(circle: CircleDetail): CircleBrief {
  const recipient = recipientFor(circle);

  return {
    id: circle.id,
    name: circle.name,
    status: circle.status,
    monthlyAmountMinor: circle.monthlyAmountMinor,
    monthlyAmountUsd: usd(circle.monthlyAmountMinor),
    currency: 'USD',
    memberCount: circle.memberCount,
    membersRequired: circle.membersRequired,
    viewerIsCreator: circle.viewerIsCreator,
    chargeDay: circle.chargeDay,
    chargesBeginOn: circle.chargesBeginOn,
    currentRound: circle.currentRound,
    potCollectedMinor: circle.potCollectedMinor,
    potCollectedUsd: usd(circle.potCollectedMinor),
    currentRecipient: recipient
      ? {
          displayName: recipient.displayName,
          username: recipient.username,
          payoutPosition: recipient.payoutPosition ?? circle.currentRound ?? 0,
        }
      : null,
    waitingForPaymentApproval: circle.members
      .filter((member) => !member.chargeApproved)
      .map((member) => ({
        displayName: member.displayName,
        username: member.username,
      })),
    contributions: circle.members.map((member) => ({
      displayName: member.displayName,
      username: member.username,
      payoutPosition: member.payoutPosition,
      chargeApproved: member.chargeApproved,
      contributionStatus: member.contributionStatus,
    })),
  };
}

export function preparePayout(
  circle: CircleDetail,
  recipientPaypal: PaypalDestination | null,
): PayoutDecision {
  const base = {
    sent: false as const,
    circleId: circle.id,
    circleName: circle.name,
    round: circle.currentRound,
    recipient: null,
    unpaid: unpaidMembers(circle),
  };

  if (!circle.viewerIsCreator) {
    return {
      ...base,
      ready: false,
      confirmationRequired: false,
      reason: 'Only the circle creator can prepare a payout.',
      amountMinor: null,
      amountUsd: null,
    };
  }

  if (circle.status !== 'active') {
    return {
      ...base,
      ready: false,
      confirmationRequired: false,
      reason:
        circle.status === 'forming'
          ? 'This circle is still forming. Lock it and collect this round before preparing a payout.'
          : 'This circle is already completed.',
      amountMinor: null,
      amountUsd: null,
    };
  }

  if (circle.currentRound === null) {
    return {
      ...base,
      ready: false,
      confirmationRequired: false,
      reason: 'Charges have not started for this circle.',
      amountMinor: null,
      amountUsd: null,
    };
  }

  if (base.unpaid.length > 0) {
    return {
      ...base,
      ready: false,
      confirmationRequired: false,
      reason: 'This round is not fully paid.',
      amountMinor: circle.potCollectedMinor,
      amountUsd: usd(circle.potCollectedMinor),
    };
  }

  const recipient = recipientFor(circle);

  if (!recipient) {
    return {
      ...base,
      ready: false,
      confirmationRequired: false,
      reason: 'This round has no recipient yet.',
      amountMinor: circle.potCollectedMinor,
      amountUsd: usd(circle.potCollectedMinor),
    };
  }

  if (!recipientPaypal) {
    return {
      ...base,
      ready: false,
      confirmationRequired: false,
      reason: 'The recipient has not linked a PayPal account.',
      amountMinor: circle.potCollectedMinor,
      amountUsd: usd(circle.potCollectedMinor),
      recipient: {
        displayName: recipient.displayName,
        username: recipient.username,
        paypal: null,
      },
    };
  }

  return {
    ...base,
    ready: true,
    confirmationRequired: true,
    reason: 'Ready for the creator to confirm. No money has been sent.',
    amountMinor: circle.potCollectedMinor,
    amountUsd: usd(circle.potCollectedMinor),
    recipient: {
      displayName: recipient.displayName,
      username: recipient.username,
      paypal: recipientPaypal,
    },
  };
}

function recipientFor(circle: CircleDetail): CircleMember | null {
  if (circle.currentRound === null) {
    return null;
  }

  return (
    circle.members.find(
      (member) => member.payoutPosition === circle.currentRound,
    ) ?? null
  );
}

function unpaidMembers(circle: CircleDetail): PayoutDecision['unpaid'] {
  if (circle.currentRound === null) {
    return [];
  }

  return circle.members
    .filter((member) => member.contributionStatus !== 'paid')
    .map((member) => ({
      displayName: member.displayName,
      username: member.username,
      contributionStatus: member.contributionStatus,
    }));
}

function usd(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const absolute = Math.abs(Math.trunc(minor));

  return `${sign}${Math.trunc(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}
