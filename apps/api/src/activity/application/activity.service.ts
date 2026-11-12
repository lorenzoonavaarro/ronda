import { Injectable } from '@nestjs/common';
import type { ActivityRecord, CircleRounds } from '@repo/api';

import { currentRound } from '../../charges/domain/charge-calendar';
import { buildActivity } from '../domain/build-activity';
import { buildCircleRounds } from '../domain/build-rounds';
import { PgActivityRepository } from '../infrastructure/pg-activity-repository';

@Injectable()
export class ActivityService {
  clock: () => Date = () => new Date();

  constructor(private readonly activity: PgActivityRepository) {}

  async read(userId: string): Promise<ActivityRecord> {
    return buildActivity(await this.activity.load(userId), this.clock());
  }

  async rounds(userId: string, circleId: string): Promise<CircleRounds | null> {
    if (!isUuid(circleId)) {
      return null;
    }

    const circle = await this.activity.circleForMember(userId, circleId);

    if (!circle) {
      return null;
    }

    const round = circle.chargesBeginOn
      ? currentRound(circle.chargesBeginOn, this.clock(), circle.membersRequired)
      : null;

    return buildCircleRounds({
      chargesBeginOn: circle.chargesBeginOn,
      currentRound: round,
      members: circle.members,
      contributions: circle.contributions,
    });
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}
