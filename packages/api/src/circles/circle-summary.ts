export type CircleSummary = {
  id: string;
  name: string;
  monthlyAmountMinor: number;
  currency: 'USD';
  status: 'forming' | 'active' | 'completed';
  memberCount: number;
  membersRequired: number;
  viewerIsCreator: boolean;
};
