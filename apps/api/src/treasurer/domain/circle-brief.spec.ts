import { describe, expect, it } from '@jest/globals';
import type { CircleDetail } from '@repo/api';

import { circleBrief, preparePayout } from './circle-brief';

const circleId = '11111111-1111-4111-8111-111111111111';

function circle(overrides: Partial<CircleDetail> = {}): CircleDetail {
  return {
    id: circleId,
    name: 'Thursday',
    monthlyAmountMinor: 5000,
    currency: 'USD',
    status: 'active',
    memberCount: 2,
    membersRequired: 2,
    viewerIsCreator: true,
    inviteToken: 'secret-invite',
    createdAt: '2026-01-01T00:00:00.000Z',
    chargeDay: 4,
    chargesBeginOn: '2026-01-04',
    potCollectedMinor: 10000,
    currentRound: 1,
    viewerChargeApproved: true,
    members: [
      {
        displayName: 'Ada',
        username: 'ada',
        creator: true,
        payoutPosition: 1,
        chargeApproved: true,
        contributionStatus: 'paid',
      },
      {
        displayName: 'Bea',
        username: 'bea',
        creator: false,
        payoutPosition: 2,
        chargeApproved: false,
        contributionStatus: 'due',
      },
    ],
    yield: { status: 'not_earning', earnedMinor: null, availableMinor: null },
    ...overrides,
  };
}

describe('circleBrief', () => {
  it('names members who have not approved charges and hides the invite', () => {
    const brief = circleBrief(circle());

    expect(brief.waitingForPaymentApproval).toEqual([
      { displayName: 'Bea', username: 'bea' },
    ]);
    expect(brief.currentRecipient).toEqual({
      displayName: 'Ada',
      username: 'ada',
      payoutPosition: 1,
    });
    expect(JSON.stringify(brief)).not.toContain('secret-invite');
  });
});

describe('preparePayout', () => {
  it('refuses a member who did not create the circle and hides PayPal', () => {
    const decision = preparePayout(circle({ viewerIsCreator: false }), {
      fullName: 'Bea',
      email: 'bea@example.com',
      payerId: 'payer-bea',
    });

    expect(decision.ready).toBe(false);
    expect(decision.sent).toBe(false);
    expect(decision.recipient).toBeNull();
    expect(JSON.stringify(decision)).not.toContain('bea@example.com');
  });

  it('lists unpaid members and does not mark the round ready', () => {
    const decision = preparePayout(circle(), null);

    expect(decision).toMatchObject({
      ready: false,
      sent: false,
      reason: 'This round is not fully paid.',
      unpaid: [
        { displayName: 'Bea', username: 'bea', contributionStatus: 'due' },
      ],
    });
  });

  it('proposes the collected pot for the creator without sending it', () => {
    const decision = preparePayout(
      circle({
        members: [
          {
            displayName: 'Ada',
            username: 'ada',
            creator: true,
            payoutPosition: 1,
            chargeApproved: true,
            contributionStatus: 'paid',
          },
          {
            displayName: 'Bea',
            username: 'bea',
            creator: false,
            payoutPosition: 2,
            chargeApproved: true,
            contributionStatus: 'paid',
          },
        ],
      }),
      {
        fullName: 'Ada Lovelace',
        email: 'ada@example.com',
        payerId: 'payer-ada',
      },
    );

    expect(decision).toMatchObject({
      ready: true,
      sent: false,
      confirmationRequired: true,
      amountMinor: 10000,
      amountUsd: '100.00',
      recipient: {
        username: 'ada',
        paypal: { email: 'ada@example.com', payerId: 'payer-ada' },
      },
    });
  });

  it('stops when the recipient has not linked PayPal', () => {
    const decision = preparePayout(
      circle({
        members: [
          {
            displayName: 'Ada',
            username: 'ada',
            creator: true,
            payoutPosition: 1,
            chargeApproved: true,
            contributionStatus: 'paid',
          },
        ],
        memberCount: 1,
        membersRequired: 1,
      }),
      null,
    );

    expect(decision.ready).toBe(false);
    expect(decision.sent).toBe(false);
    expect(decision.reason).toBe(
      'The recipient has not linked a PayPal account.',
    );
    expect(decision.recipient?.paypal).toBeNull();
  });
});
