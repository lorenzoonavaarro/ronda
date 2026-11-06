export const MIN_CIRCLE_SEATS = 2;
export const MAX_CIRCLE_SEATS = 12;
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
  membersRequired: number;
  chargeDay: number;
  chargesBeginOn: string | null;
};

export type CircleMemberRecord = {
  userId: string;
  displayName: string;
  username: string;
  creator: boolean;
  payoutPosition: number | null;
  joinedAt: Date;
};

export type CircleDetailRecord = CircleRecord & {
  inviteToken: string;
  members: CircleMemberRecord[];
};

export type AddMemberResult =
  'joined' | 'already' | 'full' | 'closed' | 'missing';
