import type { CreditEventType } from '@repo/api';

export type StoredCreditEvent = {
  circleId: string;
  circleName: string;
  roundNumber: number;
  eventType: CreditEventType;
  points: number;
  occurredOn: string;
};

export type CreditMembershipRow = {
  circleId: string;
  circleName: string;
};

export interface CreditRepository {
  insert(input: {
    id: string;
    userId: string;
    circleId: string;
    roundNumber: number;
    eventType: CreditEventType;
    points: number;
  }): Promise<boolean>;
  membersRequired(circleId: string): Promise<number | null>;
  eventsForUser(userId: string): Promise<StoredCreditEvent[]>;
  membershipsForUser(userId: string): Promise<CreditMembershipRow[]>;
}

export interface CreditRecorder {
  recordPaid(input: {
    userId: string;
    circleId: string;
    roundNumber: number;
  }): Promise<void>;
  recordMissed(input: {
    userId: string;
    circleId: string;
    roundNumber: number;
  }): Promise<void>;
}

export interface CreditReader {
  score(userId: string): Promise<number>;
}

export const CREDIT_REPOSITORY = Symbol('CREDIT_REPOSITORY');
export const CREDIT_RECORDER = Symbol('CREDIT_RECORDER');
