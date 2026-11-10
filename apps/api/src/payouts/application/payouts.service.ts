import { randomUUID } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';

import { Inject, Injectable } from '@nestjs/common';
import type { CircleDetail } from '@repo/api';

import { CirclesService } from '../../circles/application/circles.service';
import { PaypalService } from '../../paypal/application/paypal.service';
import {
  PAYPAL_PAYOUTS,
  PAYOUT_REPOSITORY,
  type PayoutRecord,
  type PayoutRepository,
  type PaypalPayouts,
} from './ports';
import {
  PayoutNotReadyError,
} from '../domain/errors';

@Injectable()
export class PayoutsService {
  constructor(
    @Inject(PAYOUT_REPOSITORY) private readonly payouts: PayoutRepository,
    @Inject(PAYPAL_PAYOUTS) private readonly paypal: PaypalPayouts,
    private readonly circles: CirclesService,
    private readonly accounts: PaypalService,
  ) {}

  async confirm(userId: string, circleId: string): Promise<PayoutRecord> {
    const circle = await this.circles.getForMember(userId, circleId);
    this.validateCreator(circle);

    const round = circle.currentRound;
    if (round === null) {
      throw new PayoutNotReadyError('Charges have not started for this circle.');
    }

    if (circle.status !== 'active') {
      throw new PayoutNotReadyError('This circle is not active.');
    }

    const recipient = circle.members.find(
      (member) => member.payoutPosition === round,
    );
    if (!recipient) {
      throw new PayoutNotReadyError('This round has no recipient.');
    }

    const unpaid = circle.members.filter(
      (member) => member.contributionStatus !== 'paid',
    );
    if (unpaid.length > 0) {
      throw new PayoutNotReadyError('Every contribution must be paid first.');
    }

    const recipientId = await this.circles.memberUserId(
      userId,
      circleId,
      recipient.username,
    );
    if (!recipientId) {
      throw new PayoutNotReadyError('The recipient could not be found.');
    }

    const status = await this.accounts.statusForUser(recipientId);
    const email = status.account?.email;
    if (!email || !status.account.emailVerified) {
      throw new PayoutNotReadyError(
        'The recipient needs a verified PayPal email.',
      );
    }

    const existing = await this.payouts.findForRound(circleId, round);
    if (existing?.status === 'succeeded' || existing?.status === 'submitted') {
      return existing;
    }

    if (existing?.status === 'failed') {
      throw new PayoutNotReadyError(
        'This payout failed and needs manual review before retrying.',
      );
    }

    const payout =
      existing ??
      (await this.payouts.create({
        id: randomUUID(),
        circleId,
        roundNumber: round,
        creatorId: userId,
        recipientUserId: recipientId,
        recipientEmail: email,
        amountMinor: circle.potCollectedMinor,
      }));

    const submitted = await this.paypal.create({
      requestId: payout.id,
      senderBatchId: payout.id,
      recipientEmail: payout.recipientEmail,
      amountMinor: payout.amountMinor,
    });
    return (
      (await this.payouts.markSubmitted(
        payout.id,
        submitted.batchId,
        submitted.itemId,
      )) ?? payout
    );
  }

  async webhook(raw: Buffer, headers: IncomingHttpHeaders): Promise<boolean> {
    let event: unknown;
    try {
      event = JSON.parse(raw.toString('utf8')) as unknown;
    } catch {
      return false;
    }

    if (!(await this.paypal.verifyWebhook({ headers, event }))) {
      return false;
    }

    if (!event || typeof event !== 'object') {
      return true;
    }

    const record = event as Record<string, unknown>;
    const resource =
      record.resource && typeof record.resource === 'object'
        ? (record.resource as Record<string, unknown>)
        : null;
    const batchId = readString(resource?.payout_batch_id);
    const itemId = readString(resource?.payout_item_id);
    const eventType = readString(record.event_type);

    if (!batchId) {
      return true;
    }

    if (
      eventType === 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED' ||
      eventType === 'PAYMENT.PAYOUTSBATCH.SUCCESS'
    ) {
      await this.payouts.markSucceeded(batchId, itemId);
    } else if (
      eventType === 'PAYMENT.PAYOUTS-ITEM.FAILED' ||
      eventType === 'PAYMENT.PAYOUTS-ITEM.BLOCKED' ||
      eventType === 'PAYMENT.PAYOUTS-ITEM.RETURNED' ||
      eventType === 'PAYMENT.PAYOUTSBATCH.DENIED'
    ) {
      await this.payouts.markFailed(
        batchId,
        itemId,
        readString(resource?.errors),
      );
    }

    return true;
  }

  private validateCreator(circle: CircleDetail): void {
    if (!circle.viewerIsCreator) {
      throw new PayoutNotReadyError(
        'Only the circle creator can confirm a payout.',
      );
    }
  }
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
