import { Inject, Injectable } from '@nestjs/common';
import type { CreditEventType } from '@repo/api';
import type { Pool } from 'pg';

import { PG_POOL } from '../../database/database.module';
import type {
  ActivityContribution,
  ActivityEvent,
  ActivityMembership,
} from '../domain/build-activity';
import type {
  RoundContribution,
  RoundMember,
} from '../domain/build-rounds';

type EventRow = {
  circle_id: string;
  circle_name: string;
  round_number: number;
  event_type: CreditEventType;
  points: number;
  occurred_on: string;
};

type ContributionRow = {
  circle_id: string;
  round_number: number;
  amount_minor: number;
  status: ActivityContribution['status'];
};

type MembershipRow = {
  id: string;
  name: string;
  status: ActivityMembership['status'];
  monthly_amount_minor: number;
  members_required: number;
  charges_begin_on: string | null;
  payout_position: number | null;
};

type CircleRow = {
  members_required: number;
  charges_begin_on: string | null;
};

type MemberRow = {
  user_id: string;
  username: string;
  display_name: string;
  payout_position: number | null;
};

export type ActivityRows = {
  events: ActivityEvent[];
  contributions: ActivityContribution[];
  memberships: ActivityMembership[];
};

export type CircleRoundRows = {
  membersRequired: number;
  chargesBeginOn: string | null;
  members: RoundMember[];
  contributions: RoundContribution[];
};

@Injectable()
export class PgActivityRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async load(userId: string): Promise<ActivityRows> {
    const [events, contributions, memberships] = await Promise.all([
      this.pool.query<EventRow>(
        `SELECT e.circle_id, c.name AS circle_name, e.round_number, e.event_type,
                e.points, to_char(e.occurred_on, 'YYYY-MM-DD') AS occurred_on
         FROM credit_events e
         JOIN circles c ON c.id = e.circle_id
         WHERE e.user_id = $1`,
        [userId],
      ),
      this.pool.query<ContributionRow>(
        `SELECT circle_id, round_number, amount_minor, status
         FROM contributions
         WHERE user_id = $1`,
        [userId],
      ),
      this.pool.query<MembershipRow>(
        `SELECT c.id, c.name, c.status, c.monthly_amount_minor, c.members_required,
                to_char(c.charges_begin_on, 'YYYY-MM-DD') AS charges_begin_on,
                m.payout_position
         FROM circle_members m
         JOIN circles c ON c.id = m.circle_id
         WHERE m.user_id = $1`,
        [userId],
      ),
    ]);

    return {
      events: events.rows.map((row) => ({
        circleId: row.circle_id,
        circleName: row.circle_name,
        roundNumber: Number(row.round_number),
        eventType: row.event_type,
        points: Number(row.points),
        occurredOn: row.occurred_on,
      })),
      contributions: contributions.rows.map((row) => ({
        circleId: row.circle_id,
        roundNumber: Number(row.round_number),
        amountMinor: Number(row.amount_minor),
        status: row.status,
      })),
      memberships: memberships.rows.map((row) => ({
        circleId: row.id,
        circleName: row.name,
        status: row.status,
        monthlyAmountMinor: Number(row.monthly_amount_minor),
        membersRequired: Number(row.members_required),
        chargesBeginOn: row.charges_begin_on,
        payoutPosition:
          row.payout_position === null ? null : Number(row.payout_position),
      })),
    };
  }

  async circleForMember(
    userId: string,
    circleId: string,
  ): Promise<CircleRoundRows | null> {
    const circle = await this.pool.query<CircleRow>(
      `SELECT c.members_required,
              to_char(c.charges_begin_on, 'YYYY-MM-DD') AS charges_begin_on
       FROM circles c
       JOIN circle_members mine
         ON mine.circle_id = c.id AND mine.user_id = $2
       WHERE c.id = $1`,
      [circleId, userId],
    );
    const row = circle.rows[0];

    if (!row) {
      return null;
    }

    const [members, contributions] = await Promise.all([
      this.pool.query<MemberRow>(
        `SELECT m.user_id, u.username, u.display_name, m.payout_position
         FROM circle_members m
         JOIN users u ON u.id = m.user_id
         WHERE m.circle_id = $1`,
        [circleId],
      ),
      this.pool.query<{
        user_id: string;
        round_number: number;
        status: RoundContribution['status'];
      }>(
        `SELECT user_id, round_number, status
         FROM contributions
         WHERE circle_id = $1`,
        [circleId],
      ),
    ]);

    return {
      membersRequired: Number(row.members_required),
      chargesBeginOn: row.charges_begin_on,
      members: members.rows.map((member) => ({
        userId: member.user_id,
        username: member.username,
        displayName: member.display_name,
        payoutPosition:
          member.payout_position === null
            ? null
            : Number(member.payout_position),
      })),
      contributions: contributions.rows.map((contribution) => ({
        userId: contribution.user_id,
        roundNumber: Number(contribution.round_number),
        status: contribution.status,
      })),
    };
  }
}
