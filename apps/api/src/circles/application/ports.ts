import type { CircleRecord } from '../domain/circle';

export interface CircleRepository {
  create(input: {
    id: string;
    name: string;
    monthlyAmountMinor: number;
    createdBy: string;
    createdAt: Date;
  }): Promise<void>;
  listForUser(userId: string): Promise<CircleRecord[]>;
}

export const CIRCLE_REPOSITORY = Symbol('CIRCLE_REPOSITORY');
