import { Inject, Injectable } from '@nestjs/common';
import type { CreditEventType } from '@repo/api';
import type { Pool, PoolClient } from 'pg';

import { PG_POOL } from '../../database/database.module';
import type {
  CreditMembershipRow,
  CreditRepository,
  StoredCreditEvent,
} from '../application/ports';

type EventRow = {
  circle_id: string;
  circle_name: string;
  round_number: number;
  event_type: CreditEventType;
  points: number;
  occurred_on: string;
};

@Injectable()
export class PgCreditRepository implements CreditRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool | PoolClient) {}

  async insert(input: {
    id: string;
    userId: string;
    circleId: string;
    roundNumber: number;
    eventType: CreditEventType;
    points: number;
  }): Promise<boolean> {
    const result = await this.pool.query(
      `INSERT INTO credit_events (
         id, user_id, circle_id, round_number, event_type, points, occurred_on
       )
       VALUES ($1, $2, $3, $4, $5, $6, (now() AT TIME ZONE 'UTC')::date)
       ON CONFLICT (user_id, circle_id, round_number, event_type) DO NOTHING`,
      [
        input.id,
        input.userId,
        input.circleId,
        input.roundNumber,
        input.eventType,
        input.points,
      ],
    );

    return result.rowCount === 1;
  }

  async membersRequired(circleId: string): Promise<number | null> {
    const result = await this.pool.query<{ members_required: number }>(
      `SELECT members_required FROM circles WHERE id = $1`,
      [circleId],
    );

    return result.rows[0]?.members_required ?? null;
  }

  async eventsForUser(userId: string): Promise<StoredCreditEvent[]> {
    const result = await this.pool.query<EventRow>(
      `SELECT e.circle_id,
              c.name AS circle_name,
              e.round_number,
              e.event_type,
              e.points,
              to_char(e.occurred_on, 'YYYY-MM-DD') AS occurred_on
       FROM credit_events e
       JOIN circles c ON c.id = e.circle_id
       WHERE e.user_id = $1
       ORDER BY e.occurred_on DESC, e.round_number DESC, e.event_type ASC`,
      [userId],
    );

    return result.rows.map((row) => ({
      circleId: row.circle_id,
      circleName: row.circle_name,
      roundNumber: row.round_number,
      eventType: row.event_type,
      points: row.points,
      occurredOn: row.occurred_on,
    }));
  }

  async membershipsForUser(userId: string): Promise<CreditMembershipRow[]> {
    const result = await this.pool.query<{ id: string; name: string }>(
      `SELECT c.id, c.name
       FROM circle_members m
       JOIN circles c ON c.id = m.circle_id
       WHERE m.user_id = $1
       ORDER BY c.name ASC, c.id ASC`,
      [userId],
    );

    return result.rows.map((row) => ({
      circleId: row.id,
      circleName: row.name,
    }));
  }
}
