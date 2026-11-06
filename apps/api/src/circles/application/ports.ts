import type {
  AddMemberResult,
  CircleDetailRecord,
  CircleRecord,
} from '../domain/circle';

export type CircleSettingsResult =
  'updated' | 'missing' | 'forbidden' | 'locked' | 'too_small';

export type CircleLockResult =
  'locked' | 'missing' | 'forbidden' | 'not_full' | 'already';

export interface CircleRepository {
  create(input: {
    id: string;
    name: string;
    monthlyAmountMinor: number;
    createdBy: string;
    createdAt: Date;
    inviteToken: string;
    chargeDay: number;
  }): Promise<void>;
  listForUser(userId: string): Promise<CircleRecord[]>;
  findForMember(
    userId: string,
    circleId: string,
  ): Promise<CircleDetailRecord | null>;
  findByInviteToken(token: string): Promise<CircleDetailRecord | null>;
  addMember(
    circleId: string,
    userId: string,
    joinedAt: Date,
  ): Promise<AddMemberResult>;
  updateSettings(
    circleId: string,
    userId: string,
    input: {
      name: string;
      monthlyAmountMinor: number;
      membersRequired: number;
    },
  ): Promise<CircleSettingsResult>;
  lock(
    circleId: string,
    userId: string,
    orderOf: (userIds: string[]) => string[],
  ): Promise<CircleLockResult>;
}

export const CIRCLE_REPOSITORY = Symbol('CIRCLE_REPOSITORY');
