import type { IncomingHttpHeaders } from 'node:http';

export type StoredContributionStatus =
  'pending' | 'paid' | 'failed' | 'refunded';

export type ContributionRow = {
  id: string;
  circleId: string;
  userId: string;
  roundNumber: number;
  amountMinor: number;
  status: StoredContributionStatus;
  paypalOrderId: string | null;
};

export type LockedCircle = {
  id: string;
  chargeDay: number;
  chargesBeginOn: string | null;
  monthlyAmountMinor: number;
  membersRequired: number;
  memberIds: string[];
};

export interface ChargeRepository {
  lockedCircles(): Promise<LockedCircle[]>;
  approvedAmong(userIds: string[]): Promise<string[]>;
  latestApprovalOn(userIds: string[]): Promise<string | null>;
  setBeginOn(circleId: string, beginOn: string): Promise<void>;
  findContribution(
    circleId: string,
    userId: string,
    roundNumber: number,
  ): Promise<ContributionRow | null>;
  insertPending(input: {
    id: string;
    circleId: string;
    userId: string;
    roundNumber: number;
    amountMinor: number;
  }): Promise<void>;
  saveOrderId(id: string, orderId: string): Promise<void>;
  markFailed(id: string): Promise<void>;
  markPaid(
    id: string,
    captureId: string | null,
    amountMinor: number,
  ): Promise<void>;
  markRefunded(id: string): Promise<void>;
  recordEvent(eventId: string): Promise<boolean>;
  contributionsForRound(
    circleId: string,
    roundNumber: number,
  ): Promise<ContributionRow[]>;
  savePaymentMethod(input: {
    userId: string;
    paymentTokenId: string;
    customerId: string | null;
  }): Promise<void>;
  paymentTokenFor(userId: string): Promise<string | null>;
  isMember(circleId: string, userId: string): Promise<boolean>;
}

export interface PaypalPayments {
  createSetupToken(input: {
    returnUrl: string;
    cancelUrl: string;
    requestId: string;
  }): Promise<{ id: string; approveUrl: string }>;
  createPaymentToken(
    setupTokenId: string,
    requestId: string,
  ): Promise<{ paymentTokenId: string; customerId: string | null }>;
  createVaultOrder(input: {
    requestId: string;
    vaultId: string;
    amount: string;
    customId: string;
  }): Promise<{ orderId: string }>;
  verifyWebhook(input: {
    headers: IncomingHttpHeaders;
    event: unknown;
  }): Promise<boolean>;
}

export const CHARGE_REPOSITORY = Symbol('CHARGE_REPOSITORY');
export const PAYPAL_PAYMENTS = Symbol('PAYPAL_PAYMENTS');
export const CHARGE_READER = Symbol('CHARGE_READER');
