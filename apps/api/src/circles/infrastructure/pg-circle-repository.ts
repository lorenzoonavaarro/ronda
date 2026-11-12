import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';

import { PG_POOL } from '../../database/database.module';
import { sameMembers } from '../domain/assign-turns';
import { MEMBERS_REQUIRED_TO_START } from '../domain/circle';
import type {
  AddMemberResult,
  CircleDetailRecord,
  CircleMemberRecord,
  CircleRecord,
  CircleStatus,
} from '../domain/circle';
import type {
  CircleLockResult,
  CircleRepository,
  CircleSettingsResult,
} from '../application/ports';

type CircleRow = {
  id: string;
  name: string;
  monthly_amount_minor: number;
  currency: 'USD';
  status: CircleStatus;
  created_by: string;
  created_at: Date;
  member_count: string;
  members_required: number;
  charge_day: number;
  charges_begin_on: string | null;
  minimum_credit_score: number;
  created_by_display_name: string;
  created_by_username: string;
  invite_token?: string;
};

type MemberRow = {
  user_id: string;
  display_name: string;
  username: string;
  payout_position: number | null;
  joined_at: Date;
  creator: boolean;
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
    inviteToken: string;
    chargeDay: number;
    minimumCreditScore?: number;
  }): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO circles (
           id, name, monthly_amount_minor, currency, status, created_by,
           created_at, invite_token, members_required, charge_day,
           minimum_credit_score
         )
         VALUES ($1, $2, $3, 'USD', 'forming', $4, $5, $6, $7, $8, $9)`,
        [
          input.id,
          input.name,
          input.monthlyAmountMinor,
          input.createdBy,
          input.createdAt,
          input.inviteToken,
          MEMBERS_REQUIRED_TO_START,
          input.chargeDay,
          input.minimumCreditScore ?? 0,
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
              c.created_by, c.created_at, c.members_required, c.charge_day,
              c.minimum_credit_score,
              creator.display_name AS created_by_display_name,
              creator.username AS created_by_username,
              to_char(c.charges_begin_on, 'YYYY-MM-DD') AS charges_begin_on,
              count(m.user_id)::text AS member_count
       FROM circles c
       JOIN users creator ON creator.id = c.created_by
       JOIN circle_members mine
         ON mine.circle_id = c.id AND mine.user_id = $1
       JOIN circle_members m ON m.circle_id = c.id
       GROUP BY c.id, creator.display_name, creator.username
       ORDER BY c.created_at DESC`,
      [userId],
    );

    return result.rows.map((row) => this.toRecord(row));
  }

  async listAll(
    userId: string,
  ): Promise<Array<CircleRecord & { viewerIsMember: boolean }>> {
    const result = await this.pool.query<
      CircleRow & { viewer_is_member: boolean }
    >(
      `SELECT c.id, c.name, c.monthly_amount_minor, c.currency, c.status,
              c.created_by, c.created_at, c.members_required, c.charge_day,
              c.minimum_credit_score,
              creator.display_name AS created_by_display_name,
              creator.username AS created_by_username,
              to_char(c.charges_begin_on, 'YYYY-MM-DD') AS charges_begin_on,
              count(m.user_id)::text AS member_count,
              COALESCE(bool_or(m.user_id = $1), false) AS viewer_is_member
       FROM circles c
       JOIN users creator ON creator.id = c.created_by
       LEFT JOIN circle_members m ON m.circle_id = c.id
       GROUP BY c.id, creator.display_name, creator.username
       HAVING COALESCE(bool_or(m.user_id = $1), false)
           OR (
             c.status = 'forming'
             AND count(m.user_id) < c.members_required
           )
       ORDER BY c.created_at DESC`,
      [userId],
    );

    return result.rows.map((row) => ({
      ...this.toRecord(row),
      viewerIsMember: row.viewer_is_member,
    }));
  }

  async findForMember(
    userId: string,
    circleId: string,
  ): Promise<CircleDetailRecord | null> {
    const result = await this.pool.query<CircleRow>(
      `SELECT c.id, c.name, c.monthly_amount_minor, c.currency, c.status,
              c.created_by, c.created_at, c.invite_token, c.members_required,
              c.charge_day, c.minimum_credit_score,
              creator.display_name AS created_by_display_name,
              creator.username AS created_by_username,
              to_char(c.charges_begin_on, 'YYYY-MM-DD') AS charges_begin_on,
              count(m.user_id)::text AS member_count
       FROM circles c
       JOIN users creator ON creator.id = c.created_by
       JOIN circle_members mine
         ON mine.circle_id = c.id AND mine.user_id = $2
       JOIN circle_members m ON m.circle_id = c.id
       WHERE c.id = $1
       GROUP BY c.id, creator.display_name, creator.username`,
      [circleId, userId],
    );
    const row = result.rows[0];

    if (!row?.invite_token) {
      return null;
    }

    return this.toDetail(row, await this.membersOf(circleId));
  }

  async findByInviteToken(token: string): Promise<CircleDetailRecord | null> {
    const result = await this.pool.query<CircleRow>(
      `SELECT c.id, c.name, c.monthly_amount_minor, c.currency, c.status,
              c.created_by, c.created_at, c.invite_token, c.members_required,
              c.charge_day, c.minimum_credit_score,
              creator.display_name AS created_by_display_name,
              creator.username AS created_by_username,
              to_char(c.charges_begin_on, 'YYYY-MM-DD') AS charges_begin_on,
              count(m.user_id)::text AS member_count
       FROM circles c
       JOIN users creator ON creator.id = c.created_by
       JOIN circle_members m ON m.circle_id = c.id
       WHERE c.invite_token = $1
       GROUP BY c.id, creator.display_name, creator.username`,
      [token],
    );
    const row = result.rows[0];

    if (!row?.invite_token) {
      return null;
    }

    return this.toDetail(row, await this.membersOf(row.id));
  }

  async addMember(
    circleId: string,
    userId: string,
    joinedAt: Date,
  ): Promise<AddMemberResult> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const circle = await client.query<{
        status: CircleStatus;
        members_required: number;
      }>(
        `SELECT status, members_required FROM circles WHERE id = $1 FOR UPDATE`,
        [circleId],
      );
      const row = circle.rows[0];

      if (!row) {
        await client.query('ROLLBACK');
        return 'missing';
      }

      if (row.status !== 'forming') {
        await client.query('ROLLBACK');
        return 'closed';
      }

      const existing = await client.query(
        `SELECT 1 FROM circle_members WHERE circle_id = $1 AND user_id = $2`,
        [circleId, userId],
      );

      if (existing.rowCount) {
        await client.query('ROLLBACK');
        return 'already';
      }

      const count = await client.query<{ member_count: string }>(
        `SELECT count(*)::text AS member_count
         FROM circle_members
         WHERE circle_id = $1`,
        [circleId],
      );

      if (
        Number(count.rows[0]?.member_count ?? 0) >= Number(row.members_required)
      ) {
        await client.query('ROLLBACK');
        return 'full';
      }

      await client.query(
        `INSERT INTO circle_members (circle_id, user_id, payout_position, joined_at)
         VALUES ($1, $2, NULL, $3)`,
        [circleId, userId, joinedAt],
      );
      await client.query('COMMIT');
      return 'joined';
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateSettings(
    circleId: string,
    userId: string,
    input: {
      name: string;
      monthlyAmountMinor: number;
      membersRequired: number;
      minimumCreditScore?: number;
    },
  ): Promise<CircleSettingsResult> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const gate = await this.gate(client, circleId, userId);

      if (gate !== 'creator') {
        await client.query('ROLLBACK');
        return gate === 'already' ? 'locked' : gate;
      }

      const count = await client.query<{ member_count: string }>(
        `SELECT count(*)::text AS member_count
         FROM circle_members
         WHERE circle_id = $1`,
        [circleId],
      );

      if (input.membersRequired < Number(count.rows[0]?.member_count ?? 0)) {
        await client.query('ROLLBACK');
        return 'too_small';
      }

      await client.query(
        `UPDATE circles
         SET name = $2, monthly_amount_minor = $3, members_required = $4,
             minimum_credit_score = $5
         WHERE id = $1`,
        [
          circleId,
          input.name,
          input.monthlyAmountMinor,
          input.membersRequired,
          input.minimumCreditScore ?? 0,
        ],
      );
      await client.query('COMMIT');
      return 'updated';
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async lock(
    circleId: string,
    userId: string,
    orderOf: (userIds: string[]) => string[],
  ): Promise<CircleLockResult> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const gate = await this.gate(client, circleId, userId);

      if (gate !== 'creator') {
        await client.query('ROLLBACK');
        return gate;
      }

      const members = await client.query<{ user_id: string }>(
        `SELECT user_id
         FROM circle_members
         WHERE circle_id = $1
         ORDER BY joined_at ASC, user_id ASC`,
        [circleId],
      );
      const ids = members.rows.map((row) => row.user_id);
      const seats = await client.query<{ members_required: number }>(
        `SELECT members_required FROM circles WHERE id = $1`,
        [circleId],
      );

      if (ids.length !== Number(seats.rows[0]?.members_required)) {
        await client.query('ROLLBACK');
        return 'not_full';
      }

      const ordered = orderOf(ids);

      if (!sameMembers(ids, ordered)) {
        throw new Error('Turn order must include every member once.');
      }

      for (const [index, memberId] of ordered.entries()) {
        await client.query(
          `UPDATE circle_members
           SET payout_position = $3
           WHERE circle_id = $1 AND user_id = $2`,
          [circleId, memberId, index + 1],
        );
      }

      await client.query(`UPDATE circles SET status = 'active' WHERE id = $1`, [
        circleId,
      ]);
      await client.query('COMMIT');
      return 'locked';
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async gate(
    client: PoolClient,
    circleId: string,
    userId: string,
  ): Promise<'creator' | 'missing' | 'forbidden' | 'already'> {
    const circle = await client.query<{
      status: CircleStatus;
      created_by: string;
    }>(`SELECT status, created_by FROM circles WHERE id = $1 FOR UPDATE`, [
      circleId,
    ]);
    const row = circle.rows[0];

    if (!row) {
      return 'missing';
    }

    const member = await client.query(
      `SELECT 1 FROM circle_members WHERE circle_id = $1 AND user_id = $2`,
      [circleId, userId],
    );

    if (!member.rowCount) {
      return 'missing';
    }

    if (row.created_by !== userId) {
      return 'forbidden';
    }

    if (row.status !== 'forming') {
      return 'already';
    }

    return 'creator';
  }

  private async membersOf(circleId: string): Promise<CircleMemberRecord[]> {
    const result = await this.pool.query<MemberRow>(
      `SELECT u.id AS user_id, u.display_name, u.username, m.payout_position,
              m.joined_at, (c.created_by = u.id) AS creator
       FROM circle_members m
       JOIN users u ON u.id = m.user_id
       JOIN circles c ON c.id = m.circle_id
       WHERE m.circle_id = $1
       ORDER BY m.payout_position ASC NULLS LAST, m.joined_at ASC, u.username ASC`,
      [circleId],
    );

    return result.rows.map((row) => ({
      userId: row.user_id,
      displayName: row.display_name,
      username: row.username,
      creator: row.creator,
      payoutPosition: row.payout_position,
      joinedAt: row.joined_at,
    }));
  }

  private toRecord(row: CircleRow): CircleRecord {
    return {
      id: row.id,
      name: row.name,
      monthlyAmountMinor: row.monthly_amount_minor,
      currency: row.currency,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      memberCount: Number(row.member_count),
      membersRequired: Number(row.members_required),
      minimumCreditScore: Number(row.minimum_credit_score),
      createdByDisplayName: row.created_by_display_name,
      createdByUsername: row.created_by_username,
      chargeDay: Number(row.charge_day),
      chargesBeginOn: row.charges_begin_on,
    };
  }

  private toDetail(
    row: CircleRow,
    members: CircleMemberRecord[],
  ): CircleDetailRecord {
    return {
      ...this.toRecord(row),
      inviteToken: row.invite_token ?? '',
      members,
    };
  }
}
