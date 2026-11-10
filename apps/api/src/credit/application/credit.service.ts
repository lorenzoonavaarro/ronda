import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { CreditRecord } from '@repo/api';

import { streakFromRounds } from '../domain/streak';
import {
  CREDIT_REPOSITORY,
  type CreditRecorder,
  type CreditRepository,
} from './ports';

const PAID_POINTS = 10;
const MISSED_POINTS = -15;
const COMPLETED_POINTS = 20;
const DEFAULTED_POINTS = -40;

@Injectable()
export class CreditService implements CreditRecorder {
  constructor(
    @Inject(CREDIT_REPOSITORY) private readonly credit: CreditRepository,
  ) {}

  async recordPaid(input: {
    userId: string;
    circleId: string;
    roundNumber: number;
  }): Promise<void> {
    const inserted = await this.credit.insert({
      id: randomUUID(),
      ...input,
      eventType: 'contribution_paid',
      points: PAID_POINTS,
    });

    if (!inserted) {
      return;
    }

    const required = await this.credit.membersRequired(input.circleId);
    const events = (await this.credit.eventsForUser(input.userId)).filter(
      (event) => event.circleId === input.circleId,
    );
    const paidRounds = new Set(
      events
        .filter((event) => event.eventType === 'contribution_paid')
        .map((event) => event.roundNumber),
    );
    const missed = events.some(
      (event) => event.eventType === 'contribution_missed',
    );

    if (required === null || missed || paidRounds.size !== required) {
      return;
    }

    for (let round = 1; round <= required; round += 1) {
      if (!paidRounds.has(round)) {
        return;
      }
    }

    await this.credit.insert({
      id: randomUUID(),
      userId: input.userId,
      circleId: input.circleId,
      roundNumber: 0,
      eventType: 'circle_completed',
      points: COMPLETED_POINTS,
    });
  }

  async recordMissed(input: {
    userId: string;
    circleId: string;
    roundNumber: number;
  }): Promise<void> {
    await this.credit.insert({
      id: randomUUID(),
      ...input,
      eventType: 'contribution_missed',
      points: MISSED_POINTS,
    });
  }

  async recordPotDefault(input: {
    userId: string;
    circleId: string;
  }): Promise<void> {
    await this.credit.insert({
      id: randomUUID(),
      userId: input.userId,
      circleId: input.circleId,
      roundNumber: 0,
      eventType: 'pot_defaulted',
      points: DEFAULTED_POINTS,
    });
  }

  async read(userId: string): Promise<CreditRecord> {
    const [events, memberships] = await Promise.all([
      this.credit.eventsForUser(userId),
      this.credit.membershipsForUser(userId),
    ]);

    return {
      points: events.reduce((sum, event) => sum + event.points, 0),
      memberships: memberships.map((membership) => ({
        circleId: membership.circleId,
        circleName: membership.circleName,
        streak: streakFromRounds(
          events.filter((event) => event.circleId === membership.circleId),
        ),
      })),
      events: events.map((event) => ({
        circleId: event.circleId,
        circleName: event.circleName,
        roundNumber: event.roundNumber === 0 ? null : event.roundNumber,
        eventType: event.eventType,
        points: event.points,
        occurredOn: event.occurredOn,
      })),
    };
  }
}
