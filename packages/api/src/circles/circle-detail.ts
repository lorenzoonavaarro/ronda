import type { CircleSummary } from './circle-summary';

export type ContributionStatus =
  'paid' | 'due' | 'not_due' | 'failed' | 'refunded';

export type CircleMember = {
  displayName: string;
  username: string;
  creator: boolean;
  creditScore?: number;
  reputation?:
    | 'top_member'
    | 'trusted_member'
    | 'building_reputation'
    | 'new_member';
  payoutPosition: number | null;
  chargeApproved: boolean;
  contributionStatus: ContributionStatus;
};

export type CircleDetail = CircleSummary & {
  inviteToken: string;
  createdAt: string;
  chargeDay: number;
  chargesBeginOn: string | null;
  potCollectedMinor: number;
  currentRound: number | null;
  viewerChargeApproved: boolean;
  members: CircleMember[];
  yield: {
    status: 'not_earning';
    earnedMinor: null;
    availableMinor: null;
  };
};
