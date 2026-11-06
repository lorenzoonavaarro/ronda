import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { CircleSummary } from '@repo/api';

import { MEMBERS_REQUIRED_TO_START } from '../domain/circle';
import { parseCreateCircle } from '../domain/parse-circle-input';
import { CIRCLE_REPOSITORY, type CircleRepository } from './ports';

@Injectable()
export class CirclesService {
  clock: () => Date = () => new Date();

  constructor(
    @Inject(CIRCLE_REPOSITORY) private readonly circles: CircleRepository,
  ) {}

  async create(userId: string, body: unknown): Promise<CircleSummary> {
    const input = parseCreateCircle(body);
    const id = randomUUID();

    await this.circles.create({
      id,
      name: input.name,
      monthlyAmountMinor: input.monthlyAmountMinor,
      createdBy: userId,
      createdAt: this.clock(),
    });

    return {
      id,
      name: input.name,
      monthlyAmountMinor: input.monthlyAmountMinor,
      currency: 'USD',
      status: 'forming',
      memberCount: 1,
      membersRequired: MEMBERS_REQUIRED_TO_START,
    };
  }

  async listForUser(userId: string): Promise<CircleSummary[]> {
    const circles = await this.circles.listForUser(userId);

    return circles.map((circle) => ({
      id: circle.id,
      name: circle.name,
      monthlyAmountMinor: circle.monthlyAmountMinor,
      currency: circle.currency,
      status: circle.status,
      memberCount: circle.memberCount,
      membersRequired: MEMBERS_REQUIRED_TO_START,
    }));
  }
}
