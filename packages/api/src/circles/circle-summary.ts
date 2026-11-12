export type CircleSummary = {
  id: string;
  name: string;
  monthlyAmountMinor: number;
  currency: 'USD';
  status: 'forming' | 'active' | 'completed';
  memberCount: number;
  membersRequired: number;
  minimumCreditScore?: number;
  createdByDisplayName?: string;
  createdByUsername?: string;
  viewerIsCreator: boolean;
  viewerIsMember: boolean;
};
