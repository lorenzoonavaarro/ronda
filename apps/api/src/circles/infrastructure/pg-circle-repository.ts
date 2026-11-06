import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';

import { PG_POOL } from '../../database/database.module';
import type { CircleRecord, CircleStatus } from '../domain/circle';
import type { CircleRepository } from '../application/ports';

type CircleRow = {
  id: string;
  name: string;
  monthly_amount_minor: number;
  currency: 'USD';
  status: CircleStatus;
  created_by: string;
  created_at: Date;
  member_count: string;
};

@Injectable()
export class PgCircleRepository implements CircleRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(input: {
    id: string;
    name: string;
    monthlyAmountMinor: number;
    createdBy: string;
    createdAt: Date;
  }): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO circles (
           id, name, monthly_amount_minor, currency, status, created_by, created_at
         )
         VALUES ($1, $2, $3, 'USD', 'forming', $4, $5)`,
        [
          input.id,
          input.name,
          input.monthlyAmountMinor,
          input.createdBy,
          input.createdAt,
        ],
      );
      await client.query(
        `INSERT INTO circle_members (circle_id, user_id, payout_position, joined_at)
         VALUES ($1, $2, NULL, $3)`,
        [input.id, input.createdBy, input.createdAt],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listForUser(userId: string): Promise<CircleRecord[]> {
    const result = await this.pool.query<CircleRow>(
      `SELECT c.id, c.name, c.monthly_amount_minor, c.currency, c.status,
              c.created_by, c.created_at, count(m.user_id)::text AS member_count
       FROM circles c
       JOIN circle_members mine
         ON mine.circle_id = c.id AND mine.user_id = $1
       JOIN circle_members m ON m.circle_id = c.id
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      [userId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      monthlyAmountMinor: row.monthly_amount_minor,
      currency: row.currency,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      memberCount: Number(row.member_count),
    }));
  }
}
