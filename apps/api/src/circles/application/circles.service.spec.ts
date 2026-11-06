import { describe, expect, it } from '@jest/globals';

import { CirclesService } from './circles.service';
import type { CircleRepository } from './ports';
import type { CircleRecord } from '../domain/circle';
import { InvalidCircleInputError } from '../domain/errors';

class MemoryCircles implements CircleRepository {
  readonly rows: CircleRecord[] = [];

  async create(input: {
    id: string;
    name: string;
    monthlyAmountMinor: number;
    createdBy: string;
    createdAt: Date;
  }): Promise<void> {
    this.rows.push({
      ...input,
      currency: 'USD',
      status: 'forming',
      memberCount: 1,
    });
  }

  async listForUser(userId: string): Promise<CircleRecord[]> {
    return this.rows.filter((circle) => circle.createdBy === userId);
  }
}

function createService() {
  const circles = new MemoryCircles();
  const service = new CirclesService(circles);
  return { service, circles };
}

describe('CirclesService', () => {
  it('creates a forming circle with the creator as the only member', async () => {
    const { service } = createService();

    const circle = await service.create('user-1', {
      name: '  Thursday pot  ',
      monthlyAmountMinor: 5000,
    });

    expect(circle).toEqual({
      id: expect.any(String),
      name: 'Thursday pot',
      monthlyAmountMinor: 5000,
      currency: 'USD',
      status: 'forming',
      memberCount: 1,
      membersRequired: 6,
    });
  });

  it('lists only the circles that belong to the caller', async () => {
    const { service } = createService();
    await service.create('user-1', {
      name: 'Mine',
      monthlyAmountMinor: 2000,
    });
    await service.create('user-2', {
      name: 'Theirs',
      monthlyAmountMinor: 2000,
    });

    const circles = await service.listForUser('user-1');

    expect(circles.map((circle) => circle.name)).toEqual(['Mine']);
  });

  it('rejects a blank name and an amount outside $1 to $100,000', async () => {
    const { service } = createService();

    await expect(
      service.create('user-1', { name: '   ', monthlyAmountMinor: 5000 }),
    ).rejects.toBeInstanceOf(InvalidCircleInputError);
    await expect(
      service.create('user-1', { name: 'Pot', monthlyAmountMinor: 99 }),
    ).rejects.toBeInstanceOf(InvalidCircleInputError);
    await expect(
      service.create('user-1', { name: 'Pot', monthlyAmountMinor: 50.5 }),
    ).rejects.toBeInstanceOf(InvalidCircleInputError);
  });
});
