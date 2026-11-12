import type { IncomingHttpHeaders } from 'node:http';

export type PayoutStatus = 'pending' | 'submitted' | 'succeeded' | 'failed';

export type PayoutRecord = {
  id: string;
  circleId: string;
  roundNumber: number;
  creatorId: string;
  recipientUserId: string;
  recipientEmail: string;
  amountMinor: number;
  status: PayoutStatus;
  paypalBatchId: string | null;
  paypalItemId: string | null;
  failureReason: string | null;
};

export interface PayoutRepository {
  findForRound(circleId: string, roundNumber: number): Promise<PayoutRecord | null>;
  create(input: {
    id: string;
    circleId: string;
    roundNumber: number;
    creatorId: string;
    recipientUserId: string;
    recipientEmail: string;
    amountMinor: number;
  }): Promise<PayoutRecord>;
  markSubmitted(
    id: string,
    batchId: string,
    itemId: string | null,
  ): Promise<PayoutRecord | null>;
  markSucceeded(batchId: string, itemId: string | null): Promise<string[]>;
  markFailed(
    batchId: string,
    itemId: string | null,
    reason: string | null,
  ): Promise<void>;
}

export interface PaypalPayouts {
  create(input: {
    requestId: string;
    senderBatchId: string;
    recipientEmail: string;
    amountMinor: number;
  }): Promise<{ batchId: string; itemId: string | null }>;
  verifyWebhook(input: {
    headers: IncomingHttpHeaders;
    event: unknown;
  }): Promise<boolean>;
}

export const PAYOUT_REPOSITORY = Symbol('PAYOUT_REPOSITORY');
export const PAYPAL_PAYOUTS = Symbol('PAYPAL_PAYOUTS');
