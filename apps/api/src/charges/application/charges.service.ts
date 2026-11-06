import { randomUUID } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';

import { Inject, Injectable } from '@nestjs/common';
import type { ContributionStatus } from '@repo/api';

import { PaypalPaymentError, PaypalVaultError } from '../domain/errors';
import {
  currentRound,
  minorToPaypalValue,
  paypalValueToMinor,
} from '../domain/charge-calendar';
import {
  CHARGE_REPOSITORY,
  PAYPAL_PAYMENTS,
  type ChargeRepository,
  type ContributionRow,
  type PaypalPayments,
} from './ports';

export type ChargeView = {
  potCollectedMinor: number;
  currentRound: number | null;
  approvedUserIds: ReadonlySet<string>;
  statusByUserId: ReadonlyMap<string, ContributionStatus>;
};

@Injectable()
export class ChargesService {
  constructor(
    @Inject(CHARGE_REPOSITORY) private readonly charges: ChargeRepository,
    @Inject(PAYPAL_PAYMENTS) private readonly paypal: PaypalPayments,
  ) {}

  async view(
    input: {
      circleId: string;
      chargesBeginOn: string | null;
      membersRequired: number;
      memberIds: string[];
    },
    now: Date,
  ): Promise<ChargeView> {
    const approved = await this.charges.approvedAmong(input.memberIds);
    const round = input.chargesBeginOn
      ? currentRound(input.chargesBeginOn, now, input.membersRequired)
      : null;
    const rows =
      round === null
        ? []
        : await this.charges.contributionsForRound(input.circleId, round);
    const statusByUserId = new Map<string, ContributionStatus>();

    for (const row of rows) {
      statusByUserId.set(row.userId, shownStatus(row.status));
    }

    return {
      potCollectedMinor: rows
        .filter((row) => row.status === 'paid')
        .reduce((sum, row) => sum + row.amountMinor, 0),
      currentRound: round,
      approvedUserIds: new Set(approved),
      statusByUserId,
    };
  }

  async runDue(now: Date): Promise<void> {
    const circles = await this.charges.lockedCircles();

    for (const circle of circles) {
      const approved = new Set(
        await this.charges.approvedAmong(circle.memberIds),
      );

      if (circle.memberIds.some((userId) => !approved.has(userId))) {
        continue;
      }

      const approvalOn = await this.charges.latestApprovalOn(circle.memberIds);

      if (!approvalOn) {
        continue;
      }

      let beginOn = circle.chargesBeginOn;

      if (beginOn !== approvalOn) {
        beginOn = approvalOn;
        await this.charges.setBeginOn(circle.id, beginOn);
      }

      const round = currentRound(beginOn, now, circle.membersRequired);

      if (round === null) {
        continue;
      }

      for (const userId of circle.memberIds) {
        await this.chargeMember(
          circle.id,
          userId,
          round,
          circle.monthlyAmountMinor,
        );
      }
    }
  }

  async beginApproval(input: {
    returnUrl: string;
    cancelUrl: string;
  }): Promise<{ setupTokenId: string; approveUrl: string }> {
    try {
      const token = await this.paypal.createSetupToken({
        returnUrl: input.returnUrl,
        cancelUrl: input.cancelUrl,
        requestId: randomUUID(),
      });

      return { setupTokenId: token.id, approveUrl: token.approveUrl };
    } catch {
      throw new PaypalVaultError();
    }
  }

  async completeApproval(userId: string, setupTokenId: string): Promise<void> {
    try {
      const token = await this.paypal.createPaymentToken(
        setupTokenId,
        randomUUID(),
      );
      await this.charges.savePaymentMethod({
        userId,
        paymentTokenId: token.paymentTokenId,
        customerId: token.customerId,
      });
    } catch {
      throw new PaypalVaultError();
    }
  }

  async memberOf(circleId: string, userId: string): Promise<boolean> {
    return this.charges.isMember(circleId, userId);
  }

  async receiveWebhook(
    raw: Buffer,
    headers: IncomingHttpHeaders,
  ): Promise<boolean> {
    let event: unknown;

    try {
      event = JSON.parse(raw.toString('utf8')) as unknown;
    } catch {
      return false;
    }

    const verified = await this.paypal.verifyWebhook({ headers, event });

    if (!verified || !event || typeof event !== 'object') {
      return false;
    }

    const record = event as Record<string, unknown>;
    const eventId = record.id;
    const eventType = record.event_type;

    if (typeof eventId !== 'string' || typeof eventType !== 'string') {
      return true;
    }

    const fresh = await this.charges.recordEvent(eventId);

    if (!fresh) {
      return true;
    }

    const resource = record.resource;

    if (!resource || typeof resource !== 'object') {
      return true;
    }

    const contributionId = readContributionId(resource);

    if (!contributionId) {
      return true;
    }

    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      const amount = readAmountMinor(resource);
      const captureId = readId(resource);

      if (amount !== null) {
        await this.charges.markPaid(contributionId, captureId, amount);
      }
    } else if (eventType === 'PAYMENT.CAPTURE.DENIED') {
      await this.charges.markFailed(contributionId);
    } else if (eventType === 'PAYMENT.CAPTURE.REFUNDED') {
      await this.charges.markRefunded(contributionId);
    }

    return true;
  }

  private async chargeMember(
    circleId: string,
    userId: string,
    roundNumber: number,
    amountMinor: number,
  ): Promise<void> {
    const existing = await this.charges.findContribution(
      circleId,
      userId,
      roundNumber,
    );

    if (existing && (existing.status !== 'pending' || existing.paypalOrderId)) {
      return;
    }

    const id = existing?.id ?? randomUUID();

    if (!existing) {
      await this.charges.insertPending({
        id,
        circleId,
        userId,
        roundNumber,
        amountMinor,
      });
    }

    const vaultId = await this.charges.paymentTokenFor(userId);

    if (!vaultId) {
      await this.charges.markFailed(id);
      return;
    }

    try {
      const order = await this.paypal.createVaultOrder({
        requestId: id,
        vaultId,
        amount: minorToPaypalValue(amountMinor),
        customId: id,
      });
      await this.charges.saveOrderId(id, order.orderId);
    } catch (error) {
      if (error instanceof PaypalPaymentError && !error.retryable) {
        await this.charges.markFailed(id);
      }
    }
  }
}

function shownStatus(status: ContributionRow['status']): ContributionStatus {
  if (status === 'pending') {
    return 'due';
  }

  return status;
}

function readContributionId(resource: object): string | null {
  const record = resource as { custom_id?: unknown; invoice_id?: unknown };
  const value = record.custom_id ?? record.invoice_id;

  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : null;
}

function readAmountMinor(resource: object): number | null {
  const value = (resource as { amount?: { value?: unknown } }).amount?.value;

  return typeof value === 'string' ? paypalValueToMinor(value) : null;
}

function readId(resource: object): string | null {
  const id = (resource as { id?: unknown }).id;

  return typeof id === 'string' && id.length > 0 ? id : null;
}
