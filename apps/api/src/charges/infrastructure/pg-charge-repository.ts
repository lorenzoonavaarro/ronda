import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';

import { PG_POOL } from '../../database/database.module';
import type {
  ChargeRepository,
  ContributionRow,
  LockedCircle,
  StoredContributionStatus,
} from '../application/ports';

type ContributionRecord = {
  id: string;
  circle_id: string;
  user_id: string;
  round_number: number;
  amount_minor: number;
  status: StoredContributionStatus;
  paypal_order_id: string | null;
};

@Injectable()
export class PgChargeRepository implements ChargeRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async lockedCircles(): Promise<LockedCircle[]> {
    const result = await this.pool.query<{
      id: string;
      charge_day: number;
      charges_begin_on: string | null;
      monthly_amount_minor: number;
      members_required: number;
      member_ids: string[];
    }>(
      `SELECT c.id, c.charge_day,
              to_char(c.charges_begin_on, 'YYYY-MM-DD') AS charges_begin_on,
              c.monthly_amount_minor, c.members_required,
              array_agg(m.user_id) AS member_ids
       FROM circles c
       JOIN circle_members m ON m.circle_id = c.id
       WHERE c.status = 'active'
       GROUP BY c.id`,
    );

    return result.rows.map((row) => ({
      id: row.id,
      chargeDay: Number(row.charge_day),
      chargesBeginOn: row.charges_begin_on,
      monthlyAmountMinor: row.monthly_amount_minor,
      membersRequired: Number(row.members_required),
      memberIds: row.member_ids,
    }));
  }

  async approvedAmong(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) {
      return [];
    }

    const result = await this.pool.query<{ user_id: string }>(
      `SELECT user_id
       FROM paypal_payment_methods
       WHERE user_id = ANY($1::uuid[])`,
      [userIds],
    );

    return result.rows.map((row) => row.user_id);
  }

  async latestApprovalOn(userIds: string[]): Promise<string | null> {
    if (userIds.length === 0) {
      return null;
    }

    const result = await this.pool.query<{ approved_on: string | null }>(
      `SELECT to_char(max(approved_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS approved_on
       FROM paypal_payment_methods
       WHERE user_id = ANY($1::uuid[])
       HAVING count(*) = $2`,
      [userIds, userIds.length],
    );

    return result.rows[0]?.approved_on ?? null;
  }

  async setBeginOn(circleId: string, beginOn: string): Promise<void> {
    await this.pool.query(
      `UPDATE circles
       SET charges_begin_on = $2::date
       WHERE id = $1
         AND status = 'active'
         AND (
           charges_begin_on IS NULL
           OR NOT EXISTS (
             SELECT 1 FROM contributions WHERE circle_id = circles.id
           )
         )`,
      [circleId, beginOn],
    );
  }

  async findContribution(
    circleId: string,
    userId: string,
    roundNumber: number,
  ): Promise<ContributionRow | null> {
    const result = await this.pool.query<ContributionRecord>(
      `SELECT id, circle_id, user_id, round_number, amount_minor, status,
              paypal_order_id
       FROM contributions
       WHERE circle_id = $1 AND user_id = $2 AND round_number = $3`,
      [circleId, userId, roundNumber],
    );

    return result.rows[0] ? mapContribution(result.rows[0]) : null;
  }

  async insertPending(input: {
    id: string;
    circleId: string;
    userId: string;
    roundNumber: number;
    amountMinor: number;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO contributions (
         id, circle_id, user_id, round_number, amount_minor, status
       )
       VALUES ($1, $2, $3, $4, $5, 'pending')
       ON CONFLICT (circle_id, user_id, round_number) DO NOTHING`,
      [
        input.id,
        input.circleId,
        input.userId,
        input.roundNumber,
        input.amountMinor,
      ],
    );
  }

  async saveOrderId(id: string, orderId: string): Promise<void> {
    await this.pool.query(
      `UPDATE contributions
       SET paypal_order_id = $2
       WHERE id = $1 AND paypal_order_id IS NULL`,
      [id, orderId],
    );
  }

  async markFailed(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE contributions
       SET status = 'failed'
       WHERE id = $1 AND status = 'pending'`,
      [id],
    );
  }

  async markPaid(
    id: string,
    captureId: string | null,
    amountMinor: number,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE contributions
       SET status = 'paid', paypal_capture_id = $2, paid_at = now()
       WHERE id = $1
         AND status IN ('pending', 'failed')
         AND amount_minor = $3`,
      [id, captureId, amountMinor],
    );
  }

  async markRefunded(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE contributions
       SET status = 'refunded'
       WHERE id = $1 AND status = 'paid'`,
      [id],
    );
  }

  async recordEvent(eventId: string): Promise<boolean> {
    const result = await this.pool.query(
      `INSERT INTO paypal_webhook_events (id)
       VALUES ($1)
       ON CONFLICT (id) DO NOTHING`,
      [eventId],
    );

    return result.rowCount === 1;
  }

  async contributionsForRound(
    circleId: string,
    roundNumber: number,
  ): Promise<ContributionRow[]> {
    const result = await this.pool.query<ContributionRecord>(
      `SELECT id, circle_id, user_id, round_number, amount_minor, status,
              paypal_order_id
       FROM contributions
       WHERE circle_id = $1 AND round_number = $2`,
      [circleId, roundNumber],
    );

    return result.rows.map(mapContribution);
  }

  async savePaymentMethod(input: {
    userId: string;
    paymentTokenId: string;
    customerId: string | null;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO paypal_payment_methods (
         user_id, payment_token_id, paypal_customer_id, approved_at
       )
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id) DO UPDATE
       SET payment_token_id = EXCLUDED.payment_token_id,
           paypal_customer_id = EXCLUDED.paypal_customer_id,
           approved_at = now()`,
      [input.userId, input.paymentTokenId, input.customerId],
    );
  }

  async paymentTokenFor(userId: string): Promise<string | null> {
    const result = await this.pool.query<{ payment_token_id: string }>(
      `SELECT payment_token_id
       FROM paypal_payment_methods
       WHERE user_id = $1`,
      [userId],
    );

    return result.rows[0]?.payment_token_id ?? null;
  }

  async isMember(circleId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM circle_members WHERE circle_id = $1 AND user_id = $2`,
      [circleId, userId],
    );

    return (result.rowCount ?? 0) > 0;
  }
}

function mapContribution(row: ContributionRecord): ContributionRow {
  return {
    id: row.id,
    circleId: row.circle_id,
    userId: row.user_id,
    roundNumber: row.round_number,
    amountMinor: row.amount_minor,
    status: row.status,
    paypalOrderId: row.paypal_order_id,
  };
}
