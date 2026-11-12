import { describe, expect, it } from '@jest/globals';
import type {
  CircleDetail,
  CircleSummary,
  CreditRecord,
  PaypalLinkStatus,
} from '@repo/api';

import { CircleNotFoundError } from '../../circles/domain/errors';
import type { PayoutDecision } from '../domain/circle-brief';
import type {
  TreasurerCircles,
  TreasurerCredit,
  TreasurerModel,
  TreasurerModelRequest,
  TreasurerPaypal,
} from './ports';
import { TreasurerService } from './treasurer.service';

const circleId = '11111111-1111-4111-8111-111111111111';

function detail(paid: boolean): CircleDetail {
  return {
    id: circleId,
    name: 'Thursday',
    monthlyAmountMinor: 5000,
    currency: 'USD',
    status: 'active',
    memberCount: 1,
    membersRequired: 1,
    viewerIsCreator: true,
    viewerIsMember: true,
    inviteToken: 'secret-invite',
    createdAt: '2026-01-01T00:00:00.000Z',
    chargeDay: 4,
    chargesBeginOn: '2026-01-04',
    potCollectedMinor: paid ? 5000 : 0,
    currentRound: 1,
    viewerChargeApproved: true,
    members: [
      {
        displayName: 'Ada',
        username: 'ada',
        creator: true,
        payoutPosition: 1,
        chargeApproved: paid,
        contributionStatus: paid ? 'paid' : 'due',
      },
    ],
  };
}

class FakeCircles implements TreasurerCircles {
  circle = detail(false);
  paypalLookups = 0;

  async listForUser(): Promise<CircleSummary[]> {
    return [
      {
        id: this.circle.id,
        name: this.circle.name,
        monthlyAmountMinor: this.circle.monthlyAmountMinor,
        currency: 'USD',
        status: this.circle.status,
        memberCount: this.circle.memberCount,
        membersRequired: this.circle.membersRequired,
        viewerIsCreator: this.circle.viewerIsCreator,
        viewerIsMember: true,
      },
    ];
  }

  async getForMember(): Promise<CircleDetail> {
    return this.circle;
  }

  async memberUserId(): Promise<string | null> {
    this.paypalLookups += 1;
    return 'user-ada';
  }
}

class FakeCredit implements TreasurerCredit {
  async read(): Promise<CreditRecord> {
    return {
      points: 10,
      memberships: [{ circleId, circleName: 'Thursday', streak: 1 }],
      events: [
        {
          circleId,
          circleName: 'Thursday',
          roundNumber: 1,
          eventType: 'contribution_paid',
          points: 10,
          occurredOn: '2026-01-04',
        },
      ],
    };
  }
}

class FakePaypal implements TreasurerPaypal {
  calls = 0;

  async statusForUser(): Promise<PaypalLinkStatus> {
    this.calls += 1;
    return {
      configured: true,
      environment: 'sandbox',
      returnUrl: 'http://127.0.0.1:3000/paypal/callback',
      account: {
        fullName: 'Ada Lovelace',
        email: 'ada@example.com',
        emailVerified: true,
        accountVerified: true,
        accountType: 'PERSONAL',
        payerId: 'payer-ada',
        linkedAt: '2026-01-01T00:00:00.000Z',
      },
    };
  }
}

class ScriptedModel implements TreasurerModel {
  request: TreasurerModelRequest | null = null;
  toolNames: string[] = [];

  constructor(private readonly names: string[]) {}

  async answer(request: TreasurerModelRequest): Promise<string> {
    this.request = request;
    const results = [];

    for (const name of this.names) {
      this.toolNames.push(name);
      results.push(await request.callTool(name, {}));
    }

    return JSON.stringify(results);
  }
}

function service(
  circles: FakeCircles,
  paypal: FakePaypal,
  model: TreasurerModel,
) {
  return new TreasurerService(circles, new FakeCredit(), paypal, model);
}

describe('TreasurerService', () => {
  it('reports members who still need to approve and does not look up PayPal', async () => {
    const circles = new FakeCircles();
    const paypal = new FakePaypal();
    const model = new ScriptedModel(['read_circle']);
    const reply = await service(circles, paypal, model).ask('user-ada', {
      message: 'Who still needs to approve?',
      circleId,
    });
    const brief = JSON.parse(reply)[0] as {
      waitingForPaymentApproval: unknown;
    };

    expect(brief.waitingForPaymentApproval).toEqual([
      { displayName: 'Ada', username: 'ada' },
    ]);
    expect(reply).not.toContain('secret-invite');
    expect(paypal.calls).toBe(0);
    expect(model.request?.message).toContain(circleId);
  });

  it('prepares a payout for the creator and leaves sent false', async () => {
    const circles = new FakeCircles();
    circles.circle = detail(true);
    const paypal = new FakePaypal();
    const reply = await service(
      circles,
      paypal,
      new ScriptedModel(['prepare_round_payout']),
    ).ask('user-ada', { message: 'Is this round ready?', circleId });
    const decision = JSON.parse(reply)[0] as PayoutDecision;

    expect(decision.ready).toBe(true);
    expect(decision.sent).toBe(false);
    expect(decision.confirmationRequired).toBe(true);
    expect(decision.recipient?.paypal?.email).toBe('ada@example.com');
    expect(reply).not.toContain('paypal/callback');
    expect(paypal.calls).toBe(1);
  });

  it('does not look up PayPal when the round is not fully paid', async () => {
    const circles = new FakeCircles();
    const paypal = new FakePaypal();
    const reply = await service(
      circles,
      paypal,
      new ScriptedModel(['prepare_round_payout']),
    ).ask('user-ada', { message: 'Pay the pot', circleId });
    const decision = JSON.parse(reply)[0] as PayoutDecision;

    expect(decision.ready).toBe(false);
    expect(decision.sent).toBe(false);
    expect(paypal.calls).toBe(0);
    expect(circles.paypalLookups).toBe(0);
  });

  it('hides a missing circle as a tool error', async () => {
    const circles = new FakeCircles();
    circles.getForMember = () => Promise.reject(new CircleNotFoundError());
    const reply = await service(
      circles,
      new FakePaypal(),
      new ScriptedModel(['read_circle']),
    ).ask('user-ada', { message: 'Read it', circleId });

    expect(JSON.parse(reply)).toEqual([{ error: 'Circle not found.' }]);
  });
});
