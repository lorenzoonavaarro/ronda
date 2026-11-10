import { describe, expect, it } from '@jest/globals';

import { PaypalPaymentError } from '../domain/errors';
import { ChargesService } from './charges.service';
import type {
  ChargeRepository,
  ContributionRow,
  LockedCircle,
  PaypalPayments,
  WebhookTransaction,
} from './ports';

class MemoryCharges implements ChargeRepository {
  circles: LockedCircle[] = [];
  approved = new Set<string>();
  approvedOn = new Map<string, string>();
  tokens = new Map<string, string>();
  rows: ContributionRow[] = [];
  events = new Set<string>();
  members = new Set<string>();
  creditEvents: string[] = [];
  failCredit = false;

  async lockedCircles(): Promise<LockedCircle[]> {
    return this.circles;
  }

  async approvedAmong(userIds: string[]): Promise<string[]> {
    return userIds.filter((userId) => this.approved.has(userId));
  }

  async latestApprovalOn(userIds: string[]): Promise<string | null> {
    const dates = userIds.map((userId) => this.approvedOn.get(userId) ?? null);

    if (dates.length === 0 || dates.some((date) => date === null)) {
      return null;
    }

    return dates.reduce((latest, date) =>
      date !== null && date > latest! ? date : latest,
    );
  }

  async setBeginOn(circleId: string, beginOn: string): Promise<void> {
    const circle = this.circles.find((item) => item.id === circleId);
    const charged = this.rows.some((row) => row.circleId === circleId);

    if (circle && (!circle.chargesBeginOn || !charged)) {
      circle.chargesBeginOn = beginOn;
    }
  }

  async findContribution(
    circleId: string,
    userId: string,
    roundNumber: number,
  ): Promise<ContributionRow | null> {
    return (
      this.rows.find(
        (row) =>
          row.circleId === circleId &&
          row.userId === userId &&
          row.roundNumber === roundNumber,
      ) ?? null
    );
  }

  async insertPending(input: {
    id: string;
    circleId: string;
    userId: string;
    roundNumber: number;
    amountMinor: number;
  }): Promise<void> {
    this.rows.push({
      ...input,
      status: 'pending',
      paypalOrderId: null,
    });
  }

  async saveOrderId(id: string, orderId: string): Promise<void> {
    const row = this.rows.find((item) => item.id === id);

    if (row && !row.paypalOrderId) {
      row.paypalOrderId = orderId;
    }
  }

  async markFailed(id: string): Promise<ContributionRow | null> {
    const row = this.rows.find((item) => item.id === id);

    if (row?.status === 'pending') {
      row.status = 'failed';
    }

    return row?.status === 'failed' ? row : null;
  }

  async markPaid(
    id: string,
    captureId: string | null,
    amountMinor: number,
  ): Promise<ContributionRow | null> {
    const row = this.rows.find((item) => item.id === id);

    if (
      row &&
      (row.status === 'pending' || row.status === 'failed') &&
      row.amountMinor === amountMinor
    ) {
      row.status = 'paid';
      row.paypalOrderId = row.paypalOrderId ?? captureId;
    }

    return row?.status === 'paid' && row.amountMinor === amountMinor
      ? row
      : null;
  }

  async markRefunded(id: string): Promise<void> {
    const row = this.rows.find((item) => item.id === id);

    if (row?.status === 'paid') {
      row.status = 'refunded';
    }
  }

  async recordEvent(eventId: string): Promise<boolean> {
    if (this.events.has(eventId)) {
      return false;
    }

    this.events.add(eventId);
    return true;
  }

  async contributionsForRound(
    circleId: string,
    roundNumber: number,
  ): Promise<ContributionRow[]> {
    return this.rows.filter(
      (row) => row.circleId === circleId && row.roundNumber === roundNumber,
    );
  }

  async savePaymentMethod(): Promise<void> {}

  async paymentTokenFor(userId: string): Promise<string | null> {
    return this.tokens.get(userId) ?? null;
  }

  async isMember(circleId: string, userId: string): Promise<boolean> {
    return this.members.has(`${circleId}:${userId}`);
  }

  async withWebhookTransaction<T>(
    work: (transaction: WebhookTransaction) => Promise<T>,
  ): Promise<T> {
    const rows = this.rows.map((row) => ({ ...row }));
    const events = new Set(this.events);
    const creditEvents = [...this.creditEvents];

    try {
      return await work({
        charges: this,
        credit: {
          recordPaid: async (input) => {
            if (this.failCredit) {
              throw new Error('credit write failed');
            }

            this.creditEvents.push(
              `paid:${input.userId}:${input.circleId}:${input.roundNumber}`,
            );
          },
          recordMissed: async (input) => {
            if (this.failCredit) {
              throw new Error('credit write failed');
            }

            this.creditEvents.push(
              `missed:${input.userId}:${input.circleId}:${input.roundNumber}`,
            );
          },
        },
      });
    } catch (error) {
      this.rows = rows;
      this.events = events;
      this.creditEvents = creditEvents;
      throw error;
    }
  }
}

class FakePaypal implements PaypalPayments {
  orders: {
    requestId: string;
    vaultId: string;
    amount: string;
    customId: string;
  }[] = [];
  decline = false;
  verified = true;

  async createSetupToken(): Promise<{ id: string; approveUrl: string }> {
    return {
      id: 'setup',
      approveUrl: 'https://www.sandbox.paypal.com/approve',
    };
  }

  async createPaymentToken(): Promise<{
    paymentTokenId: string;
    customerId: string | null;
  }> {
    return { paymentTokenId: 'token', customerId: null };
  }

  async createVaultOrder(input: {
    requestId: string;
    vaultId: string;
    amount: string;
    customId: string;
  }): Promise<{ orderId: string }> {
    if (this.decline) {
      throw new PaypalPaymentError(false);
    }

    this.orders.push(input);
    return { orderId: `ORDER-${this.orders.length}` };
  }

  async verifyWebhook(): Promise<boolean> {
    return this.verified;
  }
}

function circle(overrides: Partial<LockedCircle> = {}): LockedCircle {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    chargeDay: 6,
    chargesBeginOn: null,
    monthlyAmountMinor: 2500,
    membersRequired: 2,
    memberIds: ['user-1', 'user-2'],
    ...overrides,
  };
}

describe('ChargesService', () => {
  it('does not charge until the circle is locked and every member has approved', async () => {
    const repo = new MemoryCharges();
    const paypal = new FakePaypal();
    const service = new ChargesService(repo, paypal);
    repo.circles = [circle()];
    repo.approved.add('user-1');
    repo.tokens.set('user-1', 'vault-1');

    await service.runDue(new Date('2026-11-06T12:00:00Z'));

    expect(paypal.orders).toEqual([]);
    expect(repo.circles[0]?.chargesBeginOn).toBeNull();
  });

  it('charges each member once on the charge day and waits for the webhook', async () => {
    const repo = new MemoryCharges();
    const paypal = new FakePaypal();
    const service = new ChargesService(repo, paypal);
    repo.circles = [circle()];
    repo.approved.add('user-1');
    repo.approved.add('user-2');
    repo.approvedOn.set('user-1', '2026-11-04');
    repo.approvedOn.set('user-2', '2026-11-06');
    repo.tokens.set('user-1', 'vault-1');
    repo.tokens.set('user-2', 'vault-2');

    await service.runDue(new Date('2026-11-06T12:00:00Z'));
    await service.runDue(new Date('2026-11-06T13:00:00Z'));

    expect(repo.circles[0]?.chargesBeginOn).toBe('2026-11-06');
    expect(paypal.orders).toHaveLength(2);
    expect(paypal.orders.map((order) => order.amount)).toEqual([
      '25.00',
      '25.00',
    ]);
    expect(
      paypal.orders.every((order) => order.requestId === order.customId),
    ).toBe(true);
    expect(repo.rows.every((row) => row.status === 'pending')).toBe(true);

    const view = await service.view(
      {
        circleId: repo.circles[0]!.id,
        chargesBeginOn: '2026-11-06',
        membersRequired: 2,
        memberIds: ['user-1', 'user-2'],
      },
      new Date('2026-11-06T13:00:00Z'),
    );

    expect(view.potCollectedMinor).toBe(0);
    expect(view.currentRound).toBe(1);
    expect(view.statusByUserId.get('user-1')).toBe('due');
  });

  it('starts from the latest approval date when an earlier date was saved', async () => {
    const repo = new MemoryCharges();
    const paypal = new FakePaypal();
    const service = new ChargesService(repo, paypal);
    repo.circles = [circle({ chargesBeginOn: '2026-12-01' })];
    repo.approved.add('user-1');
    repo.approved.add('user-2');
    repo.approvedOn.set('user-1', '2026-11-06');
    repo.approvedOn.set('user-2', '2026-11-06');
    repo.tokens.set('user-1', 'vault-1');
    repo.tokens.set('user-2', 'vault-2');

    await service.runDue(new Date('2026-11-06T12:00:00Z'));

    expect(repo.circles[0]?.chargesBeginOn).toBe('2026-11-06');
    expect(paypal.orders).toHaveLength(2);
  });

  it('marks a declined charge failed and does not try it again', async () => {
    const repo = new MemoryCharges();
    const paypal = new FakePaypal();
    paypal.decline = true;
    const service = new ChargesService(repo, paypal);
    repo.circles = [circle({ memberIds: ['user-1'], membersRequired: 2 })];
    repo.approved.add('user-1');
    repo.approvedOn.set('user-1', '2026-11-06');
    repo.tokens.set('user-1', 'vault-1');

    await service.runDue(new Date('2026-11-06T12:00:00Z'));
    paypal.decline = false;
    await service.runDue(new Date('2026-11-06T13:00:00Z'));

    expect(paypal.orders).toHaveLength(0);
    expect(repo.rows[0]?.status).toBe('failed');
  });

  it('adds a confirmed capture to the pot once', async () => {
    const repo = new MemoryCharges();
    const paypal = new FakePaypal();
    const service = new ChargesService(repo, paypal);
    const contributionId = '22222222-2222-4222-8222-222222222222';
    repo.rows.push({
      id: contributionId,
      circleId: '11111111-1111-4111-8111-111111111111',
      userId: 'user-1',
      roundNumber: 1,
      amountMinor: 2500,
      status: 'pending',
      paypalOrderId: 'ORDER-1',
    });
    const body = Buffer.from(
      JSON.stringify({
        id: 'WH-1',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: 'CAPTURE-1',
          custom_id: contributionId,
          amount: { value: '25.00' },
        },
      }),
    );

    expect(await service.receiveWebhook(body, {})).toBe(true);
    expect(await service.receiveWebhook(body, {})).toBe(true);
    expect(repo.rows[0]?.status).toBe('paid');
    expect(repo.creditEvents).toEqual([
      'paid:user-1:11111111-1111-4111-8111-111111111111:1',
    ]);

    const view = await service.view(
      {
        circleId: '11111111-1111-4111-8111-111111111111',
        chargesBeginOn: '2026-11-06',
        membersRequired: 2,
        memberIds: ['user-1'],
      },
      new Date('2026-11-06T13:00:00Z'),
    );

    expect(view.potCollectedMinor).toBe(2500);

    const refund = Buffer.from(
      JSON.stringify({
        id: 'WH-2',
        event_type: 'PAYMENT.CAPTURE.REFUNDED',
        resource: { custom_id: contributionId },
      }),
    );
    await service.receiveWebhook(refund, {});

    const after = await service.view(
      {
        circleId: '11111111-1111-4111-8111-111111111111',
        chargesBeginOn: '2026-11-06',
        membersRequired: 2,
        memberIds: ['user-1'],
      },
      new Date('2026-11-06T13:00:00Z'),
    );

    expect(after.potCollectedMinor).toBe(0);
    expect(repo.rows[0]?.status).toBe('refunded');
  });

  it('rolls back the webhook claim and payment when credit recording fails', async () => {
    const repo = new MemoryCharges();
    const paypal = new FakePaypal();
    const service = new ChargesService(repo, paypal);
    const contributionId = '22222222-2222-4222-8222-222222222222';
    repo.rows.push({
      id: contributionId,
      circleId: '11111111-1111-4111-8111-111111111111',
      userId: 'user-1',
      roundNumber: 1,
      amountMinor: 2500,
      status: 'pending',
      paypalOrderId: 'ORDER-1',
    });
    repo.failCredit = true;
    const body = Buffer.from(
      JSON.stringify({
        id: 'WH-ROLLBACK',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: 'CAPTURE-1',
          custom_id: contributionId,
          amount: { value: '25.00' },
        },
      }),
    );

    await expect(service.receiveWebhook(body, {})).rejects.toThrow(
      'credit write failed',
    );
    expect(repo.events.has('WH-ROLLBACK')).toBe(false);
    expect(repo.rows[0]?.status).toBe('pending');

    repo.failCredit = false;
    await expect(service.receiveWebhook(body, {})).resolves.toBe(true);
    expect(repo.rows[0]?.status).toBe('paid');
    expect(repo.creditEvents).toHaveLength(1);
  });

  it('ignores an unverified webhook', async () => {
    const repo = new MemoryCharges();
    const paypal = new FakePaypal();
    paypal.verified = false;
    const service = new ChargesService(repo, paypal);
    const contributionId = '22222222-2222-4222-8222-222222222222';
    repo.rows.push({
      id: contributionId,
      circleId: '11111111-1111-4111-8111-111111111111',
      userId: 'user-1',
      roundNumber: 1,
      amountMinor: 2500,
      status: 'pending',
      paypalOrderId: 'ORDER-1',
    });

    const accepted = await service.receiveWebhook(
      Buffer.from(
        JSON.stringify({
          id: 'WH-1',
          event_type: 'PAYMENT.CAPTURE.COMPLETED',
          resource: {
            custom_id: contributionId,
            amount: { value: '25.00' },
          },
        }),
      ),
      {},
    );

    expect(accepted).toBe(false);
    expect(repo.rows[0]?.status).toBe('pending');
  });
});
