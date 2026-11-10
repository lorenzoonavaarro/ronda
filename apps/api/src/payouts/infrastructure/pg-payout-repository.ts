import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';

import { PG_POOL } from '../../database/database.module';
import type {
  PayoutRecord,
  PayoutRepository,
  PayoutStatus,
} from '../application/ports';

type PayoutRow = {
  id: string;
  circle_id: string;
  round_number: number;
  creator_id: string;
  recipient_user_id: string;
  recipient_email: string;
  amount_minor: number;
  status: PayoutStatus;
  paypal_batch_id: string | null;
  paypal_item_id: string | null;
  failure_reason: string | null;
};

@Injectable()
export class PgPayoutRepository implements PayoutRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findForRound(
    circleId: string,
    roundNumber: number,
  ): Promise<PayoutRecord | null> {
    const result = await this.pool.query<PayoutRow>(
      `SELECT id, circle_id, round_number, creator_id, recipient_user_id,
              recipient_email, amount_minor, status, paypal_batch_id,
              paypal_item_id, failure_reason
       FROM payouts
       WHERE circle_id = $1 AND round_number = $2`,
      [circleId, roundNumber],
    );

    return result.rows[0] ? map(result.rows[0]) : null;
  }

  async create(input: {
    id: string;
    circleId: string;
    roundNumber: number;
    creatorId: string;
    recipientUserId: string;
    recipientEmail: string;
    amountMinor: number;
  }): Promise<PayoutRecord> {
    const result = await this.pool.query<PayoutRow>(
      `INSERT INTO payouts (
         id, circle_id, round_number, creator_id, recipient_user_id,
         recipient_email, amount_minor, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       ON CONFLICT (circle_id, round_number) DO NOTHING
       RETURNING id, circle_id, round_number, creator_id, recipient_user_id,
                 recipient_email, amount_minor, status, paypal_batch_id,
                 paypal_item_id, failure_reason`,
      [
        input.id,
        input.circleId,
        input.roundNumber,
        input.creatorId,
        input.recipientUserId,
        input.recipientEmail,
        input.amountMinor,
      ],
    );

    return (
      result.rows[0]
        ? map(result.rows[0])
        : (await this.findForRound(input.circleId, input.roundNumber))!
    );
  }

  async markSubmitted(
    id: string,
    batchId: string,
    itemId: string | null,
  ): Promise<PayoutRecord | null> {
    const result = await this.pool.query<PayoutRow>(
      `UPDATE payouts
       SET status = 'submitted', paypal_batch_id = $2, paypal_item_id = $3
       WHERE id = $1 AND status = 'pending'
       RETURNING id, circle_id, round_number, creator_id, recipient_user_id,
                 recipient_email, amount_minor, status, paypal_batch_id,
                 paypal_item_id, failure_reason`,
      [id, batchId, itemId],
    );

    return result.rows[0] ? map(result.rows[0]) : this.findById(id);
  }

  async markSucceeded(batchId: string, itemId: string | null): Promise<void> {
    await this.pool.query(
      `UPDATE payouts
       SET status = 'succeeded', failure_reason = NULL
       WHERE paypal_batch_id = $1
         AND ($2::text IS NULL OR paypal_item_id = $2)
         AND status <> 'succeeded'`,
      [batchId, itemId],
    );
  }

  async markFailed(
    batchId: string,
    itemId: string | null,
    reason: string | null,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE payouts
       SET status = 'failed', failure_reason = $3
       WHERE paypal_batch_id = $1
         AND ($2::text IS NULL OR paypal_item_id = $2)
         AND status <> 'succeeded'`,
      [batchId, itemId, reason],
    );
  }

  private async findById(id: string): Promise<PayoutRecord | null> {
    const result = await this.pool.query<PayoutRow>(
      `SELECT id, circle_id, round_number, creator_id, recipient_user_id,
              recipient_email, amount_minor, status, paypal_batch_id,
              paypal_item_id, failure_reason
       FROM payouts WHERE id = $1`,
      [id],
    );

    return result.rows[0] ? map(result.rows[0]) : null;
  }
}

function map(row: PayoutRow): PayoutRecord {
  return {
    id: row.id,
    circleId: row.circle_id,
    roundNumber: row.round_number,
    creatorId: row.creator_id,
    recipientUserId: row.recipient_user_id,
    recipientEmail: row.recipient_email,
    amountMinor: row.amount_minor,
    status: row.status,
    paypalBatchId: row.paypal_batch_id,
    paypalItemId: row.paypal_item_id,
    failureReason: row.failure_reason,
  };
}
