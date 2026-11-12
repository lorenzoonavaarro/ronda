export type ActivityStatus =
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'completed'
  | 'defaulted';

export type ActivityEntry = {
  occurredOn: string;
  circleId: string;
  circleName: string;
  roundNumber: number | null;
  amountMinor: number | null;
  status: ActivityStatus;
  points: number;
};

export type ActivityMonth = {
  month: string;
  paidMinor: number;
  missedMinor: number;
};

export type ActivityTurnState = 'forming' | 'waiting' | 'received';

export type ActivityTurn = {
  circleId: string;
  circleName: string;
  payoutPosition: number | null;
  currentRound: number | null;
  membersRequired: number;
  state: ActivityTurnState;
};

export type ScorePoint = {
  occurredOn: string;
  points: number;
};

export type ActivityRecord = {
  points: number;
  onTimeCount: number;
  missedCount: number;
  onTimeRate: number | null;
  committedMinor: number;
  paidThisRoundMinor: number;
  months: ActivityMonth[];
  turns: ActivityTurn[];
  entries: ActivityEntry[];
  score: ScorePoint[];
};

export type CircleRoundPayment = {
  username: string;
  displayName: string;
  payoutPosition: number | null;
  status: 'paid' | 'due' | 'not_due' | 'failed' | 'refunded';
};

export type CircleRound = {
  roundNumber: number;
  chargeOn: string;
  payments: CircleRoundPayment[];
};

export type CircleRounds = {
  rounds: CircleRound[];
};
