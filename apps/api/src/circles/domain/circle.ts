export const MEMBERS_REQUIRED_TO_START = 6;
export const MIN_MONTHLY_AMOUNT_MINOR = 100;
export const MAX_MONTHLY_AMOUNT_MINOR = 10_000_000;

export type CircleStatus = 'forming' | 'active' | 'completed';

export type CircleRecord = {
  id: string;
  name: string;
  monthlyAmountMinor: number;
  currency: 'USD';
  status: CircleStatus;
  createdBy: string;
  createdAt: Date;
  memberCount: number;
};
