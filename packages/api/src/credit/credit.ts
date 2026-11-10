export type CreditEventType =
  | 'contribution_paid'
  | 'contribution_missed'
  | 'circle_completed'
  | 'pot_defaulted';

export type CreditEvent = {
  circleId: string;
  circleName: string;
  roundNumber: number | null;
  eventType: CreditEventType;
  points: number;
  occurredOn: string;
};

export type CreditMembership = {
  circleId: string;
  circleName: string;
  streak: number;
};

export type CreditRecord = {
  points: number;
  memberships: CreditMembership[];
  events: CreditEvent[];
};
