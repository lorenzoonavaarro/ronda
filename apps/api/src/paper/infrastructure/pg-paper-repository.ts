import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';

import { currentRound } from '../../charges/domain/charge-calendar';
import { PG_POOL } from '../../database/database.module';
import {
  paperFreeze,
  paperGrantTarget,
  type ActiveCircleObligation,
} from '../domain/paper-grant';
import {
  averageCostMinor,
  fillBuy,
  fillSell,
  formatShares,
} from '../domain/paper-order';
import { PaperOrderError, fillMessage, freezeMessage } from '../domain/errors';

type CircleRow = {
  id: string;
  monthly_amount_minor: number;
  members_required: number;
  charges_begin_on: string | null;
};

type PositionRow = {
  symbol: string;
  quantity_e4: number;
  cost_basis_minor: number;
};

type OrderRow = {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity_e4: number;
  price_minor: number;
  notional_minor: number;
  created_at: Date;
};

type LedgerRow = {
  id: string;
  kind: 'payout' | 'payout_reversal' | 'buy' | 'sell';
  amount_minor: number;
  description: string;
  created_at: Date;
};

export type StoredPosition = {
  symbol: string;
  quantityE4: number;
  costBasisMinor: number;
};

export type StoredOrder = {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantityE4: number;
  priceMinor: number;
  notionalMinor: number;
  createdAt: Date;
};

export type PaperSnapshot = {
  cashMinor: number;
  grantedMinor: number;
  payoutsReceivedMinor: number;
  obligationsMinor: number;
  bufferMinor: number;
  targetMinor: number;
  freeze:
    | 'missed_contribution'
    | 'reserve_short'
    | 'payout_reversed'
    | null;
  positions: StoredPosition[];
  orders: StoredOrder[];
  ledger: Array<{
    id: string;
    kind: LedgerRow['kind'];
    amountMinor: number;
    description: string;
    createdAt: Date;
  }>;
};

@Injectable()
export class PgPaperRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async sync(userId: string, now: Date): Promise<PaperSnapshot> {
    return this.transaction(userId, async (client) => {
      const account = await this.lockedAccount(client, userId);
      const facts = await this.facts(client, userId, now);
      const granted = applyGrant(account, facts);

      if (granted.cashMinor !== account.cashMinor) {
        await this.saveAccount(client, userId, granted);
      }

      return this.snapshot(client, userId, granted, facts);
    });
  }

  async fill(
    userId: string,
    now: Date,
    order: {
      symbol: string;
      side: 'buy' | 'sell';
      quantityE4: number;
      priceMinor: number;
    },
  ): Promise<{
    symbol: string;
    side: 'buy' | 'sell';
    quantity: string;
    priceMinor: number;
    notionalMinor: number;
  }> {
    return this.transaction(userId, async (client) => {
      const account = await this.lockedAccount(client, userId);
      const facts = await this.facts(client, userId, now);
      const granted = applyGrant(account, facts);
      const freeze = paperFreeze({
        hasMissedContribution: facts.hasMissedContribution,
        hasReversedPayout: facts.hasReversedPayout,
        grantedMinor: granted.grantedMinor,
        targetMinor: facts.targetMinor,
      });

      if (order.side === 'buy' && freeze) {
        throw new PaperOrderError(freezeMessage(freeze), 409);
      }

      const position = await this.position(client, userId, order.symbol);
      const filled =
        order.side === 'buy'
          ? fillBuy({
              cashMinor: granted.cashMinor,
              quantityE4: position?.quantityE4 ?? 0,
              costBasisMinor: position?.costBasisMinor ?? 0,
              buyQuantityE4: order.quantityE4,
              priceMinor: order.priceMinor,
            })
          : fillSell({
              cashMinor: granted.cashMinor,
              quantityE4: position?.quantityE4 ?? 0,
              costBasisMinor: position?.costBasisMinor ?? 0,
              sellQuantityE4: order.quantityE4,
              priceMinor: order.priceMinor,
            });

      if (!filled.ok) {
        throw new PaperOrderError(fillMessage(filled.reason));
      }

      await this.saveAccount(client, userId, {
        cashMinor: filled.cashMinor,
        grantedMinor: granted.grantedMinor,
      });

      const orderId = randomUUID();
      if (filled.closed) {
        await client.query(
          `DELETE FROM paper_positions WHERE user_id = $1 AND symbol = $2`,
          [userId, order.symbol],
        );
      } else {
        await client.query(
          `INSERT INTO paper_positions (
             user_id, symbol, quantity_e4, cost_basis_minor
           )
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, symbol)
           DO UPDATE SET quantity_e4 = EXCLUDED.quantity_e4,
                         cost_basis_minor = EXCLUDED.cost_basis_minor`,
          [userId, order.symbol, filled.quantityE4, filled.costBasisMinor],
        );
      }

      await client.query(
        `INSERT INTO paper_orders (
           id, user_id, symbol, side, quantity_e4, price_minor, notional_minor
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          orderId,
          userId,
          order.symbol,
          order.side,
          order.quantityE4,
          order.priceMinor,
          filled.notionalMinor,
        ],
      );
      await client.query(
        `INSERT INTO paper_cash_ledger (
           id, user_id, event_key, kind, amount_minor, description
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (event_key) DO NOTHING`,
        [
          randomUUID(),
          userId,
          `order:${orderId}`,
          order.side,
          order.side === 'buy' ? -filled.notionalMinor : filled.notionalMinor,
          `${order.side === 'buy' ? 'Bought' : 'Sold'} ${formatShares(order.quantityE4)} ${order.symbol}`,
        ],
      );

      return {
        symbol: order.symbol,
        side: order.side,
        quantity: formatShares(order.quantityE4),
        priceMinor: order.priceMinor,
        notionalMinor: filled.notionalMinor,
      };
    });
  }

  private async transaction<T>(
    userId: string,
    run: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO paper_accounts (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId],
      );
      const grants = await client.query<{ payout_id: string; amount_minor: number }>(
        `SELECT payout_id, amount_minor
         FROM paper_payout_grants
         WHERE user_id = $1`,
        [userId],
      );
      for (const grant of grants.rows) {
        const payout = await client.query<{ status: string }>(
          `SELECT status FROM payouts WHERE id = $1`,
          [grant.payout_id],
        );
        const status = payout.rows[0]?.status;
        if (status === 'succeeded') {
          await client.query(
            `INSERT INTO paper_cash_ledger (
               id, user_id, event_key, kind, amount_minor, description
             )
             VALUES ($1, $2, $3, 'payout', $4, $5)
             ON CONFLICT (event_key) DO NOTHING`,
            [
              randomUUID(),
              userId,
              `payout:${grant.payout_id}`,
              grant.amount_minor,
              'Simulated PayPal payout',
            ],
          );
        } else {
          await client.query(
            `INSERT INTO paper_cash_ledger (
               id, user_id, event_key, kind, amount_minor, description
             )
             VALUES ($1, $2, $3, 'payout_reversal', $4, $5)
             ON CONFLICT (event_key) DO NOTHING`,
            [
              randomUUID(),
              userId,
              `payout-reversal:${grant.payout_id}`,
              -grant.amount_minor,
              'Reversed simulated PayPal payout',
            ],
          );
        }
      }
      const result = await run(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async lockedAccount(
    client: PoolClient,
    userId: string,
  ): Promise<{ cashMinor: number; grantedMinor: number }> {
    const result = await client.query<{
      cash_minor: number;
      granted_minor: number;
    }>(
      `SELECT cash_minor, granted_minor
       FROM paper_accounts
       WHERE user_id = $1
       FOR UPDATE`,
      [userId],
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error('Paper account was not created.');
    }

    return { cashMinor: row.cash_minor, grantedMinor: row.granted_minor };
  }

  private async facts(
    client: PoolClient,
    userId: string,
    now: Date,
  ): Promise<{
    payoutsReceivedMinor: number;
    obligationsMinor: number;
    bufferMinor: number;
    targetMinor: number;
    hasMissedContribution: boolean;
    hasReversedPayout: boolean;
  }> {
    await client.query(
      `INSERT INTO paper_payout_grants (payout_id, user_id, amount_minor)
       SELECT id, recipient_user_id, amount_minor
       FROM payouts
       WHERE recipient_user_id = $1 AND status = 'succeeded'
       ON CONFLICT (payout_id) DO NOTHING`,
      [userId],
    );
    const payouts = await client.query<{ total: number }>(
      `SELECT COALESCE(SUM(amount_minor), 0)::int AS total
       FROM payouts
       WHERE recipient_user_id = $1 AND status = 'succeeded'`,
      [userId],
    );
    const circles = await client.query<CircleRow>(
      `SELECT c.id, c.monthly_amount_minor, c.members_required,
              to_char(c.charges_begin_on, 'YYYY-MM-DD') AS charges_begin_on
       FROM circles c
       JOIN circle_members m ON m.circle_id = c.id AND m.user_id = $1
       WHERE c.status = 'active'`,
      [userId],
    );
    const paid = await client.query<{ circle_id: string; round_number: number }>(
      `SELECT circle_id, round_number
       FROM contributions
       WHERE user_id = $1 AND status = 'paid'`,
      [userId],
    );
    const missed = await client.query<{ missed: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM contributions x
         JOIN circles c ON c.id = x.circle_id
         WHERE x.user_id = $1
           AND c.status = 'active'
           AND x.status = 'failed'
       ) AS missed`,
      [userId],
    );
    const reversed = await client.query<{ reversed: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM paper_payout_grants g
         JOIN payouts p ON p.id = g.payout_id
         WHERE g.user_id = $1 AND p.status <> 'succeeded'
       ) AS reversed`,
      [userId],
    );
    const paidRounds = new Set(
      paid.rows.map((row) => `${row.circle_id}:${row.round_number}`),
    );
    const obligations: ActiveCircleObligation[] = circles.rows.map((row) => {
      const round = row.charges_begin_on
        ? currentRound(row.charges_begin_on, now, row.members_required)
        : null;

      return {
        monthlyAmountMinor: row.monthly_amount_minor,
        membersRequired: row.members_required,
        currentRound: round,
        currentRoundPaid:
          round !== null && paidRounds.has(`${row.id}:${round}`),
      };
    });
    const grant = paperGrantTarget({
      payoutsReceivedMinor: payouts.rows[0]?.total ?? 0,
      circles: obligations,
    });

    return {
      ...grant,
      payoutsReceivedMinor: payouts.rows[0]?.total ?? 0,
      hasMissedContribution: missed.rows[0]?.missed === true,
      hasReversedPayout: reversed.rows[0]?.reversed === true,
    };
  }

  private async position(
    client: PoolClient,
    userId: string,
    symbol: string,
  ): Promise<StoredPosition | null> {
    const result = await client.query<PositionRow>(
      `SELECT symbol, quantity_e4, cost_basis_minor
       FROM paper_positions
       WHERE user_id = $1 AND symbol = $2
       FOR UPDATE`,
      [userId, symbol],
    );
    const row = result.rows[0];

    return row
      ? {
          symbol: row.symbol,
          quantityE4: row.quantity_e4,
          costBasisMinor: row.cost_basis_minor,
        }
      : null;
  }

  private async saveAccount(
    client: PoolClient,
    userId: string,
    account: { cashMinor: number; grantedMinor: number },
  ): Promise<void> {
    await client.query(
      `UPDATE paper_accounts
       SET cash_minor = $2, granted_minor = $3
       WHERE user_id = $1`,
      [userId, account.cashMinor, account.grantedMinor],
    );
  }

  private async snapshot(
    client: PoolClient,
    userId: string,
    account: { cashMinor: number; grantedMinor: number },
    facts: {
      payoutsReceivedMinor: number;
      obligationsMinor: number;
      bufferMinor: number;
      targetMinor: number;
      hasMissedContribution: boolean;
      hasReversedPayout: boolean;
    },
  ): Promise<PaperSnapshot> {
    const positions = await client.query<PositionRow>(
      `SELECT symbol, quantity_e4, cost_basis_minor
       FROM paper_positions
       WHERE user_id = $1
       ORDER BY symbol ASC`,
      [userId],
    );
    const orders = await client.query<OrderRow>(
      `SELECT id, symbol, side, quantity_e4, price_minor, notional_minor,
              created_at
       FROM paper_orders
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 8`,
      [userId],
    );
    const ledger = await client.query<LedgerRow>(
      `SELECT id, kind, amount_minor, description, created_at
       FROM paper_cash_ledger
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 12`,
      [userId],
    );

    return {
      cashMinor: account.cashMinor,
      grantedMinor: account.grantedMinor,
      payoutsReceivedMinor: facts.payoutsReceivedMinor,
      obligationsMinor: facts.obligationsMinor,
      bufferMinor: facts.bufferMinor,
      targetMinor: facts.targetMinor,
      freeze: paperFreeze({
        hasMissedContribution: facts.hasMissedContribution,
        hasReversedPayout: facts.hasReversedPayout,
        grantedMinor: account.grantedMinor,
        targetMinor: facts.targetMinor,
      }),
      positions: positions.rows.map((row) => ({
        symbol: row.symbol,
        quantityE4: row.quantity_e4,
        costBasisMinor: row.cost_basis_minor,
      })),
      orders: orders.rows.map((row) => ({
        id: row.id,
        symbol: row.symbol,
        side: row.side,
        quantityE4: row.quantity_e4,
        priceMinor: row.price_minor,
        notionalMinor: row.notional_minor,
        createdAt: row.created_at,
      })),
      ledger: ledger.rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        amountMinor: row.amount_minor,
        description: row.description,
        createdAt: row.created_at,
      })),
    };
  }

}

function applyGrant(
  account: { cashMinor: number; grantedMinor: number },
  facts: { targetMinor: number },
): { cashMinor: number; grantedMinor: number } {
  const delta = facts.targetMinor - account.grantedMinor;

  if (delta <= 0) {
    return account;
  }

  return {
    cashMinor: account.cashMinor + delta,
    grantedMinor: account.grantedMinor + delta,
  };
}

export function positionQuote(
  position: StoredPosition,
  priceMinor: number | null,
): {
  averageCostMinor: number;
  marketValueMinor: number | null;
  gainMinor: number | null;
} {
  const average = averageCostMinor(position.quantityE4, position.costBasisMinor);

  if (priceMinor === null) {
    return {
      averageCostMinor: average,
      marketValueMinor: null,
      gainMinor: null,
    };
  }

  const marketValueMinor = Math.round(
    (position.quantityE4 * priceMinor) / 10000,
  );

  return {
    averageCostMinor: average,
    marketValueMinor,
    gainMinor: marketValueMinor - position.costBasisMinor,
  };
}
